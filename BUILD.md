# Build Documentation - CypherEdge Email Service

## Overview

The Email Service is packaged as a standalone Windows executable (`emailService.exe`) using a two-step bundling process: **esbuild** for bundling, then **pkg** for creating the executable.

## Why Two Steps?

The `googleapis` library has V8 snapshot limitations that cause "Invalid host defined options" errors when directly packaged with pkg. By pre-bundling with esbuild, we work around this limitation.

## Prerequisites

```bash
npm install
```

Required dev dependencies:
- `esbuild` - JavaScript bundler
- `pkg` - Node.js executable packager

## Build Process

### Step 1: Bundle with esbuild

```bash
npx esbuild src/background.js --bundle --platform=node --target=node18 --outfile=dist/bundle.cjs --external:sqlite3
```

This creates `dist/bundle.cjs` (~30MB) containing all JavaScript dependencies bundled together.

**Key flags:**
- `--bundle` - Bundle all dependencies
- `--platform=node` - Target Node.js (not browser)
- `--target=node18` - Compatibility with Node 18
- `--external:sqlite3` - Exclude sqlite3 (native module, loaded at runtime)

### Step 2: Package with pkg

```bash
npx pkg dist/bundle.cjs --targets node18-win-x64 --output dist/emailService.exe --config pkg.config.json
```

This creates `dist/emailService.exe` (~55MB) - the standalone executable.

### Step 3: Post-build (native modules)

```bash
node scripts/post-build.js
```

Copies `node_sqlite3.node` to `dist/native_modules/` for runtime loading.

## Quick Build Commands

```bash
# Full build (recommended)
npm run build

# Or manually:
npm run copy-assets && npx esbuild src/background.js --bundle --platform=node --target=node18 --outfile=dist/bundle.cjs --external:sqlite3 && npx pkg dist/bundle.cjs --targets node18-win-x64 --output dist/emailService.exe --config pkg.config.json && npm run postbuild
```

## Distribution Files

After build, the `dist/` folder contains:

```
dist/
├── emailService.exe      # Main executable (~55MB)
├── credentials.json      # Google OAuth credentials (REQUIRED)
├── native_modules/
│   └── node_sqlite3.node # SQLite native binding
├── .env                  # Environment config (optional)
└── README.txt            # Usage instructions
```

## Path Resolution

The exe uses `process.execPath` to find files relative to itself:

```javascript
// In src/config.js
const isPackaged = typeof process.pkg !== 'undefined';

const getExeDir = () => {
  if (isPackaged) {
    return path.dirname(process.execPath);  // exe directory
  }
  return path.resolve(__dirname, '..');     // project root
};

// credentials.json loaded from exe directory
credentials: path.join(exeDir, 'credentials.json'),
```

## Data Storage Paths

The exe stores data in the CypherEdge shared directory:

| Data | Path |
|------|------|
| Database | `%APPDATA%\CypherEdge\db.sqlite3` |
| Tokens | `%APPDATA%\CypherEdge\gmail_tokens.json` |
| PDFs | `%APPDATA%\CypherEdge\auto_fetched\<email>\` |
| Settings | `%APPDATA%\CypherEdge\auto_fetch_settings.json` |

## Configuration Files

### pkg.config.json

```json
{
  "pkg": {
    "scripts": ["dist/bundle.cjs"],
    "assets": ["credentials.json"],
    "targets": ["node18-win-x64"],
    "outputPath": "dist"
  }
}
```

### scripts/copy-assets.js

Copies `credentials.json` to `dist/` before packaging.

### scripts/post-build.js

Copies sqlite3 native module and creates README.txt.

## Troubleshooting

### "Invalid host defined options" error
- **Cause**: googleapis V8 snapshot issue
- **Fix**: Use esbuild bundle step before pkg

### "credentials.json not found"
- **Cause**: credentials.json not in exe directory
- **Fix**: Copy credentials.json to same folder as exe

### "Missing GOOGLE_CLIENT_ID"
- **Cause**: credentials.json missing or invalid
- **Fix**: Ensure valid Google OAuth credentials file exists

### sqlite3 errors
- **Cause**: Native module not found
- **Fix**: Ensure `native_modules/node_sqlite3.node` exists alongside exe

## Testing the Build

```bash
# Test status (no network required)
./dist/emailService.exe --status

# Test scan (requires network + authorized accounts)
./dist/emailService.exe --scan

# Test OAuth setup
./dist/emailService.exe --setup
```

## Cross-Platform Builds

Currently Windows-only. For other platforms:

```bash
# macOS
npx pkg dist/bundle.cjs --targets node18-macos-x64 --output dist/emailService-macos

# Linux
npx pkg dist/bundle.cjs --targets node18-linux-x64 --output dist/emailService-linux
```

Note: Native module (sqlite3) must be compiled for each target platform.
