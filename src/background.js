// src/background.js
// Phase 1: Standalone background service entry point
// This is packaged as emailService.exe for CypherEdge integration

require('dotenv').config();
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const express = require('express');

const config = require('./config');
const AutoFetchEmailService = require('./services/AutoFetchEmailService');

// Parse command line arguments
const args = process.argv.slice(2);
const MODE = {
  BACKGROUND: 'background',
  SETUP: 'setup',
  SCAN_ONCE: 'scan-once',
  STATUS: 'status'
};

function parseArgs() {
  const options = {
    mode: MODE.BACKGROUND,
    port: config.port
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--setup' || arg === '--auth' || arg === '-s') {
      options.mode = MODE.SETUP;
    } else if (arg === '--scan' || arg === '--once' || arg === '-o') {
      options.mode = MODE.SCAN_ONCE;
    } else if (arg === '--status') {
      options.mode = MODE.STATUS;
    } else if (arg === '--port' || arg === '-p') {
      options.port = parseInt(args[++i] || config.port, 10);
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Email Service - CypherEdge Background Scanner
==============================================

Usage: emailService.exe [options]

Options:
  --setup, --auth, -s    Start web server for OAuth authentication
  --scan, --once, -o     Run a single scan and exit
  --status               Show service status and exit
  --port, -p <port>      Port for setup server (default: ${config.port})
  --help, -h             Show this help message

Modes:
  Default (no args)      Run as background service (continuous scanning)
  Setup mode             Start temporary web server for Gmail OAuth
  Scan once              Run a single scan and exit

Data Locations:
  Tokens:    ${config.paths.sharedTokens}
  Database:  ${config.paths.sharedDb}
  PDFs:      ${config.paths.autoFetchedPdfs}
  Settings:  ${config.paths.sharedSettings}

Examples:
  emailService.exe                 # Run background service
  emailService.exe --setup         # Start OAuth setup server
  emailService.exe --scan          # Run single scan
  emailService.exe --status        # Check status
`);
}

async function printStatus(service) {
  console.log('\n========================================');
  console.log('EMAIL SERVICE STATUS');
  console.log('========================================');

  const accounts = await service.getActiveAccounts();
  console.log(`\nAuthorized Accounts: ${accounts.length}`);
  accounts.forEach(email => console.log(`   - ${email}`));

  const stats = await service.getStats();
  console.log(`\nDatabase Statistics:`);
  console.log(`   Total statements: ${stats.total || 0}`);
  console.log(`   Pending: ${stats.pending || 0}`);
  console.log(`   Needs password: ${stats.needs_password || 0}`);
  console.log(`   Completed: ${stats.completed || 0}`);

  const status = service.getStatus();
  console.log(`\nService Status:`);
  console.log(`   Last scan: ${status.lastScanTime ? new Date(status.lastScanTime).toLocaleString() : 'Never'}`);
  console.log(`   Scan interval: ${status.intervalMinutes} minutes`);

  console.log(`\nPaths:`);
  console.log(`   Tokens: ${status.tokensPath}`);
  console.log(`   PDFs: ${status.pdfOutputDir}`);

  console.log('\n========================================\n');
}

async function startSetupServer(service, port) {
  const app = express();
  app.use(express.json());

  // Home page
  app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Email Service Setup</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 600px;
      margin: 50px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .card {
      background: white;
      border-radius: 8px;
      padding: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }
    h1 { color: #333; margin-top: 0; }
    h2 { color: #555; font-size: 18px; margin-top: 0; }
    .btn {
      display: inline-block;
      background: #4285f4;
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      text-decoration: none;
      font-weight: 500;
    }
    .btn:hover { background: #3367d6; }
    .success { color: #34a853; }
    .info { color: #666; font-size: 14px; }
    ul { padding-left: 20px; }
    li { margin: 8px 0; }
    code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>CypherEdge Email Service Setup</h1>
    <p>This setup wizard will authorize Gmail access for automatic bank statement fetching.</p>
    <a href="/auth" class="btn">Authorize Gmail Account</a>
  </div>

  <div class="card">
    <h2>How it works</h2>
    <ul>
      <li>Click "Authorize Gmail Account" above</li>
      <li>Sign in with your Google account</li>
      <li>Grant read-only access to your emails</li>
      <li>The service will automatically scan for bank statements</li>
    </ul>
  </div>

  <div class="card">
    <h2>Authorized Accounts</h2>
    <div id="accounts">Loading...</div>
  </div>

  <script>
    fetch('/api/accounts')
      .then(r => r.json())
      .then(data => {
        const el = document.getElementById('accounts');
        if (data.accounts && data.accounts.length > 0) {
          el.innerHTML = '<ul>' + data.accounts.map(e => '<li>' + e + '</li>').join('') + '</ul>';
          el.innerHTML += '<p class="success">Setup complete! You can close this window and run the service in background mode.</p>';
        } else {
          el.innerHTML = '<p class="info">No accounts authorized yet. Click the button above to add one.</p>';
        }
      })
      .catch(() => {
        document.getElementById('accounts').innerHTML = '<p>Could not load accounts</p>';
      });
  </script>
</body>
</html>
    `);
  });

  // Start OAuth flow (redirect)
  app.get('/auth', (req, res) => {
    try {
      const authUrl = service.getAuthUrl();
      res.redirect(authUrl);
    } catch (e) {
      res.status(500).send(`
        <h1>Error</h1>
        <p>Could not start OAuth flow: ${e.message}</p>
        <p>Make sure credentials.json is present in the project directory.</p>
        <a href="/">Go back</a>
      `);
    }
  });

  // Get OAuth URL as JSON (for Electron integration)
  app.get('/auth-url', (req, res) => {
    try {
      const authUrl = service.getAuthUrl();
      res.json({ authUrl });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // OAuth callback
  app.get('/oauth/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) {
      return res.status(400).send('No authorization code received');
    }

    try {
      const email = await service.handleOAuthCode(code);
      res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Authorization Successful</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 600px;
      margin: 50px auto;
      padding: 20px;
      text-align: center;
    }
    .success { color: #34a853; font-size: 48px; }
    h1 { color: #333; }
    .email { background: #f0f0f0; padding: 8px 16px; border-radius: 4px; display: inline-block; }
    .next-steps { text-align: left; background: #f5f5f5; padding: 20px; border-radius: 8px; margin-top: 24px; }
    code { background: #e0e0e0; padding: 2px 6px; border-radius: 3px; }
  </style>
</head>
<body>
  <div class="success">&#10004;</div>
  <h1>Authorization Successful!</h1>
  <p>Account authorized: <span class="email">${email}</span></p>

  <div class="next-steps">
    <h3>Next Steps:</h3>
    <ol>
      <li>Close this browser window</li>
      <li>Run the service in background mode:
        <br><code>emailService.exe</code>
      </li>
      <li>Or add more accounts by clicking the button below</li>
    </ol>
  </div>

  <p style="margin-top: 24px;">
    <a href="/" style="color: #4285f4;">Add another account</a>
  </p>
</body>
</html>
      `);
    } catch (e) {
      res.status(500).send(`
        <h1>Authorization Failed</h1>
        <p>Error: ${e.message}</p>
        <a href="/">Try again</a>
      `);
    }
  });

  // API: List accounts
  app.get('/api/accounts', async (req, res) => {
    try {
      const accounts = await service.getActiveAccounts();
      res.json({ accounts });
    } catch (e) {
      res.json({ accounts: [], error: e.message });
    }
  });

  // API: Get stats
  app.get('/api/stats', async (req, res) => {
    try {
      const stats = await service.getStats();
      res.json(stats);
    } catch (e) {
      res.json({ error: e.message });
    }
  });

  // API: Trigger scan
  app.post('/api/scan', async (req, res) => {
    try {
      const result = await service.triggerScan();
      res.json({ success: result });
    } catch (e) {
      res.json({ success: false, error: e.message });
    }
  });

  // API: Re-check password protection for all PDFs
  // Useful after updating the PasswordChecker logic
  app.post('/api/recheck-passwords', async (req, res) => {
    try {
      console.log('[API] Re-checking password protection for all PDFs...');

      const statements = await service.database.getAllStatements();
      const PasswordChecker = require('./services/PasswordChecker');
      const pc = new PasswordChecker();

      let updated = 0;
      let errors = 0;

      for (const stmt of statements) {
        try {
          const fsSync = require('fs');
          // Use snake_case column names from SQLite
          const pdfPath = stmt.pdf_path;
          const pdfFilename = stmt.pdf_filename;
          const isProtected = stmt.is_password_protected;

          if (!pdfPath || !fsSync.existsSync(pdfPath)) {
            console.log(`  [Skip] File not found: ${pdfFilename || 'unknown'}`);
            continue;
          }

          const result = await pc.checkPdfProtection(pdfPath);
          const newValue = result.isProtected ? 1 : 0;

          // Update if different
          if (isProtected !== newValue) {
            // Use email_message_id since id can be null in some records
            await service.database.updatePasswordProtectionByMessageId(stmt.email_message_id, newValue);
            console.log(`  [Updated] ${pdfFilename}: ${isProtected} -> ${newValue}`);
            updated++;
          }
        } catch (e) {
          console.error(`  [Error] ${stmt.pdf_filename || 'unknown'}: ${e.message}`);
          errors++;
        }
      }

      console.log(`[API] Re-check complete: ${updated} updated, ${errors} errors`);
      res.json({ success: true, total: statements.length, updated, errors });
    } catch (e) {
      console.error('[API] Re-check error:', e.message);
      res.json({ success: false, error: e.message });
    }
  });

  // Start server
  const server = app.listen(port, () => {
    console.log('\n========================================');
    console.log('SETUP SERVER STARTED');
    console.log('========================================');
    console.log(`URL: http://localhost:${port}`);
    console.log('\nOpen this URL in your browser to authorize Gmail accounts.');
    console.log('Press Ctrl+C when done to exit.\n');
  });

  // Don't auto-open browser - OAuth is handled via Electron BrowserWindow
  // try {
  //   const open = require('open');
  //   open(`http://localhost:${port}`).catch(() => {});
  // } catch (e) {
  //   // open module not available, skip
  // }

  return server;
}

async function runBackgroundService(service, port) {
  console.log('\n========================================');
  console.log('BACKGROUND MODE');
  console.log('========================================');

  const accounts = await service.getActiveAccounts();

  if (accounts.length === 0) {
    console.log('\nNo authorized Gmail accounts found!');
    console.log('Please run with --setup flag first to authorize accounts:');
    console.log('  emailService.exe --setup\n');
    process.exit(1);
  }

  // Start web server for Electron integration (OAuth, API endpoints)
  await startSetupServer(service, port);
  console.log(`\nAPI server running on port ${port} for Electron integration`);

  // Start the background service
  await service.start();

  // Keep process running
  console.log('Service running in background. Press Ctrl+C to stop.\n');
}

async function runSingleScan(service) {
  console.log('\n========================================');
  console.log('SINGLE SCAN MODE');
  console.log('========================================');

  const accounts = await service.getActiveAccounts();

  if (accounts.length === 0) {
    console.log('\nNo authorized Gmail accounts found!');
    console.log('Please run with --setup flag first.\n');
    process.exit(1);
  }

  console.log(`Scanning ${accounts.length} account(s)...\n`);

  await service.triggerScan();

  console.log('Scan complete. Exiting.\n');
  await service.stop();
  process.exit(0);
}

async function main() {
  const options = parseArgs();

  console.log('========================================');
  console.log('   CYPHEREDGE EMAIL SERVICE');
  console.log('   Bank Statement Auto-Fetcher');
  console.log('========================================\n');

  // Create and initialize service
  const service = new AutoFetchEmailService();

  try {
    await service.init();
  } catch (e) {
    console.error('Failed to initialize service:', e.message);
    process.exit(1);
  }

  // Handle different modes
  switch (options.mode) {
    case MODE.SETUP:
      await startSetupServer(service, options.port);
      break;

    case MODE.SCAN_ONCE:
      await runSingleScan(service);
      break;

    case MODE.STATUS:
      await printStatus(service);
      process.exit(0);
      break;

    case MODE.BACKGROUND:
    default:
      await runBackgroundService(service, options.port);
      break;
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\nShutting down...');
    await service.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n\nReceived SIGTERM, shutting down...');
    await service.stop();
    process.exit(0);
  });

  // Handle uncaught errors
  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err.message);
    console.error(err.stack);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection:', reason);
  });
}

// Run if executed directly
if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
  });
}

module.exports = { AutoFetchEmailService, main };
