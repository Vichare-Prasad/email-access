# CypherEdge Auto-Fetch Bank Statements: Implementation Plan

## Overview

This document outlines the complete implementation plan for automatically fetching bank statements from Gmail and integrating them into CypherEdge.

**Architecture:** Two-Phase Approach
- **Phase 1:** Lightweight background service (fetches PDFs, stores metadata)
- **Phase 2:** Electron UI integration (user actions trigger full processing)

---

## Table of Contents

1. [Architecture Diagram](#architecture-diagram)
2. [Phase 1: Background Service](#phase-1-background-service)
3. [Phase 2: Electron UI Integration](#phase-2-electron-ui-integration)
4. [Database Schema](#database-schema)
5. [Data Flow Diagrams](#data-flow-diagrams)
6. [API Specifications](#api-specifications)
7. [File Structure](#file-structure)
8. [Implementation Checklist](#implementation-checklist)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SYSTEM ARCHITECTURE                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 1: BACKGROUND SERVICE                               │
│                    (Runs 24/7 - Independent of Electron)                     │
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Gmail     │    │   Fetch     │    │   Detect    │    │   Check     │  │
│  │   OAuth     │ →  │   PDFs      │ →  │   Bank      │ →  │   Password  │  │
│  │   Connect   │    │   (filter)  │    │   Name      │    │   Protected │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └──────┬──────┘  │
│                                                                   │         │
│                                                                   ▼         │
│                                                          ┌───────────────┐  │
│                                                          │ Store in DB   │  │
│                                                          │ (metadata     │  │
│                                                          │  only)        │  │
│                                                          └───────────────┘  │
└──────────────────────────────────────────────────────────────────┬──────────┘
                                                                   │
                              SHARED DATABASE                      │
                              (db.sqlite3)                         │
                              auto_fetched_statements table        │
                                                                   │
┌──────────────────────────────────────────────────────────────────┴──────────┐
│                    PHASE 2: ELECTRON UI                                      │
│                    (User interaction & full processing)                      │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    GENERATE REPORT PAGE                              │    │
│  │  ┌───────────────────────────────────────────────────────────────┐  │    │
│  │  │  Manual Upload Section (existing)                              │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  │                                                                      │    │
│  │  ┌───────────────────────────────────────────────────────────────┐  │    │
│  │  │  AUTO-FETCHED STATEMENTS (new section)                        │  │    │
│  │  │                                                                │  │    │
│  │  │  ┌─ Ready to Process ───────────────────────────────────────┐ │  │    │
│  │  │  │ PDF Name   │ Bank   │ From      │ Actions                │ │  │    │
│  │  │  │ stmt.pdf   │ HDFC   │ user@mail │ [Add▾] [New] [Delete]  │ │  │    │
│  │  │  └──────────────────────────────────────────────────────────┘ │  │    │
│  │  │                                                                │  │    │
│  │  │  ┌─ Needs Password ─────────────────────────────────────────┐ │  │    │
│  │  │  │ PDF Name   │ Bank   │ From      │ Actions                │ │  │    │
│  │  │  │ secure.pdf │ Axis   │ user@mail │ [Enter Passwords]      │ │  │    │
│  │  │  └──────────────────────────────────────────────────────────┘ │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  User Action → Triggers EXISTING generate-report/edit-pdf handlers          │
│             → Full processing: FastAPI → Transform → Store in all tables    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Background Service

### 1.1 Purpose

A lightweight, standalone service that:
- Runs continuously (24/7), even when Electron app is closed
- Connects to Gmail accounts via OAuth
- Fetches bank statement PDFs from emails
- Detects bank name from filename/sender/content
- Checks if PDF is password-protected
- Stores **metadata only** in shared database
- Does **NOT** call FastAPI or perform complex processing

### 1.2 Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 1 COMPONENTS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. SCHEDULER                                                    │
│     └─ Runs fetch cycle every N minutes (configurable)          │
│     └─ Respects mode setting (24/7 vs manual)                   │
│                                                                  │
│  2. GMAIL CLIENT                                                 │
│     └─ OAuth 2.0 authentication                                 │
│     └─ Token management (refresh, store)                        │
│     └─ Email search with filters                                │
│     └─ Attachment download                                      │
│                                                                  │
│  3. EMAIL FILTER                                                 │
│     └─ Sender whitelist (known bank domains)                    │
│     └─ Subject keyword matching                                 │
│     └─ Deduplication (email_message_id)                         │
│                                                                  │
│  4. BANK DETECTOR                                                │
│     └─ Filename parsing (e.g., "HDFC_stmt.pdf" → "HDFC")       │
│     └─ Sender domain mapping (e.g., @hdfcbank.net → "HDFC")    │
│     └─ ML classifier fallback (existing classifier.py)          │
│                                                                  │
│  5. PASSWORD CHECKER                                             │
│     └─ Attempts to open PDF                                     │
│     └─ Catches encryption/password errors                       │
│     └─ Sets is_password_protected flag                          │
│                                                                  │
│  6. DATABASE WRITER                                              │
│     └─ Connects to shared db.sqlite3                            │
│     └─ Inserts into auto_fetched_statements table               │
│     └─ Updates status on errors                                 │
│                                                                  │
│  7. SETTINGS MANAGER                                             │
│     └─ Read/write settings from JSON file                       │
│     └─ Mode: 24/7 or manual                                     │
│     └─ Fetch interval                                           │
│     └─ Connected accounts list                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Fetch Cycle Algorithm

```
FUNCTION runFetchCycle():

    settings = loadSettings()

    IF settings.mode == "manual" AND NOT manualTrigger:
        RETURN  // Skip if manual mode and no trigger

    FOR EACH account IN settings.connectedAccounts:

        TRY:
            tokens = loadTokens(account.email)
            gmail = authenticateGmail(tokens)

            // Build search query
            query = buildSearchQuery()
            // Examples:
            //   "has:attachment from:(@hdfcbank.net OR @sbi.co.in OR ...)"
            //   "has:attachment subject:(statement OR e-statement)"

            emails = gmail.searchEmails(query, maxResults=50)

            FOR EACH email IN emails:

                // Check if already processed
                IF existsInDatabase(email.messageId):
                    CONTINUE

                // Get email details
                emailDetails = gmail.getEmailDetails(email.id)

                FOR EACH attachment IN emailDetails.attachments:

                    // Filter by extension
                    IF NOT attachment.filename.endsWith('.pdf'):
                        CONTINUE

                    // Download attachment
                    pdfContent = gmail.downloadAttachment(email.id, attachment.id)

                    // Generate unique filename
                    savedPath = savePDF(pdfContent, attachment.filename, account.email)

                    // Detect bank name
                    detectedBank = detectBank(
                        filename = attachment.filename,
                        sender = emailDetails.from,
                        pdfContent = pdfContent  // for classifier fallback
                    )

                    // Check password protection
                    isPasswordProtected = checkPasswordProtection(savedPath)

                    // Determine initial status
                    status = isPasswordProtected ? "needs_password" : "pending"

                    // Insert into database
                    INSERT INTO auto_fetched_statements:
                        gmail_account = account.email
                        email_message_id = email.messageId
                        email_subject = emailDetails.subject
                        email_from = emailDetails.from
                        email_date = emailDetails.date
                        pdf_filename = attachment.filename
                        pdf_path = savedPath
                        detected_bank = detectedBank.name
                        detection_method = detectedBank.method
                        is_password_protected = isPasswordProtected
                        status = status
                        fetched_at = NOW()

                    LOG("Fetched: " + attachment.filename + " from " + account.email)

        CATCH error:
            LOG("Error fetching from " + account.email + ": " + error)
            CONTINUE  // Don't stop on single account failure

    LOG("Fetch cycle complete")
```

### 1.4 Bank Detection Algorithm

```
FUNCTION detectBank(filename, sender, pdfContent):

    result = { name: null, method: null }

    // METHOD 1: Filename parsing
    bankKeywords = {
        "hdfc": "HDFC Bank",
        "sbi": "State Bank of India",
        "icici": "ICICI Bank",
        "axis": "Axis Bank",
        "kotak": "Kotak Mahindra Bank",
        "yes": "Yes Bank",
        "indusind": "IndusInd Bank",
        "canara": "Canara Bank",
        "pnb": "Punjab National Bank",
        "bob": "Bank of Baroda",
        "union": "Union Bank",
        "idbi": "IDBI Bank",
        "federal": "Federal Bank",
        "rbl": "RBL Bank",
        "bandhan": "Bandhan Bank",
        // ... add more
    }

    lowercaseFilename = filename.toLowerCase()
    FOR EACH (keyword, bankName) IN bankKeywords:
        IF lowercaseFilename.contains(keyword):
            RETURN { name: bankName, method: "filename" }

    // METHOD 2: Sender domain mapping
    senderDomains = {
        "hdfcbank.net": "HDFC Bank",
        "hdfcbank.com": "HDFC Bank",
        "sbi.co.in": "State Bank of India",
        "alerts.sbi.co.in": "State Bank of India",
        "icicibank.com": "ICICI Bank",
        "axisbank.com": "Axis Bank",
        "kotak.com": "Kotak Mahindra Bank",
        "kotakbank.com": "Kotak Mahindra Bank",
        "yesbank.in": "Yes Bank",
        "indusind.com": "IndusInd Bank",
        "canarabank.com": "Canara Bank",
        "pnb.co.in": "Punjab National Bank",
        "bankofbaroda.co.in": "Bank of Baroda",
        "unionbankofindia.co.in": "Union Bank",
        "idbi.co.in": "IDBI Bank",
        "federalbank.co.in": "Federal Bank",
        "rblbank.com": "RBL Bank",
        "bandhanbank.com": "Bandhan Bank",
        "sbmbank.co.in": "SBM Bank",
        // ... add more
    }

    senderDomain = extractDomain(sender)
    IF senderDomain IN senderDomains:
        RETURN { name: senderDomains[senderDomain], method: "sender" }

    // METHOD 3: ML Classifier (fallback)
    // Uses existing classifier.py
    classifierResult = runClassifier(pdfContent)
    IF classifierResult.isBankStatement:
        RETURN { name: classifierResult.bankName OR "Unknown Bank", method: "classifier" }

    // METHOD 4: Unknown
    RETURN { name: "Unknown", method: "unknown" }
```

### 1.5 Password Protection Check

```
FUNCTION checkPasswordProtection(pdfPath):

    TRY:
        // Using pdf-parse or similar library
        pdf = openPDF(pdfPath)

        // If we can read the first page, not protected
        content = pdf.getPage(1).getText()

        RETURN false  // Not password protected

    CATCH error:
        IF error.type == "PasswordRequired" OR
           error.type == "EncryptedPDF" OR
           error.message.contains("password"):
            RETURN true  // Password protected
        ELSE:
            // Some other error (corrupted PDF, etc.)
            LOG("PDF check error: " + error)
            RETURN false
```

### 1.6 Settings File Format

**Location:** `%APPDATA%/CypherEdge/auto_fetch_settings.json`

```json
{
  "mode": "24/7",
  "fetchIntervalMinutes": 30,
  "connectedAccounts": [
    {
      "email": "admin@cyphersol.co.in",
      "addedAt": "2024-12-01T10:00:00Z",
      "lastFetchAt": "2024-12-02T08:30:00Z",
      "status": "active"
    },
    {
      "email": "sanchaythalnerkar@gmail.com",
      "addedAt": "2024-12-02T08:32:00Z",
      "lastFetchAt": "2024-12-02T08:45:00Z",
      "status": "active"
    }
  ],
  "filterSettings": {
    "useSenderWhitelist": true,
    "useSubjectKeywords": true,
    "senderWhitelist": [
      "@hdfcbank.net",
      "@sbi.co.in",
      "@icicibank.com"
    ],
    "subjectKeywords": [
      "statement",
      "e-statement",
      "account statement",
      "bank statement"
    ]
  },
  "storageSettings": {
    "pdfStoragePath": "%APPDATA%/CypherEdge/auto_fetched/",
    "maxStorageDays": 30,
    "cleanupEnabled": true
  },
  "serviceStatus": {
    "isRunning": true,
    "startedAt": "2024-12-02T06:00:00Z",
    "lastError": null
  }
}
```

### 1.7 OAuth Token Storage

**Location:** `%APPDATA%/CypherEdge/gmail_tokens.json`

```json
{
  "admin@cyphersol.co.in": {
    "access_token": "ya29...",
    "refresh_token": "1//...",
    "expiry_date": 1733140800000,
    "token_type": "Bearer",
    "scope": "https://www.googleapis.com/auth/gmail.readonly"
  },
  "sanchaythalnerkar@gmail.com": {
    "access_token": "ya29...",
    "refresh_token": "1//...",
    "expiry_date": 1733144400000,
    "token_type": "Bearer",
    "scope": "https://www.googleapis.com/auth/gmail.readonly"
  }
}
```

---

## Phase 2: Electron UI Integration

### 2.1 Purpose

Integrate auto-fetched statements into CypherEdge UI:
- Display fetched statements in Generate Report page
- Allow user to take action (Add to Case, Create New, Delete)
- Handle password entry for protected PDFs
- Trigger full processing using EXISTING handlers
- Track user actions in database

### 2.2 UI Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 2 UI COMPONENTS                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. AUTO-FETCHED SECTION (Main Container)                        │
│     └─ Location: Generate Report page                           │
│     └─ Collapsible card/section                                 │
│     └─ Shows count badge when new items                         │
│                                                                  │
│  2. PENDING TABLE (Ready to Process)                             │
│     └─ Lists PDFs with status='pending'                         │
│     └─ Columns: Filename, Bank, From Email, Date, Actions       │
│     └─ Actions: [Add to Case▾] [Create New] [Delete]            │
│                                                                  │
│  3. NEEDS PASSWORD TABLE                                         │
│     └─ Lists PDFs with status='needs_password'                  │
│     └─ Columns: Filename, Bank, From Email, Date, Actions       │
│     └─ Actions: [Enter Passwords] button                        │
│                                                                  │
│  4. PASSWORD MODAL                                               │
│     └─ Bulk password entry for protected PDFs                   │
│     └─ Shows PDF details to help identify                       │
│     └─ [Process All] button                                     │
│                                                                  │
│  5. CASE SELECTOR DROPDOWN                                       │
│     └─ Shows existing cases for "Add to Case"                   │
│     └─ Searchable/filterable                                    │
│                                                                  │
│  6. NEW CASE MODAL                                               │
│     └─ Prompts for case name                                    │
│     └─ Validates uniqueness                                     │
│                                                                  │
│  7. SETTINGS PANEL                                               │
│     └─ Mode toggle (24/7 vs Manual)                             │
│     └─ Connected accounts management                            │
│     └─ Fetch interval setting                                   │
│     └─ Service status display                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 UI Mockup: Auto-Fetched Section

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📥 Auto-Fetched Bank Statements                          [⚙️ Settings]    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─ Ready to Process (3) ──────────────────────────────────────────────────┐│
│  │                                                                          ││
│  │  ┌────────────────┬───────────┬──────────────────┬─────────┬──────────┐ ││
│  │  │ PDF Name       │ Bank      │ From             │ Date    │ Actions  │ ││
│  │  ├────────────────┼───────────┼──────────────────┼─────────┼──────────┤ ││
│  │  │ 📄 5372XXX.PDF │ HDFC Bank │ statements@hdfc  │ Dec 2   │ [Add▾]   │ ││
│  │  │                │           │                  │         │ [New]    │ ││
│  │  │                │           │                  │         │ [🗑️]     │ ││
│  │  ├────────────────┼───────────┼──────────────────┼─────────┼──────────┤ ││
│  │  │ 📄 SBI_stmt.pdf│ SBI       │ alerts@sbi.co.in │ Dec 1   │ [Add▾]   │ ││
│  │  │                │           │                  │         │ [New]    │ ││
│  │  │                │           │                  │         │ [🗑️]     │ ││
│  │  ├────────────────┼───────────┼──────────────────┼─────────┼──────────┤ ││
│  │  │ 📄 axis_nov.pdf│ Axis Bank │ estatement@axis  │ Nov 30  │ [Add▾]   │ ││
│  │  │                │           │                  │         │ [New]    │ ││
│  │  │                │           │                  │         │ [🗑️]     │ ││
│  │  └────────────────┴───────────┴──────────────────┴─────────┴──────────┘ ││
│  │                                                                          ││
│  │  [Add▾] = Dropdown showing: "Case_ABC", "Case_XYZ", "John_Doe", ...     ││
│  │  [New]  = Opens modal to enter new case name                            ││
│  │  [🗑️]   = Delete this statement                                         ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─ Needs Password (2) ────────────────────────────────────────────────────┐│
│  │                                                                          ││
│  │  ┌────────────────┬───────────┬──────────────────┬─────────┬──────────┐ ││
│  │  │ PDF Name       │ Bank      │ From             │ Date    │ Status   │ ││
│  │  ├────────────────┼───────────┼──────────────────┼─────────┼──────────┤ ││
│  │  │ 📄 secure1.pdf │ ICICI     │ estatement@icici │ Dec 2   │ 🔒       │ ││
│  │  │ 📄 secure2.pdf │ Kotak     │ statements@kotak │ Dec 1   │ 🔒       │ ││
│  │  └────────────────┴───────────┴──────────────────┴─────────┴──────────┘ ││
│  │                                                                          ││
│  │                                              [Enter Passwords]          ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.4 UI Mockup: Password Modal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🔐 Enter Passwords for Protected Statements                          [X]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  These bank statements require passwords to process:                         │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                                                                        │  │
│  │  📄 secure1.pdf                                                       │  │
│  │  ───────────────────────────────────────────────────────────────────  │  │
│  │  Bank: ICICI Bank                                                     │  │
│  │  From: estatement@icicibank.com                                       │  │
│  │  Subject: Your ICICI Bank Account Statement - November 2024           │  │
│  │  Received: December 2, 2024 at 10:30 AM                               │  │
│  │                                                                        │  │
│  │  Password: [________________________]                                  │  │
│  │                                                                        │  │
│  │  ─────────────────────────────────────────────────────────────────── │  │
│  │                                                                        │  │
│  │  📄 secure2.pdf                                                       │  │
│  │  ───────────────────────────────────────────────────────────────────  │  │
│  │  Bank: Kotak Mahindra Bank                                            │  │
│  │  From: statements@kotak.com                                           │  │
│  │  Subject: Kotak Bank Statement for October 2024                       │  │
│  │  Received: December 1, 2024 at 3:45 PM                                │  │
│  │                                                                        │  │
│  │  Password: [________________________]                                  │  │
│  │                                                                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│                                              [Cancel]  [Verify & Process]   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.5 UI Mockup: Settings Panel

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚙️ Auto-Fetch Settings                                               [X]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PROCESSING MODE                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ ◉ 24/7 Auto-fetch                                                     │  │
│  │   Continuously fetch bank statements in background                    │  │
│  │                                                                        │  │
│  │ ○ Manual Only                                                          │  │
│  │   Only fetch when you click "Fetch Now"                               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  FETCH INTERVAL                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Check for new statements every: [30 minutes ▾]                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  CONNECTED GMAIL ACCOUNTS                                                    │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ ✅ admin@cyphersol.co.in                                              │  │
│  │    Last fetch: 2 minutes ago                        [Disconnect]      │  │
│  │                                                                        │  │
│  │ ✅ sanchaythalnerkar@gmail.com                                        │  │
│  │    Last fetch: 5 minutes ago                        [Disconnect]      │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  [+ Connect Gmail Account]                                                   │
│                                                                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  SERVICE STATUS                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Status: 🟢 Running                                                     │  │
│  │ Started: December 2, 2024 at 6:00 AM                                  │  │
│  │ Statements fetched today: 5                                           │  │
│  │ Last fetch: 2 minutes ago                                             │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│                                    [Fetch Now]  [View Logs]  [Save]         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.6 User Action Flows

#### Flow A: Create New Case

```
User clicks [New] button
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│ NEW CASE MODAL                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Enter case name: [_________________________]                 │ │
│ │                                                              │ │
│ │ Bank: HDFC Bank (auto-filled from detection)                │ │
│ │ PDF: 5372XXXXXXXXXX38_14-06-2025.PDF                        │ │
│ │                                                              │ │
│ │                              [Cancel] [Create & Process]    │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
        │
        │ User enters "Client_ABC_Nov2024" and clicks Create
        ▼
┌─────────────────────────────────────────────────────────────────┐
│ ELECTRON MAIN PROCESS                                            │
│                                                                  │
│ 1. Validate case name uniqueness                                │
│                                                                  │
│ 2. Build payload (same as manual upload):                       │
│    {                                                            │
│      files: [{                                                  │
│        pdf_paths: "C:/Users/.../auto_fetched/5372XXX.PDF",     │
│        bankName: "hdfc bank",                                   │
│        passwords: "",                                           │
│        start_date: "",                                          │
│        end_date: ""                                             │
│      }],                                                        │
│      caseName: "Client_ABC_Nov2024",                            │
│      source: "generate-report"                                  │
│    }                                                            │
│                                                                  │
│ 3. Call EXISTING handler:                                       │
│    ipcMain.handle("generate-report", ...)                       │
│                                                                  │
│ 4. Existing handler does:                                       │
│    - Create case in DB                                          │
│    - Call FastAPI /analyze-statements-pdf/                      │
│    - Store statements, transactions, summary, eod, etc.         │
│    - Update case status                                         │
│                                                                  │
│ 5. On success, update auto_fetched_statements:                  │
│    UPDATE SET status='completed',                               │
│               user_action='created_new',                        │
│               target_case_name='Client_ABC_Nov2024'             │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│ SUCCESS                                                          │
│                                                                  │
│ - Statement removed from Auto-Fetched section                   │
│ - New case appears in Recent Reports table                      │
│ - User can click to view analysis                               │
└─────────────────────────────────────────────────────────────────┘
```

#### Flow B: Add to Existing Case

```
User clicks [Add▾] dropdown
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│ CASE SELECTOR DROPDOWN                                           │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🔍 Search cases...                                          │ │
│ │ ─────────────────────────────────────────────────────────── │ │
│ │ ○ Client_ABC_Oct2024          (3 statements)                │ │
│ │ ○ John_Doe_Financials         (5 statements)                │ │
│ │ ○ XYZ_Company_2024            (2 statements)                │ │
│ │ ○ Monthly_Review_Nov          (1 statement)                 │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
        │
        │ User selects "Client_ABC_Oct2024"
        ▼
┌─────────────────────────────────────────────────────────────────┐
│ CONFIRMATION                                                     │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Add this statement to "Client_ABC_Oct2024"?                 │ │
│ │                                                              │ │
│ │ This will merge the new transactions with 3 existing        │ │
│ │ statements in this case.                                    │ │
│ │                                                              │ │
│ │                              [Cancel] [Add & Process]       │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
        │
        │ User confirms
        ▼
┌─────────────────────────────────────────────────────────────────┐
│ ELECTRON MAIN PROCESS                                            │
│                                                                  │
│ 1. Build payload with source="add-pdf":                         │
│    {                                                            │
│      files: [{                                                  │
│        pdf_paths: "C:/Users/.../auto_fetched/stmt.PDF",        │
│        bankName: "sbi",                                         │
│        passwords: "",                                           │
│        start_date: "",                                          │
│        end_date: ""                                             │
│      }],                                                        │
│      caseName: "Client_ABC_Oct2024",                            │
│      source: "add-pdf"   // CRITICAL: triggers merge logic     │
│    }                                                            │
│                                                                  │
│ 2. Call EXISTING handler:                                       │
│    ipcMain.handle("generate-report", ..., "add-pdf")            │
│                                                                  │
│ 3. Existing handler does:                                       │
│    - Fetch existing transactions from case                      │
│    - Format as whole_transaction_sheet                          │
│    - Call FastAPI with existing + new                           │
│    - Delete old statements/transactions                         │
│    - Store merged result                                        │
│    - Update case status                                         │
│                                                                  │
│ 4. On success, update auto_fetched_statements:                  │
│    UPDATE SET status='completed',                               │
│               user_action='added_to_case',                      │
│               target_case_id=<case_id>                          │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│ SUCCESS                                                          │
│                                                                  │
│ - Statement removed from Auto-Fetched section                   │
│ - Case "Client_ABC_Oct2024" now has 4 statements                │
│ - Transactions are merged                                       │
└─────────────────────────────────────────────────────────────────┘
```

#### Flow C: Password Entry & Process

```
User clicks [Enter Passwords]
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│ PASSWORD MODAL (shows all needs_password items)                  │
│                                                                  │
│ User enters passwords for each PDF                              │
│ Clicks [Verify & Process]                                       │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│ VERIFICATION STEP                                                │
│                                                                  │
│ FOR EACH PDF:                                                   │
│   - Try to open with entered password                           │
│   - If success: mark as verified                                │
│   - If fail: show error, ask to re-enter                        │
│                                                                  │
│ If all verified → Move to "Ready to Process" section            │
│ Update: status = 'pending' (now ready for action)               │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│ RESULT                                                           │
│                                                                  │
│ - PDFs move from "Needs Password" to "Ready to Process"         │
│ - Password is stored temporarily (not persisted)                │
│ - User can now use [Add] or [New] buttons                       │
│ - When processing, password is passed to FastAPI                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Existing Tables (No Changes)

```sql
-- Already exist in CypherEdge, used as-is
cases, statements, transactions, summary, eod,
opportunity_to_earn, failed_statements, users, Category_Master
```

### New Table: auto_fetched_statements

```sql
CREATE TABLE auto_fetched_statements (
    -- Primary Key
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Source Information (from Gmail)
    gmail_account TEXT NOT NULL,
    email_message_id TEXT UNIQUE,        -- Gmail message ID for deduplication
    email_subject TEXT,
    email_from TEXT,
    email_date INTEGER,                  -- Unix timestamp
    fetched_at INTEGER DEFAULT (strftime('%s', 'now')),

    -- PDF Information
    pdf_filename TEXT NOT NULL,          -- Original filename
    pdf_path TEXT NOT NULL,              -- Full local path
    pdf_size INTEGER,                    -- File size in bytes

    -- Detection Results
    detected_bank TEXT,                  -- Bank name (from detection)
    detection_method TEXT,               -- 'filename', 'sender', 'classifier', 'unknown'
    is_password_protected INTEGER DEFAULT 0,

    -- Processing Status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',           -- Ready for user action (non-password)
        'needs_password',    -- Waiting for password entry
        'processing',        -- Currently being processed
        'completed',         -- User took action, moved to main tables
        'deleted',           -- User deleted
        'failed'             -- Processing failed
    )),

    -- User Action (filled when user takes action in UI)
    user_action TEXT CHECK (user_action IN (
        'created_new',       -- Created new case
        'added_to_case',     -- Added to existing case
        'deleted'            -- Deleted by user
    )),
    target_case_id INTEGER,              -- FK to cases(id) if added to existing
    target_case_name TEXT,               -- Case name if created new
    actioned_at INTEGER,                 -- When user took action

    -- Password (temporary, for processing)
    temp_password TEXT,                  -- Stored temporarily after verification

    -- Error Tracking
    error_message TEXT,                  -- Error details if failed

    -- Timestamps
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),

    -- Foreign Key (optional, only if added to case)
    FOREIGN KEY (target_case_id) REFERENCES cases(id)
);

-- Indexes for performance
CREATE INDEX idx_afs_status ON auto_fetched_statements(status);
CREATE INDEX idx_afs_gmail ON auto_fetched_statements(gmail_account);
CREATE INDEX idx_afs_email_id ON auto_fetched_statements(email_message_id);
CREATE INDEX idx_afs_fetched ON auto_fetched_statements(fetched_at);
```

### Drizzle ORM Schema (for Electron)

```javascript
// File: config/db/schema/AutoFetchedStatements.js

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { cases } from "./Cases";

export const autoFetchedStatements = sqliteTable("auto_fetched_statements", {
    id: integer("id").primaryKey({ autoIncrement: true }),

    // Source Information
    gmailAccount: text("gmail_account").notNull(),
    emailMessageId: text("email_message_id").unique(),
    emailSubject: text("email_subject"),
    emailFrom: text("email_from"),
    emailDate: integer("email_date", { mode: "timestamp" }),
    fetchedAt: integer("fetched_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),

    // PDF Information
    pdfFilename: text("pdf_filename").notNull(),
    pdfPath: text("pdf_path").notNull(),
    pdfSize: integer("pdf_size"),

    // Detection Results
    detectedBank: text("detected_bank"),
    detectionMethod: text("detection_method"),
    isPasswordProtected: integer("is_password_protected").default(0),

    // Status
    status: text("status").default("pending"),

    // User Action
    userAction: text("user_action"),
    targetCaseId: integer("target_case_id").references(() => cases.id),
    targetCaseName: text("target_case_name"),
    actionedAt: integer("actioned_at", { mode: "timestamp" }),

    // Temporary password
    tempPassword: text("temp_password"),

    // Error tracking
    errorMessage: text("error_message"),

    // Timestamps
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});
```

---

## API Specifications

### IPC Channels (Electron)

#### New Handlers for Auto-Fetch

```javascript
// File: ipc/autoFetchHandlers.js

// Get pending statements (for UI display)
ipcMain.handle("auto-fetch:get-pending", async () => {
    return db.select()
        .from(autoFetchedStatements)
        .where(inArray(autoFetchedStatements.status, ['pending', 'needs_password']))
        .orderBy(desc(autoFetchedStatements.fetchedAt));
});

// Get all statements with optional filter
ipcMain.handle("auto-fetch:get-all", async (event, filter) => {
    let query = db.select().from(autoFetchedStatements);

    if (filter?.status) {
        query = query.where(eq(autoFetchedStatements.status, filter.status));
    }
    if (filter?.gmailAccount) {
        query = query.where(eq(autoFetchedStatements.gmailAccount, filter.gmailAccount));
    }

    return query.orderBy(desc(autoFetchedStatements.fetchedAt));
});

// Mark as completed after user action
ipcMain.handle("auto-fetch:mark-completed", async (event, id, action, targetCaseId, targetCaseName) => {
    return db.update(autoFetchedStatements)
        .set({
            status: 'completed',
            userAction: action,
            targetCaseId: targetCaseId,
            targetCaseName: targetCaseName,
            actionedAt: Math.floor(Date.now() / 1000),
            updatedAt: Math.floor(Date.now() / 1000)
        })
        .where(eq(autoFetchedStatements.id, id));
});

// Mark as deleted
ipcMain.handle("auto-fetch:delete", async (event, id) => {
    const statement = await db.select()
        .from(autoFetchedStatements)
        .where(eq(autoFetchedStatements.id, id))
        .get();

    // Optionally delete the PDF file
    if (statement?.pdfPath) {
        try {
            await fs.unlink(statement.pdfPath);
        } catch (e) {
            // Ignore if file doesn't exist
        }
    }

    return db.update(autoFetchedStatements)
        .set({
            status: 'deleted',
            userAction: 'deleted',
            actionedAt: Math.floor(Date.now() / 1000),
            updatedAt: Math.floor(Date.now() / 1000)
        })
        .where(eq(autoFetchedStatements.id, id));
});

// Verify password for protected PDF
ipcMain.handle("auto-fetch:verify-password", async (event, id, password) => {
    const statement = await db.select()
        .from(autoFetchedStatements)
        .where(eq(autoFetchedStatements.id, id))
        .get();

    if (!statement) {
        return { success: false, error: "Statement not found" };
    }

    // Try to open PDF with password
    const isValid = await verifyPdfPassword(statement.pdfPath, password);

    if (isValid) {
        // Store password temporarily and update status
        await db.update(autoFetchedStatements)
            .set({
                status: 'pending',
                tempPassword: password,  // Stored for processing
                updatedAt: Math.floor(Date.now() / 1000)
            })
            .where(eq(autoFetchedStatements.id, id));

        return { success: true };
    } else {
        return { success: false, error: "Invalid password" };
    }
});

// Get settings
ipcMain.handle("auto-fetch:get-settings", async () => {
    const settingsPath = path.join(app.getPath('userData'), 'auto_fetch_settings.json');
    try {
        const data = await fs.readFile(settingsPath, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        // Return defaults if file doesn't exist
        return {
            mode: '24/7',
            fetchIntervalMinutes: 30,
            connectedAccounts: [],
            serviceStatus: { isRunning: false }
        };
    }
});

// Update settings
ipcMain.handle("auto-fetch:update-settings", async (event, settings) => {
    const settingsPath = path.join(app.getPath('userData'), 'auto_fetch_settings.json');
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
    return { success: true };
});

// Get statistics
ipcMain.handle("auto-fetch:get-stats", async () => {
    const pending = await db.select({ count: sql`count(*)` })
        .from(autoFetchedStatements)
        .where(eq(autoFetchedStatements.status, 'pending'));

    const needsPassword = await db.select({ count: sql`count(*)` })
        .from(autoFetchedStatements)
        .where(eq(autoFetchedStatements.status, 'needs_password'));

    const completed = await db.select({ count: sql`count(*)` })
        .from(autoFetchedStatements)
        .where(eq(autoFetchedStatements.status, 'completed'));

    return {
        pending: pending[0]?.count || 0,
        needsPassword: needsPassword[0]?.count || 0,
        completed: completed[0]?.count || 0
    };
});
```

#### Preload Bridge (expose to React)

```javascript
// File: preload.js (additions)

autoFetch: {
    getPending: () => ipcRenderer.invoke("auto-fetch:get-pending"),
    getAll: (filter) => ipcRenderer.invoke("auto-fetch:get-all", filter),
    markCompleted: (id, action, caseId, caseName) =>
        ipcRenderer.invoke("auto-fetch:mark-completed", id, action, caseId, caseName),
    delete: (id) => ipcRenderer.invoke("auto-fetch:delete", id),
    verifyPassword: (id, password) =>
        ipcRenderer.invoke("auto-fetch:verify-password", id, password),
    getSettings: () => ipcRenderer.invoke("auto-fetch:get-settings"),
    updateSettings: (settings) => ipcRenderer.invoke("auto-fetch:update-settings", settings),
    getStats: () => ipcRenderer.invoke("auto-fetch:get-stats"),
}
```

---

## File Structure

### Phase 1: Background Service

```
email-access/                          # Current project, becomes the service
├── src/
│   ├── index.js                       # Service entry point
│   ├── config.js                      # Configuration management
│   ├── scheduler.js                   # Fetch cycle scheduler
│   ├── services/
│   │   ├── GmailClient.js             # Gmail OAuth & API (existing, enhanced)
│   │   ├── BankDetector.js            # Bank name detection (new)
│   │   ├── PasswordChecker.js         # PDF password check (new)
│   │   └── EmailFilter.js             # Email filtering logic (new)
│   ├── db/
│   │   └── database.js                # SQLite connection to shared DB
│   └── utils/
│       ├── logger.js                  # Logging (existing)
│       ├── fileUtils.js               # File operations (existing)
│       └── tokenStore.js              # OAuth token management (existing)
├── package.json
├── .env
└── README.md
```

### Phase 2: Electron Integration

```
frontend/                              # CypherEdge Electron app
├── config/db/schema/
│   └── AutoFetchedStatements.js       # New schema (add)
├── ipc/
│   └── autoFetchHandlers.js           # New IPC handlers (add)
├── react-app/src/components/
│   └── AutoFetch/                     # New folder
│       ├── AutoFetchSection.jsx       # Main section component
│       ├── PendingTable.jsx           # Ready to process table
│       ├── NeedsPasswordTable.jsx     # Password required table
│       ├── PasswordModal.jsx          # Bulk password modal
│       ├── CaseSelector.jsx           # Case dropdown
│       ├── NewCaseModal.jsx           # New case name modal
│       └── SettingsPanel.jsx          # Settings modal
├── main.js                            # Register new IPC handlers (modify)
└── preload.js                         # Expose autoFetch API (modify)
```

---

## Implementation Checklist

### Phase 1: Background Service

- [ ] **1.1 Core Service Setup**
  - [ ] Refactor email-access to be a standalone service
  - [ ] Configure to use shared database path (%APPDATA%/CypherEdge/db.sqlite3)
  - [ ] Add scheduler with configurable interval
  - [ ] Add settings file management

- [ ] **1.2 Gmail Integration**
  - [ ] Reuse existing GmailClient.js
  - [ ] Add email filtering (sender whitelist, subject keywords)
  - [ ] Add deduplication (check email_message_id before processing)
  - [ ] Store OAuth tokens in shared location

- [ ] **1.3 Bank Detection**
  - [ ] Implement filename parsing
  - [ ] Implement sender domain mapping
  - [ ] Integrate existing classifier.py as fallback
  - [ ] Return detection method with result

- [ ] **1.4 Password Detection**
  - [ ] Implement PDF password check
  - [ ] Set appropriate status based on result

- [ ] **1.5 Database Operations**
  - [ ] Create auto_fetched_statements table (migration)
  - [ ] Implement INSERT for new fetched PDFs
  - [ ] Implement deduplication check

- [ ] **1.6 Service Lifecycle**
  - [ ] Add start/stop functionality
  - [ ] Add Windows service wrapper (optional)
  - [ ] Add logging

### Phase 2: Electron Integration

- [ ] **2.1 Database Schema**
  - [ ] Add Drizzle schema for auto_fetched_statements
  - [ ] Run migration to create table
  - [ ] Test schema with existing tables

- [ ] **2.2 IPC Handlers**
  - [ ] Implement auto-fetch:get-pending
  - [ ] Implement auto-fetch:get-all
  - [ ] Implement auto-fetch:mark-completed
  - [ ] Implement auto-fetch:delete
  - [ ] Implement auto-fetch:verify-password
  - [ ] Implement auto-fetch:get-settings
  - [ ] Implement auto-fetch:update-settings
  - [ ] Register handlers in main.js

- [ ] **2.3 Preload Bridge**
  - [ ] Add autoFetch object to preload.js
  - [ ] Expose all IPC methods

- [ ] **2.4 React Components**
  - [ ] Create AutoFetchSection.jsx (main container)
  - [ ] Create PendingTable.jsx
  - [ ] Create NeedsPasswordTable.jsx
  - [ ] Create PasswordModal.jsx
  - [ ] Create CaseSelector.jsx
  - [ ] Create NewCaseModal.jsx
  - [ ] Create SettingsPanel.jsx

- [ ] **2.5 Integration with Generate Report**
  - [ ] Add AutoFetchSection to GenerateReport.js
  - [ ] Wire up action buttons to existing handlers
  - [ ] Test create new case flow
  - [ ] Test add to existing case flow
  - [ ] Test password entry flow

- [ ] **2.6 Testing**
  - [ ] Test end-to-end: fetch → display → action → verify in main tables
  - [ ] Test password-protected PDF flow
  - [ ] Test error handling
  - [ ] Test settings persistence

---

## Shared Resources

### Database Path
```
%APPDATA%/CypherEdge/db.sqlite3
(or %APPDATA%/CypherEdge/ats_db.sqlite3 if FOR_ATS=true)
```

### OAuth Tokens Path
```
%APPDATA%/CypherEdge/gmail_tokens.json
```

### Settings Path
```
%APPDATA%/CypherEdge/auto_fetch_settings.json
```

### PDF Storage Path
```
%APPDATA%/CypherEdge/auto_fetched/<timestamp>_<filename>.pdf
```

---

## Notes

### Why Two-Phase Approach?

1. **Code Reuse**: The existing `generate-report` handler has 550+ lines of complex transformations, batching, and multi-table operations. Duplicating this would be error-prone and hard to maintain.

2. **Single Source of Truth**: All processing goes through the same code path, ensuring consistent data storage.

3. **User Control**: CAs need to decide how statements are categorized (new case vs add to existing). Background auto-processing would remove this control.

4. **Password Handling**: Some PDFs are password-protected. Background service can't prompt for passwords; this must be done in UI.

5. **Error Recovery**: If processing fails, user can retry from UI. Background-only processing would leave orphaned records.

### Service Independence

The background service runs independently because:
- CAs may want statements fetched overnight
- Electron app shouldn't need to be open 24/7
- Service can be started at Windows boot
- Service continues running when Electron closes

### Data Flow Summary

```
Gmail → [Phase 1] → auto_fetched_statements (metadata only)
                            ↓
                      User sees in UI
                            ↓
                      User takes action
                            ↓
        [Phase 2] → EXISTING handlers → cases, statements, transactions, etc.
```

---

*Document Version: 1.0*
*Last Updated: December 2024*
