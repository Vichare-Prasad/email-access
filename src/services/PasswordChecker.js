// src/services/PasswordChecker.js
// Checks if PDF is password-protected using pdf-lib for accurate detection

const fs = require('fs').promises;
const fsSync = require('fs');
const { PDFDocument } = require('pdf-lib');

class PasswordChecker {
  /**
   * Check if a PDF file is password-protected by attempting to open it
   * @param {string} filePath - Path to PDF file
   * @returns {Promise<Object>} { isProtected: boolean, error: string|null }
   */
  async checkPdfProtection(filePath) {
    try {
      // Check if file exists
      if (!fsSync.existsSync(filePath)) {
        return { isProtected: false, error: 'File not found' };
      }

      // Read the entire PDF file
      const pdfBytes = await fs.readFile(filePath);

      try {
        // Attempt to load the PDF without a password
        // pdf-lib will throw if the PDF requires a password to open
        const pdfDoc = await PDFDocument.load(pdfBytes, {
          ignoreEncryption: false,  // Don't ignore encryption - we want to detect it
          throwOnInvalidObject: false,
          updateMetadata: false
        });

        // If we get here, the PDF loaded successfully without a password
        // Try to access the page count to ensure we can actually read it
        const pageCount = pdfDoc.getPageCount();

        console.log(`[PasswordChecker] ${filePath}: Not protected (${pageCount} pages)`);
        return { isProtected: false, error: null };

      } catch (loadError) {
        const errorMsg = loadError.message?.toLowerCase() || '';

        // Check if the error is due to encryption/password
        if (errorMsg.includes('encrypted') ||
            errorMsg.includes('password') ||
            errorMsg.includes('decrypt') ||
            errorMsg.includes('user password') ||
            errorMsg.includes('owner password') ||
            errorMsg.includes('encryption')) {
          console.log(`[PasswordChecker] ${filePath}: Password protected - ${loadError.message}`);
          return { isProtected: true, error: null };
        }

        // Some other PDF error (corrupted, invalid format, etc.)
        console.warn(`[PasswordChecker] ${filePath}: PDF error - ${loadError.message}`);
        return { isProtected: false, error: loadError.message };
      }
    } catch (error) {
      console.error(`[PasswordChecker] Error checking ${filePath}:`, error.message);
      return { isProtected: false, error: error.message };
    }
  }

  /**
   * Verify if a password is correct for a PDF
   * @param {string} filePath - Path to PDF
   * @param {string} password - Password to test
   * @returns {Promise<Object>} { success: boolean, error: string|null }
   */
  async verifyPassword(filePath, password) {
    try {
      // Check if file exists
      if (!fsSync.existsSync(filePath)) {
        return { success: false, error: 'File not found' };
      }

      const pdfBytes = await fs.readFile(filePath);

      // First check if the PDF is actually protected
      try {
        await PDFDocument.load(pdfBytes, {
          ignoreEncryption: false,
          throwOnInvalidObject: false,
          updateMetadata: false
        });
        // If we get here, PDF is not protected - any password "works"
        console.log(`[PasswordChecker] ${filePath}: Not protected, password not needed`);
        return { success: true, error: null };
      } catch (firstLoadError) {
        // PDF is protected, now try with the password
      }

      try {
        // Try to load with the password
        const pdfDoc = await PDFDocument.load(pdfBytes, {
          password: password,
          ignoreEncryption: false,
          throwOnInvalidObject: false,
          updateMetadata: false
        });

        // Verify we can actually access the content
        const pageCount = pdfDoc.getPageCount();

        console.log(`[PasswordChecker] ${filePath}: Password verified (${pageCount} pages)`);
        return { success: true, error: null };

      } catch (loadError) {
        const errorMsg = loadError.message?.toLowerCase() || '';

        if (errorMsg.includes('password') ||
            errorMsg.includes('decrypt') ||
            errorMsg.includes('encrypted')) {
          console.log(`[PasswordChecker] ${filePath}: Invalid password`);
          return { success: false, error: 'Invalid password' };
        }

        console.error(`[PasswordChecker] ${filePath}: Error verifying - ${loadError.message}`);
        return { success: false, error: loadError.message };
      }
    } catch (error) {
      console.error(`[PasswordChecker] Error verifying password for ${filePath}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Batch check multiple PDFs for password protection
   * @param {string[]} filePaths - Array of file paths
   * @returns {Promise<Object>} Map of filePath -> { isProtected, error }
   */
  async batchCheck(filePaths) {
    const results = {};

    for (const filePath of filePaths) {
      results[filePath] = await this.checkPdfProtection(filePath);
    }

    return results;
  }

  /**
   * Quick check using header markers (legacy method, kept as fallback)
   * This is faster but less accurate than pdf-lib loading
   * @param {string} filePath - Path to PDF file
   * @returns {Promise<Object>} { isProtected: boolean, error: string|null }
   */
  async quickCheck(filePath) {
    try {
      if (!fsSync.existsSync(filePath)) {
        return { isProtected: false, error: 'File not found' };
      }

      const buffer = await this.readPdfHeader(filePath);
      const isProtected = this.hasEncryptionMarkers(buffer);

      return { isProtected, error: null };
    } catch (error) {
      return { isProtected: false, error: error.message };
    }
  }

  /**
   * Read first portion of PDF file (for quick check)
   */
  async readPdfHeader(filePath, bytes = 8192) {
    const fd = await fs.open(filePath, 'r');
    try {
      const buffer = Buffer.alloc(bytes);
      await fd.read(buffer, 0, bytes, 0);
      return buffer;
    } finally {
      await fd.close();
    }
  }

  /**
   * Check for encryption markers in PDF buffer (for quick check)
   */
  hasEncryptionMarkers(buffer) {
    const content = buffer.toString('binary');

    // Look for /Encrypt dictionary in PDF
    if (content.includes('/Encrypt')) {
      return true;
    }

    // Look for standard security handler
    if (content.includes('/Standard')) {
      const standardIndex = content.indexOf('/Standard');
      const nearbyContent = content.substring(
        Math.max(0, standardIndex - 100),
        Math.min(content.length, standardIndex + 100)
      );
      if (nearbyContent.includes('/Filter') || nearbyContent.includes('/Encrypt')) {
        return true;
      }
    }

    // Look for password-related markers
    if (content.includes('/U ') || content.includes('/O ') || content.includes('/P ')) {
      const hasU = content.includes('/U ') || content.includes('/U(');
      const hasO = content.includes('/O ') || content.includes('/O(');
      if (hasU && hasO) {
        return true;
      }
    }

    return false;
  }
}

module.exports = PasswordChecker;
