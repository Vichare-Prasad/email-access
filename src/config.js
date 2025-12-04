// src/config.js
// Centralized configuration for the email service
// Phase 1: Uses CypherEdge shared paths

require('dotenv').config();
const path = require('path');
const os = require('os');

// Detect if running as packaged exe (pkg)
const isPackaged = typeof process.pkg !== 'undefined';

// Get the directory where the exe/script is located
const getExeDir = () => {
  if (isPackaged) {
    // When packaged, use the directory containing the exe
    return path.dirname(process.execPath);
  }
  // When running with node, use the project root
  return path.resolve(__dirname, '..');
};

const projectRoot = path.resolve(__dirname, '..');
const exeDir = getExeDir();

// Determine CypherEdge user data path
// Matches Electron's db.js logic:
//   - Dev (not packaged): frontend/ folder
//   - Prod (packaged): %APPDATA%/CypherEdge/
const getCypherEdgeDataPath = () => {
  // Allow explicit override
  if (process.env.CYPHEREDGE_USER_DATA) {
    return process.env.CYPHEREDGE_USER_DATA;
  }

  // Dev mode: use frontend folder (same as Electron dev)
  if (!isPackaged) {
    const frontendPath = path.resolve(__dirname, '../../beta_testers_ca/frontend');
    const fs = require('fs');
    if (fs.existsSync(frontendPath)) {
      return frontendPath;
    }
  }

  // Prod mode: %APPDATA%/CypherEdge (same as Electron prod)
  return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'CypherEdge');
};

const cypherEdgeDataPath = getCypherEdgeDataPath();

module.exports = {
  // Server settings (for web UI - can be disabled in background mode)
  port: parseInt(process.env.PORT || '8234', 10),
  serverBaseUrl: process.env.SERVER_BASE_URL || `http://localhost:${process.env.PORT || 8234}`,

  // Scan settings
  initialScanDays: parseInt(process.env.INITIAL_SCAN_DAYS || '365', 10),
  intervalMinutes: parseInt(process.env.FETCH_INTERVAL_MINUTES || '30', 10),

  // Python settings (for classifier fallback)
  pythonCmd: process.env.PYTHON || 'python',

  // FastAPI settings (NOT used in Phase 1, kept for reference)
  fastApiUrl: process.env.FASTAPI_URL || 'http://localhost:7500',

  // Project root (this project)
  projectRoot,

  // CypherEdge shared data path
  cypherEdgeDataPath,

  // Paths - SHARED with CypherEdge
  paths: {
    // Local project paths (temporary/working)
    input: path.join(projectRoot, 'input'),
    output: path.join(projectRoot, 'output'),
    credentials: path.join(exeDir, 'credentials.json'),
    classifier: path.join(projectRoot, 'run_classifier.py'),

    // CypherEdge shared paths
    sharedDb: path.join(cypherEdgeDataPath, 'db.sqlite3'),
    sharedTokens: path.join(cypherEdgeDataPath, 'gmail_tokens.json'),
    sharedSettings: path.join(cypherEdgeDataPath, 'auto_fetch_settings.json'),
    autoFetchedPdfs: path.join(cypherEdgeDataPath, 'auto_fetched'),

    // Legacy paths (for backwards compatibility during development)
    usersJson: path.join(projectRoot, 'output', 'users.json'),
    emailDb: path.join(projectRoot, 'output', 'email.db'),
    unprocessed: path.join(projectRoot, 'output', 'unprocessed'),
    rejected: path.join(projectRoot, 'output', 'rejected'),
    mainDb: path.join(projectRoot, 'db.sqlite3'),
  },

  // OAuth scopes
  oauthScopes: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid'
  ],

  // Valid file extensions for attachments
  validExtensions: ['.pdf', '.xlsx', '.xls', '.csv', '.xml', '.txt'],

  // Bank detection - sender domain whitelist
  bankSenderDomains: {
    'hdfcbank.net': 'HDFC Bank',
    'hdfcbank.com': 'HDFC Bank',
    'sbi.co.in': 'State Bank of India',
    'alerts.sbi.co.in': 'State Bank of India',
    'icicibank.com': 'ICICI Bank',
    'axisbank.com': 'Axis Bank',
    'kotak.com': 'Kotak Mahindra Bank',
    'kotakbank.com': 'Kotak Mahindra Bank',
    'yesbank.in': 'Yes Bank',
    'indusind.com': 'IndusInd Bank',
    'canarabank.com': 'Canara Bank',
    'pnb.co.in': 'Punjab National Bank',
    'bankofbaroda.co.in': 'Bank of Baroda',
    'unionbankofindia.co.in': 'Union Bank',
    'idbi.co.in': 'IDBI Bank',
    'federalbank.co.in': 'Federal Bank',
    'rblbank.com': 'RBL Bank',
    'bandhanbank.com': 'Bandhan Bank',
    'sbmbank.co.in': 'SBM Bank',
    'sc.com': 'Standard Chartered',
    'standardchartered.com': 'Standard Chartered',
    'dbs.com': 'DBS Bank',
    'hsbc.co.in': 'HSBC',
    'citi.com': 'Citibank',
    'citibank.com': 'Citibank',
  },

  // Bank detection - filename keywords
  bankFilenameKeywords: {
    'hdfc': 'HDFC Bank',
    'sbi': 'State Bank of India',
    'icici': 'ICICI Bank',
    'axis': 'Axis Bank',
    'kotak': 'Kotak Mahindra Bank',
    'yes': 'Yes Bank',
    'yesbank': 'Yes Bank',
    'indusind': 'IndusInd Bank',
    'canara': 'Canara Bank',
    'pnb': 'Punjab National Bank',
    'bob': 'Bank of Baroda',
    'baroda': 'Bank of Baroda',
    'union': 'Union Bank',
    'idbi': 'IDBI Bank',
    'federal': 'Federal Bank',
    'rbl': 'RBL Bank',
    'bandhan': 'Bandhan Bank',
    'sbm': 'SBM Bank',
    'standard': 'Standard Chartered',
    'dbs': 'DBS Bank',
    'hsbc': 'HSBC',
    'citi': 'Citibank',
  },

  // Email filtering keywords
  emailSubjectKeywords: [
    'statement',
    'e-statement',
    'account statement',
    'bank statement',
    'credit card statement',
    'monthly statement',
  ],

  // Mode configuration
  runMode: process.env.RUN_MODE || 'background', // 'background' or 'web'

  // Background service settings
  backgroundService: {
    enableWebUI: process.env.ENABLE_WEB_UI === 'true',
    autoStart: process.env.AUTO_START !== 'false',
  }
};
