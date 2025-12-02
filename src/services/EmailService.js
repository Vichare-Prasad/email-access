// src/services/EmailService.js
// Core email scanning service - orchestration

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const config = require('../config');
const TokenStore = require('../utils/tokenStore');
const { computeFileHash, splitNameExt, exists, computeHashSafe } = require('../utils/fileUtils');
const GmailClient = require('./GmailClient');
const Classifier = require('./Classifier');
const FastAPIClient = require('./FastAPIClient');

class EmailService {
  constructor(opts = {}) {
    this.config = config;
    this.projectRoot = opts.projectRoot || config.projectRoot;
    this.inputDir = opts.inputDir || config.paths.input;
    this.outputDir = opts.outputDir || config.paths.output;
    this.unprocessedDir = opts.unprocessedDir || config.paths.unprocessed;
    this.rejectedDir = opts.rejectedDir || config.paths.rejected;
    this.dbPath = opts.dbPath || config.paths.emailDb;
    this.usersJsonPath = opts.usersJsonPath || config.paths.usersJson;

    this.intervalMinutes = opts.intervalMinutes || config.intervalMinutes;
    this.intervalId = null;
    this.isRunning = false;
    this._isScanning = false;
    this.db = null;

    // Initialize services
    this.tokenStore = new TokenStore(this.usersJsonPath, this.projectRoot);
    this.gmailClient = new GmailClient(config, this.tokenStore);
    this.classifier = new Classifier(config);
    this.fastApiClient = new FastAPIClient(config);

    this.serverBaseUrl = config.serverBaseUrl;
  }

  // -------------------------
  // Initialization / DB
  // -------------------------
  async createDirectories() {
    await fs.mkdir(this.inputDir, { recursive: true });
    await fs.mkdir(this.outputDir, { recursive: true });
    await fs.mkdir(this.unprocessedDir, { recursive: true });
    await fs.mkdir(this.rejectedDir, { recursive: true });
  }

  async initDatabase() {
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
    this.db = new sqlite3.Database(this.dbPath);
    this.dbRun = (sql, params = []) => new Promise((res, rej) =>
      this.db.run(sql, params, function (err) { if (err) rej(err); else res(this); }));
    this.dbGet = (sql, params = []) => new Promise((res, rej) =>
      this.db.get(sql, params, (err, row) => { if (err) rej(err); else res(row); }));
    this.dbAll = (sql, params = []) => new Promise((res, rej) =>
      this.db.all(sql, params, (err, rows) => { if (err) rej(err); else res(rows); }));

    try {
      await this.dbRun(`CREATE TABLE IF NOT EXISTS emails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT UNIQUE,
        user_email TEXT,
        from_addr TEXT,
        subject TEXT,
        processed_at INTEGER
      )`);
      await this.dbRun(`CREATE TABLE IF NOT EXISTS attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT,
        user_email TEXT,
        filename TEXT,
        path TEXT,
        file_hash TEXT,
        is_bank_statement INTEGER DEFAULT 0,
        classified_at INTEGER,
        UNIQUE(file_hash)
      )`);
      await this.dbRun(`CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)`);

      // Add user_email column if it doesn't exist (for existing databases)
      try {
        await this.dbRun(`ALTER TABLE emails ADD COLUMN user_email TEXT`);
        console.log('Added user_email column to emails table');
      } catch (e) {
        // Column already exists, ignore
      }
      try {
        await this.dbRun(`ALTER TABLE attachments ADD COLUMN user_email TEXT`);
        console.log('Added user_email column to attachments table');
      } catch (e) {
        // Column already exists, ignore
      }
    } catch (err) {
      console.error('DB init error:', err);
    }
  }

  async loadConfig() {
    try {
      const row = await this.dbGet(`SELECT value FROM config WHERE key = ?`, ['intervalMinutes']);
      if (row && row.value) {
        const v = parseInt(row.value, 10);
        if (!isNaN(v)) this.intervalMinutes = v;
      }
    } catch (err) {
      console.warn('loadConfig error (ignoring):', err.message || err);
    }
  }

  // -------------------------
  // Initial-scan flag helpers
  // -------------------------
  async hasDoneInitialScan() {
    try {
      const row = await this.dbGet(`SELECT value FROM config WHERE key = ?`, ['scanned_all_once']);
      return !!(row && row.value === '1');
    } catch (e) {
      console.warn('hasDoneInitialScan db error:', e);
      return false;
    }
  }

  async setInitialScanDone() {
    try {
      await this.dbRun(`INSERT OR REPLACE INTO config (key,value) VALUES (?,?)`, ['scanned_all_once', '1']);
    } catch (e) {
      console.warn('setInitialScanDone error:', e);
    }
  }

