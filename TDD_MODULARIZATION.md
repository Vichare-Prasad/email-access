# Technical Design Document: Code Modularization

## Overview
Refactor `serverdd.js` (2300+ lines) into clean, separated modules while keeping **exact same functionality**.

---

## Current State

### Single File Problem
```
serverdd.js (2319 lines)
├── Lines 1-60      → Stub functions, imports
├── Lines 63-288    → FastAPI integration (callMainExeAnalyzeEndpoint_sendJson)
├── Lines 298-395   → processOpportunityToEarnData
├── Lines 402-513   → handleFastApiResult helper
├── Lines 517-1823  → EmailService class (MAIN LOGIC)
├── Lines 1831-2251 → startWebAuthServer (Express routes)
├── Lines 2256-2306 → Main startup code
└── Lines 2309      → module.exports
```

### Existing Modules (Already Clean)
- `db.js` - DatabaseManager class (singleton)
- `dataProcessor.js` - FastAPI response processing
- `schema/` - Drizzle ORM schemas

---

## Proposed Structure

```
email-access/
├── src/
│   ├── index.js              # Entry point (startup only)
│   ├── config.js             # Environment & configuration
│   ├── services/
│   │   ├── EmailService.js   # Core email scanning logic
│   │   ├── GmailClient.js    # Gmail API wrapper
│   │   ├── Classifier.js     # Python classifier wrapper
│   │   └── FastAPIClient.js  # FastAPI integration
│   ├── routes/
│   │   └── webRoutes.js      # Express routes
│   └── utils/
│       ├── logger.js         # Console logging wrapper
│       ├── fileUtils.js      # File hash, move, copy
│       └── tokenStore.js     # OAuth token persistence
├── db.js                     # (keep as-is)
├── dataProcessor.js          # (keep as-is)
├── schema/                   # (keep as-is)
├── classifier.py             # (keep as-is)
└── run_classifier.py         # (keep as-is)
```

---

## Module Breakdown

### 1. `src/config.js`
**Purpose:** Centralize all configuration

**Extract from serverdd.js:**
- Environment variables
- Default paths
- OAuth scopes

```javascript
// src/config.js
module.exports = {
  port: process.env.PORT || 8234,
  serverBaseUrl: process.env.SERVER_BASE_URL || 'http://localhost:8234',
  initialScanDays: parseInt(process.env.INITIAL_SCAN_DAYS || '365'),
  pythonCmd: process.env.PYTHON || 'python',
  fastApiUrl: process.env.FASTAPI_URL || 'http://localhost:7500',

  paths: {
    input: 'input',
    output: 'output',
    unprocessed: 'output/unprocessed',
    rejected: 'output/rejected',
    usersJson: 'output/users.json',
    emailDb: 'output/email.db',
  },

  oauthScopes: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid'
  ],

  validExtensions: ['.pdf', '.xlsx', '.xls', '.csv', '.xml', '.txt'],
};
```

---

### 2. `src/utils/logger.js`
**Purpose:** Consistent logging

```javascript
// src/utils/logger.js
module.exports = {
  info: (...args) => console.log(...args),
  warn: (...args) => console.warn('⚠️', ...args),
  error: (...args) => console.error('❌', ...args),
  success: (...args) => console.log('✅', ...args),
};
```

---

### 3. `src/utils/fileUtils.js`
**Purpose:** File operations

**Extract from EmailService:**
- `computeFileHash()` (lines 1282-1290)
- `_splitNameExt()` (lines 1339-1343)
- `_exists()` (lines 1345-1352)

```javascript
// src/utils/fileUtils.js
const crypto = require('crypto');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

async function computeFileHash(filePath) { ... }
function splitNameExt(filename) { ... }
async function exists(p) { ... }
async function ensureDir(p) { ... }

module.exports = { computeFileHash, splitNameExt, exists, ensureDir };
```

---

### 4. `src/utils/tokenStore.js`
**Purpose:** OAuth token persistence

**Extract from EmailService:**
- `_persistUserTokens()` (lines 733-806)
- `getOAuthClientForEmail()` (lines 841-934)
- Token refresh handler

```javascript
// src/utils/tokenStore.js
class TokenStore {
  constructor(usersJsonPath) { ... }
  async save(email, tokens) { ... }
  async load(email) { ... }
  async listUsers() { ... }
}

module.exports = TokenStore;
```

---

### 5. `src/services/GmailClient.js`
**Purpose:** Gmail API interactions

**Extract from EmailService:**
- `_loadCredentialsFromFile()` (lines 552-595)
- `_createOAuth2Client()` (lines 716-722)
- `getAuthUrl()` (lines 724-731)
- `handleOAuthCode()` (lines 808-839)
- `checkEmails()` (lines 1049-1220)
- `extractAttachments()` (lines 1223-1276)

```javascript
// src/services/GmailClient.js
const { google } = require('googleapis');

class GmailClient {
  constructor(config, tokenStore) { ... }

  loadCredentials() { ... }
  createOAuth2Client() { ... }
  getAuthUrl() { ... }
  async handleOAuthCode(code) { ... }
  async getClientForEmail(email) { ... }
  async fetchEmails(query) { ... }
  async extractAttachments(messageId, payload) { ... }
}

module.exports = GmailClient;
```

