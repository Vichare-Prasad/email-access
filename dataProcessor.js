// Standalone data processor extracted from reportHandlers.js
// Can be used without Electron dependencies

const { transactions } = require("./schema/Transactions");
const { statements } = require("./schema/Statement");
const { cases } = require("./schema/Cases");
const { failedStatements } = require("./schema/FailedStatements");
const { eq } = require("drizzle-orm");

// Helper function to sanitize JSON string
const sanitizeJSONString = (jsonString) => {
  if (!jsonString) return jsonString;
  if (typeof jsonString !== "string") return jsonString;

  return jsonString
    .replace(/: *NaN/g, ": null")
    .replace(/: *undefined/g, ": null")
    .replace(/: *Infinity/g, ": null")
    .replace(/: *-Infinity/g, ": null");
};

// Helper function to validate and transform transaction data
const validateAndTransformTransaction = (transaction, statementId) => {
  if (!transaction["Value Date"] || !transaction.Description) {
    throw new Error("Missing required transaction fields");
  }

  // Parse date properly from DD-MM-YYYY format
  let date = null;
  try {
    const [day, month, year] = transaction["Value Date"].split("-");
    date = new Date(year, month - 1, day); // month is 0-based in JS
    if (isNaN(date.getTime())) {
      throw new Error("Invalid date");
    }
  } catch (error) {
    throw new Error(`Invalid date format: ${transaction["Value Date"]}`);
  }

  // Fixed amount handling logic
  let amount = 0;
  if (transaction.Credit !== null && !isNaN(transaction.Credit)) {
    amount = Math.abs(transaction.Credit);
  } else if (transaction.Debit !== null && !isNaN(transaction.Debit)) {
    amount = Math.abs(transaction.Debit);
  }

  let balance = 0;
  if (transaction.Balance !== null && !isNaN(transaction.Balance)) {
    balance = parseFloat(transaction.Balance);
  }

  const type =
    transaction.Credit !== null && !isNaN(transaction.Credit)
      ? "credit"
      : "debit";

  return {
    statementId,
    date: date,
    description: transaction.Description,
    amount: amount,
    category: transaction.Category || "uncategorized",
    type: type,
    balance: balance,
    entity: transaction.Bank.replace(/\d/g, "") || "unknown",
  };
};

// Helper function to store transactions in batches
const storeTransactionsBatch = async (db, transformedTransactions) => {
  try {
    if (transformedTransactions.length === 0) return;

    const dbTransactions = transformedTransactions.map((t) => {
      console.log(`Processing transaction: ${t.description}, Amount: ${t.amount}, Type: ${t.type}`);

      return {
        statementId: t.statementId.toString(),
        date: t.date,
        description: t.description,
        amount: t.amount,
        category: t.category,
        type: t.type,
        balance: t.balance,
        entity: t.entity,
      };
    });

    // Verify statement exists before inserting transactions
    const existingStatements = await db
      .select()
      .from(statements)
      .where(eq(statements.id, dbTransactions[0].statementId));

    if (existingStatements.length === 0) {
      throw new Error(`Statement ${dbTransactions[0].statementId} not found`);
    }

    // Insert transactions in chunks
    const chunkSize = 20;
    for (let i = 0; i < dbTransactions.length; i += chunkSize) {
      const chunk = dbTransactions.slice(i, i + chunkSize);
      await db.insert(transactions).values(chunk);
      console.log(`Stored transactions batch ${i / chunkSize + 1}, size: ${chunk.length}`);
    }

    return true;
  } catch (error) {
    console.error("Error storing transactions batch:", error);
    throw error;
  }
};

// Helper function to create statement record
const createStatement = async (db, fileDetail, caseId) => {
  try {
    const statementData = {
      caseId: caseId,
      accountNumber: fileDetail.accountNumber || "UNKNOWN",
      customerName: fileDetail.customerName || "UNKNOWN",
      ifscCode: fileDetail.ifscCode || null,
      bankName: fileDetail.bankName,
      filePath: fileDetail.pdf_paths,
      createdAt: new Date(),
    };

    const result = await db.insert(statements).values(statementData);
    console.log("Created statement record");
    return result.lastInsertRowid.toString();
  } catch (error) {
    console.error("Error creating statement record:", error);
    throw error;
  }
};

