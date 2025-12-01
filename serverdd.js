// proper code started from here//////////////////////////////////////////////////////


require('dotenv').config();
const fs = require('fs').promises;
const fscb = require('fs');
// const path = require('path');
const { exec } = require('child_process');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
// const fs = require("fs");
const path = require("path");
const { google } = require('googleapis');
const express = require('express');
const open = require('open');
const axios = require("axios");
const FormData = require("form-data");
const form = new FormData();
// const util = require('util');
const app = express();
const fsSync = require('fs');
const { inspect } = require('util');

// Import database and data processor
const DatabaseManager = require('./db');
const { processFastAPIResponse } = require('./dataProcessor');

// Minimal stubs for processOpportunityToEarnData function
const log = console;

// Minimal fake db object with very small API used by processOpportunityToEarnData
const stubDb = {
  insert(table) { 
    return {
      values: async (obj) => {
        console.log(`stubDb.insert called for ${table}:`, obj);
        return true;
      }
    };
  },
  delete(table) {
    return {
      where: (condition) => {
        console.log(`stubDb.delete called for ${table}`);
        return Promise.resolve(true);
      }
    };
  }
};

// If you use eq or other query functions from an ORM, add safe no-op replacements:
function stubEq() { return true; }

// Define opportunityToEarn placeholder (table name/identifier)
const opportunityToEarn = "opportunityToEarn";

// Stub function to get or create case (returns a fake case ID)
async function getOrCreateCase(caseName) {
  console.log(`getOrCreateCase stub called for: ${caseName}`);
  return 1; // Return a fake case ID for now
}

async function callMainExeAnalyzeEndpoint_sendJson(pdfPaths, passwords = [], bankNames = [], caseName = "default_case") {
  try {
    if (!Array.isArray(pdfPaths) || pdfPaths.length === 0) {
      throw new Error("pdfPaths must be a non-empty array");
    }

    // Normalize to absolute paths (server must be able to read these)
    const normalizedPaths = pdfPaths.map(p => path.isAbsolute(p) ? p : path.resolve(p));

    // Build arrays for fields that server expects as lists
    const bank_names_arr = bankNames && bankNames.length ? bankNames : normalizedPaths.map(() => "CBI.pdf");
    const passwords_arr = passwords && passwords.length ? passwords : normalizedPaths.map(() => "");

    // IMPORTANT: server expects start_date and end_date as lists (based on your 422).
    // If you only have one date, wrap it in an array.
    const start_date_arr = [""]; // <-- send as list
    const end_date_arr = [""];   // <-- send as list

    // --- simple async function to fetch Category_Master data ---

    

// Call this before creating your payload
    // Put this in server.js (CommonJS style). No need for 'open' or ES modules.
    const sqlite3 = require('sqlite3').verbose();

    function getCategoryMasterData(dbPath = path.join(__dirname, 'db.sqlite3'), tableName = 'Category_Master') {
      return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
          if (err) return reject(err);
        });

        const sql = `SELECT * FROM "${tableName}";`;
        db.all(sql, [], (err, rows) => {
          if (err) {
            db.close(() => {}); // best-effort close
            return reject(err);
          }
          db.close((closeErr) => {
            if (closeErr) return reject(closeErr);
            resolve(rows || []);
          });
        });
      });
    }

const categoryMasterData = await getCategoryMasterData();

  const payload = {
    
    bank_names: ["HDFC"],
    pdf_paths: ["C:\\Users\\abcom\\Desktop\\server_access\\output\\unprocessed\\CBI.pdf"],
    passwords: passwords_arr,
    start_date: start_date_arr,            // array, not string
    end_date: end_date_arr,                // array, not string
    ca_id: "PRASAD_VICHARE-123",
    categoryMasterData: categoryMasterData,                // send array (empty or filled with objects)
    whole_transaction_sheet: [],
    // is_ocr must be an array (one entry per file). use booleans (not strings).
    is_ocr: normalizedPaths.map(() => false)
  };

  console.log("📤 Sending JSON payload to main.exe (FastAPI) ->", {
    files: normalizedPaths.length,
    start_date_type: Array.isArray(payload.start_date) ? "array" : typeof payload.start_date,
    end_date_type: Array.isArray(payload.end_date) ? "array" : typeof payload.end_date,
  });

  const response = await axios.post("http://localhost:7500/analyze-statements/", payload, {
    headers: { "Content-Type": "application/json" },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 30000, // Increased to 120 seconds (2 minutes) for large payloads
  });

  console.log("✅ FastAPI response received:", response.data);
  // =======================
// SAVE FASTAPI RESPONSE TO JSON FILE
// =======================
// === Save raw + parsed inner JSON robust block ===
  

