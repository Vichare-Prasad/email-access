// src/services/AutoFetchEmailService.js
// Phase 1: Background email fetching service for CypherEdge integration
// Fetches bank statement PDFs and stores metadata only (no FastAPI processing)

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

const config = require('../config');
const TokenStore = require('../utils/tokenStore');
const { computeFileHash } = require('../utils/fileUtils');
const GmailClient = require('./GmailClient');
const BankDetector = require('./BankDetector');
const PasswordChecker = require('./PasswordChecker');
const AutoFetchDatabase = require('../db/AutoFetchDatabase');
const SettingsManager = require('./SettingsManager');

class AutoFetchEmailService {
  constructor(opts = {}) {
    this.config = config;

    // Use CypherEdge shared paths
    this.tokensPath = opts.tokensPath || config.paths.sharedTokens;
    this.pdfOutputDir = opts.pdfOutputDir || config.paths.autoFetchedPdfs;
    this.settingsPath = opts.settingsPath || config.paths.sharedSettings;

    this.intervalMinutes = opts.intervalMinutes || config.intervalMinutes;
    this.intervalId = null;
    this.isRunning = false;
    this._isScanning = false;

    // Initialize services
    this.tokenStore = new TokenStore(this.tokensPath, config.projectRoot);
    this.gmailClient = new GmailClient(config, this.tokenStore);
    this.bankDetector = new BankDetector();
    this.passwordChecker = new PasswordChecker();
    this.database = new AutoFetchDatabase();
    this.settingsManager = new SettingsManager(this.settingsPath);

    // Settings cache (for backwards compatibility)
    this.settings = null;
  }

  // -------------------------
  // Initialization
  // -------------------------
  async init() {
    console.log('Initializing AutoFetch Email Service...');

    // Create output directory
    await fs.mkdir(this.pdfOutputDir, { recursive: true });
    console.log(`PDF output directory: ${this.pdfOutputDir}`);

    // Initialize database
    await this.database.init();

    // Load settings
    await this.loadSettings();

    console.log('AutoFetch Email Service initialized');
  }

  async loadSettings() {
    try {
      // Use SettingsManager for enhanced settings
      await this.settingsManager.load();
      this.settings = this.settingsManager.getAll();
      console.log('Loaded auto-fetch settings via SettingsManager');
    } catch (e) {
      console.warn('Could not load settings:', e.message);
      this.settings = {
        enabled: true,
        intervalMinutes: this.intervalMinutes,
        scanDays: config.initialScanDays,
        activeAccounts: [],
        lastScanTime: null
      };
    }
  }

  async saveSettings() {
    try {
      await fs.mkdir(path.dirname(this.settingsPath), { recursive: true });
      await fs.writeFile(this.settingsPath, JSON.stringify(this.settings, null, 2));
    } catch (e) {
      console.warn('Could not save settings:', e.message);
    }
  }

  // -------------------------
  // OAuth helpers
  // -------------------------
  getAuthUrl() {
    return this.gmailClient.getAuthUrl();
  }

  async handleOAuthCode(code) {
    const email = await this.gmailClient.handleOAuthCode(code);

    // Add to active accounts if not already present
    if (!this.settings.activeAccounts.includes(email)) {
      this.settings.activeAccounts.push(email);
      await this.saveSettings();
    }

    return email;
  }

  async getActiveAccounts() {
    const { users } = await this.tokenStore.listUsers();
    return Object.keys(users);
  }

  // -------------------------
  // Service lifecycle
  // -------------------------
  async start() {
    console.log('\n========================================');
    console.log('STARTING AUTO-FETCH EMAIL SERVICE');
    console.log('========================================');

    const accounts = await this.getActiveAccounts();

    if (accounts.length === 0) {
      console.log('No authorized Gmail accounts found.');
      console.log('Please authorize at least one account first.');
      return false;
    }

    console.log(`Found ${accounts.length} authorized account(s):`);
    accounts.forEach(email => console.log(`   - ${email}`));

    if (this.isRunning) {
      console.log('Service already running - triggering immediate scan');
      await this.triggerScan();
      return true;
    }

    this.isRunning = true;

    // Perform immediate scan
    console.log('\nPerforming initial scan...');
    await this.triggerScan();

    // Setup periodic scanning
    const intervalMs = Math.max(60 * 1000, (this.intervalMinutes || 30) * 60 * 1000);

    this.intervalId = setInterval(async () => {
      if (!this.isRunning) return;

      if (this._isScanning) {
        console.log('Skipping scheduled scan - previous scan still running');
        return;
      }

      console.log('\n========================================');
      console.log(`SCHEDULED SCAN (every ${this.intervalMinutes} min)`);
      console.log('========================================');

      await this.triggerScan();
    }, intervalMs);

    console.log(`\nService started - scanning every ${this.intervalMinutes} minutes`);
    console.log('========================================\n');

    return true;
  }

