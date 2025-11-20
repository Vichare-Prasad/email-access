const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3001;
const JWT_SECRET = 'your-jwt-secret-key';

// Middleware
app.use(cors());
app.use(express.json());

// Database setup
const db = new sqlite3.Database('./users.db');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password_hash TEXT,
      imap_config TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS email_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      email_provider TEXT,
      imap_host TEXT,
      imap_port INTEGER,
      email TEXT,
      app_password TEXT,
      is_active BOOLEAN DEFAULT true,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Routes
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    
    db.run(
      'INSERT INTO users (email, password_hash) VALUES (?, ?)',
      [email, passwordHash],
      function(err) {
        if (err) {
          return res.status(400).json({ error: 'User already exists' });
        }
        
        const token = jwt.sign({ userId: this.lastID, email }, JWT_SECRET);
        res.json({ token, userId: this.lastID });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, email }, JWT_SECRET);
    res.json({ token, userId: user.id });
  });
});

// Email configuration endpoints
app.post('/api/email-config', authenticateToken, (req, res) => {
  const { emailProvider, imapHost, imapPort, email, appPassword } = req.body;
  
  db.run(
    `INSERT INTO email_configs (user_id, email_provider, imap_host, imap_port, email, app_password) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [req.user.userId, emailProvider, imapHost, imapPort, email, appPassword],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to save configuration' });
      }
      
      // Start background service for this user
      startBackgroundService(req.user.userId, email, appPassword, imapHost, imapPort);
      
      res.json({ success: true, configId: this.lastID });
    }
  );
});

app.get('/api/statements', authenticateToken, (req, res) => {
  // Return processed statements for the user
  const statements = getProcessedStatements(req.user.userId);
  res.json({ statements });
});

// Background service management
function startBackgroundService(userId, email, password, host, port) {
  // This would integrate with your existing background-service.js
  const { spawn } = require('child_process');
  
  const service = spawn('node', [
    'background-service.js',
    '--userId', userId,
    '--email', email,
    '--password', password,
    '--host', host,
    '--port', port
  ]);

  service.on('error', (err) => {
    console.error('Background service error:', err);
  });

  return service;
}

app.listen(PORT, () => {
  console.log(`Auth server running on http://localhost:${PORT}`);
});