const DatabaseManager = require('./db');
const { sql } = require('drizzle-orm');

async function checkData() {
  try {
    const dbManager = DatabaseManager.getInstance();
    const db = await dbManager.initialize('C:\\Users\\abcom\\Desktop\\beta_testers_ca-uat\\frontend\\db.sqlite3');
    
    console.log('\n📊 DATABASE CHECK\n');
    console.log('='.repeat(60));
    
    // Check cases
    const { cases } = require('./schema/Cases');
    const caseResults = await db.select().from(cases).limit(5);
    console.log(`\n📁 CASES (last 5):`);
    console.log('='.repeat(60));
    if (caseResults.length === 0) {
      console.log('❌ No cases found');
    } else {
      caseResults.forEach(c => {
        console.log(`ID: ${c.id} | Name: ${c.name} | Status: ${c.status} | Created: ${c.createdAt}`);
      });
    }
    
    // Check statements
    const { statements } = require('./schema/Statement');
    const statementResults = await db.select().from(statements).limit(10);
    console.log(`\n📄 STATEMENTS (last 10):`);
    console.log('='.repeat(60));
    if (statementResults.length === 0) {
      console.log('❌ No statements found');
    } else {
      statementResults.forEach(s => {
        console.log(`ID: ${s.id} | Case: ${s.caseId} | Bank: ${s.bankName} | Account: ${s.accountNumber}`);
      });
    }
    
    // Check transactions
    const { transactions } = require('./schema/Transactions');
    const txnResults = await db.select().from(transactions).limit(10);
    console.log(`\n💰 TRANSACTIONS (last 10):`);
    console.log('='.repeat(60));
    if (txnResults.length === 0) {
      console.log('❌ No transactions found');
    } else {
      txnResults.forEach(t => {
        console.log(`ID: ${t.id} | Statement: ${t.statementId} | Date: ${t.date} | Bank: ${t.bank}`);
        console.log(`  ${t.description} | ${t.type}: ${t.amount}`);
      });
    }
    
    // Total count
    const totalResult = await db.select({ count: sql`COUNT(*)` }).from(transactions);
    console.log(`\n📊 TOTAL TRANSACTIONS: ${totalResult[0].count}`);
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkData();