  async stop() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    await this.database.close();
    console.log('AutoFetch service stopped');
  }

  // -------------------------
  // Scanning logic
  // -------------------------
  async triggerScan() {
    if (this._isScanning) {
      console.log('Scan already in progress');
      return false;
    }

    this._isScanning = true;
    const startTime = Date.now();

    try {
      const accounts = await this.getActiveAccounts();

      if (accounts.length === 0) {
        console.log('No accounts to scan');
        return false;
      }

      let totalProcessed = 0;
      let totalAttachments = 0;
      let totalBankStatements = 0;

      for (const email of accounts) {
        console.log(`\n--- Scanning: ${email} ---`);

        const result = await this.scanAccount(email);

        totalProcessed += result.processed;
        totalAttachments += result.attachments;
        totalBankStatements += result.bankStatements;
      }

      // Update last scan time
      this.settings.lastScanTime = Date.now();
      await this.saveSettings();

      const duration = Math.round((Date.now() - startTime) / 1000);

      console.log('\n========================================');
      console.log('SCAN COMPLETE');
      console.log('========================================');
      console.log(`   Duration: ${duration}s`);
      console.log(`   Emails processed: ${totalProcessed}`);
      console.log(`   Attachments found: ${totalAttachments}`);
      console.log(`   Bank statements saved: ${totalBankStatements}`);
      console.log('========================================\n');

      return true;

    } catch (err) {
      console.error('Scan error:', err.message);
      return false;
    } finally {
      this._isScanning = false;
    }
  }

  async scanAccount(email) {
    const result = {
      processed: 0,
      attachments: 0,
      bankStatements: 0
    };

    try {
      const client = await this.gmailClient.getClientForEmail(email);

      if (!client) {
        console.error(`Could not get OAuth client for ${email}`);
        return result;
      }

      // Build bank-focused search query
      const query = this.buildBankStatementQuery();
      console.log(`Query: ${query}`);

      const messages = await this.gmailClient.fetchEmails(client, query, 200);

      if (messages.length === 0) {
        console.log('No new emails found');
        return result;
      }

      console.log(`Found ${messages.length} potential bank statement email(s)`);

      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];

        try {
          // Check if already processed
          const isAlreadyFetched = await this.database.isEmailFetched(msg.id);

          if (isAlreadyFetched) {
            continue;
          }

          // Get full message details
          const fullMessage = await this.gmailClient.getMessageDetails(client, msg.id);
          const headers = fullMessage.data.payload.headers || [];

          const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
          const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || 'Unknown';
          const dateHeader = headers.find(h => h.name.toLowerCase() === 'date')?.value;
          const emailDate = dateHeader ? Math.floor(new Date(dateHeader).getTime() / 1000) : null;

          // Pre-filter: Check if likely bank statement email
          if (!this.bankDetector.isBankStatementEmail({ sender: from, subject })) {
            // Skip non-bank emails silently
            continue;
          }

          console.log(`\n[${i + 1}/${messages.length}] ${subject.substring(0, 50)}...`);
          console.log(`   From: ${from.substring(0, 40)}...`);

          // Extract PDF attachments only
          const attachments = await this.extractPdfAttachments(client, msg.id, fullMessage.data.payload);

          if (attachments.length === 0) {
            continue;
          }

          result.processed++;
          console.log(`   Found ${attachments.length} PDF attachment(s)`);

          for (const att of attachments) {
            result.attachments++;

            // Save and process the attachment
            const saveResult = await this.saveAndProcessAttachment({
              attachment: att,
              messageId: msg.id,
              gmailAccount: email,
              emailSubject: subject,
              emailFrom: from,
              emailDate: emailDate
            });

            if (saveResult.success) {
              result.bankStatements++;
            }
          }

          // Mark as read (if incremental scan)
          await this.gmailClient.markAsRead(client, msg.id);

        } catch (msgErr) {
          console.error(`   Error processing message: ${msgErr.message}`);
        }

        // Rate limiting
        if (i > 0 && i % 10 === 0) {
          await new Promise(r => setTimeout(r, 500));
        }
      }

    } catch (err) {
      console.error(`Account scan error for ${email}:`, err.message);
    }

    return result;
  }

  /**
   * Build Gmail search query focused on bank statements
   */
  buildBankStatementQuery() {
    const keywords = config.emailSubjectKeywords || [];
    const domains = this.bankDetector.getKnownBankDomains();

    // Build OR query for subject keywords
    const subjectParts = keywords.map(k => `subject:"${k}"`);

    // Build OR query for sender domains
    const fromParts = domains.slice(0, 10).map(d => `from:@${d}`);

    // Get date filter from settings
    let dateFilter;
    if (this.settingsManager && this.settingsManager.loaded) {
      const dateRange = this.settingsManager.getDateRange();
      dateFilter = dateRange.queryType;
      console.log(`Date range filter: ${dateFilter} (preset: ${this.settings?.dateRangePreset || 'default'})`);
    } else {
      // Fallback to legacy scanDays setting
      const days = this.settings?.scanDays || config.initialScanDays;
      dateFilter = `newer_than:${days}d`;
    }

    // Simplified query that focuses on PDFs with statement-related keywords
    const query = `has:attachment filename:pdf ${dateFilter} (${subjectParts.join(' OR ')} OR ${fromParts.join(' OR ')})`;

    return query;
  }

  /**
   * Extract only PDF attachments from email
   */
  async extractPdfAttachments(client, messageId, payload, attachments = []) {
    const { google } = require('googleapis');
    const gmail = google.gmail({ version: 'v1', auth: client });

    // Check if this part is a PDF attachment
    if (payload.filename && payload.filename.length > 0) {
      const ext = path.extname(payload.filename).toLowerCase();

      if (ext === '.pdf') {
        let attachmentData = null;

        // Get attachment data
        if (payload.body && payload.body.attachmentId) {
          try {
            const attResponse = await gmail.users.messages.attachments.get({
              userId: 'me',
              messageId: messageId,
              id: payload.body.attachmentId
            });

            if (attResponse.data && attResponse.data.data) {
              attachmentData = Buffer.from(attResponse.data.data, 'base64url');
            }
          } catch (attErr) {
            console.error(`   Failed to download: ${attErr.message}`);
          }
        } else if (payload.body && payload.body.data) {
          attachmentData = Buffer.from(payload.body.data, 'base64url');
        }

        if (attachmentData) {
          attachments.push({
            filename: payload.filename,
            mimeType: payload.mimeType,
            size: attachmentData.length,
            data: attachmentData
          });
        }
      }
    }

    // Recursively check parts
    if (payload.parts && Array.isArray(payload.parts)) {
      for (const part of payload.parts) {
        await this.extractPdfAttachments(client, messageId, part, attachments);
      }
    }

    return attachments;
  }

  /**
   * Save attachment and record metadata in database
   */
  async saveAndProcessAttachment({ attachment, messageId, gmailAccount, emailSubject, emailFrom, emailDate }) {
    try {
      // Create account-specific subdirectory
      const accountDir = path.join(this.pdfOutputDir, this.sanitizeEmail(gmailAccount));
      await fs.mkdir(accountDir, { recursive: true });

      // Generate unique filename
      const sanitizedFilename = attachment.filename.replace(/[\\/]/g, '_');
      let targetPath = path.join(accountDir, sanitizedFilename);

      // Handle filename conflicts
      if (fsSync.existsSync(targetPath)) {
        const ext = path.extname(sanitizedFilename);
        const name = path.basename(sanitizedFilename, ext);
        let counter = 1;
        do {
          targetPath = path.join(accountDir, `${name}_${counter}${ext}`);
          counter++;
        } while (fsSync.existsSync(targetPath));
      }

      // Save file
      await fs.writeFile(targetPath, attachment.data);
      console.log(`   Saved: ${path.basename(targetPath)}`);

      // Detect bank from filename and sender
      const bankResult = this.bankDetector.detect({
        filename: attachment.filename,
        sender: emailFrom,
        subject: emailSubject
      });
      console.log(`   Bank: ${bankResult.name} (${bankResult.method})`);

      // Check if password protected
      const passwordResult = await this.passwordChecker.checkPdfProtection(targetPath);
      if (passwordResult.isProtected) {
        console.log(`   Password: Protected`);
      }

      // Get file size
      const stats = await fs.stat(targetPath);

      // Insert into database
      const recordId = await this.database.insertStatement({
        gmailAccount: gmailAccount,
        emailMessageId: messageId,
        emailSubject: emailSubject,
        emailFrom: emailFrom,
        emailDate: emailDate,
        pdfFilename: path.basename(targetPath),
        pdfPath: targetPath,
        pdfSize: stats.size,
        detectedBank: bankResult.name,
        detectionMethod: bankResult.method,
        isPasswordProtected: passwordResult.isProtected
      });

      console.log(`   Record ID: ${recordId}`);

      return {
        success: true,
        recordId: recordId,
        path: targetPath,
        bank: bankResult.name,
        isPasswordProtected: passwordResult.isProtected
      };

    } catch (err) {
      console.error(`   Save error: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Sanitize email for use as directory name
   */
  sanitizeEmail(email) {
    return email.replace(/[^a-zA-Z0-9@._-]/g, '_');
  }

  // -------------------------
  // Stats and info
  // -------------------------
  async getStats() {
    return await this.database.getStats();
  }

  async getStatsByAccount() {
    return await this.database.getStatsByAccount();
  }

  async getPendingStatements() {
    return await this.database.getPendingStatements();
  }

  async getAllStatements(filter = {}) {
    return await this.database.getAllStatements(filter);
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      isScanning: this._isScanning,
      intervalMinutes: this.intervalMinutes,
      lastScanTime: this.settings?.lastScanTime || null,
      pdfOutputDir: this.pdfOutputDir,
      tokensPath: this.tokensPath
    };
  }
}

module.exports = AutoFetchEmailService;
