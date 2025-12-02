// scripts/post-build.js
// Post-build script to copy native modules alongside the executable

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');

console.log('Running post-build tasks...');

// Create native_modules directory in dist
const nativeDir = path.join(distDir, 'native_modules');
if (!fs.existsSync(nativeDir)) {
  fs.mkdirSync(nativeDir, { recursive: true });
}

// Find and copy sqlite3 native bindings
const sqlite3Paths = [
  // Windows build path (most common)
  path.join(projectRoot, 'node_modules', 'sqlite3', 'build', 'Release', 'node_sqlite3.node'),
  // Alternative names
  path.join(projectRoot, 'node_modules', 'sqlite3', 'build', 'Release', 'sqlite3.node'),
  // NAPI binding paths
  path.join(projectRoot, 'node_modules', 'sqlite3', 'lib', 'binding', 'napi-v6-win32-x64', 'node_sqlite3.node'),
  path.join(projectRoot, 'node_modules', 'sqlite3', 'lib', 'binding', 'napi-v3-win32-x64', 'node_sqlite3.node'),
];

let foundSqlite = false;

for (const src of sqlite3Paths) {
  if (fs.existsSync(src)) {
    const dstName = path.basename(src);
    const dst = path.join(nativeDir, dstName);
    fs.copyFileSync(src, dst);
    console.log(`Copied ${dstName} from: ${src}`);
    foundSqlite = true;
    break;
  }
}

if (!foundSqlite) {
  console.warn('Warning: Could not find sqlite3.node - searching for alternatives...');

  // Search recursively in node_modules/sqlite3
  const sqlite3Dir = path.join(projectRoot, 'node_modules', 'sqlite3');

  function findNodeFile(dir) {
    if (!fs.existsSync(dir)) return null;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isFile() && entry.name === 'sqlite3.node') {
        return fullPath;
      }

      if (entry.isDirectory()) {
        const found = findNodeFile(fullPath);
        if (found) return found;
      }
    }

    return null;
  }

  const found = findNodeFile(sqlite3Dir);

  if (found) {
    const dst = path.join(nativeDir, 'sqlite3.node');
    fs.copyFileSync(found, dst);
    console.log(`Found and copied sqlite3.node from: ${found}`);
    foundSqlite = true;
  }
}

if (!foundSqlite) {
  console.error('ERROR: Could not find sqlite3.node native module!');
  console.error('The packaged executable may not work without it.');
  console.error('Try running: npm rebuild sqlite3');
}

// Create a readme for the dist folder
const readme = `
CypherEdge Email Service
========================

Files in this directory:
- emailService.exe    - Main executable
- credentials.json    - Google OAuth credentials (REQUIRED)
- native_modules/     - Native Node.js modules
- .env               - Environment configuration (optional)

Setup:
1. Ensure credentials.json is present (from Google Cloud Console)
2. Run: emailService.exe --setup
3. Authorize your Gmail account(s) in the browser
4. Once authorized, run: emailService.exe

Usage:
  emailService.exe              # Run background service
  emailService.exe --setup      # OAuth setup mode
  emailService.exe --scan       # Single scan and exit
  emailService.exe --status     # Show status
  emailService.exe --help       # Show help

Data Storage:
- Tokens: %APPDATA%/CypherEdge/gmail_tokens.json
- Database: %APPDATA%/CypherEdge/db.sqlite3
- PDFs: %APPDATA%/CypherEdge/auto_fetched/
`;

fs.writeFileSync(path.join(distDir, 'README.txt'), readme.trim());
console.log('Created README.txt');

console.log('\nPost-build complete!');
console.log(`\nDistribution files in: ${distDir}`);

// List files in dist
console.log('\nFiles:');
const files = fs.readdirSync(distDir);
files.forEach(f => {
  const stat = fs.statSync(path.join(distDir, f));
  if (stat.isDirectory()) {
    console.log(`  ${f}/`);
  } else {
    const size = (stat.size / 1024).toFixed(1);
    console.log(`  ${f} (${size} KB)`);
  }
});
