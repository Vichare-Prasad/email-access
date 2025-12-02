# CypherEdge Email Auto-Fetch Service - Complete Documentation

**Last Updated:** December 2, 2025
**Status:** Phase 2 Integration Complete (Testing Required)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Email-Access Service (Standalone)](#3-email-access-service-standalone)
4. [CypherEdge Electron Integration](#4-cypheredge-electron-integration)
5. [OAuth Flow](#5-oauth-flow)
6. [Database Schema](#6-database-schema)
7. [Settings & Configuration](#7-settings--configuration)
8. [File-by-File Reference](#8-file-by-file-reference)
9. [IPC Handlers Reference](#9-ipc-handlers-reference)
10. [Testing Checklist](#10-testing-checklist)
11. [Known Issues & Pending Work](#11-known-issues--pending-work)
12. [How to Resume Development](#12-how-to-resume-development)

---

## 1. Project Overview

### What is This?

The **Email Auto-Fetch Service** is a system that automatically scans Gmail accounts for bank statement PDF attachments, downloads them, detects if they're password-protected, and prepares them for analysis by CypherEdge's FastAPI backend.

### Problem It Solves

Users receive bank statements via email. Instead of manually downloading each PDF:
1. The service automatically scans Gmail for bank statement emails
2. Downloads PDF attachments
3. Identifies the bank (HDFC, SBI, ICICI, Axis, etc.)
4. Detects password-protected PDFs
5. Stores them ready for processing

### Two Components

1. **email-access** (`C:\Users\sanch\Desktop\email-access\`)
   - Standalone Node.js service
   - Handles Gmail OAuth, email scanning, PDF downloading
   - Runs on port 8234
   - Can run as Windows service or child process

2. **CypherEdge Electron App** (`C:\Users\sanch\Desktop\beta_testers_ca\frontend\`)
   - User interface for the auto-fetch feature
   - Onboarding wizard for first-time setup
   - Statements table showing fetched PDFs
   - Processing integration with FastAPI

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CypherEdge Electron App                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ OnboardingWizard│  │AutoFetchedState-│  │  Settings Panel │ │
│  │    (React)      │  │   ments Page    │  │    (Future)     │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
│           │                    │                    │           │
│           └────────────────────┼────────────────────┘           │
│                                │                                 │
│                    ┌───────────▼───────────┐                    │
│                    │   IPC Handlers        │                    │
│                    │ (autoFetchedStatements│                    │
│                    │  .js, preload.js)     │                    │
│                    └───────────┬───────────┘                    │
│                                │                                 │
└────────────────────────────────┼────────────────────────────────┘
                                 │
                    HTTP API (port 8234)
                                 │
┌────────────────────────────────▼────────────────────────────────┐
│                    Email-Access Service                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  GmailClient    │  │ AutoFetchEmail  │  │ PasswordChecker │ │
│  │  (OAuth, API)   │  │    Service      │  │   (pdf-lib)     │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
│           │                    │                    │           │
│           └────────────────────┼────────────────────┘           │
│                                │                                 │
│                    ┌───────────▼───────────┐                    │
│                    │   SQLite Database     │                    │
│                    │ (auto_fetched_state-  │                    │
│                    │      ments table)     │                    │
│                    └───────────────────────┘                    │
└─────────────────────────────────────────────────────────────────┘
                                 │
                           Gmail API
                                 │
┌────────────────────────────────▼────────────────────────────────┐
│                         Gmail Inbox                              │
│     Bank statement emails with PDF attachments                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Email-Access Service (Standalone)

### Location
`C:\Users\sanch\Desktop\email-access\`

### Purpose
Standalone service that can run independently or be controlled by Electron.

### Key Files

#### `src/background.js` - Main Entry Point
- Express server on port 8234
- Handles CLI arguments: `--setup`, `--scan`, (default: background mode)
- Routes:
  - `GET /` - Home page with quick actions
  - `GET /auth` - Redirects to Google OAuth
  - `GET /auth-url` - Returns OAuth URL as JSON (for Electron)
  - `GET /oauth/callback` - Handles OAuth callback
  - `GET /api/accounts` - List authorized accounts
  - `GET /api/stats` - Service statistics
  - `POST /api/scan` - Trigger manual scan
  - `GET /users` - List all users with tokens

#### `src/services/AutoFetchEmailService.js` - Core Service
- Manages email scanning workflow
- Coordinates GmailClient, PasswordChecker, BankIdentifier
- Handles scheduled scanning intervals
- Key methods:
  - `start()` - Begin scanning loop
  - `stop()` - Stop scanning
  - `triggerScan()` - Manual scan trigger
  - `getAuthUrl()` - Get OAuth URL
  - `handleOAuthCode(code)` - Complete OAuth flow

#### `src/services/GmailClient.js` - Gmail API Wrapper
- OAuth2 authentication with Google
- Email search and retrieval
- Attachment downloading
- Token management (refresh tokens)
- Key methods:
  - `getAuthUrl()` - Generate OAuth URL
  - `authenticate(code)` - Exchange code for tokens
  - `searchEmails(query)` - Search Gmail
  - `getEmailWithAttachments(messageId)` - Get email details
  - `downloadAttachment(messageId, attachmentId)` - Download PDF

#### `src/services/PasswordChecker.js` - PDF Password Detection
- Uses `pdf-lib` to detect password-protected PDFs
- Attempts to load PDF without password
- If it fails with encryption error → password protected
- Key methods:
  - `checkPdfProtection(filePath)` - Returns `{ isProtected: boolean }`
  - `verifyPassword(filePath, password)` - Test if password is correct

#### `src/services/BankIdentifier.js` - Bank Detection
- Identifies bank from email sender, subject, or filename
- Supported banks: HDFC, SBI, ICICI, Axis, Kotak, Yes Bank, IndusInd, SBM
- Key method:
  - `identifyBank(email, filename)` - Returns bank name or "Unknown"

#### `src/services/SettingsManager.js` - Settings Persistence
- Manages `auto_fetch_settings.json`
- Stores: mode, date range, accounts, onboarding status
- Location: `%APPDATA%/CypherEdge/auto_fetch_settings.json`

### Running the Service

```bash
# Setup mode - Start web server for OAuth
node src/background.js --setup

# Single scan - Scan once and exit
node src/background.js --scan

# Background mode - Continuous scanning (requires accounts)
node src/background.js
```

### Environment Variables (`.env`)
```env
PORT=8234
SERVER_BASE_URL=http://localhost:8234
GOOGLE_CLIENT_ID=1016771744014-sflkvg...
GOOGLE_CLIENT_SECRET=GOCSPX-...
INITIAL_SCAN_DAYS=365
```

### Google OAuth Credentials
- File: `credentials.json`
- Redirect URI: `http://localhost:8234/oauth/callback`
- Scopes: `gmail.readonly`

---

## 4. CypherEdge Electron Integration

### Location
`C:\Users\sanch\Desktop\beta_testers_ca\frontend\`

### Key Files Modified/Created

#### `react-app/src/Pages/AutoFetchedStatements.js`
- Main page for the auto-fetch feature
- Shows onboarding wizard if not onboarded
- Displays stats cards (Total, Pending, Needs Password, etc.)
- Shows statements table with actions (View PDF, Enter Password, Process)

#### `react-app/src/components/AutoFetchedComponents/OnboardingWizard.jsx` (NEW)
- 5-step wizard: Welcome → Connect Gmail → Select Mode → Date Range → Done
- Full-width design (no Card wrapper, no "box in box")
- Uses `openGmailOAuthPopup()` for in-app OAuth
- Progress bar at top, content in middle, navigation at bottom

#### `ipc/autoFetchedStatements.js` (HEAVILY MODIFIED)
- All IPC handlers for the auto-fetch feature
- Settings management (get, update, onboarding)
- Database queries for statements
- Gmail OAuth handlers:
  - `get-gmail-auth-url` - Get OAuth URL from service
  - `open-gmail-oauth-popup` - **NEW** Opens BrowserWindow with Google Sign-In
  - `add-gmail-account` - Add account to settings
  - `remove-gmail-account` - Remove account
  - `refresh-gmail-accounts` - Sync accounts from service

#### `ipc/emailServiceManager.js` (NEW)
- Manages email service as child process
- Start/stop service based on mode setting
- IPC handlers:
  - `email-service:start`
  - `email-service:stop`
  - `email-service:status`
  - `email-service:trigger-scan`

#### `ipc/autoProcessing.js` (NEW)
- Auto-processes pending statements on app startup
- Only processes non-password-protected PDFs
- Uses existing `generateReportIpc` flow
- IPC handlers:
  - `auto-processing:run`
  - `auto-processing:status`
  - `auto-processing:toggle`

#### `preload.js` (MODIFIED)
- Exposed new APIs to renderer:
  ```javascript
  autoFetchSettings: {
    get: () => ...,
    update: (updates) => ...,
    isOnboarded: () => ...,
    completeOnboarding: () => ...,
    getAccounts: () => ...,
  },
  getGmailAuthUrl: () => ...,
  openGmailOAuthPopup: () => ...,  // NEW
  addGmailAccount: (email) => ...,
  removeGmailAccount: (email) => ...,
  refreshGmailAccounts: () => ...,
  emailService: { start, stop, status, triggerScan },
  autoProcessing: { run, status, toggle },
  ```

#### `main.js` (MODIFIED)
- Added imports for new IPC modules
- Registered new IPC handlers
- Added startup logic for email service and auto-processing
- Added cleanup on app quit

#### `db/schema/AutoFetchedStatements.js` (NEW)
- Drizzle ORM schema for `auto_fetched_statements` table
- Defines all columns and types

---

## 5. OAuth Flow

### How OAuth Works (In-App Popup)

1. **User clicks "Connect Gmail Account"** in OnboardingWizard
2. **OnboardingWizard calls** `window.electron.openGmailOAuthPopup()`
3. **IPC handler** (`open-gmail-oauth-popup`) does:
   - Fetches OAuth URL from `http://localhost:8234/auth-url`
   - Creates Electron `BrowserWindow` (600x700, sandbox mode)
   - Loads the Google OAuth URL in the window
4. **User sees Google Sign-In** inside Electron popup
5. **User completes authorization** → Google redirects to `localhost:8234/oauth/callback`
6. **email-access service** handles callback:
   - Exchanges code for tokens
   - Saves tokens to `output/users.json`
   - Shows success page
7. **IPC handler detects success** (monitors `did-navigate` event)
8. **Fetches updated accounts** from `http://localhost:8234/api/accounts`
9. **Updates local settings** with new account email
10. **Closes popup** after 2-second delay
11. **Returns result** to OnboardingWizard: `{ success: true, email: "..." }`

### Key Files for OAuth

| Component | File | Purpose |
|-----------|------|---------|
| Popup handler | `ipc/autoFetchedStatements.js:424-543` | Creates BrowserWindow, monitors OAuth |
| OAuth URL endpoint | `email-access/src/background.js:214-221` | Returns OAuth URL as JSON |
| OAuth callback | `email-access/src/background.js:223-280` | Handles Google redirect |
| Token storage | `email-access/output/users.json` | Stores OAuth tokens |
| GmailClient OAuth | `email-access/src/services/GmailClient.js` | OAuth2 implementation |

---

## 6. Database Schema

### Table: `auto_fetched_statements`

Located in: `%APPDATA%/CypherEdge/db.sqlite3`

```sql
CREATE TABLE auto_fetched_statements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_message_id TEXT UNIQUE NOT NULL,      -- Gmail message ID
  email_subject TEXT,                          -- Email subject line
  email_from TEXT,                             -- Sender email address
  email_date INTEGER,                          -- Unix timestamp (seconds)
  pdf_filename TEXT NOT NULL,                  -- Original filename
  pdf_path TEXT NOT NULL,                      -- Local file path
  pdf_size INTEGER,                            -- File size in bytes
  detected_bank TEXT,                          -- Identified bank name
  is_password_protected INTEGER DEFAULT 0,     -- 0=no, 1=yes
  status TEXT DEFAULT 'pending',               -- pending/needs_password/processing/completed/failed
  target_case_id INTEGER,                      -- CypherEdge case ID (after processing)
  target_case_name TEXT,                       -- Generated case name
  error_message TEXT,                          -- Error details if failed
  fetched_at INTEGER NOT NULL,                 -- When downloaded (unix timestamp)
  processed_at INTEGER,                        -- When processed (unix timestamp)
  created_at INTEGER,                          -- Record created
  updated_at INTEGER,                          -- Record updated
  gmail_account TEXT                           -- Which Gmail account this came from
);
```

### Status Values

| Status | Meaning |
|--------|---------|
| `pending` | Downloaded, ready to process |
| `needs_password` | PDF is password-protected, waiting for user input |
| `processing` | Currently being analyzed by FastAPI |
| `completed` | Successfully processed, case created |
| `failed` | Processing failed (see error_message) |

---

## 7. Settings & Configuration

### Settings File Location
`%APPDATA%/CypherEdge/auto_fetch_settings.json`

### Settings Schema

```json
{
  "mode": "when_app_open",      // "when_app_open" or "24/7"
  "enabled": true,
  "intervalMinutes": 30,         // Scan interval
  "dateRangePreset": "30days",   // "today", "7days", "30days", "all"
  "customStartDate": null,       // For custom date range
  "customEndDate": null,
  "scanDays": 365,               // Legacy setting
  "activeAccounts": [            // Connected Gmail accounts
    "user@gmail.com"
  ],
  "onboardingCompleted": true,
  "autoProcessOnStartup": true,  // Auto-process pending PDFs
  "lastScanTime": 1701532800,
  "serviceStartedAt": 1701532800,
  "lastError": null,
  "totalFetched": 113,
  "fetchedToday": 5,
  "lastFetchDate": "2025-12-02"
}
```

### Mode Descriptions

| Mode | Behavior |
|------|----------|
| `when_app_open` | Email service runs as child process while Electron is open |
| `24/7` | Email service runs as Windows service, always scanning |

---

## 8. File-by-File Reference

### Email-Access Service (`C:\Users\sanch\Desktop\email-access\`)

| File | Purpose |
|------|---------|
| `src/background.js` | Main entry point, Express server, CLI handling |
| `src/services/AutoFetchEmailService.js` | Core service orchestration |
| `src/services/GmailClient.js` | Gmail API wrapper, OAuth |
| `src/services/PasswordChecker.js` | PDF password detection (pdf-lib) |
| `src/services/BankIdentifier.js` | Bank identification from email/filename |
| `src/services/SettingsManager.js` | Settings persistence |
| `src/services/TokenStore.js` | OAuth token storage |
| `credentials.json` | Google OAuth credentials |
| `output/users.json` | Stored OAuth tokens |
| `.env` | Environment configuration |
| `package.json` | Dependencies (googleapis, pdf-lib, express, etc.) |

### CypherEdge Electron (`C:\Users\sanch\Desktop\beta_testers_ca\frontend\`)

| File | Purpose |
|------|---------|
| `main.js` | Electron main process, IPC registration |
| `preload.js` | Exposes APIs to renderer |
| `ipc/autoFetchedStatements.js` | All auto-fetch IPC handlers |
| `ipc/emailServiceManager.js` | Child process management |
| `ipc/autoProcessing.js` | Startup auto-processing |
| `db/schema/AutoFetchedStatements.js` | Database schema |
| `react-app/src/Pages/AutoFetchedStatements.js` | Main UI page |
| `react-app/src/components/AutoFetchedComponents/OnboardingWizard.jsx` | Setup wizard |
| `react-app/src/components/AutoFetchedComponents/PasswordEntryModal.jsx` | Password input modal |

---

## 9. IPC Handlers Reference

### Auto-Fetch Settings

| Handler | Purpose |
|---------|---------|
| `get-auto-fetch-settings` | Get current settings |
| `update-auto-fetch-settings` | Update settings |
| `is-auto-fetch-onboarded` | Check if onboarding completed |
| `complete-auto-fetch-onboarding` | Mark onboarding done |
| `get-auto-fetch-accounts` | Get connected Gmail accounts |

### Gmail OAuth

| Handler | Purpose |
|---------|---------|
| `get-gmail-auth-url` | Get OAuth URL from service |
| `open-gmail-oauth-popup` | **Open in-app OAuth popup** |
| `add-gmail-account` | Add account to settings |
| `remove-gmail-account` | Remove account |
| `refresh-gmail-accounts` | Sync accounts from service |

### Statements

| Handler | Purpose |
|---------|---------|
| `get-auto-fetched-statements` | Query statements from DB |
| `get-auto-fetched-stats` | Get counts by status |
| `process-auto-fetched-statement` | Prepare statement for FastAPI |
| `mark-auto-fetched-completed` | Update status to completed |
| `mark-auto-fetched-failed` | Update status to failed |
| `save-pdf-password` | Save password for protected PDF |

### Email Service Management

| Handler | Purpose |
|---------|---------|
| `email-service:start` | Start service as child process |
| `email-service:stop` | Stop child process |
| `email-service:status` | Get running status |
| `email-service:trigger-scan` | Trigger manual scan |

### Auto-Processing

| Handler | Purpose |
|---------|---------|
| `auto-processing:run` | Process pending statements |
| `auto-processing:status` | Get auto-process settings |
| `auto-processing:toggle` | Enable/disable auto-process |

---

## 10. Testing Checklist

### Prerequisites
- [ ] Email-access service running: `node src/background.js --setup`
- [ ] Port 8234 is available
- [ ] CypherEdge Electron app restarted after code changes

### OAuth Flow
- [ ] Click "Connect Gmail Account" opens Electron popup (not Chrome)
- [ ] Google Sign-In page loads in popup
- [ ] Can select Google account and authorize
- [ ] Popup closes automatically after success
- [ ] Account appears in "Account Connected" section
- [ ] Can add multiple accounts

### Onboarding Wizard
- [ ] Wizard appears on first visit to Auto-Fetched Statements
- [ ] Full-width design (no nested boxes)
- [ ] Progress bar shows current step
- [ ] Can navigate forward/backward
- [ ] "Skip for now" works on welcome step
- [ ] Mode selection saves correctly
- [ ] Date range selection saves correctly
- [ ] "Start Auto-Fetching" completes onboarding

### Statements Table
- [ ] Shows fetched statements with correct data
- [ ] Status badges display correctly
- [ ] "View PDF" opens PDF file
- [ ] "Enter Password" opens modal for protected PDFs
- [ ] "Process" button triggers FastAPI analysis
- [ ] Refresh button updates the list

### Auto-Processing
- [ ] Pending statements process on app startup (if enabled)
- [ ] Password-protected PDFs are skipped
- [ ] Status updates correctly after processing

---

## 11. Known Issues & Pending Work

### Known Issues

1. **Process button error**: Screenshot showed "Error invoking remote method 'generate-report': [object Object]" - needs investigation in FastAPI integration

2. **Service auto-close**: The email-access service may close when run with `&` in bash - use long timeout or separate terminal

3. **Electron app restart required**: Any changes to IPC handlers or preload.js require full Electron app restart

### Pending Work

1. **24/7 Mode Implementation**: Windows service installation not fully implemented
   - Need: `emailService.exe --install` command
   - Need: Service management in Settings panel

2. **Settings Panel**: UI for changing settings after onboarding
   - Date range adjustment
   - Mode switching
   - Account management

3. **Password Entry Flow**:
   - Currently saves password to DB
   - Need to re-trigger PDF processing after password entry

4. **Error Handling**:
   - Better error messages for users
   - Retry logic for failed processes

5. **Bank Detection Improvements**:
   - Add more banks
   - Improve detection accuracy

---

## 12. How to Resume Development

### Step 1: Start the Email-Access Service

```bash
cd C:\Users\sanch\Desktop\email-access
node src/background.js --setup
```

This starts the service on port 8234 with the web UI for OAuth.

### Step 2: Start CypherEdge Electron App

```bash
cd C:\Users\sanch\Desktop\beta_testers_ca\frontend
npm start
```

Or from the project root with the usual development command.

### Step 3: Navigate to Auto-Fetched Statements

- Open the sidebar
- Click "Auto-Fetched Statements"
- If not onboarded, you'll see the wizard
- If already onboarded, you'll see the statements table

### Step 4: Test OAuth Flow

1. Click "Connect Gmail Account"
2. Should see Electron popup with Google Sign-In
3. Complete authorization
4. Popup should close, account should appear

### Key Commands

```bash
# Check if service is running
netstat -ano | findstr :8234

# Kill process on port (if stuck)
taskkill /F /PID <process_id>

# Run single email scan
cd C:\Users\sanch\Desktop\email-access
node src/background.js --scan

# Check logs
# Electron logs: DevTools console (Ctrl+Shift+I in app)
# Service logs: Console output where service is running
```

### Important Paths

| What | Path |
|------|------|
| Email service | `C:\Users\sanch\Desktop\email-access\` |
| Electron app | `C:\Users\sanch\Desktop\beta_testers_ca\frontend\` |
| Settings file | `%APPDATA%\CypherEdge\auto_fetch_settings.json` |
| Database | `%APPDATA%\CypherEdge\db.sqlite3` |
| Downloaded PDFs | `%APPDATA%\CypherEdge\auto_fetched\` |
| OAuth tokens | `email-access\output\users.json` |

### Development Notes

- **React Hot Reload**: React components update automatically
- **IPC Changes**: Require Electron app restart
- **preload.js Changes**: Require Electron app restart
- **main.js Changes**: Require Electron app restart
- **email-access Changes**: Require service restart

---

## Summary of What Was Done

### Phase 1: Standalone Email Service (Previously Completed)
- Gmail OAuth integration
- Email scanning with configurable queries
- PDF attachment downloading
- Bank identification from email/filename
- Password-protected PDF detection using pdf-lib
- SQLite database for tracking statements
- Express API for external control

### Phase 2: Electron Integration (Just Completed)
1. **OnboardingWizard** - 5-step setup wizard
2. **OAuth Popup** - In-app Google Sign-In (BrowserWindow)
3. **IPC Handlers** - Full API for React components
4. **Database Schema** - Drizzle ORM integration
5. **Settings Management** - JSON-based configuration
6. **Auto-Processing** - Process pending PDFs on startup
7. **Service Management** - Child process start/stop
8. **UI Improvements** - Full-width wizard, no nested boxes

### Files Created
- `OnboardingWizard.jsx`
- `emailServiceManager.js`
- `autoProcessing.js`
- `db/schema/AutoFetchedStatements.js`

### Files Modified
- `autoFetchedStatements.js` (extensive)
- `preload.js`
- `main.js`
- `AutoFetchedStatements.js`
- `background.js` (disabled auto-browser-open)

---

*This documentation should allow anyone to pick up development exactly where it left off.*
