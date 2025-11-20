const sqlite3 = require('sqlite3').verbose();

const dbPath = 'C:\\Users\\abcom\\Desktop\\beta_testers_ca-uat\\frontend\\db.sqlite3';

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
});

console.log('📋 DATABASE SCHEMA:\n');

db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
  if (err) {
    console.error('Error getting tables:', err.message);
    db.close();
    return;
  }
  
  console.log('Tables:', tables.map(t => t.name).join(', '));
  console.log('\n' + '='.repeat(80) + '\n');
  
  let remaining = tables.length;
  
  tables.forEach(table => {
    db.all(`PRAGMA table_info(${table.name})`, [], (err, columns) => {
      if (err) {
        console.error(`Error getting schema for ${table.name}:`, err.message);
      } else {
        console.log(`\n📋 TABLE: ${table.name}`);
        console.log('-'.repeat(80));
        columns.forEach(col => {
          console.log(`  ${col.name.padEnd(30)} ${col.type.padEnd(15)} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
        });
      }
      
      remaining--;
      if (remaining === 0) {
        db.close();
      }
    });
  });
});