// Helper function to process transactions
const processTransactions = async (db, allTransactions, fileDetail, statementId, index) => {
  try {
    // Debug: Check what bank names exist in the transactions
    const uniqueBanks = [...new Set(allTransactions.map(t => t.Bank))];
    console.log(`🔍 Available bank names in transactions:`, uniqueBanks);
    console.log(`🔍 fileDetail.bankName =`, fileDetail.bankName);
    console.log(`🔍 index =`, index);
    console.log(`🔍 Looking for bank name: "${fileDetail.bankName + index}"`);
    
    const targetBankName = (fileDetail.bankName + index).toLowerCase();
    console.log(`🔍 Target (lowercase): "${targetBankName}"`);
    
    const statementTransactions = allTransactions
      .filter((t) => {
        const match = t.Bank && t.Bank.toLowerCase() === targetBankName;
        if (!match && t.Bank) {
          console.log(`  ❌ No match: "${t.Bank.toLowerCase()}" !== "${targetBankName}"`);
        }
        return match;
      })
      .map((transaction) => {
        try {
          return validateAndTransformTransaction(transaction, statementId);
        } catch (error) {
          console.warn(`Invalid transaction skipped: ${error.message}`, transaction);
          return null;
        }
      })
      .filter(Boolean);

    console.log(`✅ Filtered ${statementTransactions.length} transactions matching "${fileDetail.bankName + index}" (case-insensitive)`);

    await storeTransactionsBatch(db, statementTransactions);

    return statementTransactions.length;
  } catch (error) {
    console.error(`Error processing transactions for ${fileDetail.bankName}:`, error);
    throw error;
  }
};

/**
 * Main function to process FastAPI response and store in database
 * @param {Object} db - Drizzle database instance
 * @param {Object} responseData - Full FastAPI response
 * @param {Number} caseId - Case ID to associate with
 * @param {Array} fileDetails - Array of file detail objects with pdf_paths, bankName, etc.
 * @returns {Object} Processing results
 */
async function processFastAPIResponse(db, responseData, caseId, fileDetails) {
  try {
    console.log("🔄 Processing FastAPI response for case:", caseId);

    // Sanitize and parse the inner JSON data
    const sanitizedJsonString = sanitizeJSONString(responseData.data);
    const parsedData = JSON.parse(sanitizedJsonString);

    if (parsedData == null) {
      console.warn("⚠️ Parsed data is null");
      
      // Store failed statements if any
      if (responseData.pdf_paths_not_extracted) {
        await db.insert(failedStatements).values({
          caseId: caseId,
          data: JSON.stringify(responseData.pdf_paths_not_extracted),
        });
      }

      return {
        success: false,
        totalTransactions: 0,
        failedStatements: responseData.pdf_paths_not_extracted || null,
      };
    }

    // Extract and filter transactions
    const allTransactions = (parsedData.Transactions || []).filter((transaction) => {
      if (typeof transaction.Credit === "number" && isNaN(transaction.Credit)) {
        transaction.Credit = null;
      }
      if (typeof transaction.Debit === "number" && isNaN(transaction.Debit)) {
        transaction.Debit = null;
      }
      if (typeof transaction.Balance === "number" && isNaN(transaction.Balance)) {
        transaction.Balance = 0;
      }

      return (
        (transaction.Credit !== null && !isNaN(transaction.Credit)) ||
        (transaction.Debit !== null && !isNaN(transaction.Debit))
      );
    });

    console.log(`✅ Extracted ${allTransactions.length} valid transactions`);

    // Process each file detail
    const processedData = [];
    for (const fileDetail of fileDetails) {
      try {
        const statementId = await createStatement(db, fileDetail, caseId);
        const transactionCount = await processTransactions(
          db,
          allTransactions,
          fileDetail,
          statementId,
          fileDetails.indexOf(fileDetail)
        );

        processedData.push({
          statementId,
          bankName: fileDetail.bankName,
          transactionCount,
        });

        console.log(`✅ Processed ${transactionCount} transactions for ${fileDetail.bankName}`);
      } catch (error) {
        console.error(`❌ Error processing file detail for ${fileDetail.bankName}:`, error);
      }
    }

    // Store failed statements if any
    if (responseData.pdf_paths_not_extracted) {
      await db.insert(failedStatements).values({
        caseId: caseId,
        data: JSON.stringify(responseData.pdf_paths_not_extracted),
      });
    }

    const totalTransactions = processedData.reduce((sum, d) => sum + d.transactionCount, 0);

    console.log(`✅ Successfully processed ${totalTransactions} total transactions`);

    return {
      success: true,
      processed: processedData,
      totalTransactions,
      failedStatements: responseData.pdf_paths_not_extracted || null,
      nerResults: responseData.ner_results || { Name: [], "Acc Number": [] },
    };
  } catch (error) {
    console.error("❌ Error in processFastAPIResponse:", error);
    throw error;
  }
}

module.exports = {
  sanitizeJSONString,
  validateAndTransformTransaction,
  storeTransactionsBatch,
  createStatement,
  processTransactions,
  processFastAPIResponse,
};
