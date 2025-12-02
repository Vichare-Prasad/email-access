// src/services/GmailClient.js
// Gmail API wrapper

const { google } = require('googleapis');
const fsSync = require('fs');
const path = require('path');

class GmailClient {
  constructor(config, tokenStore) {
    this.config = config;
    this.tokenStore = tokenStore;
    this.credentials = null;
    this.loadCredentials();
  }

  /**
   * Load OAuth credentials from credentials.json file
   */
  loadCredentials() {
    const credentialsPath = this.config.paths.credentials;
    try {
      if (fsSync.existsSync(credentialsPath)) {
        const content = fsSync.readFileSync(credentialsPath, 'utf8');
        const json = JSON.parse(content);

        // Handle both "web" and "installed" credential types
        const creds = json.web || json.installed || json;

        if (creds.client_id && creds.client_secret) {
          console.log('Loaded credentials from credentials.json');
          console.log(`   Client ID: ${creds.client_id.substring(0, 20)}...`);

          // Extract redirect URI from credentials if available
          let redirectUri = null;
          if (creds.redirect_uris && creds.redirect_uris.length > 0) {
            redirectUri = creds.redirect_uris[0];
            console.log(`   Redirect URI: ${redirectUri}`);
          }

          this.credentials = {
            clientId: creds.client_id,
            clientSecret: creds.client_secret,
            redirectUri: redirectUri
          };
          return;
        }
      }

      console.warn('credentials.json not found, using fallback');
      this.credentials = {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirectUri: null
      };
    } catch (e) {
      console.error('Error loading credentials.json:', e.message);
      this.credentials = {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirectUri: null
      };
    }
  }

  /**
   * Ensure OAuth config is present
   */
  _ensureOAuthConfig() {
    if (!this.credentials.clientId || !this.credentials.clientSecret) {
      throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
    }
  }

  /**
   * Create OAuth2 client
   */
  createOAuth2Client() {
    this._ensureOAuthConfig();
    const redirectUri = this.credentials.redirectUri || `${this.config.serverBaseUrl}/oauth/callback`;
    console.log(`   Using redirect URI: ${redirectUri}`);
    return new google.auth.OAuth2(
      this.credentials.clientId,
      this.credentials.clientSecret,
      redirectUri
    );
  }

