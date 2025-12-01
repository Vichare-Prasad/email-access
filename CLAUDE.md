# Email Access - Bank Statement Processing Service

## Overview
Automated Gmail scanner that downloads email attachments, classifies them as bank statements using ML, and prepares them for FastAPI analysis.

## Quick Start
```bash
npm install
node serverdd.js
```
Server runs at: `http://localhost:8234`

## Project Structure
```
email-access/
├── serverdd.js         # Main server (Gmail OAuth, email scanning)
├── classifier.py       # ML bank statement classifier (177KB)
├── run_classifier.py   # Classifier runner script
├── db.js               # Database manager (Drizzle ORM)
├── dataProcessor.js    # FastAPI response processor
├── generate_report.py  # Report generation utility
├── .env                # Environment configuration
├── credentials.json    # Google OAuth credentials
├── package.json        # Node.js dependencies
├── schema/             # Database schemas
│   ├── Cases.js
│   ├── Statement.js
│   ├── Transactions.js
│   └── FailedStatements.js
├── input/              # New attachments (processing queue)
└── output/
    ├── unprocessed/    # Bank statements (ready for FastAPI)
    ├── rejected/       # Non-bank files
    ├── users.json      # OAuth tokens
    └── processed_db.json # Classifier tracking
```

## Configuration (.env)
```env
PORT=8234
SERVER_BASE_URL=http://localhost:8234
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
INITIAL_SCAN_DAYS=365
PYTHON=python
FASTAPI_URL=http://localhost:7500
```

## How It Works

### Pipeline Flow
1. **Gmail Scan** → Downloads attachments from unread emails
2. **Classification** → ML classifier identifies bank statements
3. **Sorting** → Bank statements → `output/unprocessed/`, others → `output/rejected/`
4. **FastAPI** → (When enabled) Sends to FastAPI for data extraction

### Key Endpoints
| Endpoint | Purpose |
|----------|---------|
| `/` | Home page |
| `/auth` | Start Gmail OAuth |
| `/users` | List authorized users |
| `/trigger` | Manual scan trigger |
| `/status` | Service status |

## Development Notes

### Classifier
- Uses `classifier.py` with `pdfplumber` for PDF analysis
- Called via `run_classifier.py` from Node.js
- Outputs JSON results to stdout

### Database
- Uses Drizzle ORM with SQLite
- Tables: `cases`, `statements`, `transactions`, `failed_statements`

### OAuth
- Tokens stored in `output/users.json`
- Credentials from `credentials.json` (Google Cloud Console)

## Commands

### Run Server
```bash
node serverdd.js
```

### Test Classifier
```bash
python run_classifier.py
```

### Install Dependencies
```bash
npm install
pip install pdfplumber
```

## Important Files
- `serverdd.js:1589` - FastAPI call (currently disabled, enable when main.exe ready)
- `run_classifier.py` - Classifier entry point
- `output/users.json` - OAuth tokens (do not commit)
- `credentials.json` - Google OAuth (do not commit)

## TODO
- [ ] Enable FastAPI integration when main.exe is ready
- [ ] Add error retry logic for failed classifications
- [ ] Implement batch processing optimization