// -----------------------------------------------------
// SAVE FASTAPI RESPONSE — JSON ONLY (RAW + PARSED)
// -----------------------------------------------------
  const outputDir = path.join(__dirname, "output_json");
  if (!fscb.existsSync(outputDir)) fscb.mkdirSync(outputDir, { recursive: true });

  const base = `fastapi_response_${Date.now()}`;

  // 1) SAVE RAW OUTER JSON (always works)
  const rawPath = path.join(outputDir, `${base}_RAW.json`);

  try {
      await fs.writeFile(rawPath, JSON.stringify(response.data, null, 2), "utf8");
      console.log("✅ Saved RAW FastAPI response to:", rawPath);
  } catch (err) {
      console.error("❌ Failed to write RAW.json:", err.message);
  }


  // 2) PARSE INNER JSON STRING
  let inner = response.data?.data;
  let parsed = null;

  if (typeof inner === "string" && inner.trim() !== "") {
      try {
          // Try direct parse
          parsed = JSON.parse(inner);
          console.log("✅ Parsed inner JSON (direct)");
      } catch (err1) {
          console.warn("⚠️ Direct parse failed — trying cleanup");

          // Attempt unescape fixes
          try {
              let cleaned = inner
                  .replace(/\r/g, "")
                  .replace(/\\n/g, "\n")
                  .replace(/\\"/g, '"');

              parsed = JSON.parse(cleaned);
              console.log("✅ Parsed inner JSON after cleanup");
          } catch (err2) {
              console.error("❌ Could NOT parse inner JSON even after cleanup:", err2.message);
          }
      }
  }


  // 3) SAVE PARSED JSON (if parsing succeeded)
  if (parsed) {
      const parsedPath = path.join(outputDir, `${base}_PARSED.json`);

      try {
          await fs.writeFile(parsedPath, JSON.stringify(parsed, null, 2), "utf8");
          console.log("💾 Saved parsed inner JSON to:", parsedPath);
      } catch (err) {
          console.error("❌ Failed to write PARSED.json:", err.message);
      }
  } else {
      console.log("⚠️ Parsed inner JSON = null (not saved). Check RAW.json.");
  }

// =======================
// STORE DATA IN SQLITE DATABASE USING ELECTRON'S SCHEMA
// =======================
  try {
    console.log("🔄 Initializing database connection...");
    
    // Initialize database manager
    const dbManager = DatabaseManager.getInstance();
    const db = await dbManager.initialize(path.join(__dirname, 'db.sqlite3'));
    
    console.log("✅ Database connected successfully");
    
    // Get or create case using ca_id from payload
    const { cases } = require('./schema/Cases');
    const { eq } = require('drizzle-orm');
    
    let caseId;
    const caseName = payload.ca_id; // Use the ca_id from the payload
    
    // Try to find existing case by name
    const existingCase = await db.select().from(cases).where(eq(cases.name, caseName));
    
    if (existingCase.length > 0) {
      caseId = existingCase[0].id;
      console.log(`✅ Found existing case: ${caseName} (ID: ${caseId})`);
    } else {
      // Create new case
      const newCase = await db.insert(cases).values({
        name: caseName,
        userId: 1, // Default user ID - you can make this configurable
        status: 'Processing',
        pages: 0,
        createdAt: new Date(),
        deleted: 0,
      }).returning();
      
      caseId = newCase[0].id;
      console.log(`✅ Created new case: ${caseName} (ID: ${caseId})`);
    }
    
    // Build file details array matching the format expected by the processor
    const fileDetails = normalizedPaths.map((pdfPath, index) => ({
      pdf_paths: pdfPath,
      bankName: bank_names_arr[index],
      accountNumber: response.data.ner_results?.['Acc Number']?.[index] || null,
      customerName: response.data.ner_results?.['Name']?.[index] || null,
      ifscCode: null,
    }));
    
    // Process and store the FastAPI response using the same logic as reportHandlers.js
    const result = await processFastAPIResponse(db, response.data, caseId, fileDetails);
    
    console.log("✅ Successfully stored analysis data in db.sqlite3:", result);
  } catch (dbError) {
    console.error("❌ Failed to store data in database:", dbError.message);
    console.error(dbError.stack);
    // Continue execution even if DB storage fails
  }

// =======================

  // ✅ Extract the section returned by FastAPI
  const opportunityToEarnData = response.data?.opportunity_to_earn;

  // ✅ Call your existing function without changing ANY logic
  await processOpportunityToEarnData(opportunityToEarnData, caseName);

  console.log("📌 Opportunity To Earn processing completed");

  } catch (error) {
  console.error("❌ Error calling FastAPI endpoint:", error.message);

  if (error.response) {
    console.error("  ↳ Status:", error.response.status);
    try { console.error("  ↳ Body:", JSON.stringify(error.response.data, null, 2)); } catch(e){}
  } else if (error.request) {
    console.error("  ↳ No response received. Request config:", error.request);
  } else {
    console.error("  ↳ Axios config / setup error:", error.config || "(no config)");
  }
  console.error("  ↳ Full error:", error);
  throw error;
}}








  // Replace the broken processCase with this
  async function processCase(caseId, status = "Failed") {
  try {
  // If you have an updateCaseStatus function, call it; otherwise this stub updates nothing.
  if (typeof updateCaseStatus === "function") {
    await updateCaseStatus(caseId, status);
    return true;
  }

  // Fallback behaviour: attempt to use a DB helper if present (svc or global db)
  if (typeof svc !== "undefined" && svc && typeof svc.dbRun === "function") {
    await svc.dbRun(`UPDATE cases SET status = ?, updatedAt = ? WHERE id = ?`, [
      status,
      new Date().toISOString(),
      caseId,
    ]);
    console.log(`Updated case ${caseId} to status ${status}`);
    return true;
  }

  // If nothing exists, just log
  console.warn("processCase: update function not found; called with", { caseId, status });
  return false;
  } catch (error) {
  console.error(`processCase failed for case ${caseId}:`, error);
  throw error;
  }
  }


  // --- Existing function to process Opportunity to Earn data ---  

  const processOpportunityToEarnData = async (
  opportunityToEarnData,
  caseName
  ) => {
  log.info("Processing opportunity to earn data for case:", caseName);
  try {
    // Get the case ID for this specific report
    const validCaseId = await getOrCreateCase(caseName);

    await stubDb
      .delete(opportunityToEarn)
      .where(stubEq(opportunityToEarn.caseId, validCaseId));

    // Extract the array from the object
    const opportunityToEarnArray = Array.isArray(opportunityToEarnData)
      ? opportunityToEarnData
      : (opportunityToEarnData && opportunityToEarnData["Opportunity to Earn"]) || null;

    if (!opportunityToEarnArray || opportunityToEarnArray.length === 0) {
      log.warn("No Opportunity to Earn data found");
      return false;
    }

    // Initialize sums for each category
    let homeLoanValue = 0;
    let loanAgainstProperty = 0;
    let businessLoan = 0;
    let termPlan = 0;
    let generalInsurance = 0;

    // Loop through each product and categorize the amount correctly
    for (const item of opportunityToEarnArray) {
      const product = item["Product"];
      const amount = parseFloat(item["Amount"]) || 0;

      if (!isNaN(amount)) {
        if (product.includes("Home Loan")) {
          homeLoanValue += amount;
        } else if (product.includes("Loan Against Property")) {
          loanAgainstProperty += amount;
        } else if (product.includes("Business Loan")) {
          businessLoan += amount;
        } else if (product.includes("Term Plan")) {
          termPlan += amount;
        } else if (product.includes("General Insurance")) {
          generalInsurance += amount;
        }
      }
    }

  // Always insert a new record to append the data
    await stubDb.insert(opportunityToEarn).values({
      caseId: validCaseId,
      homeLoanValue,
      loanAgainstProperty,
      businessLoan,
      termPlan,
      generalInsurance,
    });

    log.info(`New opportunity to earn data appended for case ${validCaseId}`);
    return true;
  } catch (error) {
    log.error("Error processing opportunity to earn data:", error);
    throw error;
  }
  };

    



// -- Insert this helper in your file (near other helpers) --
async function handleFastApiResult(fastApiResult, {
  caseId = null,
  caseName = 'unknown',
  tmpdir_path = './tmp'
} = {}) {
  // local sanitize (reuse if you like)
  function sanitizeJSONString(jsonString) {
    if (!jsonString) return jsonString;
    if (typeof jsonString !== "string") return jsonString;
    return jsonString
      .replace(/: *NaN/g, ": null")
      .replace(/: *undefined/g, ": null")
      .replace(/: *Infinity/g, ": null")
      .replace(/: *-Infinity/g, ": null");
  }

  try {
    // Normalize where actual parsed payload may live
    const rawJsonStr = fastApiResult?.data?.data ?? fastApiResult?.data ?? fastApiResult ?? "{}";

    let parsedData;
    try {
      // If it's already an object, keep it
      parsedData = (typeof rawJsonStr === 'string')
        ? JSON.parse(sanitizeJSONString(rawJsonStr || "{}"))
        : rawJsonStr;
    } catch (e) {
      parsedData = null;
    }

    // If parsing failed -> mark case failed and bail out
    if (parsedData == null) {
      log && log.info && log.info("Parsed data is null, Statement Failed");

      if (caseId) {
        try {
          // mark Failed (fix: use 'Failed' not 'success')
          await processCase(caseId, "Failed");
        } catch (e) {
          console.error('processCase failed', e);
        }
      }

      try {
        const failedPDFsDir = path.join(tmpdir_path, "failed_pdfs", caseName);
        fscb.mkdirSync(failedPDFsDir, { recursive: true });
      } catch (e) {
        console.error("Failed to create failed_pdfs dir:", e);
      }

      return {
        success: false,
        reason: "parsedData_null",
        failedStatements: fastApiResult?.data?.["pdf_paths_not_extracted"] || null,
        parsedData: null
      };
    }

    // ----------------- clean & filter transactions -----------------
    const rawTransactions = Array.isArray(parsedData.Transactions) ? parsedData.Transactions : [];

    const transactions_temp = rawTransactions.filter((transaction_temp) => {
      if (typeof transaction_temp.Credit === "number" && isNaN(transaction_temp.Credit)) {
        transaction_temp.Credit = null;
      }
      if (typeof transaction_temp.Debit === "number" && isNaN(transaction_temp.Debit)) {
        transaction_temp.Debit = null;
      }
      if (typeof transaction_temp.Balance === "number" && isNaN(transaction_temp.Balance)) {
        transaction_temp.Balance = 0;
      }

      return (
        (transaction_temp.Credit !== null && !isNaN(transaction_temp.Credit)) ||
        (transaction_temp.Debit !== null && !isNaN(transaction_temp.Debit))
      );
    });

    parsedData.Transactions = transactions_temp;
    parsedData._totalTransactions = transactions_temp.length;

    // Build result/fileDetails safely
    const result =
      parsedData.result ||
      parsedData.file_details ||
      parsedData.files ||
      parsedData.FileDetails ||
      [];

    const fileDetails = (Array.isArray(result) ? result : []).map((fileDetail) => {
      return {
        end_date: fileDetail.endDate || "",
        start_date: fileDetail.startDate || "",
        pdf_paths: fileDetail.path || fileDetail.pdf_paths || fileDetail.pdfPath || "",
        bankName: (fileDetail.bankName || "").toString().replace(/\d/g, ""),
        passwords: fileDetail.password || ""
      };
    });

    // Return the parsed object plus things the rest of your code expects
    return {
      success: true,
      parsedData,
      transactions_temp,
      fileDetails,
      rawFastApiResult: fastApiResult
    };
  } catch (e) {
    console.error("handleFastApiResult error:", e);
    throw e;
  }
}



class EmailService {
  constructor(opts = {}) {
    this.projectRoot = opts.projectRoot || path.resolve(__dirname);
    this.inputDir = opts.inputDir || path.join(this.projectRoot, 'input');
    this.outputDir = opts.outputDir || path.join(this.projectRoot, 'output');
    this.unprocessedDir = opts.unprocessedDir || path.join(this.outputDir, 'unprocessed');
    this.rejectedDir = opts.rejectedDir || path.join(this.outputDir, 'rejected');
    this.dbPath = opts.dbPath || path.join(this.outputDir, 'email.db');

    this.intervalMinutes = opts.intervalMinutes || 0.033;
    this.intervalId = null;
    this.isRunning = false;
    this._isScanning = false;
    this.db = null;

    // OAuth config
    this.oauthScopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email',
      'openid'
    ];

