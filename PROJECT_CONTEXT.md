# CypherEdge Auto-Fetch Feature - Complete Project Context

## 📁 Project Locations

```
C:\Users\sanch\Desktop\
├── email-access\              # Standalone email scanner service
└── beta_testers_ca\
    └── frontend\              # CypherEdge Electron app
```

---

## 🔧 Project 1: email-access (Email Scanner Service)

### Path: `C:\Users\sanch\Desktop\email-access\`

### Purpose

Standalone Node.js service that:

- Connects to Gmail via OAuth
- Scans for bank statement PDF attachments
- Downloads and stores PDFs locally
- Writes metadata to shared SQLite database

### Key Files

| File                                    | Purpose                                                   |
| --------------------------------------- | --------------------------------------------------------- |
| `src/background.js`                     | Main entry point. Run with `--setup` for OAuth web server |
| `src/config.js`                         | Centralized config - paths, ports, OAuth scopes           |
| `src/services/AutoFetchEmailService.js` | Core scanning logic, PDF extraction                       |
| `src/services/GmailClient.js`           | Gmail API wrapper, OAuth handling                         |
| `src/services/BankDetector.js`          | Detects bank names from filenames/senders                 |
| `src/services/PatternMatcher.js`        | Fuzzy matching for bank statement detection               |
| `src/services/PasswordChecker.js`       | Checks if PDFs are password protected                     |
| `src/db/AutoFetchDatabase.js`           | Database operations for auto_fetched_statements           |
| `src/routes/webRoutes.js`               | Web routes for OAuth callbacks                            |
| `credentials.json`                      | Google OAuth credentials (client_id, client_secret)       |

### Run Commands

```bash
# OAuth setup mode (starts web server for authentication)
node src/background.js --setup

# Background scanning mode (continuous)
node src/background.js

# Single scan
node src/background.js --scan
```

### Port

- Default: `8234`
- OAuth callback: `http://localhost:8234/oauth/callback`

### Config Paths (from `src/config.js`)

**Dev Mode** (when running with Node):

```javascript
cypherEdgeDataPath = "C:UserssanchDesktop\beta_testers_ca\frontend";
```

**Production Mode** (packaged exe):

```javascript
cypherEdgeDataPath = "%APPDATA%CypherEdge";
```

### Shared Resources

- **Database**: `{cypherEdgeDataPath}/db.sqlite3`
- **Gmail Tokens**: `{cypherEdgeDataPath}/gmail_tokens.json`
- **Settings**: `{cypherEdgeDataPath}/auto_fetch_settings.json`
- **Downloaded PDFs**: `{cypherEdgeDataPath}/auto_fetched/`

---

## 🖥️ Project 2: beta_testers_ca (CypherEdge Electron App)

### Path: `C:\Users\sanch\Desktop\beta_testers_ca\frontend\`

### Purpose

Electron + React desktop app for:

- Processing bank statement PDFs
- Generating financial reports via ML/FastAPI backend
- Managing cases and transactions
- Auto-fetch integration with email-access service

### Key Files

| File                                 | Purpose                                  |
| ------------------------------------ | ---------------------------------------- |
| `main.js`                            | Electron main process entry              |
| `preload.js`                         | Exposes IPC functions to renderer        |
| `ipc/autoFetchedStatements.js`       | IPC handlers for auto-fetch feature      |
| `ipc/generateReport.js`              | Core PDF processing logic                |
| `ipc/reportHandlers.js`              | Report-related IPC handlers              |
| `ipc/emailServiceManager.js`         | Manages email-access as child process    |
| `db/db.js`                           | Database manager (Drizzle ORM)           |
| `db/schema/autoFetchedStatements.js` | Schema for auto_fetched_statements table |

### React Components (in `react-app/src/components/`)

| Component                                      | Purpose                        |
| ---------------------------------------------- | ------------------------------ |
| `AutoFetchedComponents/AutoFetchedContent.jsx` | Main auto-fetch dashboard      |
| `AutoFetchedComponents/OnboardingWizard.jsx`   | Gmail connection wizard        |
| `MainDashboardComponents/RecentReports.js`     | Recent reports table           |
| `MainDashboardComponents/GenerateReport.js`    | Manual PDF upload & processing |

### Run Commands

```bash
# Start everything (FastAPI + React + Electron)
npm run dev

# Just Electron
npm run electron
```

