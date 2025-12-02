# Email Access - Bank Statement Processing Service

## Overview

Automated Gmail scanner that downloads bank statement PDFs from email, detects bank names, checks password protection, and stores metadata for CypherEdge integration.

**Two modes:**
1. **Standalone Exe (Phase 1)** - Background service that auto-fetches PDFs
2. **Web Server (Legacy)** - HTTP server with OAuth flow and ML classifier

## Quick Start

### Standalone Executable (Recommended)
```bash
# Build the exe
npm run build

# Run OAuth setup
./dist/emailService.exe --setup

# Run background service
./dist/emailService.exe
```

### Legacy Web Server
```bash
npm install
node serverdd.js
```
Server runs at: `http://localhost:8234`

---

## Phase 1: Standalone Auto-Fetch Service (COMPLETE)

### Features
- [x] **Standalone Windows executable** (`emailService.exe`)
- [x] **Gmail OAuth authentication** with token persistence
- [x] **Targeted email search** (bank sender domains + subject keywords)
- [x] **Bank detection** from filename, sender domain, and subject
- [x] **Password protection detection** for PDFs
- [x] **Shared SQLite database** at `%APPDATA%\CypherEdge\db.sqlite3`
- [x] **Auto-organized PDF storage** at `%APPDATA%\CypherEdge\auto_fetched\<email>\`
- [x] **Background scheduling** (every 30 minutes)
- [x] **Graceful error handling** (missing credentials, no accounts, etc.)

### Usage
```bash
emailService.exe              # Background service (scans every 30min)
emailService.exe --setup      # OAuth setup mode (opens browser)
emailService.exe --scan       # Single scan and exit
emailService.exe --status     # Show status and statistics
emailService.exe --help       # Show help
```

### Data Storage
| Data | Location |
|------|----------|
| Database | `%APPDATA%\CypherEdge\db.sqlite3` |
| OAuth Tokens | `%APPDATA%\CypherEdge\gmail_tokens.json` |
| Downloaded PDFs | `%APPDATA%\CypherEdge\auto_fetched\<email>\` |
| Settings | `%APPDATA%\CypherEdge\auto_fetch_settings.json` |

### Database Schema (`auto_fetched_statements` table)
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| message_id | TEXT | Gmail message ID (unique) |
| user_email | TEXT | Gmail account |
| filename | TEXT | PDF filename |
| file_path | TEXT | Full path to PDF |
| detected_bank | TEXT | Auto-detected bank name |
| is_password_protected | INTEGER | 1 if password protected |
| email_subject | TEXT | Email subject line |
| email_from | TEXT | Sender address |
| email_date | TEXT | Email date |
| status | TEXT | pending/needs_password/processing/completed/failed |
| created_at | TEXT | Download timestamp |

### Build Process
See [BUILD.md](./BUILD.md) for detailed build instructions.

```bash
# Quick build
npm run build

# Manual steps:
# 1. Bundle with esbuild (handles googleapis V8 issues)
npx esbuild src/background.js --bundle --platform=node --target=node18 --outfile=dist/bundle.cjs --external:sqlite3

# 2. Package with pkg
npx pkg dist/bundle.cjs --targets node18-win-x64 --output dist/emailService.exe

