// src/routes/webRoutes.js
// Express route handlers

const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

function createRouter(svc, fastApiClient) {
  const router = express.Router();

  // Home page
  router.get('/', (req, res) => {
    res.send(`
      <h2>Email Service - Gmail Scanner</h2>
      <h3>Quick Actions:</h3>
      <ul>
        <li><a href="/auth">Authorize Gmail Account</a></li>
        <li><a href="/users">List Authorized Users</a></li>
        <li><a href="/trigger">Trigger Immediate Scan</a></li>
        <li><a href="/status">Service Status</a></li>
      </ul>
      <p><small>After authorization, scanning will start automatically</small></p>
    `);
  });

  // Auth redirect
  router.get('/auth', (req, res) => {
    try {
      const url = svc.getAuthUrl();
      return res.redirect(url);
    } catch (e) {
      return res.status(500).send('Error: ' + e.message);
    }
  });

  // OAuth callback (oauth2callback)
  router.get('/oauth2callback', async (req, res) => {
    const code = req.query.code;
    if (!code) {
      return res.status(400).send('Missing authorization code');
    }

    try {
      console.log('\n========================================');
      console.log('PROCESSING OAUTH CALLBACK');
      console.log('========================================');

      const email = await svc.handleOAuthCode(code);

      console.log(`Authentication successful for: ${email}`);

      await svc.resetInitialScanFlag();

      console.log('Starting email scanning service...\n');
      const started = await svc.start(true);

      if (!started) {
        throw new Error('Failed to start service');
      }

      res.send(`
        <h2>Authentication Successful!</h2>
        <h3>Email: ${email}</h3>
        <p>Service started - scanning all emails with attachments</p>
        <p>Initial full scan in progress</p>
        <p>Future scans will check for new unread emails</p>
        <hr>
        <p><a href="/status">View Status</a> | <a href="/trigger">Trigger Manual Scan</a></p>
        <p><small>You can close this window now. The service will continue running.</small></p>
      `);

    } catch (e) {
      console.error('OAuth callback error:', e.message);
      res.status(500).send(`
        <h2>Authentication Failed</h2>
        <p>Error: ${e.message}</p>
        <p><a href="/auth">Try Again</a></p>
      `);
    }
  });

  // OAuth callback (/oauth/callback - to match credentials.json)
  router.get('/oauth/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) {
      return res.status(400).send('Missing authorization code');
    }

    try {
      console.log('\n========================================');
      console.log('PROCESSING OAUTH CALLBACK (/oauth/callback)');
      console.log('========================================');

      const email = await svc.handleOAuthCode(code);

      console.log(`Authentication successful for: ${email}`);

      await svc.resetInitialScanFlag();

      console.log('Starting email scanning service...\n');
      const started = await svc.start(true);

      if (!started) {
        throw new Error('Failed to start service');
      }

      res.send(`
        <h2>Authentication Successful!</h2>
        <h3>Email: ${email}</h3>
        <p>Service started - scanning all emails with attachments</p>
        <p>Initial full scan in progress</p>
        <p>Future scans will check for new unread emails</p>
        <hr>
        <p><a href="/status">View Status</a> | <a href="/trigger">Trigger Manual Scan</a></p>
        <p><small>You can close this window now. The service will continue running.</small></p>
      `);

    } catch (e) {
      console.error('OAuth callback error:', e.message);
      res.status(500).send(`
        <h2>Authentication Failed</h2>
        <p>Error: ${e.message}</p>
        <p><a href="/auth">Try Again</a></p>
      `);
    }
  });

  // List users
  router.get('/users', async (req, res) => {
    try {
      const { users: usersData, filePath } = await svc.tokenStore.listUsers();
      const activeEmail = await svc.getActiveUserEmail();

      const userCount = Object.keys(usersData).length;

      if (userCount === 0) {
        return res.send(`
          <h2>No Users Found</h2>
          <p>No authorized users yet</p>
          <p>Expected file: <code>${filePath}</code></p>
          <hr>
          <p><a href="/auth">Authorize First User</a></p>
          <p><a href="/">Back</a></p>
        `);
      }

      res.send(`
        <h2>Authorized Users (${userCount})</h2>
        <p><strong>Active User:</strong> ${activeEmail || 'None'}</p>
        <p><small>File: ${filePath}</small></p>
        <hr>
        <h3>All Users:</h3>
        <ul>
          ${Object.keys(usersData).map(email => `
            <li style="margin-bottom: 15px; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
              <strong>${email}</strong> ${email === activeEmail ? '<strong>(Active)</strong>' : ''}
              <br><small>Last saved: ${usersData[email].saved_at || 'Unknown'}</small>
              <br><small>Refresh token: ${usersData[email].refresh_token ? 'Yes' : 'No - May need re-auth'}</small>
              <br><small>Access token: ${usersData[email].access_token ? 'Yes' : 'No'}</small>
              ${email !== activeEmail ? `<br><br><a href="/set-active?email=${encodeURIComponent(email)}" style="padding: 5px 10px; background: #007bff; color: white; text-decoration: none; border-radius: 3px;">Set as Active</a>` : ''}
            </li>
          `).join('')}
        </ul>
        <hr>
        <p>
          <a href="/auth">Add Another User</a> |
          <a href="/">Back</a>
        </p>
      `);
    } catch (e) {
      console.error('Error in /users endpoint:', e);
      return res.status(500).send(`
        <h2>Error</h2>
        <p>${e.message}</p>
        <p><a href="/">Back</a></p>
      `);
    }
  });

  // Set active user
  router.get('/set-active', async (req, res) => {
    const email = req.query.email;
    if (!email) {
      return res.status(400).send('Missing email parameter');
    }

    try {
      const { users } = await svc.tokenStore.listUsers();

      if (!users[email]) {
        return res.status(404).send(`
          <h2>User Not Found</h2>
          <p>Email: ${email}</p>
          <p><a href="/users">View Users</a></p>
        `);
      }

      await svc.setActiveUserByEmail(email);

      console.log('\nSwitching active user to:', email);
      await svc.stop();
      await svc.resetInitialScanFlag();

      const started = await svc.start(true);

      res.send(`
        <h2>Active User Changed</h2>
        <p>New active user: <strong>${email}</strong></p>
        <p>${started ? 'Service restarted with full scan' : 'Service start attempted'}</p>
        <hr>
        <p>
          <a href="/status">View Status</a> |
          <a href="/users">View Users</a> |
          <a href="/">Back</a>
        </p>
      `);
    } catch (e) {
      console.error('Error in /set-active:', e);
      return res.status(500).send(`
        <h2>Error</h2>
        <p>${e.message}</p>
        <p><a href="/users">View Users</a></p>
      `);
    }
  });

  // Trigger scan
  router.get('/trigger', async (req, res) => {
    try {
      const activeEmail = await svc.getActiveUserEmail();

      if (!activeEmail) {
        return res.status(400).send(`
          <h2>No Active User</h2>
          <p>Please <a href="/auth">authorize a Gmail account</a> first</p>
        `);
      }

      res.write(`
        <h2>Triggering Immediate Scan</h2>
        <p>Active user: <strong>${activeEmail}</strong></p>
        <p>Scan started - check server console for progress...</p>
        <hr>
      `);

      setImmediate(async () => {
        try {
          await svc.triggerImmediateScan();
          console.log('Manual trigger completed');
        } catch (err) {
          console.error('Manual trigger error:', err.message);
        }
      });

      res.end(`
        <p>Scan triggered successfully</p>
        <p><a href="/status">View Status</a> | <a href="/">Back</a></p>
      `);
    } catch (e) {
      return res.status(500).send('Error: ' + e.message);
    }
  });

  // Status page
  router.get('/status', async (req, res) => {
    try {
      const activeEmail = await svc.getActiveUserEmail();
      const stats = await svc.getStats();
      const isRunning = svc.isRunning;
      const isScanning = svc._isScanning;
      const didInitial = await svc.hasDoneInitialScan();

      // Build per-user stats table
      let perUserHtml = '';
      if (stats.perUser && stats.perUser.length > 0) {
        perUserHtml = `
          <h3>Attachments by User</h3>
          <table border="1" cellpadding="10">
            <tr><th>User Email</th><th>Total</th><th>Bank Statements</th></tr>
            ${stats.perUser.map(u => `
              <tr>
                <td>${u.user_email || '(unknown)'}</td>
                <td>${u.total}</td>
                <td>${u.bank}</td>
              </tr>
            `).join('')}
          </table>
        `;
      }

      res.send(`
        <h2>Service Status</h2>
        <table border="1" cellpadding="10">
          <tr><td><strong>Service Running:</strong></td><td>${isRunning ? 'Yes' : 'No'}</td></tr>
          <tr><td><strong>Currently Scanning:</strong></td><td>${isScanning ? 'Yes' : 'No'}</td></tr>
          <tr><td><strong>Active User:</strong></td><td>${activeEmail || 'None'}</td></tr>
          <tr><td><strong>Initial Scan Complete:</strong></td><td>${didInitial ? 'Yes' : 'No'}</td></tr>
          <tr><td><strong>Scan Interval:</strong></td><td>${svc.intervalMinutes} minutes</td></tr>
          <tr><td><strong>Total Attachments:</strong></td><td>${stats.total}</td></tr>
          <tr><td><strong>Bank Statements:</strong></td><td>${stats.bank}</td></tr>
        </table>
        ${perUserHtml}
        <hr>
        <p>
          <a href="/trigger">Trigger Scan</a> |
          <a href="/users">View Users</a> |
          <a href="/">Back</a>
        </p>
        <p><small>Page auto-refreshes every 10 seconds</small></p>
        <script>setTimeout(() => location.reload(), 10000);</script>
      `);
    } catch (e) {
      return res.status(500).send('Error: ' + e.message);
    }
  });

  // Run exe endpoint (for FastAPI integration)
  router.post('/run-exe', async (req, res) => {
    try {
      const fastApiResult = await fastApiClient.analyzeStatements(
        req.body.pdf_paths || req.body.normalizedPaths || [],
        {
          passwords: req.body.passwords || [],
          bankNames: req.body.bank_names || [],
          caseName: req.body.caseName || 'unknown',
          caId: req.body.ca_id || 'CA-123'
        }
      );

      const handled = await fastApiClient.handleFastApiResult(fastApiResult, {
        caseId: req.body.caseId,
        caseName: req.body.caseName || 'unknown',
        tmpdir_path: req.app.get('tmpdir_path') || './tmp'
      });

      if (!handled.success) {
        return res.status(200).json({
          success: true,
          data: {
            caseId: req.body.caseId,
            processed: null,
            totalTransactions: 0,
            eodProcessed: false,
            summaryProcessed: false,
            failedStatements: handled.failedStatements || null,
            failedFiles: [],
            successfulFiles: [],
            nerResults: fastApiResult?.data?.ner_results || { Name: [], 'Acc Number': [] },
            processing_times: fastApiResult?.data?.processing_times || [],
            warning: fastApiResult?.data?.['pdf_paths_not_extracted']?.['respective_reasons_for_error'] || null
          }
        });
      }

      res.json({
        success: true,
        parsed: handled.parsedData,
        totalTransactions: handled.parsedData._totalTransactions
      });

    } catch (err) {
      console.error('run-exe route error', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

module.exports = { createRouter };
