// src/utils/rescanPasswords.js
// Utility to re-scan all auto-fetched statements and update password protection status

const config = require('../config');
const AutoFetchDatabase = require('../db/AutoFetchDatabase');
const PasswordChecker = require('../services/PasswordChecker');
const fsSync = require('fs');

async function rescanAllStatements() {
  console.log('=== Re-scanning PDF password protection status ===\n');

  const db = new AutoFetchDatabase();
  const passwordChecker = new PasswordChecker();

  try {
    await db.init();

    // Get all statements (not deleted/completed)
    const statements = await db.all(`
      SELECT id, pdf_path, pdf_filename, is_password_protected, status
      FROM auto_fetched_statements
      WHERE status NOT IN ('deleted', 'completed')
      ORDER BY id
    `);

    console.log(`Found ${statements.length} statements to re-scan\n`);

    let updated = 0;
    let errors = 0;
    let wasProtected = 0;
    let nowProtected = 0;

    for (const stmt of statements) {
      const oldStatus = stmt.is_password_protected;

      // Check if file exists
      if (!fsSync.existsSync(stmt.pdf_path)) {
        console.log(`[SKIP] ID ${stmt.id}: File not found - ${stmt.pdf_filename}`);
        errors++;
        continue;
      }

      // Check password protection with new pdf-lib method
      const result = await passwordChecker.checkPdfProtection(stmt.pdf_path);

      const newProtected = result.isProtected ? 1 : 0;
      const newStatus = result.isProtected ? 'needs_password' : 'pending';

      // Track changes
      if (oldStatus === 1) wasProtected++;
      if (newProtected === 1) nowProtected++;

      // Update if status changed
      if (oldStatus !== newProtected) {
        await db.run(`
          UPDATE auto_fetched_statements
          SET is_password_protected = ?, status = ?, updated_at = ?
          WHERE id = ?
        `, [newProtected, newStatus, Math.floor(Date.now() / 1000), stmt.id]);

        console.log(`[UPDATED] ID ${stmt.id}: ${stmt.pdf_filename}`);
        console.log(`          Old: protected=${oldStatus}, New: protected=${newProtected}`);
        updated++;
      } else {
        console.log(`[OK] ID ${stmt.id}: ${stmt.pdf_filename} (protected=${newProtected})`);
      }

      if (result.error) {
        console.log(`          Warning: ${result.error}`);
      }
    }

    console.log('\n=== Rescan Summary ===');
    console.log(`Total scanned: ${statements.length}`);
    console.log(`Updated: ${updated}`);
    console.log(`Errors/Skipped: ${errors}`);
    console.log(`Previously marked protected: ${wasProtected}`);
    console.log(`Now marked protected: ${nowProtected}`);

  } catch (error) {
    console.error('Error during rescan:', error);
    throw error;
  } finally {
    await db.close();
  }
}

// Run if called directly
if (require.main === module) {
  rescanAllStatements()
    .then(() => {
      console.log('\nRescan complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Rescan failed:', error);
      process.exit(1);
    });
}

module.exports = { rescanAllStatements };
