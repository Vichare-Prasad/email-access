// src/index.js
// Entry point for the Email Service

require('dotenv').config();
const express = require('express');
const open = require('open');

const config = require('./config');
const EmailService = require('./services/EmailService');
const FastAPIClient = require('./services/FastAPIClient');
const { createRouter } = require('./routes/webRoutes');

async function startWebAuthServer(svc, fastApiClient, port) {
  const app = express();

  // JSON body parser for POST requests
  app.use(express.json());

  // Mount routes
  app.use('/', createRouter(svc, fastApiClient));

  const server = app.listen(port, () => {
    console.log('\n========================================');
    console.log('WEB SERVER STARTED');
    console.log('========================================');
    console.log(`URL: ${config.serverBaseUrl}`);
    console.log(`Port: ${port}`);
    console.log('\nAvailable Endpoints:');
    console.log('   /          - Home page');
    console.log('   /auth      - Authorize Gmail');
    console.log('   /users     - List users');
    console.log('   /trigger   - Manual scan');
    console.log('   /status    - Service status');
    console.log('========================================\n');

    // Auto-open browser
    try {
      open(`${config.serverBaseUrl}`).catch(() => {
        console.log('Open your browser to:', config.serverBaseUrl);
      });
    } catch (_) {
      console.log('Open your browser to:', config.serverBaseUrl);
    }
  });

  return server;
}

async function main() {
  console.log('========================================');
  console.log('   EMAIL SERVICE - GMAIL SCANNER');
  console.log('========================================\n');

  const svc = new EmailService({});
  const fastApiClient = new FastAPIClient(config);

  try {
    console.log('Initializing service...');
    await svc.init();
    await svc.loadConfig();
    console.log('Service initialized\n');

    console.log('Starting web authentication server...');
    await startWebAuthServer(svc, fastApiClient, config.port);

    // Check if we already have an active user
    const activeEmail = await svc.getActiveUserEmail();

    if (activeEmail) {
      console.log(`\nFound existing active user: ${activeEmail}`);
      console.log('Auto-starting email scanning...\n');

      try {
        await svc.start(false);
      } catch (e) {
        console.error('Failed to auto-start scanning:', e.message);
        console.log('You may need to re-authorize via /auth\n');
      }
    } else {
      console.log('\nNo active user found');
      console.log('Please visit the web interface to authorize a Gmail account\n');
    }

  } catch (e) {
    console.error('Failed to start service:', e.message);
    console.error(e.stack);
    process.exit(1);
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\nShutting down gracefully...');
    await svc.stop();
    process.exit(0);
  });
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { EmailService, main };
