// scripts/copy-assets.js
// Pre-build script to prepare assets for packaging

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');

// Create dist directory
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
  console.log('Created dist directory');
}

// Copy credentials.json if it exists
const credsSrc = path.join(__dirname, '..', 'credentials.json');
const credsDst = path.join(distDir, 'credentials.json');

if (fs.existsSync(credsSrc)) {
  fs.copyFileSync(credsSrc, credsDst);
  console.log('Copied credentials.json to dist');
} else {
  console.warn('Warning: credentials.json not found - you will need to add it manually');
}

// Copy .env if it exists
const envSrc = path.join(__dirname, '..', '.env');
const envDst = path.join(distDir, '.env');

if (fs.existsSync(envSrc)) {
  fs.copyFileSync(envSrc, envDst);
  console.log('Copied .env to dist');
}

console.log('Pre-build asset copy complete');