  async resetInitialScanFlag() {
    try {
      await this.dbRun(`INSERT OR REPLACE INTO config (key,value) VALUES (?,?)`, ['scanned_all_once', '0']);
      console.log('Reset initial scan flag - next scan will be full');
    } catch (e) {
      console.warn('resetInitialScanFlag error:', e);
    }
  }

  // -------------------------
  // Active user helpers
  // -------------------------
  async getActiveUserEmail() {
    try {
      const row = await this.dbGet(`SELECT value FROM config WHERE key = ?`, ['active_user_email']);
      return row ? row.value : null;
    } catch (e) {
      console.warn('getActiveUserEmail db error:', e);
      return null;
    }
  }

  async setActiveUserByEmail(email) {
    if (!email) return;
    try {
      await this.dbRun(`INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)`, ['active_user_email', email]);
      console.log(`Set active_user_email = ${email}`);
    } catch (e) {
      console.warn('setActiveUserByEmail error:', e);
    }
  }

  // -------------------------
  // OAuth helpers (delegated to GmailClient)
  // -------------------------
  getAuthUrl() {
    return this.gmailClient.getAuthUrl();
  }

  async handleOAuthCode(code) {
    const email = await this.gmailClient.handleOAuthCode(code);
    await this.setActiveUserByEmail(email);
    return email;
  }

  async getOAuthClientForEmail(email) {
    return await this.gmailClient.getClientForEmail(email);
  }

  // -------------------------
  // Startup / scheduling
  // -------------------------
  async init() {
    await this.createDirectories();
    await this.initDatabase();
    await this.loadConfig();
  }

  async start(forceFullScan = false) {
    console.log('\n========================================');
    console.log('STARTING EMAIL SERVICE');
    console.log('========================================');

    const activeEmail = await this.getActiveUserEmail();

    if (!activeEmail) {
      console.log('No active user configured. Please authorize via /auth endpoint.');
      return false;
    }

    console.log(`Active user: ${activeEmail}`);

    // Reset initial scan flag if forcing full scan
    if (forceFullScan) {
      console.log('Force full scan requested - resetting scan flag');
      await this.resetInitialScanFlag();
    }

    // If already running, just trigger immediate scan
    if (this.isRunning) {
      console.log('Service already running - triggering immediate scan');
      await this.triggerImmediateScan();
      return true;
    }

    this.isRunning = true;

    // Perform immediate initial scan
    console.log('Performing immediate initial scan...');
    await this.triggerImmediateScan();

    // Setup periodic scanning
    const intervalMs = Math.max(30 * 1000, (this.intervalMinutes || 2) * 60 * 1000);

    this.intervalId = setInterval(async () => {
      if (!this.isRunning) return;

      if (this._isScanning) {
        console.log('Skipping scheduled run - previous scan still running');
        return;
      }

      console.log('\n========================================');
      console.log(`SCHEDULED SCAN (every ${this.intervalMinutes} min)`);
      console.log('========================================');

      await this.triggerImmediateScan();
    }, intervalMs);

    console.log(`Service started - scanning every ${this.intervalMinutes} minutes`);
    console.log('========================================\n');

    return true;
  }

  async triggerImmediateScan() {
    if (this._isScanning) {
      console.log('Scan already in progress');
      return false;
    }

    this._isScanning = true;

    try {
      const activeEmail = await this.getActiveUserEmail();

      if (!activeEmail) {
        console.log('No active user to scan');
        return false;
      }

      console.log(`\nStarting scan for: ${activeEmail}`);

      await this.checkEmails();

      console.log('\nRunning batch classifier...');
      await this.runBatchClassifier();

      console.log('Scan complete\n');
      return true;

    } catch (err) {
      console.error('Scan error:', err.message);
      return false;
    } finally {
      this._isScanning = false;
    }
  }