    // Load credentials from credentials.json file
    const creds = this._loadCredentialsFromFile();
    this.googleClientId = creds.clientId;
    this.googleClientSecret = creds.clientSecret;
    this.oauthRedirectUri = creds.redirectUri;


    this.serverBaseUrl = process.env.SERVER_BASE_URL || `http://localhost:${process.env.PORT || 8234}`;
    this.usersJsonPath = path.join(this.outputDir, 'users.json');
  }

  // Load OAuth credentials from credentials.json file
  _loadCredentialsFromFile() {
    const credentialsPath = path.join(this.projectRoot || __dirname, 'credentials.json');
    try {
      if (fsSync.existsSync(credentialsPath)) {
        const content = fsSync.readFileSync(credentialsPath, 'utf8');
        const json = JSON.parse(content);

        // Handle both "web" and "installed" credential types
        const creds = json.web || json.installed || json;

        if (creds.client_id && creds.client_secret) {
          console.log('✅ Loaded credentials from credentials.json');
          console.log(`   Client ID: ${creds.client_id.substring(0, 20)}...`);

          // Extract redirect URI from credentials if available
          let redirectUri = null;
          if (creds.redirect_uris && creds.redirect_uris.length > 0) {
            redirectUri = creds.redirect_uris[0];
            console.log(`   Redirect URI: ${redirectUri}`);
          }

          return {
            clientId: creds.client_id,
            clientSecret: creds.client_secret,
            redirectUri: redirectUri
          };
        }
      }

      console.warn('⚠️  credentials.json not found, using fallback');
      return {
        clientId: process.env.GOOGLE_CLIENT_ID || '1016771744014-sflkvg8o041amjd34st7ge8sekpttorl.apps.googleusercontent.com',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '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',
        redirectUri: null
      };
    } catch (e) {
      console.error('❌ Error loading credentials.json:', e.message);
      return {
        clientId: process.env.GOOGLE_CLIENT_ID || '1016771744014-sflkvg8o041amjd34st7ge8sekpttorl.apps.googleusercontent.com',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirectUri: null
      };
    }
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
        from_addr TEXT, 
        subject TEXT,
        processed_at INTEGER
      )`); 
      await this.dbRun(`CREATE TABLE IF NOT EXISTS attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT,
        filename TEXT,
        path TEXT,
        file_hash TEXT,
        is_bank_statement INTEGER DEFAULT 0,
        classified_at INTEGER,
        UNIQUE(file_hash)
      )`);
      await this.dbRun(`CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)`);
      
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
      console.log('✅ Reset initial scan flag - next scan will be full');
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
      console.log(`✅ Set active_user_email = ${email}`);
    } catch (e) {
      console.warn('setActiveUserByEmail error:', e);
    }
  }

  // -------------------------
  // OAuth helpers
  // -------------------------
  _ensureOAuthConfig() {
    if (!this.googleClientId || !this.googleClientSecret) {
      throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables');
    }
  }

  _createOAuth2Client() {
    this._ensureOAuthConfig();
    // Use redirect URI from credentials.json if available, otherwise use default
    const redirectUri = this.oauthRedirectUri || `${this.serverBaseUrl}/oauth/callback`;
    console.log(`   Using redirect URI: ${redirectUri}`);
    return new google.auth.OAuth2(this.googleClientId, this.googleClientSecret, redirectUri);
  }

  getAuthUrl() {
    const oAuth2Client = this._createOAuth2Client();
    return oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: this.oauthScopes
    });
  }

  async _persistUserTokens(email, tokens) {
    try {
      // Ensure output directory exists
      await fs.mkdir(this.outputDir, { recursive: true });

      let existing = {};
      
      // Try to read existing users.json, create if doesn't exist
      try {
        if (fscb.existsSync(this.usersJsonPath)) {
          const txt = await fs.readFile(this.usersJsonPath, 'utf8');
          existing = JSON.parse(txt || '{}');
          console.log('📖 Read existing users.json');
        } else {
          console.log('📝 users.json not found - will create new file');
        }
      } catch (e) {
        console.warn('⚠️  Could not read users.json (will create new):', e.message);
        existing = {};
      }

      // Add/update user tokens
      existing[email] = {
        email,
        saved_at: new Date().toISOString(),
        refresh_token: tokens.refresh_token || null,
        access_token: tokens.access_token || null,
        expiry_date: tokens.expiry_date || null,
        token_type: tokens.token_type || 'Bearer',
        scope: tokens.scope || null
      };

      // Write to file with error handling
      try {
        await fs.writeFile(this.usersJsonPath, JSON.stringify(existing, null, 2), 'utf8');
        console.log(`✅ Saved tokens to: ${this.usersJsonPath}`);
        
        // Verify file was created
        if (fscb.existsSync(this.usersJsonPath)) {
          const fileSize = fscb.statSync(this.usersJsonPath).size;
          console.log(`✅ File verified: ${fileSize} bytes`);
        } else {
          throw new Error('File was not created');
        }
      } catch (writeError) {
        console.error('❌ Failed to write users.json:', writeError.message);
        
        // Try alternative path in project root as backup
        const backupPath = path.join(this.projectRoot, 'users_backup.json');
        console.log(`🔄 Attempting backup save to: ${backupPath}`);
        
        try {
          await fs.writeFile(backupPath, JSON.stringify(existing, null, 2), 'utf8');
          console.log(`✅ Saved to backup location: ${backupPath}`);
          this.usersJsonPath = backupPath; // Update path
        } catch (backupError) {
          console.error('❌ Backup save also failed:', backupError.message);
          throw new Error('Could not save tokens to any location');
        }
      }

      await this.setActiveUserByEmail(email);

      if (!tokens.refresh_token) {
        console.warn('⚠️  No refresh_token received. You may need to revoke access and re-authorize.');
        console.warn('💡 Visit: https://myaccount.google.com/permissions');
      }

      return true;
    } catch (e) {
      console.error('❌ Failed to persist user tokens:', e.message);
      throw e;
    }
  }

  async handleOAuthCode(code) {
    try {
      const client = this._createOAuth2Client();

      console.log('🔄 Exchanging authorization code for tokens...');
      const r = await client.getToken(code);
      const tokens = r.tokens || {};

      console.log('📥 Received tokens:', {
        has_refresh_token: !!tokens.refresh_token,
        has_access_token: !!tokens.access_token,
        expiry_date: tokens.expiry_date || null
      });

      client.setCredentials(tokens);

      const oauth2 = google.oauth2({ auth: client, version: 'v2' });
      const info = await oauth2.userinfo.get();
      const email = (info && info.data && info.data.email) ? info.data.email : null;
      
      if (!email) {
        throw new Error('Could not determine user email from Google');
      }

      await this._persistUserTokens(email, tokens);

      return email;
    } catch (e) {
      console.error('❌ OAuth code exchange failed:', e.message);
      throw e;
    }
  }

  async getOAuthClientForEmail(email) {
  try {
    if (!email) {
      console.warn('⚠️  No email provided to getOAuthClientForEmail');
      return null;
    }
    
    // Check if users.json exists
    if (!fscb.existsSync(this.usersJsonPath)) {
      console.warn(`⚠️  users.json not found at: ${this.usersJsonPath}`);
      
      // Try backup location
      const backupPath = path.join(this.projectRoot, 'users_backup.json');
      if (fscb.existsSync(backupPath)) {
        console.log(`✅ Found backup at: ${backupPath}`);
        this.usersJsonPath = backupPath;
      } else {
        console.warn('❌ No user tokens file found. Please authorize via /auth');
        return null;
      }
    }

    const txt = await fs.readFile(this.usersJsonPath, 'utf8');
    const users = JSON.parse(txt || '{}');
    const u = users[email];
    
    if (!u) {
      console.warn(`⚠️  No tokens found for ${email}`);
      console.log('📋 Available users:', Object.keys(users).join(', ') || 'None');
      return null;
    }

    // **CRITICAL FIX**: Check for refresh_token first
    if (!u.refresh_token) {
      console.error(`❌ No refresh_token for ${email} - cannot maintain long-term access`);
      console.error('💡 Re-authorize this account via /auth to get a new refresh token');
      
      // Still try with access_token if available (will work until it expires)
      if (!u.access_token) {
        console.error('❌ No access_token either - re-authorization required');
        return null;
      }
      
      console.warn('⚠️  Using access_token only - will fail when it expires');
    }

    console.log(`✅ Loading tokens for: ${email}`);
    console.log(`   - Has refresh_token: ${!!u.refresh_token}`);
    console.log(`   - Has access_token: ${!!u.access_token}`);
    console.log(`   - Token saved at: ${u.saved_at || 'unknown'}`);

    const client = this._createOAuth2Client();
    const credentials = {};
    
    if (u.refresh_token) credentials.refresh_token = u.refresh_token;
    if (u.access_token) credentials.access_token = u.access_token;
    if (u.expiry_date) credentials.expiry_date = u.expiry_date;
    if (u.token_type) credentials.token_type = u.token_type;
    if (u.scope) credentials.scope = u.scope;
    
    client.setCredentials(credentials);

    // Handle token refresh
    if (client.on) {
      client.on('tokens', async (toks) => {
        try {
          console.log('🔄 Token refresh detected - saving updated tokens');
          
          const txt2 = await fs.readFile(this.usersJsonPath, 'utf8');
          const users2 = JSON.parse(txt2 || '{}');
          const entry = users2[email] || {};
          
          if (toks.access_token) entry.access_token = toks.access_token;
          if (toks.refresh_token) entry.refresh_token = toks.refresh_token;
          if (toks.expiry_date) entry.expiry_date = toks.expiry_date;
          if (toks.token_type) entry.token_type = toks.token_type;
          if (toks.scope) entry.scope = toks.scope;
          entry.saved_at = new Date().toISOString();
          
          users2[email] = entry;
          await fs.writeFile(this.usersJsonPath, JSON.stringify(users2, null, 2), 'utf8');
          console.log(`✅ Refreshed tokens saved for ${email}`);
        } catch (e) {
          console.warn('❌ Failed to persist refreshed tokens:', e.message);
        }
      });
    }

    return client;
  } catch (e) {
    console.error('❌ getOAuthClientForEmail error:', e.message);
    return null;
  }
}

  // -------------------------
  // Startup / scheduling - FIXED
  // -------------------------
  async init() {
    await this.createDirectories();
    await this.initDatabase();
    await this.loadConfig();
  }

  async start(forceFullScan = false) {
    console.log('\n🚀 ========================================');
    console.log('🚀 STARTING EMAIL SERVICE');
    console.log('🚀 ========================================');

    const activeEmail = await this.getActiveUserEmail();
    
    if (!activeEmail) {
      console.log('⚠️  No active user configured. Please authorize via /auth endpoint.');
      return false;
    }

    console.log(`📧 Active user: ${activeEmail}`);

    // Reset initial scan flag if forcing full scan
    if (forceFullScan) {
      console.log('🔄 Force full scan requested - resetting scan flag');
      await this.resetInitialScanFlag();
    }

    // If already running, just trigger immediate scan
    if (this.isRunning) {
      console.log('ℹ️  Service already running - triggering immediate scan');
      await this.triggerImmediateScan();
      return true;
    }

    this.isRunning = true;

    // Perform immediate initial scan
    console.log('📬 Performing immediate initial scan...');
    await this.triggerImmediateScan();

    // Setup periodic scanning
    const intervalMs = Math.max(30 * 1000, (this.intervalMinutes || 2) * 60 * 1000);
    
    this.intervalId = setInterval(async () => {
      if (!this.isRunning) return;
      
      if (this._isScanning) {
        console.log('⏭️  Skipping scheduled run - previous scan still running');
        return;
      }
      
      console.log('\n⏰ ========================================');
      console.log(`⏰ SCHEDULED SCAN (every ${this.intervalMinutes} min)`);
      console.log('⏰ ========================================');
      
      await this.triggerImmediateScan();
    }, intervalMs);

    console.log(`✅ Service started - scanning every ${this.intervalMinutes} minutes`);
    console.log('========================================\n');
    
    return true;
  }

  async triggerImmediateScan() {
    if (this._isScanning) {
      console.log('⚠️  Scan already in progress');
      return false;
    }

    this._isScanning = true; 
    
    try {
      const activeEmail = await this.getActiveUserEmail();
      
      if (!activeEmail) {
        console.log('⚠️  No active user to scan');
        return false;
      }

      console.log(`\n📧 Starting scan for: ${activeEmail}`);
      
      await this.checkEmails();
      
      console.log('\n🤖 Running batch classifier...');
      await this.runBatchClassifier();
      
      console.log('✅ Scan complete\n');
      return true;
      
    } catch (err) {
      console.error('❌ Scan error:', err.message);
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
    console.log('🛑 Service stopped');
  }

  // -------------------------
  // Email scanning logic (Gmail REST API)
  // -------------------------

  async checkEmails() {
    const didInitial = await this.hasDoneInitialScan();
    const activeEmail = await this.getActiveUserEmail();

    if (!activeEmail) {
      console.warn('❌ No active user configured');
      return;
    }

    let q;
    if (!didInitial) {
      const scanDays = parseInt(process.env.INITIAL_SCAN_DAYS || '365', 10);
      q = `has:attachment newer_than:${scanDays}d`;
      console.log(`🔍 INITIAL FULL SCAN - attachments from last ${scanDays} days`);
    } else {
      q = 'has:attachment is:unread';
      console.log('🔍 INCREMENTAL SCAN - unread attachments only');
    }

    let client;
    try {
      client = await this.getOAuthClientForEmail(activeEmail);
      if (!client) {
        console.error('❌ Could not create OAuth client - please re-authorize');
        return;
      }
    } catch (e) {
      console.error('❌ OAuth client error:', e.message);
      return;
    }

    // Create Gmail API instance
    const gmail = google.gmail({ version: 'v1', auth: client });

    try {
      // Step 1: List messages matching our query
      console.log(`📧 Searching emails with query: "${q}"`);

      let allMessages = [];
      let pageToken = null;

      do {
        const listResponse = await gmail.users.messages.list({
          userId: 'me',
          q: q,
          maxResults: 100,
          pageToken: pageToken
        });

        const messages = listResponse.data.messages || [];
        allMessages = allMessages.concat(messages);
        pageToken = listResponse.data.nextPageToken;

        console.log(`   Found ${messages.length} messages (total: ${allMessages.length})`);

      } while (pageToken && allMessages.length < 500); // Limit to 500 emails max

      if (allMessages.length === 0) {
        console.log('📭 No emails found matching criteria');
        if (!didInitial) {
          await this.setInitialScanDone();
        }
        return;
      }

      console.log(`\n📬 Processing ${allMessages.length} email(s)...`);

      let processedCount = 0;
      let attachmentCount = 0;
      let skippedCount = 0;

      // Step 2: Process each message
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
          const fullMessage = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'full'
          });

          const headers = fullMessage.data.payload.headers || [];
          const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
          const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || 'Unknown';

          console.log(`\n📧 [${i + 1}/${allMessages.length}] ${subject.substring(0, 50)}...`);
          console.log(`   From: ${from.substring(0, 40)}...`);

          // Step 3: Extract attachments
          const attachments = await this.extractAttachments(gmail, msg.id, fullMessage.data.payload);

          if (attachments.length > 0) {
            console.log(`   📎 Found ${attachments.length} attachment(s)`);

            // Save each attachment
            for (const att of attachments) {
              const saved = await this.saveAttachment(att.data, att.filename, msg.id);
              if (saved) {
                attachmentCount++;
              }
            }
          }

          // Record email as processed
          const now = Math.floor(Date.now() / 1000);
          await this.dbRun(
            `INSERT OR IGNORE INTO emails (message_id, from_addr, subject, processed_at) VALUES (?, ?, ?, ?)`,
            [msg.id, from, subject, now]
          );

          processedCount++;

          // Mark as read if incremental scan
          if (didInitial) {
            try {
              await gmail.users.messages.modify({
                userId: 'me',
                id: msg.id,
                requestBody: {
                  removeLabelIds: ['UNREAD']
                }
              });
            } catch (markErr) {
              console.warn(`   ⚠️ Could not mark as read: ${markErr.message}`);
            }
          }

        } catch (msgErr) {
          console.error(`   ❌ Error processing message: ${msgErr.message}`);
        }

        // Rate limiting - small delay between messages
        if (i > 0 && i % 10 === 0) {
          await new Promise(r => setTimeout(r, 500));
        }
      }

      console.log('\n📊 ========================================');
      console.log('📊 EMAIL SCAN SUMMARY');
      console.log('📊 ========================================');
      console.log(`   Total emails found: ${allMessages.length}`);
      console.log(`   Processed: ${processedCount}`);
      console.log(`   Skipped (already done): ${skippedCount}`);
      console.log(`   Attachments saved: ${attachmentCount}`);
      console.log('========================================\n');

      // Mark initial scan as done
      if (!didInitial) {
        await this.setInitialScanDone();
        console.log('✅ Initial scan completed - future scans will only check unread emails');
      }

    } catch (err) {
      console.error('❌ Gmail API error:', err.message);
      if (err.code === 401 || err.code === 403) {
        console.error('💡 Token may be expired - try re-authorizing via /auth');
      }
    }
  }

  // Extract attachments from email payload (recursive for multipart)
  async extractAttachments(gmail, messageId, payload, attachments = []) {
    const validExtensions = ['.pdf', '.xlsx', '.xls', '.csv', '.xml', '.txt'];

    // Check if this part has an attachment
    if (payload.filename && payload.filename.length > 0) {
      const ext = path.extname(payload.filename).toLowerCase();

      if (validExtensions.includes(ext)) {
        console.log(`   📄 Found: ${payload.filename}`);

        let attachmentData = null;

        // Get attachment data
        if (payload.body && payload.body.attachmentId) {
          // Large attachment - need to fetch separately
          try {
            const attResponse = await gmail.users.messages.attachments.get({
              userId: 'me',
              messageId: messageId,
              id: payload.body.attachmentId
            });

            if (attResponse.data && attResponse.data.data) {
              // Decode base64url to buffer
              attachmentData = Buffer.from(attResponse.data.data, 'base64url');
            }
          } catch (attErr) {
            console.error(`   ❌ Failed to download attachment: ${attErr.message}`);
          }
        } else if (payload.body && payload.body.data) {
          // Small attachment - data is inline
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

    // Recursively check parts (for multipart messages)
    if (payload.parts && Array.isArray(payload.parts)) {
      for (const part of payload.parts) {
        await this.extractAttachments(gmail, messageId, part, attachments);
      }
    }

    return attachments;
  }

  
  // -------------------------
  // File operations (keep existing)
  // -------------------------
  async computeFileHash(filePath) {
    return new Promise((resolve, reject) => {
      const h = crypto.createHash('sha256');
      const rs = fscb.createReadStream(filePath);
      rs.on('data', d => h.update(d));
      rs.on('error', reject);
      rs.on('end', () => resolve(h.digest('hex')));
    });
  }

  async isFileAlreadySaved(fileHash) {
    try {
      const row = await this.dbGet(`SELECT id FROM attachments WHERE file_hash = ?`, [fileHash]);
      return !!row;
    } catch (err) {
      return false;
    }
  }

  async saveAttachment(fileBuffer, filename, messageId = null) {
    try {
      await fs.mkdir(this.inputDir, { recursive: true });

      let target = path.join(this.inputDir, filename);
      if (await this._exists(target)) {
        const { name, ext } = this._splitNameExt(filename);
        let i = 1;
        do {
          target = path.join(this.inputDir, `${name}_${i}${ext}`);
          i++;
        } while (await this._exists(target));
      }

      await fs.writeFile(target, fileBuffer);

      const fileHash = await this.computeFileHash(target);

      if (await this.isFileAlreadySaved(fileHash)) {
        console.log(`  ↩️  Skipping duplicate: ${filename}`);
        try { await fs.unlink(target); } catch (_) {}
        return false;
      }

      const now = Math.floor(Date.now() / 1000);
      await this.dbRun(
        `INSERT INTO attachments (message_id, filename, path, file_hash, classified_at) VALUES (?, ?, ?, ?, ?)`,
        [messageId, path.basename(target), target, fileHash, null]
      );
      
      console.log(`  ✅ Saved: ${path.basename(target)}`);
      return { path: target, fileHash };
    } catch (err) {
      console.error('  ❌ Save error:', err.message);
      return false;
    }
  }

  _splitNameExt(filename) {
    const ext = path.extname(filename);
    const name = path.basename(filename, ext);
    return { name, ext };
  }

  async _exists(p) {
    try {
      await fs.access(p);
      return true;
    } catch (e) {
      return false;
    }
  }

  async runBatchClassifier() {
    const pythonCmd = process.env.PYTHON || 'python';
    const classifierPath = path.join(this.projectRoot, 'run_classifier.py');
    
    if (!fscb.existsSync(classifierPath)) {
      console.warn('⚠️  Classifier not found:', classifierPath);
      return { ok: false, error: 'Classifier script not found' };
    }

    // Check if there are any files to classify
    let inputFiles = [];
    try {
      const files = await fs.readdir(this.inputDir);
      inputFiles = files.filter(f => {
        const ext = path.extname(f).toLowerCase();
        return ['.pdf', '.xlsx', '.xls', '.csv', '.xml', '.txt'].includes(ext);
      });
      
      if (inputFiles.length === 0) {
        console.log('ℹ️  No files to classify in input folder');
        return { ok: true, message: 'No files to classify' };
      }
      
      console.log(`📁 Found ${inputFiles.length} file(s) to classify:`);
      inputFiles.slice(0, 5).forEach(f => console.log(`   - ${f}`));
      if (inputFiles.length > 5) console.log(`   ... and ${inputFiles.length - 5} more`);
      
    } catch (e) {
      console.warn('⚠️  Could not read input directory:', e.message);
      return { ok: false, error: 'Could not read input directory' };
    }

    const cmd = `"${pythonCmd}" "${classifierPath}" "${this.inputDir}" "${this.unprocessedDir}"`;

    console.log('🤖 Starting batch classifier...');
    console.log(`📝 Command: ${cmd}`);
    console.log(`📂 Input dir: ${this.inputDir}`);
    console.log(`📂 Output dir: ${this.unprocessedDir}`);
    
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      exec(cmd, {
        encoding: 'utf8',
        maxBuffer: 50 * 1024 * 1024,
        timeout: 30000, // 5 minute timeout
        env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8' })
      }, async (error, stdout, stderr) => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        if (error) {
          console.error('❌ Classifier execution error:', error.message);
          if (error.code) console.error('   Error code:', error.code);
          if (error.signal) console.error('   Signal:', error.signal);
          
          if (stderr && stderr.trim()) {
            console.error('📛 Classifier stderr:');
            console.error(stderr.trim().slice(0, 2000));
          }
          
          return resolve({ 
            ok: false, 
            error: error.message,
            stderr: stderr ? stderr.trim() : null,
            duration 
          });
        }
        
        if (stderr && stderr.trim()) {
          console.warn('⚠️  Classifier warnings:');
          const stderrLines = stderr.trim().split('\n');
          stderrLines.slice(0, 10).forEach(line => console.warn(`   ${line}`));
          if (stderrLines.length > 10) {
            console.warn(`   ... and ${stderrLines.length - 10} more warning lines`);
          }
        }

        const out = (stdout || '').trim();
        
        if (!out) {
          console.log('ℹ️  Classifier produced no output');
          console.log(`⏱️  Duration: ${duration}s`);
          return resolve({ ok: false, error: 'No output from classifier', duration });
        }

        // Log raw output for debugging
        console.log('\n📤 Classifier output:');
        console.log('─'.repeat(60));
        const outputLines = out.split('\n');
        outputLines.forEach((line, idx) => {
          if (idx < 20 || idx >= outputLines.length - 10) {
            console.log(line);
          } else if (idx === 20) {
            console.log(`... ${outputLines.length - 30} more lines ...`);
          }
        });
        console.log('─'.repeat(60));

        // Parse JSON results
        const lines = out.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const jsonObjects = [];
        
        for (let i = 0; i < lines.length; i++) {
          const l = lines[i];
          if (l.startsWith('{') && l.endsWith('}')) {
            try { 
              const parsed = JSON.parse(l);
              jsonObjects.push(parsed);
            } catch (e) {
              // Try to extract JSON if embedded in other text
              const first = l.indexOf('{');
              const last = l.lastIndexOf('}');
              if (first !== -1 && last !== -1 && last > first) {
                const sub = l.substring(first, last + 1);
                try { 
                  const parsed = JSON.parse(sub);
                  jsonObjects.push(parsed);
                } catch (_) {}
              }
            }
          }
        }

        console.log(`\n📊 Classification Results:`);
        if (jsonObjects.length > 0) {
          console.log(`✅ Parsed ${jsonObjects.length} classification result(s)`);
          
          let bankCount = 0;
          let nonBankCount = 0;
          
          jsonObjects.forEach((obj, idx) => {
            const isBank = !!obj.is_bank_statement || !!obj.is_bank;
            const fileName = obj.file_path ? path.basename(obj.file_path) : obj.filename || `result_${idx + 1}`;
            const confidence = obj.confidence || obj.confidence_score || 0;
            
            if (isBank) {
              bankCount++;
              console.log(`   ${idx + 1}. ✅ BANK STATEMENT - ${fileName} (${confidence}%)`);
            } else {
              nonBankCount++;
              console.log(`   ${idx + 1}. ❌ Not bank - ${fileName} (${confidence}%)`);
            }
          });
          
          console.log(`\n📈 Summary:`);
          console.log(`   Bank statements: ${bankCount}`);
          console.log(`   Non-bank files: ${nonBankCount}`);
          console.log(`   Total classified: ${jsonObjects.length}`);
          
        } else {
          console.warn('⚠️  Could not parse any JSON results from classifier output');
          console.log('💡 This might mean:');
          console.log('   - Classifier is running but not outputting JSON');
          console.log('   - Check run_classifier.py for proper JSON output format');
          console.log('   - Expected format: {"is_bank_statement": true, "file_path": "...", "confidence": 95}');
        }

        // Process results and update DB
        if (jsonObjects.length > 0) {
          console.log('\n🔄 Processing classification results...');
          let bankStatementCount = 0;
          let duplicateCount = 0;
          let rejectedCount = 0;
          let errorCount = 0;

          for (const obj of jsonObjects) {
            try {
              const filePath = obj.file_path || obj.path || null;
              const isBank = !!obj.is_bank_statement || !!obj.is_bank;

              if (!filePath || !fscb.existsSync(filePath)) {
                console.warn(`  ⚠️  File not found: ${filePath}`);
                errorCount++;
                continue;
              }

              const fileHash = await this._computeHashSafe(filePath);

              if (!fileHash) {
                console.warn(`  ⚠️  Could not compute hash for: ${path.basename(filePath)}`);
                errorCount++;
                continue;
              }

              if (isBank) {
                // It's a bank statement - move to unprocessed (with duplicate check)
                const result = await this.ensureUnprocessedPresence(
                  fileHash,
                  filePath,
                  obj.output_path || obj.outputPath || null
                );

                if (result.success) {
                  bankStatementCount++;
                } else if (result.reason === 'duplicate') {
                  duplicateCount++;
                } else {
                  errorCount++;
                }
              } else {
                // Not a bank statement - move to rejected folder
                const rejected = await this.rejectNonBankStatement(filePath);
                if (rejected) {
                  rejectedCount++;
                } else {
                  errorCount++;
                }
              }
            } catch (e) {
              console.warn('⚠️  Error processing result:', e.message);
              errorCount++;
            }
          }

          console.log('\n📊 Processing Summary:');
          console.log(`   ✅ Bank statements saved: ${bankStatementCount}`);
          console.log(`   ↩️  Duplicates rejected: ${duplicateCount}`);
          console.log(`   🚫 Non-bank rejected: ${rejectedCount}`);
          if (errorCount > 0) {
            console.log(`   ❌ Errors: ${errorCount}`);
          }
        }

        console.log(`⏱️  Total duration: ${duration}s`);
        console.log('✅ Classifier completed\n');
        
        
        resolve({
          ok: true,
          parsed: jsonObjects,
          raw: out,
          duration,
          filesProcessed: jsonObjects.length,
          bankStatements: jsonObjects.filter(obj => !!obj.is_bank_statement || !!obj.is_bank).length
        });

        // TODO: Re-enable when main.exe FastAPI backend is available
        // await callMainExeAnalyzeEndpoint_sendJson(
        // ['pdfPath'],           // the PDF path(s)
        // ["password_if_any"],  // optional passwords
        // ["hdfc"]         // bank names
        // );
        console.log('ℹ️  FastAPI analysis skipped (main.exe not configured yet)');
      });

    
    });

  
    
  async function sendUnprocessedToMainExe(unprocessedDir) {
    const files = fs.readdirSync(unprocessedDir)
      .filter(f => f.toLowerCase().endsWith(".pdf"))
      .map(f => path.join(unprocessedDir, f));
  
    if (files.length > 0) {
      console.log(`🚀 Sending ${files.length} PDF(s) to FastAPI main.exe server...`);
      await callMainExeAnalyzeEndpoint(files);
    } else {
      console.log("ℹ️ No unprocessed PDFs found to send.");
      }
    }

  }

  async _computeHashSafe(filePath) {
    try {
      if (!filePath || !fscb.existsSync(filePath)) return null;
      return await this.computeFileHash(filePath);
    } catch (e) {
      return null;
    }
  }

  // Check if file hash already exists in database (any status)
  async isDuplicateInUnprocessed(fileHash) {
    try {
      // Check if file with same hash exists anywhere in database
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

  // Check if file with same hash already exists in unprocessed folder by scanning files
  async isDuplicateByContentInFolder(fileHash) {
    try {
      if (!fscb.existsSync(this.unprocessedDir)) return null;

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
          // Skip files that can't be read
          continue;
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  // Move file to unprocessed folder, reject if duplicate
  async ensureUnprocessedPresence(fileHash, sourcePath, outputPath = null) {
    try {
      // Check 1: Check database for duplicate hash
      const existingInDb = await this.isDuplicateInUnprocessed(fileHash);
      if (existingInDb) {
        console.log(`  ↩️  DUPLICATE DETECTED (DB): ${path.basename(sourcePath)}`);
        console.log(`     Already exists as: ${path.basename(existingInDb.path)}`);
        // Delete the duplicate file instead of moving to rejected
        try {
          await fs.unlink(sourcePath);
          console.log(`  🗑️  Deleted duplicate: ${path.basename(sourcePath)}`);
        } catch (e) {
          console.warn(`  ⚠️  Could not delete duplicate: ${e.message}`);
        }
        return { success: false, reason: 'duplicate', existingPath: existingInDb.path };
      }

      // Check 2: Scan unprocessed folder for duplicate content
      const existingInFolder = await this.isDuplicateByContentInFolder(fileHash);
      if (existingInFolder) {
        console.log(`  ↩️  DUPLICATE DETECTED (Folder): ${path.basename(sourcePath)}`);
        console.log(`     Already exists as: ${path.basename(existingInFolder.path)}`);
        // Delete the duplicate file
        try {
          await fs.unlink(sourcePath);
          console.log(`  🗑️  Deleted duplicate: ${path.basename(sourcePath)}`);
        } catch (e) {
          console.warn(`  ⚠️  Could not delete duplicate: ${e.message}`);
        }
        return { success: false, reason: 'duplicate', existingPath: existingInFolder.path };
      }

      // Determine destination path
      const fileName = path.basename(sourcePath);
      let destPath = outputPath || path.join(this.unprocessedDir, fileName);

      // Handle filename collision - but first check if existing file has same content
      if (await this._exists(destPath)) {
        const existingHash = await this.computeFileHash(destPath);
        if (existingHash === fileHash) {
          // Same content, it's a duplicate
          console.log(`  ↩️  DUPLICATE DETECTED (Same file): ${path.basename(sourcePath)}`);
          try {
            await fs.unlink(sourcePath);
            console.log(`  🗑️  Deleted duplicate: ${path.basename(sourcePath)}`);
          } catch (e) {
            console.warn(`  ⚠️  Could not delete duplicate: ${e.message}`);
          }
          return { success: false, reason: 'duplicate', existingPath: destPath };
        }

        // Different content but same filename - rename with counter
        const { name, ext } = this._splitNameExt(fileName);
        let counter = 1;
        do {
          destPath = path.join(this.unprocessedDir, `${name}_${counter}${ext}`);
          counter++;
        } while (await this._exists(destPath));
      }

      // Ensure unprocessed directory exists
      await fs.mkdir(this.unprocessedDir, { recursive: true });

      // Copy file to unprocessed folder
      if (sourcePath !== destPath) {
        await fs.copyFile(sourcePath, destPath);
        console.log(`  ✅ Copied to unprocessed: ${path.basename(destPath)}`);
      }

      // Update database - mark as bank statement
      const now = Math.floor(Date.now() / 1000);
      await this.dbRun(
        `UPDATE attachments SET is_bank_statement = 1, classified_at = ?, path = ? WHERE file_hash = ?`,
        [now, destPath, fileHash]
      );

      // Remove from input folder after successful copy
      if (sourcePath !== destPath && fscb.existsSync(sourcePath)) {
        try {
          await fs.unlink(sourcePath);
          console.log(`  🗑️  Removed from input: ${path.basename(sourcePath)}`);
        } catch (e) {
          console.warn(`  ⚠️  Could not remove source file: ${e.message}`);
        }
      }

      return { success: true, destPath };
    } catch (e) {
      console.error('ensureUnprocessedPresence error:', e.message);
      return { success: false, reason: 'error', error: e.message };
    }
  }

  // Move file to rejected folder
  async moveToRejected(filePath, reason = 'unknown') {
    try {
      if (!fscb.existsSync(filePath)) {
        console.warn(`  ⚠️  File not found for rejection: ${filePath}`);
        return false;
      }

      await fs.mkdir(this.rejectedDir, { recursive: true });

      const fileName = path.basename(filePath);
      const { name, ext } = this._splitNameExt(fileName);

      // Add reason suffix to filename
      let destPath = path.join(this.rejectedDir, `${name}_${reason}${ext}`);

      // Handle filename collision
      if (await this._exists(destPath)) {
        let counter = 1;
        do {
          destPath = path.join(this.rejectedDir, `${name}_${reason}_${counter}${ext}`);
          counter++;
        } while (await this._exists(destPath));
      }

      // Move file
      await fs.rename(filePath, destPath);
      console.log(`  🚫 Rejected: ${path.basename(destPath)} (${reason})`);

      // Update database
      const fileHash = await this._computeHashSafe(destPath);
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

  // Move non-bank statement files to rejected folder
  async rejectNonBankStatement(filePath) {
    return await this.moveToRejected(filePath, 'not_bank_statement');
  }

  async getStats() {
    const t = await this.dbGet(`SELECT COUNT(*) AS c FROM attachments`);
    const b = await this.dbGet(`SELECT COUNT(*) AS c FROM attachments WHERE is_bank_statement=1`);
    return { total: t ? t.c : 0, bank: b ? b.c : 0 };
  }

  async getFiles() {
    return await this.dbAll(`SELECT * FROM attachments ORDER BY id DESC LIMIT 200`);
  }
}




// -------------------------
// Web auth server - FIXED
// -------------------------
async function startWebAuthServer(svc, port = process.env.PORT || 3000) {
  const app = express();

  app.post('/run-exe', async (req, res) => {
  try {
    const fastApiResult = await sendToFastAPI({
      normalizedPaths: req.body.normalizedPaths || [],
      bank_names_arr: req.body.bank_names || [],
      passwords_arr: req.body.passwords || [],
      start_date_arr: req.body.start_date || [],
      end_date_arr: req.body.end_date || [],
      caseName: req.body.caseName || 'unknown',
      ca_id: req.body.ca_id || 'CA-123',
      tmpdir_path: req.app.get('tmpdir_path') || './tmp',
      pdf_paths_override: req.body.pdf_paths // optional
    });

    // handle parsed null scenario — same logic you had before:
// handle fastApiResult properly using the helper
const handled = await handleFastApiResult(fastApiResult, {
  caseId: req.body.caseId,
  caseName: req.body.caseName || 'unknown',
  tmpdir_path: req.app.get('tmpdir_path') || './tmp'
});

if (!handled.success) {
  // already marked failed inside helper
  return res.status(200).json({
    success: true,
    data: {
      caseId: req.body.caseId,
      processed: null,
      totalTransactions: 0,
      eodProcessed: false,
      summaryProcessed: false,
      failedStatements: handled.failedStatements || null,
      failedFiles: Array.from([]),
      successfulFiles: Array.from([]),
      nerResults: fastApiResult?.data?.ner_results || { Name: [], "Acc Number": [] },
      processing_times: fastApiResult?.data?.processing_times || [],
      warning: fastApiResult?.data?.["pdf_paths_not_extracted"]?.["respective_reasons_for_error"] || null
    }
  });
}

// At this point handled.success === true
// Continue your normal processing flow using handled.parsedData, handled.transactions_temp, handled.fileDetails
// For example:
res.json({ success: true, parsed: handled.parsedData, totalTransactions: handled.parsedData._totalTransactions });

  } catch (err) {
    console.error('run-exe route error', err);
    // optionally mark case failed
    if (req.body?.caseId) {
      try { await processCase(req.body.caseId, 'Failed'); } catch (e) { console.error(e); }
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});





  app.get('/', (req, res) => {
    res.send(`
      <h2>📧 Email Service - Gmail Scanner</h2>
      <h3>Quick Actions:</h3>
      <ul>
        <li><a href="/auth">🔐 Authorize Gmail Account</a></li>
        <li><a href="/users">👤 List Authorized Users</a></li>
        <li><a href="/trigger">🚀 Trigger Immediate Scan</a></li>
        <li><a href="/status">📊 Service Status</a></li>
      </ul>
      <p><small>After authorization, scanning will start automatically</small></p>
    `);
  });

  app.get('/auth', (req, res) => {
    try {
      const url = svc.getAuthUrl();
      return res.redirect(url);
    } catch (e) {
      return res.status(500).send('❌ Error: ' + e.message);
    }
  });

  app.get('/oauth2callback', async (req, res) => {
    const code = req.query.code;
    if (!code) {
      return res.status(400).send('❌ Missing authorization code');
    }

    try {
      console.log('\n🔐 ========================================');
      console.log('🔐 PROCESSING OAUTH CALLBACK');
      console.log('🔐 ========================================');

      const email = await svc.handleOAuthCode(code);

      console.log(`✅ Authentication successful for: ${email}`);

      // Reset scan flag to force full initial scan
      await svc.resetInitialScanFlag();

      // Start service with force full scan
      console.log('🚀 Starting email scanning service...\n');
      const started = await svc.start(true);

      if (!started) {
        throw new Error('Failed to start service');
      }

      res.send(`
        <h2>✅ Authentication Successful!</h2>
        <h3>Email: ${email}</h3>
        <p>✅ Service started - scanning all emails with attachments</p>
        <p>✅ Initial full scan in progress</p>
        <p>✅ Future scans will check for new unread emails</p>
        <hr>
        <p><a href="/status">View Status</a> | <a href="/trigger">Trigger Manual Scan</a></p>
        <p><small>You can close this window now. The service will continue running.</small></p>
      `);

    } catch (e) {
      console.error('❌ OAuth callback error:', e.message);
      res.status(500).send(`
        <h2>❌ Authentication Failed</h2>
        <p>Error: ${e.message}</p>
        <p><a href="/auth">Try Again</a></p>
      `);
    }
  });

  // Also handle /oauth/callback to match credentials.json redirect_uri
  app.get('/oauth/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) {
      return res.status(400).send('❌ Missing authorization code');
    }

    try {
      console.log('\n🔐 ========================================');
      console.log('🔐 PROCESSING OAUTH CALLBACK (/oauth/callback)');
      console.log('🔐 ========================================');

      const email = await svc.handleOAuthCode(code);

      console.log(`✅ Authentication successful for: ${email}`);

      // Reset scan flag to force full initial scan
      await svc.resetInitialScanFlag();

      // Start service with force full scan
      console.log('🚀 Starting email scanning service...\n');
      const started = await svc.start(true);

      if (!started) {
        throw new Error('Failed to start service');
      }

      res.send(`
        <h2>✅ Authentication Successful!</h2>
        <h3>Email: ${email}</h3>
        <p>✅ Service started - scanning all emails with attachments</p>
        <p>✅ Initial full scan in progress</p>
        <p>✅ Future scans will check for new unread emails</p>
        <hr>
        <p><a href="/status">View Status</a> | <a href="/trigger">Trigger Manual Scan</a></p>
        <p><small>You can close this window now. The service will continue running.</small></p>
      `);

    } catch (e) {
      console.error('❌ OAuth callback error:', e.message);
      res.status(500).send(`
        <h2>❌ Authentication Failed</h2>
        <p>Error: ${e.message}</p>
        <p><a href="/auth">Try Again</a></p>
      `);
    }
  });

  app.get('/users', async (req, res) => {
    try {
      // Check primary location
      let usersData = {};
      let filePath = svc.usersJsonPath;
      
      if (!fscb.existsSync(svc.usersJsonPath)) {
        // Try backup location
        const backupPath = path.join(svc.projectRoot, 'users_backup.json');
        if (fscb.existsSync(backupPath)) {
          filePath = backupPath;
          console.log('Using backup users file');
        } else {
          return res.send(`cal
            <h2>👤 No Users Found</h2>
            <p>❌ No authorized users yet</p>
            <p>Expected file: <code>${svc.usersJsonPath}</code></p>
            <p>Also checked: <code>${backupPath}</code></p>
            <hr>
            <p><a href="/auth">🔐 Authorize First User</a></p>
            <p><a href="/">← Back</a></p>
          `);
        }
      }
      
      const txt = await fs.readFile(filePath, 'utf8');
      usersData = JSON.parse(txt || '{}');
      const activeEmail = await svc.getActiveUserEmail();
      
      const userCount = Object.keys(usersData).length;
      
      if (userCount === 0) {
        return res.send(`
          <h2>👤 No Users Found</h2>
          <p>⚠️  users.json exists but is empty</p>
          <p>File location: <code>${filePath}</code></p>
          <hr>
          <p><a href="/auth">🔐 Authorize First User</a></p>
          <p><a href="/">← Back</a></p>
        `);
      }
      
      res.send(`
        <h2>👤 Authorized Users (${userCount})</h2>
        <p><strong>Active User:</strong> ${activeEmail || '⚠️ None'}</p>
        <p><small>File: ${filePath}</small></p>
        <hr>
        <h3>All Users:</h3>
        <ul>
          ${Object.keys(usersData).map(email => `
            <li style="margin-bottom: 15px; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
              <strong>${email}</strong> ${email === activeEmail ? '✅ <strong>(Active)</strong>' : ''}
              <br><small>📅 Last saved: ${usersData[email].saved_at || 'Unknown'}</small>
              <br><small>🔑 Refresh token: ${usersData[email].refresh_token ? '✅ Yes' : '❌ No - May need re-auth'}</small>
              <br><small>🎫 Access token: ${usersData[email].access_token ? '✅ Yes' : '❌ No'}</small>
              ${email !== activeEmail ? `<br><br><a href="/set-active?email=${encodeURIComponent(email)}" style="padding: 5px 10px; background: #007bff; color: white; text-decoration: none; border-radius: 3px;">Set as Active</a>` : ''}
            </li>
          `).join('')}
        </ul>
        <hr>
        <p>
          <a href="/auth">🔐 Add Another User</a> | 
          <a href="/">← Back</a>
        </p>
      `);
    } catch (e) {
      console.error('Error in /users endpoint:', e);
      return res.status(500).send(`
        <h2>❌ Error</h2>
        <p>${e.message}</p>
        <p><a href="/">← Back</a></p>
      `);
    }
  });

  app.get('/set-active', async (req, res) => {
    const email = req.query.email;
    if (!email) {
      return res.status(400).send('❌ Missing email parameter');
    }
    
    try {
      let exists = false;
      let filePath = svc.usersJsonPath;
      
      // Check primary location
      if (!fscb.existsSync(svc.usersJsonPath)) {
        // Try backup
        const backupPath = path.join(svc.projectRoot, 'users_backup.json');
        if (fscb.existsSync(backupPath)) {
          filePath = backupPath;
          svc.usersJsonPath = backupPath;
        }
      }
      
      if (fscb.existsSync(filePath)) {
        const txt = await fs.readFile(filePath, 'utf8');
        const users = JSON.parse(txt || '{}');
        if (users[email]) exists = true;
      }
      
      if (!exists) {
        return res.status(404).send(`
          <h2>❌ User Not Found</h2>
          <p>Email: ${email}</p>
          <p>File checked: ${filePath}</p>
          <p><a href="/users">← View Users</a></p>
        `);
      }
      
      await svc.setActiveUserByEmail(email);
      
      // Stop and restart service with new user
      console.log('\n🔄 Switching active user to:', email);
      await svc.stop();
      await svc.resetInitialScanFlag();
      
      const started = await svc.start(true);
      
      res.send(`
        <h2>✅ Active User Changed</h2>
        <p>New active user: <strong>${email}</strong></p>
        <p>${started ? '✅' : '⚠️'} Service ${started ? 'restarted with full scan' : 'start attempted'}</p>
        <hr>
        <p>
          <a href="/status">📊 View Status</a> | 
          <a href="/users">👤 View Users</a> | 
          <a href="/">← Back</a>
        </p>
      `);
    } catch (e) {
      console.error('Error in /set-active:', e);
      return res.status(500).send(`
        <h2>❌ Error</h2>
        <p>${e.message}</p>
        <p><a href="/users">← View Users</a></p>
      `);
    }
  });

  app.get('/trigger', async (req, res) => {
    try {
      const activeEmail = await svc.getActiveUserEmail();
      
      if (!activeEmail) {
        return res.status(400).send(`
          <h2>⚠️ No Active User</h2>
          <p>Please <a href="/auth">authorize a Gmail account</a> first</p>
        `);
      }

      res.write(`
        <h2>🚀 Triggering Immediate Scan</h2>
        <p>Active user: <strong>${activeEmail}</strong></p>
        <p>Scan started - check server console for progress...</p>
        <hr>
      `);

      // Trigger scan asynchronously
      setImmediate(async () => {
        try {
          await svc.triggerImmediateScan();
          console.log('✅ Manual trigger completed');
        } catch (err) {
          console.error('❌ Manual trigger error:', err.message);
        }
      });

      res.end(`
        <p>✅ Scan triggered successfully</p>
        <p><a href="/status">View Status</a> | <a href="/">← Back</a></p>
      `);
    } catch (e) {
      return res.status(500).send('❌ Error: ' + e.message);
    }
  });

  app.get('/status', async (req, res) => {
    try {
      const activeEmail = await svc.getActiveUserEmail();
      const stats = await svc.getStats();
      const isRunning = svc.isRunning;
      const isScanning = svc._isScanning;
      const didInitial = await svc.hasDoneInitialScan();

      res.send(`
        <h2>📊 Service Status</h2>
        <table border="1" cellpadding="10">
          <tr><td><strong>Service Running:</strong></td><td>${isRunning ? '✅ Yes' : '❌ No'}</td></tr>
          <tr><td><strong>Currently Scanning:</strong></td><td>${isScanning ? '🔄 Yes' : '⏸️ No'}</td></tr>
          <tr><td><strong>Active User:</strong></td><td>${activeEmail || 'None'}</td></tr>
          <tr><td><strong>Initial Scan Complete:</strong></td><td>${didInitial ? '✅ Yes' : '❌ No'}</td></tr>
          <tr><td><strong>Scan Interval:</strong></td><td>${svc.intervalMinutes} minutes</td></tr>
          <tr><td><strong>Total Attachments:</strong></td><td>${stats.total}</td></tr>
          <tr><td><strong>Bank Statements:</strong></td><td>${stats.bank}</td></tr>
        </table>
        <hr>
        <p>
          <a href="/trigger">🚀 Trigger Scan</a> | 
          <a href="/users">👤 View Users</a> | 
          <a href="/">← Back</a>
        </p>
        <p><small>Page auto-refreshes every 10 seconds</small></p>
        <script>setTimeout(() => location.reload(), 10000);</script>
      `);
    } catch (e) {
      return res.status(500).send('❌ Error: ' + e.message);
    }
  });

  const server = app.listen(port, () => {
    console.log('\n🌐 ========================================');
    console.log('🌐 WEB SERVER STARTED');
    console.log('🌐 ========================================');
    console.log(`📍 URL: ${svc.serverBaseUrl}`);
    console.log(`📍 Port: ${port}`);
    console.log('\n📋 Available Endpoints:');
    console.log('   /          - Home page');
    console.log('   /auth      - Authorize Gmail');
    console.log('   /users     - List users');
    console.log('   /trigger   - Manual scan');
    console.log('   /status    - Service status');
    console.log('========================================\n');

    // Auto-open browser
    try {
      open(`${svc.serverBaseUrl}`).catch(() => {
        console.log('💡 Open your browser to:', svc.serverBaseUrl);
      });
    } catch (_) {
      console.log('💡 Open your browser to:', svc.serverBaseUrl);
    }
  });




  return server;
}

// -------------------------
// Main startup
// -------------------------
if (require.main === module) {
  (async () => {
    console.log('╔════════════════════════════════════════╗');
    console.log('║   📧 EMAIL SERVICE - GMAIL SCANNER   ║');
    console.log('╚════════════════════════════════════════╝\n');

    const svc = new EmailService({});
    
    try {
      console.log('🔧 Initializing service...');
      await svc.init();
      await svc.loadConfig();
      console.log('✅ Service initialized\n');

      console.log('🌐 Starting web authentication server...');
      // Use port 8234 to match credentials.json redirect_uri, or PORT env var
      await startWebAuthServer(svc, process.env.PORT || 8234);

      // Check if we already have an active user
      const activeEmail = await svc.getActiveUserEmail();
      
      if (activeEmail) {
        console.log(`\n✅ Found existing active user: ${activeEmail}`);
        console.log('🚀 Auto-starting email scanning...\n');
        
        try {
          await svc.start(false);
        } catch (e) {
          console.error('❌ Failed to auto-start scanning:', e.message);
          console.log('💡 You may need to re-authorize via /auth\n');
        }
      } else {
        console.log('\n No active user found');
        console.log('💡 Please visit the web interface to authorize a Gmail account\n');
      }

    } catch (e) {
      console.error('❌ Failed to start service:', e.message);
      console.error(e.stack);
      process.exit(1);
    }

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Shutting down gracefully...');
      await svc.stop();
      process.exit(0);
    });

  })();
}


module.exports = EmailService;






////////////////////////////ended heree////////////////////////////////////////////////////////


