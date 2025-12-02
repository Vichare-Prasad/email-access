// src/config.js
// Centralized configuration for the email service

require('dotenv').config();
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

module.exports = {
  // Server settings
  port: parseInt(process.env.PORT || '8234', 10),
  serverBaseUrl: process.env.SERVER_BASE_URL || `http://localhost:${process.env.PORT || 8234}`,

  // Scan settings
  initialScanDays: parseInt(process.env.INITIAL_SCAN_DAYS || '365', 10),
  intervalMinutes: 0.033, // Default scan interval

  // Python settings
  pythonCmd: process.env.PYTHON || 'python',

  // FastAPI settings
  fastApiUrl: process.env.FASTAPI_URL || 'http://localhost:7500',

  // Paths
  projectRoot,
  paths: {
    input: path.join(projectRoot, 'input'),
    output: path.join(projectRoot, 'output'),
    unprocessed: path.join(projectRoot, 'output', 'unprocessed'),
    rejected: path.join(projectRoot, 'output', 'rejected'),
    usersJson: path.join(projectRoot, 'output', 'users.json'),
    emailDb: path.join(projectRoot, 'output', 'email.db'),
    credentials: path.join(projectRoot, 'credentials.json'),
    classifier: path.join(projectRoot, 'run_classifier.py'),
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
};