---

### 6. `src/services/Classifier.js`
**Purpose:** Python classifier wrapper

**Extract from EmailService:**
- `runBatchClassifier()` (lines 1354-1617)

```javascript
// src/services/Classifier.js
const { exec } = require('child_process');

class Classifier {
  constructor(pythonCmd, classifierPath) { ... }

  async classifyFiles(inputDir, outputDir) { ... }
  parseResults(stdout) { ... }
}

module.exports = Classifier;
```

---

### 7. `src/services/FastAPIClient.js`
**Purpose:** FastAPI integration

**Extract from serverdd.js:**
- `callMainExeAnalyzeEndpoint_sendJson()` (lines 63-288)
- `handleFastApiResult()` (lines 402-513)
- `processOpportunityToEarnData()` (lines 329-395)

```javascript
// src/services/FastAPIClient.js
const axios = require('axios');

class FastAPIClient {
  constructor(baseUrl) { ... }

  async analyzeStatements(pdfPaths, options) { ... }
  parseResponse(result) { ... }
  async processOpportunityToEarn(data, caseName) { ... }
}

module.exports = FastAPIClient;
```

---

### 8. `src/services/EmailService.js`
**Purpose:** Core orchestration (MUCH SMALLER)

**Keep only:**
- Service state management
- Orchestration logic
- Database interactions

```javascript
// src/services/EmailService.js
const GmailClient = require('./GmailClient');
const Classifier = require('./Classifier');
const config = require('../config');

class EmailService {
  constructor(opts = {}) {
    this.gmailClient = new GmailClient(config, this.tokenStore);
    this.classifier = new Classifier(config.pythonCmd, ...);
    // ... minimal state
  }

  async init() { ... }
  async start() { ... }
  async stop() { ... }
  async triggerScan() { ... }
  async processAttachment(file) { ... }
}

module.exports = EmailService;
```

---

### 9. `src/routes/webRoutes.js`
**Purpose:** Express route handlers

**Extract from serverdd.js:**
- `startWebAuthServer()` (lines 1831-2251)

```javascript
// src/routes/webRoutes.js
const express = require('express');

function createRouter(emailService) {
  const router = express.Router();

  router.get('/', (req, res) => { ... });
  router.get('/auth', (req, res) => { ... });
  router.get('/oauth/callback', async (req, res) => { ... });
  router.get('/users', async (req, res) => { ... });
  router.get('/trigger', async (req, res) => { ... });
  router.get('/status', async (req, res) => { ... });

  return router;
}

module.exports = { createRouter };
```

---

### 10. `src/index.js`
**Purpose:** Clean entry point

```javascript
// src/index.js
require('dotenv').config();
const express = require('express');
const config = require('./config');
const EmailService = require('./services/EmailService');
const { createRouter } = require('./routes/webRoutes');

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   EMAIL SERVICE - GMAIL SCANNER        ║');
  console.log('╚════════════════════════════════════════╝\n');

  const service = new EmailService();
  await service.init();

  const app = express();
  app.use('/', createRouter(service));

  app.listen(config.port, () => {
    console.log(`Server running at ${config.serverBaseUrl}`);
  });

  // Auto-start if user exists
  const activeUser = await service.getActiveUser();
  if (activeUser) {
    await service.start();
  }
}

main().catch(console.error);
```

---

## File Size Comparison

| File | Before | After |
|------|--------|-------|
| serverdd.js | 2319 lines | DELETED |
| src/index.js | - | ~40 lines |
| src/config.js | - | ~30 lines |
| src/services/EmailService.js | - | ~200 lines |
| src/services/GmailClient.js | - | ~300 lines |
| src/services/Classifier.js | - | ~150 lines |
| src/services/FastAPIClient.js | - | ~200 lines |
| src/routes/webRoutes.js | - | ~250 lines |
| src/utils/fileUtils.js | - | ~50 lines |
| src/utils/tokenStore.js | - | ~100 lines |
| src/utils/logger.js | - | ~10 lines |

**Total: ~1330 lines (spread across 11 focused files)**

---

## Migration Steps

1. Create `src/` folder structure
2. Create `src/config.js` first (no dependencies)
3. Create `src/utils/` modules
4. Create `src/services/GmailClient.js`
5. Create `src/services/Classifier.js`
6. Create `src/services/FastAPIClient.js`
7. Create `src/services/EmailService.js` (uses above)
8. Create `src/routes/webRoutes.js`
9. Create `src/index.js`
10. Test everything works
11. Delete `serverdd.js`
12. Update `package.json` main entry

---

## What Stays The Same

- All functionality
- All endpoints
- All file paths
- OAuth flow
- Classifier behavior
- Database schemas
- Output folders

---

## What Changes

- Code organization only
- Easier to read
- Easier to test
- Easier to modify

---

## Ready to Implement?

Let me know if you approve this TDD, and I'll start the refactoring.
