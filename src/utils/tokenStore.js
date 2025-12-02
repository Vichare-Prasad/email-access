// src/utils/tokenStore.js
// OAuth token persistence

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

class TokenStore {
  constructor(usersJsonPath, projectRoot) {
    this.usersJsonPath = usersJsonPath;
    this.projectRoot = projectRoot;
  }

  /**
   * Save user tokens
   */
  async save(email, tokens) {
    try {
      // Ensure output directory exists
      const dir = path.dirname(this.usersJsonPath);
      await fs.mkdir(dir, { recursive: true });

      let existing = {};

      // Try to read existing users.json
      try {
        if (fsSync.existsSync(this.usersJsonPath)) {
          const txt = await fs.readFile(this.usersJsonPath, 'utf8');
          existing = JSON.parse(txt || '{}');
          console.log('Read existing users.json');
        } else {
          console.log('users.json not found - will create new file');
        }
      } catch (e) {
        console.warn('Could not read users.json (will create new):', e.message);
        existing = {};
      }

      // Add/update user tokens
      existing[email] = {
        email,
        saved_at: new Date().toISOString(),
        refresh_token: tokens.refresh_token || null,
        access_token: tokens.access_token || null,
        expiry_date: tokens.expiry_date || null,
        token_type: tokens.token_type || 'Bearer',
        scope: tokens.scope || null
      };

      // Write to file with error handling
      try {
        await fs.writeFile(this.usersJsonPath, JSON.stringify(existing, null, 2), 'utf8');
        console.log(`Saved tokens to: ${this.usersJsonPath}`);

        // Verify file was created
        if (fsSync.existsSync(this.usersJsonPath)) {
          const fileSize = fsSync.statSync(this.usersJsonPath).size;
          console.log(`File verified: ${fileSize} bytes`);
        } else {
          throw new Error('File was not created');
        }
      } catch (writeError) {
        console.error('Failed to write users.json:', writeError.message);

        // Try alternative path in project root as backup
        const backupPath = path.join(this.projectRoot, 'users_backup.json');
        console.log(`Attempting backup save to: ${backupPath}`);

        try {
          await fs.writeFile(backupPath, JSON.stringify(existing, null, 2), 'utf8');
          console.log(`Saved to backup location: ${backupPath}`);
          this.usersJsonPath = backupPath;
        } catch (backupError) {
          console.error('Backup save also failed:', backupError.message);
          throw new Error('Could not save tokens to any location');
        }
      }

      if (!tokens.refresh_token) {
        console.warn('No refresh_token received. You may need to revoke access and re-authorize.');
        console.warn('Visit: https://myaccount.google.com/permissions');
      }

      return true;
    } catch (e) {
      console.error('Failed to persist user tokens:', e.message);
      throw e;
    }
  }

  /**
   * Load user tokens
   */
  async load(email) {
    try {
      if (!email) {
        console.warn('No email provided to load tokens');
        return null;
      }

      // Check if users.json exists
      if (!fsSync.existsSync(this.usersJsonPath)) {
        console.warn(`users.json not found at: ${this.usersJsonPath}`);

        // Try backup location
        const backupPath = path.join(this.projectRoot, 'users_backup.json');
        if (fsSync.existsSync(backupPath)) {
          console.log(`Found backup at: ${backupPath}`);
          this.usersJsonPath = backupPath;
        } else {
          console.warn('No user tokens file found. Please authorize via /auth');
          return null;
        }
      }

      const txt = await fs.readFile(this.usersJsonPath, 'utf8');
      const users = JSON.parse(txt || '{}');
      const u = users[email];

      if (!u) {
        console.warn(`No tokens found for ${email}`);
        console.log('Available users:', Object.keys(users).join(', ') || 'None');
        return null;
      }

      return u;
    } catch (e) {
      console.error('Load tokens error:', e.message);
      return null;
    }
  }

  /**
   * Update tokens for a user (used during refresh)
   */
  async update(email, tokens) {
    try {
      const txt = await fs.readFile(this.usersJsonPath, 'utf8');
      const users = JSON.parse(txt || '{}');
      const entry = users[email] || {};

      if (tokens.access_token) entry.access_token = tokens.access_token;
      if (tokens.refresh_token) entry.refresh_token = tokens.refresh_token;
      if (tokens.expiry_date) entry.expiry_date = tokens.expiry_date;
      if (tokens.token_type) entry.token_type = tokens.token_type;
      if (tokens.scope) entry.scope = tokens.scope;
      entry.saved_at = new Date().toISOString();

      users[email] = entry;
      await fs.writeFile(this.usersJsonPath, JSON.stringify(users, null, 2), 'utf8');
      console.log(`Refreshed tokens saved for ${email}`);
    } catch (e) {
      console.warn('Failed to persist refreshed tokens:', e.message);
    }
  }

  /**
   * List all users
   */
  async listUsers() {
    try {
      let filePath = this.usersJsonPath;

      if (!fsSync.existsSync(this.usersJsonPath)) {
        const backupPath = path.join(this.projectRoot, 'users_backup.json');
        if (fsSync.existsSync(backupPath)) {
          filePath = backupPath;
        } else {
          return { users: {}, filePath: this.usersJsonPath };
        }
      }

      const txt = await fs.readFile(filePath, 'utf8');
      return { users: JSON.parse(txt || '{}'), filePath };
    } catch (e) {
      console.error('Error listing users:', e.message);
      return { users: {}, filePath: this.usersJsonPath };
    }
  }

  /**
   * Get current users.json path
   */
  getPath() {
    return this.usersJsonPath;
  }
}

module.exports = TokenStore;
