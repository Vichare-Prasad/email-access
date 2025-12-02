// src/utils/fileUtils.js
// File utility functions

const crypto = require('crypto');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

/**
 * Compute SHA256 hash of a file
 */
async function computeFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    const rs = fsSync.createReadStream(filePath);
    rs.on('data', d => h.update(d));
    rs.on('error', reject);
    rs.on('end', () => resolve(h.digest('hex')));
  });
}

/**
 * Split filename into name and extension
 */
function splitNameExt(filename) {
  const ext = path.extname(filename);
  const name = path.basename(filename, ext);
  return { name, ext };
}

/**
 * Check if a path exists
 */
async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Check if a path exists (sync version)
 */
function existsSync(p) {
  return fsSync.existsSync(p);
}

/**
 * Ensure directory exists
 */
async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

/**
 * Ensure directory exists (sync version)
 */
function ensureDirSync(p) {
  if (!fsSync.existsSync(p)) {
    fsSync.mkdirSync(p, { recursive: true });
  }
}

/**
 * Safe file hash computation (returns null on error)
 */
async function computeHashSafe(filePath) {
  try {
    if (!filePath || !fsSync.existsSync(filePath)) return null;
    return await computeFileHash(filePath);
  } catch (e) {
    return null;
  }
}

module.exports = {
  computeFileHash,
  splitNameExt,
  exists,
  existsSync,
  ensureDir,
  ensureDirSync,
  computeHashSafe,
};
