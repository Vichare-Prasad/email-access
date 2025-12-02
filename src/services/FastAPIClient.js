// src/services/FastAPIClient.js
// FastAPI integration client

const axios = require('axios');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

class FastAPIClient {
  constructor(config) {
    this.config = config;
    this.baseUrl = config.fastApiUrl;
  }

  /**
   * Get Category Master data from database
   */
  getCategoryMasterData(dbPath, tableName = 'Category_Master') {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) return reject(err);
      });

      const sql = `SELECT * FROM "${tableName}";`;
      db.all(sql, [], (err, rows) => {
        if (err) {
          db.close(() => {});
          return reject(err);
        }
        db.close((closeErr) => {
          if (closeErr) return reject(closeErr);
          resolve(rows || []);
        });
      });
    });
  }

  /**
   * Analyze statements via FastAPI
   */
  async analyzeStatements(pdfPaths, options = {}) {
    const {
      passwords = [],
      bankNames = [],
      caseName = 'default_case',
      caId = 'PRASAD_VICHARE-123'
    } = options;

    try {
      if (!Array.isArray(pdfPaths) || pdfPaths.length === 0) {
        throw new Error('pdfPaths must be a non-empty array');
      }

      // Normalize to absolute paths
      const normalizedPaths = pdfPaths.map(p => path.isAbsolute(p) ? p : path.resolve(p));

      // Build arrays for fields that server expects as lists
      const bank_names_arr = bankNames && bankNames.length ? bankNames : normalizedPaths.map(() => 'CBI.pdf');
      const passwords_arr = passwords && passwords.length ? passwords : normalizedPaths.map(() => '');
      const start_date_arr = [''];
      const end_date_arr = [''];

      // Get category master data
      let categoryMasterData = [];
      try {
        categoryMasterData = await this.getCategoryMasterData(this.config.paths.mainDb);
      } catch (e) {
        console.warn('Could not load category master data:', e.message);
      }

      const payload = {
        bank_names: ['HDFC'],
        pdf_paths: normalizedPaths,
        passwords: passwords_arr,
        start_date: start_date_arr,
        end_date: end_date_arr,
        ca_id: caId,
        categoryMasterData: categoryMasterData,
        whole_transaction_sheet: [],
        is_ocr: normalizedPaths.map(() => false)
      };

      console.log('Sending JSON payload to main.exe (FastAPI) ->', {
        files: normalizedPaths.length,
        start_date_type: Array.isArray(payload.start_date) ? 'array' : typeof payload.start_date,
        end_date_type: Array.isArray(payload.end_date) ? 'array' : typeof payload.end_date,
      });

      const response = await axios.post(`${this.baseUrl}/analyze-statements/`, payload, {
        headers: { 'Content-Type': 'application/json' },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 30000,
      });

      console.log('FastAPI response received:', response.data);

      // Save response to JSON file
      await this.saveResponse(response.data);

      return {
        success: true,
        data: response.data,
        normalizedPaths,
        bank_names_arr,
        caseName,
        caId
      };

    } catch (error) {
      console.error('Error calling FastAPI endpoint:', error.message);

      if (error.response) {
        console.error('  Status:', error.response.status);
        try { console.error('  Body:', JSON.stringify(error.response.data, null, 2)); } catch(e){}
      } else if (error.request) {
        console.error('  No response received. Request config:', error.request);
      }

      throw error;
    }
  }

  /**
   * Save FastAPI response to JSON files
   */
  async saveResponse(responseData) {
    const outputDir = path.join(this.config.projectRoot, 'output_json');
    if (!fsSync.existsSync(outputDir)) fsSync.mkdirSync(outputDir, { recursive: true });

    const base = `fastapi_response_${Date.now()}`;

    // Save raw response
    const rawPath = path.join(outputDir, `${base}_RAW.json`);
    try {
      await fs.writeFile(rawPath, JSON.stringify(responseData, null, 2), 'utf8');
      console.log('Saved RAW FastAPI response to:', rawPath);
    } catch (err) {
      console.error('Failed to write RAW.json:', err.message);
    }

    // Parse inner JSON string
    let inner = responseData?.data;
    let parsed = null;

    if (typeof inner === 'string' && inner.trim() !== '') {
      try {
        parsed = JSON.parse(inner);
        console.log('Parsed inner JSON (direct)');
      } catch (err1) {
        console.warn('Direct parse failed - trying cleanup');

        try {
          let cleaned = inner
            .replace(/\r/g, '')
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"');

          parsed = JSON.parse(cleaned);
          console.log('Parsed inner JSON after cleanup');
        } catch (err2) {
          console.error('Could NOT parse inner JSON even after cleanup:', err2.message);
        }
      }
    }

    // Save parsed JSON
    if (parsed) {
      const parsedPath = path.join(outputDir, `${base}_PARSED.json`);
      try {
        await fs.writeFile(parsedPath, JSON.stringify(parsed, null, 2), 'utf8');
        console.log('Saved parsed inner JSON to:', parsedPath);
      } catch (err) {
        console.error('Failed to write PARSED.json:', err.message);
      }
    }
  }

  /**
   * Sanitize JSON string
   */
  sanitizeJSONString(jsonString) {
    if (!jsonString) return jsonString;
    if (typeof jsonString !== 'string') return jsonString;
    return jsonString
      .replace(/: *NaN/g, ': null')
      .replace(/: *undefined/g, ': null')
      .replace(/: *Infinity/g, ': null')
      .replace(/: *-Infinity/g, ': null');
  }

  /**
   * Handle FastAPI result
   */
  async handleFastApiResult(fastApiResult, options = {}) {
    const { caseId = null, caseName = 'unknown', tmpdir_path = './tmp' } = options;

    try {
      // Normalize where actual parsed payload may live
      const rawJsonStr = fastApiResult?.data?.data ?? fastApiResult?.data ?? fastApiResult ?? '{}';

      let parsedData;
      try {
        parsedData = (typeof rawJsonStr === 'string')
          ? JSON.parse(this.sanitizeJSONString(rawJsonStr || '{}'))
          : rawJsonStr;
      } catch (e) {
        parsedData = null;
      }

      // If parsing failed -> mark case failed and bail out
      if (parsedData == null) {
        console.log('Parsed data is null, Statement Failed');

        try {
          const failedPDFsDir = path.join(tmpdir_path, 'failed_pdfs', caseName);
          fsSync.mkdirSync(failedPDFsDir, { recursive: true });
        } catch (e) {
          console.error('Failed to create failed_pdfs dir:', e);
        }

        return {
          success: false,
          reason: 'parsedData_null',
          failedStatements: fastApiResult?.data?.['pdf_paths_not_extracted'] || null,
          parsedData: null
        };
      }

      // Clean & filter transactions
      const rawTransactions = Array.isArray(parsedData.Transactions) ? parsedData.Transactions : [];

      const transactions_temp = rawTransactions.filter((transaction_temp) => {
        if (typeof transaction_temp.Credit === 'number' && isNaN(transaction_temp.Credit)) {
          transaction_temp.Credit = null;
        }
        if (typeof transaction_temp.Debit === 'number' && isNaN(transaction_temp.Debit)) {
          transaction_temp.Debit = null;
        }
        if (typeof transaction_temp.Balance === 'number' && isNaN(transaction_temp.Balance)) {
          transaction_temp.Balance = 0;
        }

        return (
          (transaction_temp.Credit !== null && !isNaN(transaction_temp.Credit)) ||
          (transaction_temp.Debit !== null && !isNaN(transaction_temp.Debit))
        );
      });

      parsedData.Transactions = transactions_temp;
      parsedData._totalTransactions = transactions_temp.length;

      // Build result/fileDetails safely
      const result =
        parsedData.result ||
        parsedData.file_details ||
        parsedData.files ||
        parsedData.FileDetails ||
        [];

      const fileDetails = (Array.isArray(result) ? result : []).map((fileDetail) => {
        return {
          end_date: fileDetail.endDate || '',
          start_date: fileDetail.startDate || '',
          pdf_paths: fileDetail.path || fileDetail.pdf_paths || fileDetail.pdfPath || '',
          bankName: (fileDetail.bankName || '').toString().replace(/\d/g, ''),
          passwords: fileDetail.password || ''
        };
      });

      return {
        success: true,
        parsedData,
        transactions_temp,
        fileDetails,
        rawFastApiResult: fastApiResult
      };
    } catch (e) {
      console.error('handleFastApiResult error:', e);
      throw e;
    }
  }

  /**
   * Process Opportunity to Earn data
   */
  async processOpportunityToEarnData(opportunityToEarnData, caseName) {
    console.log('Processing opportunity to earn data for case:', caseName);

    try {
      // Extract the array from the object
      const opportunityToEarnArray = Array.isArray(opportunityToEarnData)
        ? opportunityToEarnData
        : (opportunityToEarnData && opportunityToEarnData['Opportunity to Earn']) || null;

      if (!opportunityToEarnArray || opportunityToEarnArray.length === 0) {
        console.warn('No Opportunity to Earn data found');
        return false;
      }

      // Initialize sums for each category
      let homeLoanValue = 0;
      let loanAgainstProperty = 0;
      let businessLoan = 0;
      let termPlan = 0;
      let generalInsurance = 0;

      // Loop through each product and categorize the amount correctly
      for (const item of opportunityToEarnArray) {
        const product = item['Product'];
        const amount = parseFloat(item['Amount']) || 0;

        if (!isNaN(amount)) {
          if (product.includes('Home Loan')) {
            homeLoanValue += amount;
          } else if (product.includes('Loan Against Property')) {
            loanAgainstProperty += amount;
          } else if (product.includes('Business Loan')) {
            businessLoan += amount;
          } else if (product.includes('Term Plan')) {
            termPlan += amount;
          } else if (product.includes('General Insurance')) {
            generalInsurance += amount;
          }
        }
      }

      console.log('Opportunity to Earn processed:', {
        homeLoanValue,
        loanAgainstProperty,
        businessLoan,
        termPlan,
        generalInsurance
      });

      return {
        homeLoanValue,
        loanAgainstProperty,
        businessLoan,
        termPlan,
        generalInsurance
      };
    } catch (error) {
      console.error('Error processing opportunity to earn data:', error);
      throw error;
    }
  }
}

module.exports = FastAPIClient;
