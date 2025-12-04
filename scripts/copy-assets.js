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

// Copy patterns.json for PatternMatcher
const patternsSrc = path.join(__dirname, '..', 'src', 'patterns.json');
const patternsDst = path.join(distDir, 'patterns.json');
if (fs.existsSync(patternsSrc)) {
  fs.copyFileSync(patternsSrc, patternsDst);
  console.log('Copied patterns.json to dist');
} else {
  console.warn('Warning: patterns.json not found - PatternMatcher will use defaults');
}

// Copy classifier script for packaged exe
const classifierSrc = path.join(__dirname, '..', 'run_classifier.py');
const classifierDst = path.join(distDir, 'run_classifier.py');
if (fs.existsSync(classifierSrc)) {
  fs.copyFileSync(classifierSrc, classifierDst);
  console.log('Copied run_classifier.py to dist');
} else {
  console.warn('Warning: run_classifier.py not found - classifier may be unavailable in packaged build');
}

// Copy .env if it exists
const envSrc = path.join(__dirname, '..', '.env');
const envDst = path.join(distDir, '.env');

if (fs.existsSync(envSrc)) {
  fs.copyFileSync(envSrc, envDst);
  console.log('Copied .env to dist');
}

console.log('Pre-build asset copy complete');