# 3. Post-build (copy native modules)
node scripts/post-build.js
```

---

## Project Structure

```
email-access/
├── src/
│   ├── background.js           # Standalone exe entry point (Phase 1)
│   ├── index.js                # Web server entry point (Legacy)
│   ├── config.js               # Centralized configuration
│   ├── db/
│   │   └── AutoFetchDatabase.js    # SQLite for auto-fetched statements
│   ├── services/
│   │   ├── AutoFetchEmailService.js # Core Phase 1 service
│   │   ├── EmailService.js          # Legacy email service
│   │   ├── GmailClient.js           # Gmail API wrapper
│   │   ├── BankDetector.js          # Bank name detection
│   │   ├── PasswordChecker.js       # PDF password detection
│   │   └── tokenStore.js            # OAuth token management
│   └── routes/
│       └── auth.js                  # OAuth routes (legacy)
├── dist/                       # Build output
│   ├── emailService.exe        # Standalone executable
│   ├── credentials.json        # OAuth credentials (required)
│   └── native_modules/         # SQLite native binding
├── scripts/
│   ├── copy-assets.js          # Pre-build asset copy
│   └── post-build.js           # Post-build native module copy
├── schema/                     # Drizzle ORM schemas (legacy)
├── serverdd.js                 # Legacy monolithic server
├── credentials.json            # Google OAuth credentials
├── BUILD.md                    # Build documentation
└── CLAUDE.md                   # This file
```

---

## Configuration

### Environment Variables (.env)
```env
PORT=8234
SERVER_BASE_URL=http://localhost:8234
INITIAL_SCAN_DAYS=365
FETCH_INTERVAL_MINUTES=30
PYTHON=python
FASTAPI_URL=http://localhost:7500
```

### Bank Detection

**Sender Domain Whitelist** (src/config.js):
- hdfcbank.net/com, sbi.co.in, icicibank.com, axisbank.com
- kotak.com, yesbank.in, indusind.com, canarabank.com
- pnb.co.in, bankofbaroda.co.in, idbi.co.in, federalbank.co.in
- rblbank.com, bandhanbank.com, sc.com, dbs.com, hsbc.co.in, citi.com

**Filename Keywords**:
- hdfc, sbi, icici, axis, kotak, yes, indusind, canara, pnb, bob, etc.

**Email Subject Keywords**:
- statement, e-statement, account statement, bank statement
- credit card statement, monthly statement

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/background.js` | Standalone exe entry point with CLI modes |
| `src/services/AutoFetchEmailService.js` | Core auto-fetch logic |
| `src/services/BankDetector.js` | Bank name detection from filename/sender/subject |
| `src/services/PasswordChecker.js` | PDF password protection detection |
| `src/db/AutoFetchDatabase.js` | SQLite database for statement metadata |
| `src/config.js` | All paths, settings, bank lists |
| `serverdd.js` | Legacy monolithic server (still works) |

---

## Phase 2: CypherEdge Integration (TODO)

- [ ] IPC communication with Electron app
- [ ] UI for viewing/managing auto-fetched statements
- [ ] Password entry flow for protected PDFs
- [ ] Manual statement upload
- [ ] FastAPI integration for PDF parsing

---

## Legacy Web Server

### Endpoints
| Endpoint | Purpose |
|----------|---------|
| `/` | Home page |
| `/auth` | Start Gmail OAuth |
| `/oauth/callback` | OAuth callback |
| `/users` | List authorized users |
| `/trigger` | Manual scan trigger |
| `/status` | Service status |

### Run Legacy Server
```bash
node serverdd.js
# or
node src/index.js
```

---

## Troubleshooting

### Exe Issues

**"credentials.json not found"**
- Copy credentials.json to same directory as emailService.exe

**"Missing GOOGLE_CLIENT_ID"**
- Ensure credentials.json contains valid Google OAuth credentials

**"No authorized Gmail accounts"**
- Run `emailService.exe --setup` to authorize accounts

**sqlite3 errors**
- Ensure native_modules/node_sqlite3.node exists alongside exe

### OAuth Issues

**"Token expired"**
- Tokens auto-refresh using refresh_token
- If persistent, re-authorize with --setup

**"redirect_uri_mismatch"**
- Ensure Google Cloud Console has correct redirect URI
- Default: `http://localhost:8234/oauth/callback`

---

## Test Results (Phase 1)

| Test | Result |
|------|--------|
| Scan with credentials | PASS - 113 emails found, 52 PDFs downloaded |
| Missing credentials.json | PASS - Graceful error message |
| No authorized accounts | PASS - "Please run --setup" message |
| Fresh database | PASS - Auto-creates tables |
| Background mode | PASS - Starts, scans, schedules |
| Bank detection | PASS - HDFC, SBI, IndusInd, Axis detected |
| Password detection | PASS - 6 protected PDFs identified |