### Ports

- React dev server: `3000`
- FastAPI backend: `7500`
- email-access service: `8234`

---

## 🔗 How They Connect

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CypherEdge Electron App                       │
│                                                                      │
│  ┌──────────────┐    ┌─────────────────┐    ┌──────────────────┐   │
│  │ React UI     │───▶│ preload.js      │───▶│ IPC Handlers     │   │
│  │ (port 3000)  │    │ (bridge)        │    │ (main process)   │   │
│  └──────────────┘    └─────────────────┘    └────────┬─────────┘   │
│                                                       │              │
│                                              ┌────────▼─────────┐   │
│                                              │ emailServiceMgr  │   │
│                                              │ (child process)  │   │
│                                              └────────┬─────────┘   │
└───────────────────────────────────────────────────────┼─────────────┘
                                                        │
                              HTTP calls (port 8234)    │
                                                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     email-access Service                             │
│                                                                      │
│  ┌──────────────┐    ┌─────────────────┐    ┌──────────────────┐   │
│  │ Express      │    │ Gmail Client    │    │ AutoFetch        │   │
│  │ (OAuth)      │    │ (API calls)     │    │ EmailService     │   │
│  └──────────────┘    └─────────────────┘    └──────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Shared SQLite DB
                                    ▼
                    ┌───────────────────────────────┐
                    │        db.sqlite3             │
                    │  - auto_fetched_statements    │
                    │  - cases                      │
                    │  - statements                 │
                    │  - transactions               │
                    └───────────────────────────────┘
```

---

## 📂 Data Paths (IMPORTANT!)

### Dev Mode Path Mismatch Issue

| Component                                    | Dev Mode Location           |
| -------------------------------------------- | --------------------------- |
| **Electron App** (`app.getPath("userData")`) | `%APPDATA%\Electron\`       |
| **email-access** (hardcoded)                 | `beta_testers_ca\frontend\` |

This causes settings files to be written to different locations!

### Production Mode (Consistent)

Both use: `%APPDATA%\CypherEdge\`

### Settings File Location

```
# Dev - Electron writes here:
%APPDATA%\Electron\auto_fetch_settings.json

# Dev - email-access reads from:
C:\Users\sanch\Desktop\beta_testers_ca\frontend\auto_fetch_settings.json

# Production - Both use:
%APPDATA%\CypherEdge\auto_fetch_settings.json
```

### To Reset Onboarding (Dev Mode)

Delete from BOTH locations:

```powershell
Remove-Item "$env:APPDATA\Electron\auto_fetch_settings.json" -Force
Remove-Item "C:\Users\sanch\Desktop\beta_testers_ca\frontend\auto_fetch_settings.json" -Force
```

---

## 🔄 Auto-Fetch Processing Flow

### 1. User Clicks "Process" on Auto-Fetched Statement

```
AutoFetchedContent.jsx
    │
    ▼ handleProcess(statement)
    │
    ▼ window.electron.processAutoFetchedStatement(emailMessageId, caseName)
    │   └── ipc/autoFetchedStatements.js: Updates status to "processing"
    │       Returns: { success, fileData: { pdf_paths, bankName, passwords, ... } }
    │
    ▼ window.electron.generateReportIpc({ files: [fileData] }, caseName, "generate-report")
    │   └── ipc/generateReport.js: Same pipeline as manual "Generate Report"
    │       - Copies PDF to temp folder
    │       - Calls FastAPI (port 7500) for ML extraction
    │       - Saves results to database
    │
    ▼ window.electron.markAutoFetchedCompleted(emailMessageId, caseId, caseName)
        └── Updates auto_fetched_statements status to "completed"
```

### 2. Manual "Generate Report" Flow

```
GenerateReport.js
    │
    ▼ User selects PDFs from file picker
    │
    ▼ window.electron.generateReportIpc({ files }, caseName, "generate-report")
    │   └── Same ipc/generateReport.js pipeline
    │
    ▼ updateReportData({ recentReportsData: [newData, ...existing] })
        └── Updates React context → Recent Reports table updates immediately