  /**
   * Get authorization URL
   */
  getAuthUrl() {
    const oAuth2Client = this.createOAuth2Client();
    return oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: this.config.oauthScopes
    });
  }

  /**
   * Handle OAuth code exchange
   */
  async handleOAuthCode(code) {
    try {
      const client = this.createOAuth2Client();

      console.log('Exchanging authorization code for tokens...');
      const r = await client.getToken(code);
      const tokens = r.tokens || {};

      console.log('Received tokens:', {
        has_refresh_token: !!tokens.refresh_token,
        has_access_token: !!tokens.access_token,
        expiry_date: tokens.expiry_date || null
      });

      client.setCredentials(tokens);

      const oauth2 = google.oauth2({ auth: client, version: 'v2' });
      const info = await oauth2.userinfo.get();
      const email = (info && info.data && info.data.email) ? info.data.email : null;

      if (!email) {
        throw new Error('Could not determine user email from Google');
      }

      await this.tokenStore.save(email, tokens);

      return email;
    } catch (e) {
      console.error('OAuth code exchange failed:', e.message);
      throw e;
    }
  }

  /**
   * Get OAuth client for a specific email
   */
  async getClientForEmail(email) {
    try {
      if (!email) {
        console.warn('No email provided to getClientForEmail');
        return null;
      }

      const u = await this.tokenStore.load(email);

      if (!u) {
        return null;
      }

      // Check for refresh_token
      if (!u.refresh_token) {
        console.error(`No refresh_token for ${email} - cannot maintain long-term access`);
        console.error('Re-authorize this account via /auth to get a new refresh token');

        if (!u.access_token) {
          console.error('No access_token either - re-authorization required');
          return null;
        }

        console.warn('Using access_token only - will fail when it expires');
      }

      console.log(`Loading tokens for: ${email}`);
      console.log(`   - Has refresh_token: ${!!u.refresh_token}`);
      console.log(`   - Has access_token: ${!!u.access_token}`);
      console.log(`   - Token saved at: ${u.saved_at || 'unknown'}`);

      const client = this.createOAuth2Client();
      const credentials = {};

      if (u.refresh_token) credentials.refresh_token = u.refresh_token;
      if (u.access_token) credentials.access_token = u.access_token;
      if (u.expiry_date) credentials.expiry_date = u.expiry_date;
      if (u.token_type) credentials.token_type = u.token_type;
      if (u.scope) credentials.scope = u.scope;

      client.setCredentials(credentials);

      // Handle token refresh
      if (client.on) {
        client.on('tokens', async (toks) => {
          try {
            console.log('Token refresh detected - saving updated tokens');
            await this.tokenStore.update(email, toks);
          } catch (e) {
            console.warn('Failed to persist refreshed tokens:', e.message);
          }
        });
      }

      return client;
    } catch (e) {
      console.error('getClientForEmail error:', e.message);
      return null;
    }
  }

  /**
   * Fetch emails matching a query
   */
  async fetchEmails(client, query, maxEmails = 500) {
    const gmail = google.gmail({ version: 'v1', auth: client });

    console.log(`Searching emails with query: "${query}"`);

    let allMessages = [];
    let pageToken = null;

    do {
      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 100,
        pageToken: pageToken
      });

      const messages = listResponse.data.messages || [];
      allMessages = allMessages.concat(messages);
      pageToken = listResponse.data.nextPageToken;

      console.log(`   Found ${messages.length} messages (total: ${allMessages.length})`);

    } while (pageToken && allMessages.length < maxEmails);

    return allMessages;
  }

  /**
   * Get full message details
   */
  async getMessageDetails(client, messageId) {
    const gmail = google.gmail({ version: 'v1', auth: client });
    return await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });
  }

  /**
   * Mark message as read
   */
  async markAsRead(client, messageId) {
    const gmail = google.gmail({ version: 'v1', auth: client });
    try {
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: ['UNREAD']
        }
      });
    } catch (markErr) {
      console.warn(`Could not mark as read: ${markErr.message}`);
    }
  }

  /**
   * Extract attachments from email payload (recursive for multipart)
   */
  async extractAttachments(client, messageId, payload, attachments = []) {
    const gmail = google.gmail({ version: 'v1', auth: client });
    const validExtensions = this.config.validExtensions;

    // Check if this part has an attachment
    if (payload.filename && payload.filename.length > 0) {
      const ext = path.extname(payload.filename).toLowerCase();

      if (validExtensions.includes(ext)) {
        console.log(`   Found: ${payload.filename}`);

        let attachmentData = null;

        // Get attachment data
        if (payload.body && payload.body.attachmentId) {
          // Large attachment - need to fetch separately
          try {
            const attResponse = await gmail.users.messages.attachments.get({
              userId: 'me',
              messageId: messageId,
              id: payload.body.attachmentId
            });

            if (attResponse.data && attResponse.data.data) {
              attachmentData = Buffer.from(attResponse.data.data, 'base64url');
            }
          } catch (attErr) {
            console.error(`   Failed to download attachment: ${attErr.message}`);
          }
        } else if (payload.body && payload.body.data) {
          // Small attachment - data is inline
          attachmentData = Buffer.from(payload.body.data, 'base64url');
        }

        if (attachmentData) {
          attachments.push({
            filename: payload.filename,
            mimeType: payload.mimeType,
            size: attachmentData.length,
            data: attachmentData
          });
        }
      }
    }

    // Recursively check parts (for multipart messages)
    if (payload.parts && Array.isArray(payload.parts)) {
      for (const part of payload.parts) {
        await this.extractAttachments(client, messageId, part, attachments);
      }
    }

    return attachments;
  }
}

module.exports = GmailClient;
