const sqlite3 = require('sqlite3').verbose();

const dbPath = 'C:\\Users\\abcom\\Desktop\\beta_testers_ca-uat\\frontend\\db.sqlite3';

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
});

console.log('🔍 Checking data for PRASAD_VICHARE-123 case...\n');

// First get the case
db.get('SELECT * FROM cases WHERE name LIKE ?', ['%PRASAD%'], (err, caseRow) => {
  if (err) {
    console.error('❌ Error:', err.message);
    db.close();
    return;
  }
  
  if (!caseRow) {
    console.log('❌ Case not found');
    db.close();
    return;
  }
  
  console.log('✅ CASE FOUND:');
  console.log(`   ID: ${caseRow.id}`);
  console.log(`   Name: ${caseRow.name}`);
  console.log(`   Status: ${caseRow.status}`);
  console.log(`   Created: ${new Date(caseRow.created_at * 1000).toISOString()}\n`);
  
  const caseId = caseRow.id;
  
  // Get statements for this case
  db.all('SELECT * FROM statements WHERE case_id = ?', [caseId], (err, statements) => {
    if (err) {
      console.error('❌ Error querying statements:', err.message);
      db.close();
      return;
    }
    
    console.log(`📋 STATEMENTS (${statements.length}):`);
    if (statements.length === 0) {
      console.log('   ⚠️ No statements found\n');
    } else {
      statements.forEach(stmt => {
        console.log(`\n   Statement ID: ${stmt.id}`);
        console.log(`   Bank: ${stmt.bank_name}`);
        console.log(`   Account: ${stmt.account_number}`);
        console.log(`   Customer: ${stmt.customer_name}`);
        console.log(`   File: ${stmt.file_path}`);
      });
      console.log('');
    }
    
    // Get transactions for these statements
    if (statements.length > 0) {
      const statementIds = statements.map(s => s.id).join(',');
      
      db.get(`SELECT COUNT(*) as count FROM transactions WHERE statement_id IN (${statementIds})`, [], (err, row) => {
        if (err) {
          console.error('❌ Error counting transactions:', err.message);
        } else {
          console.log(`💰 TRANSACTIONS: ${row.count} total\n`);
          
          if (row.count > 0) {
            db.all(`SELECT * FROM transactions WHERE statement_id IN (${statementIds}) ORDER BY id DESC LIMIT 5`, [], (err, txns) => {
              if (!err && txns.length > 0) {
                console.log('📊 SAMPLE TRANSACTIONS (latest 5):');
                txns.forEach(t => {
                  console.log(`\n   Transaction ID: ${t.id}`);
                  console.log(`   Date: ${new Date(t.date * 1000).toISOString().split('T')[0]}`);
                  console.log(`   Description: ${t.description.substring(0, 50)}...`);
                  console.log(`   Amount: ${t.amount}`);
                  console.log(`   Type: ${t.type}`);
                  console.log(`   Category: ${t.category}`);
                });
              }
              db.close();
            });
          } else {
            db.close();
          }
        }
      });
    } else {
      db.close();
    }
  });
});