```

### Key Difference (BUG!)

- **GenerateReport.js**: Updates `recentReportsData` React context ✅
- **AutoFetchedContent.jsx**: Does NOT update the context ❌

This is why auto-fetched processed statements don't appear in Recent Reports immediately.

---

## 🗄️ Database Schema

### Table: `auto_fetched_statements`

```sql
CREATE TABLE auto_fetched_statements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Source Information
    gmail_account TEXT NOT NULL,
    email_message_id TEXT NOT NULL UNIQUE,
    email_subject TEXT,
    email_from TEXT,
    email_date TEXT,

    -- PDF Information
    pdf_filename TEXT NOT NULL,
    pdf_path TEXT NOT NULL,
    pdf_size INTEGER,

    -- Detection Results
    detected_bank TEXT,
    detection_method TEXT,
    is_password_protected INTEGER DEFAULT 0,

    -- Processing Status
    status TEXT DEFAULT 'pending',  -- pending, needs_password, processing, completed, failed, deleted
    error_message TEXT,
    temp_password TEXT,

    -- User Action Tracking
    user_action TEXT,  -- processed, deleted, ignored
    actioned_at INTEGER,
    target_case_id INTEGER,
    target_case_name TEXT,

    -- Timestamps
    fetched_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
```

---

## 🔐 OAuth Flow

### Credentials

- File: `email-access/credentials.json`
- Client ID: `1016771744014-sflkvg8o041amjd34st7ge8sekpttorl.apps.googleusercontent.com`
- Redirect URI: `http://localhost:8234/oauth/callback`

### Flow

1. User clicks "Connect Gmail" in OnboardingWizard
2. Electron calls `window.electron.openGmailOAuth()`
3. Opens browser to `http://localhost:8234/auth` (email-access service)
4. email-access redirects to Google OAuth consent screen
5. User grants permission, Google redirects to `http://localhost:8234/oauth/callback`
6. email-access exchanges code for tokens, stores in `gmail_tokens.json`
7. Electron polls `window.electron.pollGmailAccounts()` to detect new account

### Important: Service Must Be Running with `--setup` Flag

```bash
node src/background.js --setup
```

Without `--setup`, the OAuth routes (`/auth`, `/oauth/callback`) are not registered!

---

## 🐛 Known Issues

### 1. Dev Path Mismatch

- **Cause**: Electron uses `%APPDATA%\Electron\`, email-access uses `frontend\`
- **Fix**: Make email-access use same path as Electron, OR set `CYPHEREDGE_USER_DATA` env var

### 2. Auto-Fetch Doesn't Update Recent Reports

- **Cause**: `AutoFetchedContent.jsx` doesn't call `updateReportData()` after processing
- **Fix**: Add context update like GenerateReport.js does

### 3. OAuth Stuck After Clicking Continue

- **Cause**: email-access service not running, or running without `--setup` flag
- **Fix**: Run `node src/background.js --setup`

### 4. "Unknown" Bank Detection

- **Cause**: BankDetector couldn't match filename/sender to known patterns
- **Impact**: Minor - processing still works

---

## 📋 Quick Commands Reference

### Reset Onboarding (Dev)

```powershell
Remove-Item "$env:APPDATA\Electron\auto_fetch_settings.json" -Force
```

### Clear Auto-Fetched Statements

```powershell
cd C:\Users\sanch\Desktop\beta_testers_ca\frontend
sqlite3 db.sqlite3 "DELETE FROM auto_fetched_statements"
```

### Start email-access for OAuth

```powershell
cd C:\Users\sanch\Desktop\email-access
node src/background.js --setup
```

### Check Service Status

```powershell
Invoke-WebRequest -Uri "http://localhost:8234/" -UseBasicParsing
Invoke-WebRequest -Uri "http://localhost:8234/auth-url" -UseBasicParsing
```

### Check What's on Port 8234

```powershell
netstat -ano | findstr ":8234"
```

---

## 🎨 UI Components Updated

### OnboardingWizard.jsx

- Location: `beta_testers_ca/frontend/react-app/src/components/AutoFetchedComponents/OnboardingWizard.jsx`
- 4 steps: Welcome → Connect Gmail → Settings → Done
- Uses Card components matching app's design system
- Text changed from "download" to "process"

---

## 📝 Next Steps / TODO

1. **Fix path mismatch** - Make both projects use consistent paths in dev mode
2. **Fix Recent Reports update** - Add `updateReportData()` call in AutoFetchedContent.jsx
3. **Add proper error handling** - Show user-friendly errors when service isn't running
4. **Auto-start email-access** - Consider auto-starting service from Electron in dev mode
