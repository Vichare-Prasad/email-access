// src/db/AutoFetchDatabase.js
// Database operations for auto_fetched_statements table
// Writes to CypherEdge's shared database

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs').promises;
const path = require('path');
const config = require('../config');

class AutoFetchDatabase {
  constructor(dbPath = null) {
    this.dbPath = dbPath || config.paths.sharedDb;
    this.db = null;
  }

  /**
   * Initialize database connection and create table if needed
   */
  async init() {
    // Ensure directory exists
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true });

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`Connected to database: ${this.dbPath}`);
          this.createTable().then(resolve).catch(reject);
        }
      });
    });
  }

  /**
   * Create auto_fetched_statements table
   */
  async createTable() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS auto_fetched_statements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        -- Source Information (from Gmail)
        gmail_account TEXT NOT NULL,
        email_message_id TEXT UNIQUE,
        email_subject TEXT,
        email_from TEXT,
        email_date INTEGER,
        fetched_at INTEGER DEFAULT (strftime('%s', 'now')),

        -- PDF Information
        pdf_filename TEXT NOT NULL,
        pdf_path TEXT NOT NULL,
        pdf_size INTEGER,

        -- Detection Results
        detected_bank TEXT,
        detection_method TEXT,
        is_password_protected INTEGER DEFAULT 0,

        -- Processing Status
        status TEXT DEFAULT 'pending',

        -- User Action (filled by Electron UI)
        user_action TEXT,
        target_case_id INTEGER,
        target_case_name TEXT,
        actioned_at INTEGER,

        -- Temporary password (for processing)
        temp_password TEXT,

        -- Error tracking
        error_message TEXT,

        -- Timestamps
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `;

    await this.run(createTableSQL);

    // Create indexes
    await this.run(`CREATE INDEX IF NOT EXISTS idx_afs_status ON auto_fetched_statements(status)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_afs_gmail ON auto_fetched_statements(gmail_account)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_afs_email_id ON auto_fetched_statements(email_message_id)`);

    console.log('auto_fetched_statements table ready');
  }

  /**
   * Helper: Run SQL with promise
   */
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  /**
   * Helper: Get single row
   */
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Helper: Get all rows
   */
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Check if email was already fetched (by message ID)
   */
  async isEmailFetched(emailMessageId) {
    const row = await this.get(
      'SELECT id FROM auto_fetched_statements WHERE email_message_id = ?',
      [emailMessageId]
    );
    return !!row;
  }

  /**
   * Insert a new auto-fetched statement
   */
  async insertStatement({
    gmailAccount,
    emailMessageId,
    emailSubject,
    emailFrom,
    emailDate,
    pdfFilename,
    pdfPath,
    pdfSize,
    detectedBank,
    detectionMethod,
    isPasswordProtected
  }) {
    const status = isPasswordProtected ? 'needs_password' : 'pending';
    const now = Math.floor(Date.now() / 1000);

    const result = await this.run(`
      INSERT INTO auto_fetched_statements (
        gmail_account, email_message_id, email_subject, email_from, email_date,
        pdf_filename, pdf_path, pdf_size,
        detected_bank, detection_method, is_password_protected,
        status, fetched_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      gmailAccount, emailMessageId, emailSubject, emailFrom, emailDate,
      pdfFilename, pdfPath, pdfSize,
      detectedBank, detectionMethod, isPasswordProtected ? 1 : 0,
      status, now, now, now
    ]);

    return result.lastID;
  }

  /**
   * Get pending statements (for UI display)
   */
  async getPendingStatements() {
    return await this.all(`
      SELECT * FROM auto_fetched_statements
      WHERE status IN ('pending', 'needs_password')
      ORDER BY fetched_at DESC
    `);
  }

  /**
   * Get all statements with optional filter
   */
  async getAllStatements(filter = {}) {
    let sql = 'SELECT * FROM auto_fetched_statements WHERE 1=1';
    const params = [];

    if (filter.status) {
      sql += ' AND status = ?';
      params.push(filter.status);
    }

    if (filter.gmailAccount) {
      sql += ' AND gmail_account = ?';
      params.push(filter.gmailAccount);
    }

    sql += ' ORDER BY fetched_at DESC';

    if (filter.limit) {
      sql += ' LIMIT ?';
      params.push(filter.limit);
    }

    return await this.all(sql, params);
  }

  /**
   * Update statement status
   */
  async updateStatus(id, status, errorMessage = null) {
    const now = Math.floor(Date.now() / 1000);
    return await this.run(`
      UPDATE auto_fetched_statements
      SET status = ?, error_message = ?, updated_at = ?
      WHERE id = ?
    `, [status, errorMessage, now, id]);
  }

  /**
   * Mark statement as completed (user took action)
   */
  async markCompleted(id, userAction, targetCaseId = null, targetCaseName = null) {
    const now = Math.floor(Date.now() / 1000);
    return await this.run(`
      UPDATE auto_fetched_statements
      SET status = 'completed',
          user_action = ?,
          target_case_id = ?,
          target_case_name = ?,
          actioned_at = ?,
          updated_at = ?
      WHERE id = ?
    `, [userAction, targetCaseId, targetCaseName, now, now, id]);
  }

  /**
   * Mark statement as deleted
   */
  async markDeleted(id) {
    const now = Math.floor(Date.now() / 1000);
    return await this.run(`
      UPDATE auto_fetched_statements
      SET status = 'deleted', user_action = 'deleted', actioned_at = ?, updated_at = ?
      WHERE id = ?
    `, [now, now, id]);
  }

  /**
   * Store temporary password (after user verification)
   */
  async storePassword(id, password) {
    const now = Math.floor(Date.now() / 1000);
    return await this.run(`
      UPDATE auto_fetched_statements
      SET temp_password = ?, status = 'pending', updated_at = ?
      WHERE id = ?
    `, [password, now, id]);
  }

  /**
   * Get statement by ID
   */
  async getById(id) {
    return await this.get('SELECT * FROM auto_fetched_statements WHERE id = ?', [id]);
  }

  /**
   * Get statistics
   */
  async getStats() {
    const stats = await this.get(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'needs_password' THEN 1 ELSE 0 END) as needs_password,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'deleted' THEN 1 ELSE 0 END) as deleted,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM auto_fetched_statements
    `);
    return stats;
  }

  /**
   * Get statements grouped by Gmail account
   */
  async getStatsByAccount() {
    return await this.all(`
      SELECT
        gmail_account,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'needs_password' THEN 1 ELSE 0 END) as needs_password,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM auto_fetched_statements
      GROUP BY gmail_account
    `);
  }

  /**
   * Close database connection
   */
  close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = AutoFetchDatabase;
