const EventEmitter = require('events');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;
const cron = require('node-cron');
const { processStatement } = require('./utils/emailProcessor');

class BackgroundEmailService extends EventEmitter {
    constructor() {
        super();
        this.isRunning = false;
        this.db = null;
        this.currentConfig = null;
        this.cronJob = null;
        this.init();
    }

    async init() {
        await this.initDatabase();
        await this.loadConfig();
    }

    async initDatabase() {
        const dbPath = path.join(__dirname, 'storage', 'databases', 'email-service.db');
        const dbDir = path.dirname(dbPath);
        
        await fs.mkdir(dbDir, { recursive: true });
        
        this.db = new sqlite3.Database(dbPath);

        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // Processed emails table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS processed_emails (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        message_id TEXT UNIQUE,
                        subject TEXT,
                        from_email TEXT,
                        received_date DATETIME,
                        processed_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                        has_attachments BOOLEAN DEFAULT false,
                        status TEXT DEFAULT 'processed'
                    )
                `);

                // Email configurations table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS email_configs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id TEXT DEFAULT 'default',
                        email_provider TEXT DEFAULT 'gmail',
                        imap_host TEXT,
                        imap_port INTEGER,
                        email TEXT,
                        app_password TEXT,
                        check_interval INTEGER DEFAULT 3,
                        is_active BOOLEAN DEFAULT true,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // Processed statements table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS processed_statements (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        email_id INTEGER,
                        original_filename TEXT,
                        processed_file_path TEXT,
                        file_size INTEGER,
                        transaction_count INTEGER DEFAULT 0,
                        processing_time_ms INTEGER,
                        status TEXT DEFAULT 'success',
                        error_message TEXT,
                        processed_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(email_id) REFERENCES processed_emails(id)
                    )
                `);

                // Service logs table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS service_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        level TEXT,
                        message TEXT,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `, (err) => {
                    if (err) reject(err);
                    else {
                        console.log('✅ Database initialized');
                        resolve();
                    }
                });
            });
        });
    }

    async loadConfig() {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM email_configs WHERE is_active = true ORDER BY created_at DESC LIMIT 1',
                (err, row) => {
                    if (err) {
                        this.log('error', `Error loading config: ${err.message}`);
                        reject(err);
                    } else {
                        this.currentConfig = row;
                        this.log('info', `Configuration loaded: ${row ? 'Active config found' : 'No active config'}`);
                        resolve(row);
                    }
                }
            );
        });
    }

    async start() {
        if (!this.currentConfig) {
            this.log('warn', 'No email configuration found. Service cannot start.');
            return;
        }

        if (this.isRunning) {
            this.log('warn', 'Service is already running');
            return;
        }

        this.isRunning = true;
        
        // Schedule email checking based on interval
        const intervalMinutes = this.currentConfig.check_interval || 3;
        const cronExpression = `*/${intervalMinutes} * * * *`;
        
        this.cronJob = cron.schedule(cronExpression, () => {
            this.checkEmails();
        }, {
            scheduled: true,
            timezone: "America/New_York"
        });

        // Initial check
        this.checkEmails();

        this.log('info', `Background service started. Checking emails every ${intervalMinutes} minutes`);
        this.emit('service_started');
    }

    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
        }
        this.isRunning = false;
        this.log('info', 'Background service stopped');
        this.emit('service_stopped');
    }

    async checkEmails() {
        if (!this.currentConfig || !this.isRunning) return;

        this.log('info', 'Starting email check cycle');
        
        try {
            const imap = new Imap({
                user: this.currentConfig.email,
                password: this.currentConfig.app_password,
                host: this.currentConfig.imap_host,
                port: this.currentConfig.imap_port,
                tls: true,
                tlsOptions: { rejectUnauthorized: false }
            });

            await this.connectImap(imap);
            const newEmails = await this.processNewEmails(imap);
            imap.end();

            this.log('info', `Email check completed. Processed ${newEmails} new emails`);
            
        } catch (error) {
            this.log('error', `Email check failed: ${error.message}`);
        }
    }

    connectImap(imap) {
        return new Promise((resolve, reject) => {
            imap.once('ready', resolve);
            imap.once('error', reject);
            imap.connect();
        });
    }

    async processNewEmails(imap) {
        return new Promise((resolve, reject) => {
            imap.openBox('INBOX', false, (err, box) => {
                if (err) {
                    reject(err);
                    return;
                }

                // Search for unread emails from last 48 hours
                const sinceDate = new Date();
                sinceDate.setDate(sinceDate.getDate() - 2);

                imap.search(['UNSEEN', ['SINCE', sinceDate.toISOString().split('T')[0]]], async (err, results) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    let processedCount = 0;

                    if (results.length === 0) {
                        resolve(0);
                        return;
                    }

                    const fetch = imap.fetch(results, { bodies: '' });
                    
                    fetch.on('message', async (msg) => {
                        try {
                            const processed = await this.processEmailMessage(msg);
                            if (processed) processedCount++;
                        } catch (error) {
                            this.log('error', `Error processing email: ${error.message}`);
                        }
                    });

                    fetch.once('error', (err) => {
                        this.log('error', `Email fetch error: ${err.message}`);
                        reject(err);
                    });

                    fetch.once('end', () => {
                        resolve(processedCount);
                    });
                });
            });
        });
    }

    async processEmailMessage(msg) {
        return new Promise((resolve, reject) => {
            let emailData = '';
            
            msg.on('body', (stream) => {
                stream.on('data', (chunk) => {
                    emailData += chunk.toString('utf8');
                });
            });

            msg.once('end', async () => {
                try {
                    const parsed = await simpleParser(emailData);
                    const isProcessed = await this.handleParsedEmail(parsed);
                    resolve(isProcessed);
                } catch (error) {
                    reject(error);
                }
            });

            msg.once('error', (err) => {
                reject(err);
            });
        });
    }

    async handleParsedEmail(parsedEmail) {
        const { messageId, subject, from, date, attachments } = parsedEmail;
        
        // Check if this email contains bank statements
        if (!this.isBankStatementEmail(subject, from, attachments)) {
            return false;
        }

        this.log('info', `Processing bank statement email: ${subject}`);

        // Save email to database
        const emailId = await this.saveEmailInfo(parsedEmail);
        
        // Process statement attachments
        let statementProcessed = false;
        
        for (const attachment of attachments) {
            if (this.isStatementAttachment(attachment.filename)) {
                await this.processStatementAttachment(attachment, emailId);
                statementProcessed = true;
            }
        }

        return statementProcessed;
    }

    isBankStatementEmail(subject, from, attachments) {
        if (!attachments || attachments.length === 0) return false;

        const statementKeywords = [
            'statement', 'bank', 'account', 'transaction', 'credit card',
            'account statement', 'e-statement', 'monthly statement',
            'account summary', 'transaction history'
        ];
        
        const subjectLower = subject.toLowerCase();
        const fromLower = from.text.toLowerCase();
        
        const hasStatementKeyword = statementKeywords.some(keyword => 
            subjectLower.includes(keyword) || fromLower.includes(keyword)
        );

        const hasStatementAttachment = attachments.some(attachment => 
            this.isStatementAttachment(attachment.filename)
        );

        return hasStatementKeyword && hasStatementAttachment;
    }

    isStatementAttachment(filename) {
        if (!filename) return false;
        
        const validExtensions = ['.pdf', '.xlsx', '.xls', '.csv', '.xlsm'];
        const fileExt = path.extname(filename).toLowerCase();
        return validExtensions.includes(fileExt);
    }

    async saveEmailInfo(email) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO processed_emails 
                 (message_id, subject, from_email, received_date, has_attachments) 
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    email.messageId,
                    email.subject,
                    email.from.text,
                    email.date,
                    email.attachments && email.attachments.length > 0
                ],
                function(err) {
                    if (err) {
                        // If duplicate, get existing ID
                        if (err.message.includes('UNIQUE constraint failed')) {
                            this.db.get(
                                'SELECT id FROM processed_emails WHERE message_id = ?',
                                [email.messageId],
                                (err, row) => {
                                    if (err) reject(err);
                                    else resolve(row.id);
                                }
                            );
                        } else {
                            reject(err);
                        }
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    async processStatementAttachment(attachment, emailId) {
        const startTime = Date.now();
        
        try {
            // Create attachments directory
            const attachmentsDir = path.join(__dirname, 'storage', 'attachments');
            await fs.mkdir(attachmentsDir, { recursive: true });
            
            // Save attachment file
            const filename = `statement_${emailId}_${Date.now()}_${attachment.filename}`;
            const filePath = path.join(attachmentsDir, filename);
            
            await fs.writeFile(filePath, attachment.content);
            
            this.log('info', `Saved attachment: ${filename} (${attachment.content.length} bytes)`);
            
            // Process with your statement processing logic
            const processingResult = await processStatement(filePath);
            
            // Save processing result
            await this.saveProcessingResult(emailId, attachment.filename, filePath, processingResult, Date.now() - startTime);
            
            // Emit event for real-time notifications
            this.emit('statement_processed', {
                emailId,
                filename: attachment.filename,
                result: processingResult,
                timestamp: new Date()
            });

            return processingResult;
            
        } catch (error) {
            this.log('error', `Error processing attachment ${attachment.filename}: ${error.message}`);
            
            // Save error information
            await this.saveProcessingResult(
                emailId, 
                attachment.filename, 
                null, 
                null, 
                Date.now() - startTime,
                'error',
                error.message
            );
            
            throw error;
        }
    }

    async saveProcessingResult(emailId, originalFilename, filePath, result, processingTime, status = 'success', errorMessage = null) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO processed_statements 
                 (email_id, original_filename, processed_file_path, file_size, transaction_count, processing_time_ms, status, error_message) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    emailId,
                    originalFilename,
                    filePath,
                    result?.fileSize || 0,
                    result?.transactionCount || 0,
                    processingTime,
                    status,
                    errorMessage
                ],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    // Configuration management
    async updateConfig(newConfig) {
        return new Promise((resolve, reject) => {
            // Deactivate all existing configs
            this.db.run(
                'UPDATE email_configs SET is_active = false',
                async (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    // Insert new configuration
                    this.db.run(
                        `INSERT INTO email_configs 
                         (email_provider, imap_host, imap_port, email, app_password, check_interval) 
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [
                            newConfig.emailProvider,
                            newConfig.imapHost,
                            newConfig.imapPort,
                            newConfig.email,
                            newConfig.appPassword,
                            newConfig.checkInterval || 3
                        ],
                        (err) => {
                            if (err) {
                                reject(err);
                            } else {
                                this.currentConfig = newConfig;
                                
                                // Restart service with new config
                                this.stop();
                                setTimeout(() => this.start(), 1000);
                                
                                this.log('info', 'Email configuration updated and service restarted');
                                resolve();
                            }
                        }
                    );
                }
            );
        });
    }

    // Data retrieval methods
    getProcessedStatements(limit = 50, offset = 0) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT ps.*, pe.subject, pe.from_email, pe.received_date
                 FROM processed_statements ps
                 JOIN processed_emails pe ON ps.email_id = pe.id
                 ORDER BY ps.processed_date DESC
                 LIMIT ? OFFSET ?`,
                [limit, offset],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    getServiceStatus() {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT 
                 COUNT(*) as total_emails,
                 COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_processing,
                 COUNT(CASE WHEN status = 'error' THEN 1 END) as failed_processing
                 FROM processed_statements`,
                (err, row) => {
                    if (err) reject(err);
                    else resolve({
                        running: this.isRunning,
                        config: this.currentConfig ? {
                            email: this.currentConfig.email,
                            provider: this.currentConfig.email_provider,
                            checkInterval: this.currentConfig.check_interval
                        } : null,
                        statistics: row
                    });
                }
            );
        });
    }

    // Utility methods
    log(level, message) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`);
        
        // Save to database
        this.db.run(
            'INSERT INTO service_logs (level, message) VALUES (?, ?)',
            [level, message]
        );
    }

    getStatus() {
        return {
            running: this.isRunning,
            config: this.currentConfig,
            lastCheck: new Date()
        };
    }
}

module.exports = { BackgroundEmailService };