  async stop() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('Service stopped');
  }

  // -------------------------
  // Email scanning logic
  // -------------------------
  async checkEmails() {
    const didInitial = await this.hasDoneInitialScan();
    const activeEmail = await this.getActiveUserEmail();

    if (!activeEmail) {
      console.warn('No active user configured');
      return;
    }

    let q;
    if (!didInitial) {
      const scanDays = config.initialScanDays;
      q = `has:attachment newer_than:${scanDays}d`;
      console.log(`INITIAL FULL SCAN - attachments from last ${scanDays} days`);
    } else {
      q = 'has:attachment is:unread';
      console.log('INCREMENTAL SCAN - unread attachments only');
    }

    let client;
    try {
      client = await this.getOAuthClientForEmail(activeEmail);
      if (!client) {
        console.error('Could not create OAuth client - please re-authorize');
        return;
      }
    } catch (e) {
      console.error('OAuth client error:', e.message);
      return;
    }

    try {
      const allMessages = await this.gmailClient.fetchEmails(client, q);

      if (allMessages.length === 0) {
        console.log('No emails found matching criteria');
        if (!didInitial) {
          await this.setInitialScanDone();
        }
        return;
      }

      console.log(`\nProcessing ${allMessages.length} email(s)...`);

      let processedCount = 0;
      let attachmentCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < allMessages.length; i++) {
        const msg = allMessages[i];

        try {
          // Check if already processed
          const existing = await this.dbGet(
            `SELECT id FROM emails WHERE message_id = ?`,
            [msg.id]
          );

          if (existing) {
            skippedCount++;
            continue;
          }

          // Get full message details
          const fullMessage = await this.gmailClient.getMessageDetails(client, msg.id);

          const headers = fullMessage.data.payload.headers || [];
          const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
          const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || 'Unknown';

          console.log(`\n[${i + 1}/${allMessages.length}] ${subject.substring(0, 50)}...`);
          console.log(`   From: ${from.substring(0, 40)}...`);

          // Extract attachments
          const attachments = await this.gmailClient.extractAttachments(client, msg.id, fullMessage.data.payload);

          if (attachments.length > 0) {
            console.log(`   Found ${attachments.length} attachment(s)`);
            console.log(`   User: ${activeEmail}`);

            for (const att of attachments) {
              const saved = await this.saveAttachment(att.data, att.filename, msg.id, activeEmail);
              if (saved) {
                attachmentCount++;
              }
            }
          }

          // Record email as processed (with user_email)
          const now = Math.floor(Date.now() / 1000);
          await this.dbRun(
            `INSERT OR IGNORE INTO emails (message_id, user_email, from_addr, subject, processed_at) VALUES (?, ?, ?, ?, ?)`,
            [msg.id, activeEmail, from, subject, now]
          );

          processedCount++;

          // Mark as read if incremental scan
          if (didInitial) {
            await this.gmailClient.markAsRead(client, msg.id);
          }

        } catch (msgErr) {
          console.error(`   Error processing message: ${msgErr.message}`);
        }

        // Rate limiting
        if (i > 0 && i % 10 === 0) {
          await new Promise(r => setTimeout(r, 500));
        }
      }

      console.log('\n========================================');
      console.log('EMAIL SCAN SUMMARY');
      console.log('========================================');
      console.log(`   Total emails found: ${allMessages.length}`);
      console.log(`   Processed: ${processedCount}`);
      console.log(`   Skipped (already done): ${skippedCount}`);
      console.log(`   Attachments saved: ${attachmentCount}`);
      console.log('========================================\n');

      if (!didInitial) {
        await this.setInitialScanDone();
        console.log('Initial scan completed - future scans will only check unread emails');
      }

    } catch (err) {
      console.error('Gmail API error:', err.message);
      if (err.code === 401 || err.code === 403) {
        console.error('Token may be expired - try re-authorizing via /auth');
      }
    }
  }

  // -------------------------
  // File operations
  // -------------------------
  async computeFileHash(filePath) {
    return computeFileHash(filePath);
  }

  async isFileAlreadySaved(fileHash) {
    try {
      const row = await this.dbGet(`SELECT id FROM attachments WHERE file_hash = ?`, [fileHash]);
      return !!row;
    } catch (err) {
      return false;
    }
  }

  async saveAttachment(fileBuffer, filename, messageId = null, userEmail = null) {
    try {
      await fs.mkdir(this.inputDir, { recursive: true });

      // Sanitize filename - remove path separators
      const sanitizedFilename = filename.replace(/[\\/]/g, '_');

      let target = path.join(this.inputDir, sanitizedFilename);
      if (await exists(target)) {
        const { name, ext } = splitNameExt(sanitizedFilename);
        let i = 1;
        do {
          target = path.join(this.inputDir, `${name}_${i}${ext}`);
          i++;
        } while (await exists(target));
      }

      await fs.writeFile(target, fileBuffer);

      const fileHash = await this.computeFileHash(target);

      if (await this.isFileAlreadySaved(fileHash)) {
        console.log(`  Skipping duplicate: ${sanitizedFilename}`);
        try { await fs.unlink(target); } catch (_) {}
        return false;
      }

      await this.dbRun(
        `INSERT INTO attachments (message_id, user_email, filename, path, file_hash, classified_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [messageId, userEmail, path.basename(target), target, fileHash, null]
      );

      console.log(`  Saved: ${path.basename(target)} [${userEmail}]`);
      return { path: target, fileHash, userEmail };
    } catch (err) {
      console.error('  Save error:', err.message);
      return false;
    }
  }

  // -------------------------
  // Classifier integration
  // -------------------------
  async runBatchClassifier() {
    const result = await this.classifier.classifyFiles(this.inputDir, this.unprocessedDir);

    if (!result.ok || !result.parsed || result.parsed.length === 0) {
      console.log('FastAPI analysis skipped (no results from classifier or main.exe not configured yet)');
      return result;
    }

    // Process results and update DB
    console.log('\nProcessing classification results...');
    let bankStatementCount = 0;
    let duplicateCount = 0;
    let rejectedCount = 0;
    let errorCount = 0;

    for (const obj of result.parsed) {
      try {
        const filePath = obj.file_path || obj.path || null;
        const isBank = !!obj.is_bank_statement || !!obj.is_bank;

        if (!filePath || !fsSync.existsSync(filePath)) {
          console.warn(`  File not found: ${filePath}`);
          errorCount++;
          continue;
        }

        const fileHash = await computeHashSafe(filePath);

        if (!fileHash) {
          console.warn(`  Could not compute hash for: ${path.basename(filePath)}`);
          errorCount++;
          continue;
        }

        if (isBank) {
          const moveResult = await this.ensureUnprocessedPresence(
            fileHash,
            filePath,
            obj.output_path || obj.outputPath || null
          );

          if (moveResult.success) {
            bankStatementCount++;
          } else if (moveResult.reason === 'duplicate') {
            duplicateCount++;
          } else {
            errorCount++;
          }
        } else {
          const rejected = await this.rejectNonBankStatement(filePath);
          if (rejected) {
            rejectedCount++;
          } else {
            errorCount++;
          }
        }
      } catch (e) {
        console.warn('Error processing result:', e.message);
        errorCount++;
      }
    }

    console.log('\nProcessing Summary:');
    console.log(`   Bank statements saved: ${bankStatementCount}`);
    console.log(`   Duplicates rejected: ${duplicateCount}`);
    console.log(`   Non-bank rejected: ${rejectedCount}`);
    if (errorCount > 0) {
      console.log(`   Errors: ${errorCount}`);
    }

    console.log('FastAPI analysis skipped (main.exe not configured yet)');
    return result;
  }

  // -------------------------
  // Duplicate/move operations
  // -------------------------
  async isDuplicateInUnprocessed(fileHash) {
    try {
      const row = await this.dbGet(
        `SELECT id, path FROM attachments WHERE file_hash = ?`,
        [fileHash]
      );
      return row ? row : null;
    } catch (e) {
      console.warn('isDuplicateInUnprocessed error:', e.message);
      return null;
    }
  }

  async isDuplicateByContentInFolder(fileHash) {
    try {
      if (!fsSync.existsSync(this.unprocessedDir)) return null;

      const files = await fs.readdir(this.unprocessedDir);
      for (const file of files) {
        const filePath = path.join(this.unprocessedDir, file);
        try {
          const stat = await fs.stat(filePath);
          if (stat.isFile()) {
            const existingHash = await this.computeFileHash(filePath);
            if (existingHash === fileHash) {
              return { exists: true, path: filePath };
            }
          }
        } catch (e) {
          continue;
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  async ensureUnprocessedPresence(fileHash, sourcePath, outputPath = null) {
    try {
      // Check 1: Check database for duplicate hash
      const existingInDb = await this.isDuplicateInUnprocessed(fileHash);
      if (existingInDb) {
        console.log(`  DUPLICATE DETECTED (DB): ${path.basename(sourcePath)}`);
        console.log(`     Already exists as: ${path.basename(existingInDb.path)}`);
        try {
          await fs.unlink(sourcePath);
          console.log(`  Deleted duplicate: ${path.basename(sourcePath)}`);
        } catch (e) {
          console.warn(`  Could not delete duplicate: ${e.message}`);
        }
        return { success: false, reason: 'duplicate', existingPath: existingInDb.path };
      }

      // Check 2: Scan unprocessed folder for duplicate content
      const existingInFolder = await this.isDuplicateByContentInFolder(fileHash);
      if (existingInFolder) {
        console.log(`  DUPLICATE DETECTED (Folder): ${path.basename(sourcePath)}`);
        console.log(`     Already exists as: ${path.basename(existingInFolder.path)}`);
        try {
          await fs.unlink(sourcePath);
          console.log(`  Deleted duplicate: ${path.basename(sourcePath)}`);
        } catch (e) {
          console.warn(`  Could not delete duplicate: ${e.message}`);
        }
        return { success: false, reason: 'duplicate', existingPath: existingInFolder.path };
      }

      // Determine destination path
      const fileName = path.basename(sourcePath);
      let destPath = outputPath || path.join(this.unprocessedDir, fileName);

      // Handle filename collision
      if (await exists(destPath)) {
        const existingHash = await this.computeFileHash(destPath);
        if (existingHash === fileHash) {
          console.log(`  DUPLICATE DETECTED (Same file): ${path.basename(sourcePath)}`);
          try {
            await fs.unlink(sourcePath);
            console.log(`  Deleted duplicate: ${path.basename(sourcePath)}`);
          } catch (e) {
            console.warn(`  Could not delete duplicate: ${e.message}`);
          }
          return { success: false, reason: 'duplicate', existingPath: destPath };
        }

        const { name, ext } = splitNameExt(fileName);
        let counter = 1;
        do {
          destPath = path.join(this.unprocessedDir, `${name}_${counter}${ext}`);
          counter++;
        } while (await exists(destPath));
      }

      await fs.mkdir(this.unprocessedDir, { recursive: true });

      if (sourcePath !== destPath) {
        await fs.copyFile(sourcePath, destPath);
        console.log(`  Copied to unprocessed: ${path.basename(destPath)}`);
      }

      const now = Math.floor(Date.now() / 1000);
      await this.dbRun(
        `UPDATE attachments SET is_bank_statement = 1, classified_at = ?, path = ? WHERE file_hash = ?`,
        [now, destPath, fileHash]
      );

      if (sourcePath !== destPath && fsSync.existsSync(sourcePath)) {
        try {
          await fs.unlink(sourcePath);
          console.log(`  Removed from input: ${path.basename(sourcePath)}`);
        } catch (e) {
          console.warn(`  Could not remove source file: ${e.message}`);
        }
      }

      return { success: true, destPath };
    } catch (e) {
      console.error('ensureUnprocessedPresence error:', e.message);
      return { success: false, reason: 'error', error: e.message };
    }
  }

  async moveToRejected(filePath, reason = 'unknown') {
    try {
      if (!fsSync.existsSync(filePath)) {
        console.warn(`  File not found for rejection: ${filePath}`);
        return false;
      }

      await fs.mkdir(this.rejectedDir, { recursive: true });

      const fileName = path.basename(filePath);
      const { name, ext } = splitNameExt(fileName);

      let destPath = path.join(this.rejectedDir, `${name}_${reason}${ext}`);

      if (await exists(destPath)) {
        let counter = 1;
        do {
          destPath = path.join(this.rejectedDir, `${name}_${reason}_${counter}${ext}`);
          counter++;
        } while (await exists(destPath));
      }

      await fs.rename(filePath, destPath);
      console.log(`  Rejected: ${path.basename(destPath)} (${reason})`);

      const fileHash = await computeHashSafe(destPath);
      if (fileHash) {
        await this.dbRun(
          `UPDATE attachments SET is_bank_statement = 0, path = ? WHERE file_hash = ?`,
          [destPath, fileHash]
        );
      }

      return destPath;
    } catch (e) {
      console.error('moveToRejected error:', e.message);
      return false;
    }
  }

  async rejectNonBankStatement(filePath) {
    return await this.moveToRejected(filePath, 'not_bank_statement');
  }

  // -------------------------
  // Stats
  // -------------------------
  async getStats() {
    const t = await this.dbGet(`SELECT COUNT(*) AS c FROM attachments`);
    const b = await this.dbGet(`SELECT COUNT(*) AS c FROM attachments WHERE is_bank_statement=1`);

    // Per-user stats
    const perUser = await this.dbAll(`
      SELECT user_email, COUNT(*) as total,
             SUM(CASE WHEN is_bank_statement = 1 THEN 1 ELSE 0 END) as bank
      FROM attachments
      WHERE user_email IS NOT NULL
      GROUP BY user_email
    `);

    return {
      total: t ? t.c : 0,
      bank: b ? b.c : 0,
      perUser: perUser || []
    };
  }

  async getFiles() {
    return await this.dbAll(`SELECT * FROM attachments ORDER BY id DESC LIMIT 200`);
  }

  async getFilesByUser(userEmail) {
    return await this.dbAll(
      `SELECT * FROM attachments WHERE user_email = ? ORDER BY id DESC LIMIT 200`,
      [userEmail]
    );
  }
}

module.exports = EmailService;
