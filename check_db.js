const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = 'C:\\Users\\abcom\\Desktop\\beta_testers_ca-uat\\frontend\\db.sqlite3';

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to database:', dbPath);
});

console.log('\n📋 CASES TABLE:');
db.all('SELECT id, name, status, userId, pages, createdAt FROM cases ORDER BY id DESC LIMIT 10', [], (err, rows) => {
  if (err) {
    console.error('❌ Error querying cases:', err.message);
  } else {
    console.table(rows);
  }
  
  console.log('\n📋 STATEMENTS TABLE:');
  db.all('SELECT id, caseId, accountNumber, customerName, bankName, filePath, createdAt FROM statements ORDER BY id DESC LIMIT 10', [], (err, rows) => {
    if (err) {
      console.error('❌ Error querying statements:', err.message);
    } else {
      console.table(rows);
    }
    
    console.log('\n📋 TRANSACTIONS TABLE (count):');
    db.get('SELECT COUNT(*) as count FROM transactions', [], (err, row) => {
      if (err) {
        console.error('❌ Error counting transactions:', err.message);
      } else {
        console.log('Total transactions:', row.count);
      }
      
      console.log('\n📋 LATEST TRANSACTIONS:');
      db.all('SELECT id, statementId, date, description, amount, category, type, createdAt FROM transactions ORDER BY id DESC LIMIT 10', [], (err, rows) => {
        if (err) {
          console.error('❌ Error querying transactions:', err.message);
        } else {
          console.table(rows);
        }
        
        db.close();
      });
    });
  });
});
