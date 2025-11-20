// // upload-and-save.js
// const axios = require('axios');
// const FormData = require('form-data');
// const fs = require('fs');
// const path = require('path');
// const XLSX = require('xlsx');

// const API_URL = process.env.API_URL || 'http://127.0.0.1:7500/analyze-statements-pdf/';

// function padArray(arr, n, padValue = '') {
//   const out = Array.isArray(arr) ? arr.slice(0, n) : [];
//   while (out.length < n) out.push(padValue);
//   return out;
// }

// /**
//  * Send PDFs to FastAPI and save returned sheets_in_json as an Excel file.
//  * @param {string[]} pdfPaths - local file paths to PDF files
//  * @param {Object} options - other form options
//  */
// async function uploadPdfsAndSaveExcel(pdfPaths, options = {}) {
//   try {
//     if (!Array.isArray(pdfPaths) || pdfPaths.length === 0) {
//       throw new Error('Provide at least one PDF path');
//     }

//     const form = new FormData();

//     // Add required form fields.
//     // FastAPI expects multiple entries for array fields (e.g. bank_names, is_ocr, start_date).
//     // Example - set bank_names same length as files or a single bank name repeated:
//     const bankNames = options.bank_names || pdfPaths.map(() => 'UnknownBank');
//     bankNames.forEach(n => form.append('bank_names', n));

//     // is_ocr: pass 'true'/'false' strings per your API design
//     const isOcr = options.is_ocr || pdfPaths.map(() => 'false');
//     isOcr.forEach(v => form.append('is_ocr', String(v)));

//     // Optional: passwords, start_date, end_date arrays (append each)
//     if (options.passwords) options.passwords.forEach(p => form.append('passwords', p));
//     if (options.start_date) options.start_date.forEach(d => form.append('start_date', d));
//     if (options.end_date) options.end_date.forEach(d => form.append('end_date', d));

//     // ca_id (single string)
//     form.append('ca_id', options.ca_id || 'ca_default');

//     // If you have complex JSON fields (whole_transaction_sheet, aiyazs_array_of_array,
//     // categoryMasterData), stringify them and append as form fields
//     if (options.whole_transaction_sheet) {
//       form.append('whole_transaction_sheet', JSON.stringify(options.whole_transaction_sheet));
//     }
//     if (options.aiyazs_array_of_array) {
//       form.append('aiyazs_array_of_array', JSON.stringify(options.aiyazs_array_of_array));
//     }
//     if (options.categoryMasterData) {
//       form.append('categoryMasterData', JSON.stringify(options.categoryMasterData));
//     }

//     // Append files
//     for (const p of pdfPaths) {
//       const bas = path.basename(p);
//       form.append('files', fs.createReadStream(p), { filename: bas });
//     }

//     console.log(`Uploading ${pdfPaths.length} file(s) to ${API_URL} ...`);
//     const headers = form.getHeaders();

//     const response = await axios.post(API_URL, form, {
//       headers,
//       maxContentLength: Infinity,
//       maxBodyLength: Infinity,
//       timeout: 10 * 60 * 1000 // adjust timeout if needed
//     });

//     if (!response || !response.data) {
//       throw new Error('No response data from server');
//     }

//     const resp = response.data;
//     if (resp.status !== 'success') {
//       console.error('Server returned non-success:', resp);
//       throw new Error('Processing failed on server: ' + (resp.message || JSON.stringify(resp)));
//     }

//     // resp.data should be result["sheets_in_json"] returned by your FastAPI
//     const sheets = resp.data;
//     if (!sheets || Object.keys(sheets).length === 0) {
//       throw new Error('No sheet data returned from API');
//     }

//     // Build an xlsx workbook
//     const wb = XLSX.utils.book_new();

//     // sheets might be an object mapping sheetName->array of rows,
//     // or an array — handle both.
//     if (Array.isArray(sheets)) {
//       // If API returned an array of rows -> put them in one sheet
//       const ws = XLSX.utils.json_to_sheet(sheets);
//       XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
//     } else if (typeof sheets === 'object') {
//       // If object, iterate keys as sheet names
//       for (const [sheetName, rows] of Object.entries(sheets)) {
//         // Make sure rows is an array of objects for json_to_sheet
//         const dataRows = Array.isArray(rows) ? rows : [rows];
//         const ws = XLSX.utils.json_to_sheet(dataRows);
//         // Excel sheet name max length is 31; trim if needed
//         const safeName = (sheetName || 'Sheet').toString().substring(0, 30);
//         XLSX.utils.book_append_sheet(wb, ws, safeName || 'Sheet1');
//       }
//     } else {
//       throw new Error('Unexpected sheets format from server');
//     }

//     // Save to disk
//     const outFile = options.output || `bank_statements_${Date.now()}.xlsx`;
//     XLSX.writeFile(wb, outFile);
//     console.log('Saved Excel file to', outFile);

//     return { success: true, file: outFile, response: resp };
//   } catch (err) {
//     console.error('Error:', err.message || err);
//     return { success: false, error: err.message || String(err) };
//   }
// }



// // Example usage:
// (async () => {
//   const pdfs = [
//     // replace these with your actual local paths
//     'output\\unprocessed\\narpat.pdf'];

//   // customize these options:
//   const options = {
//     bank_names: ['HDFC'],      // match per-file if you want
//     is_ocr: [ 'false'],
//     ca_id: 'my_ca_123',
//     // example of passing categoryMasterData (if needed by your endpoint)
//     // categoryMasterData: [{ category: 'Food', 'Debit / Credit': 'Debit' }, { category: 'Salary', 'Debit / Credit': 'Credit' }],
//     output: 'my_bank_statements.xlsx'
//   };

//   const result = await uploadPdfsAndSaveExcel(pdfs, options);
//   if (!result.success) process.exitCode = 1;
// })();





// new.js (DB-aware) - reads Category_Master from sqlite and uploads PDFs with categoryMasterData
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const XLSX = require('xlsx');

const API_URL = process.env.API_URL || 'http://127.0.0.1:7500/analyze-statements-pdf/';

// Try a list of candidate DB paths (relative to this script, cwd, and common locations)
function findDbFile() {
  const candidates = [];
  const scriptDir = __dirname;
  const cwd = process.cwd();

  // candidate file names
  const names = ['db.sqlite3', 'data/db.sqlite3', path.join('..','db.sqlite3')];

  for (const n of names) {
    candidates.push(path.join(cwd, n));
    candidates.push(path.join(scriptDir, n));
  }

  // explicit fallback path used earlier by me in the container environment
  candidates.push('/mnt/data/db.sqlite3');

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return path.resolve(c);
    }
  }
  return null;
}

function readCategoryMasterFromJson(jsonPath) {
  try {
    if (fs.existsSync(jsonPath)) {
      const raw = fs.readFileSync(jsonPath, 'utf8');
      const data = JSON.parse(raw);
      console.log(`Loaded ${data.length} records from JSON ${jsonPath}`);
      return data;
    }
  } catch (e) {
    console.warn('Failed reading JSON fallback:', e.message);
  }
  return null;
}

function readCategoryMasterFromDb(dbPath) {
  return new Promise((resolve, reject) => {
    if (!dbPath) {
      resolve(null);
      return;
    }
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        console.warn('Failed to open sqlite db:', err.message);
        resolve(null);
        return;
      }
    });

    // adjust table name if needed
    const tableName = 'Category_Master';

    const q = `SELECT * FROM "${tableName}";`;
    db.all(q, [], (err, rows) => {
      if (err) {
        console.warn(`Query failed (${q}):`, err.message);
        db.close(() => {});
        resolve(null);
        return;
      }
      db.close(() => {});
      console.log(`Read ${rows.length} rows from ${tableName} in ${dbPath}`);
      resolve(rows);
    });
  });
}

function padArray(arr, n, padValue = '') {
  const out = Array.isArray(arr) ? arr.slice(0, n) : [];
  while (out.length < n) out.push(padValue);
  return out;
}

async function uploadPdfsAndSaveExcel(pdfPaths, options = {}) {
  try {
    if (!Array.isArray(pdfPaths) || pdfPaths.length === 0) {
      throw new Error('Provide at least one PDF path');
    }

    // Attempt to load categoryMasterData from DB (preferred)
    let categoryMasterData = null;
    if (!options.categoryMasterData) {
      const dbPath = findDbFile();
      if (dbPath) {
        console.log('Found DB at:', dbPath);
        categoryMasterData = await readCategoryMasterFromDb(dbPath);
      } else {
        console.log('No DB found in candidate locations.');
      }
    } else {
      categoryMasterData = options.categoryMasterData;
    }

    // Fallback: try a local JSON file next to script
    if (!categoryMasterData) {
      const jsonPath = options.categoryMasterDataPath || path.join(__dirname, 'category_master_data.json');
      const jsonLoaded = readCategoryMasterFromJson(jsonPath);
      if (jsonLoaded) categoryMasterData = jsonLoaded;
    }

    // Final fallback: empty list
    if (!categoryMasterData) {
      console.warn('categoryMasterData not found in DB or JSON; using empty list fallback.');
      categoryMasterData = [];
    }

    const form = new FormData();
    const fileCount = pdfPaths.length;

    // Ensure arrays match number of files (bank_names / is_ocr)
    const bankNames = padArray(options.bank_names || ['UnknownBank'], fileCount, 'UnknownBank');
    const isOcr = padArray(options.is_ocr || ['false'], fileCount, 'false');
    bankNames.forEach(n => form.append('bank_names', n));
    isOcr.forEach(v => form.append('is_ocr', String(v)));

    if (options.passwords) padArray(options.passwords, fileCount, '').forEach(p => form.append('passwords', p));
    if (options.start_date) padArray(options.start_date, fileCount, '').forEach(d => form.append('start_date', d));
    if (options.end_date) padArray(options.end_date, fileCount, '').forEach(d => form.append('end_date', d));

    form.append('ca_id', options.ca_id || 'ca_default');

    // Add categoryMasterData (stringified JSON)
    try {
      form.append('categoryMasterData', JSON.stringify(categoryMasterData));
      console.log(`Appended categoryMasterData (records: ${Array.isArray(categoryMasterData) ? categoryMasterData.length : 0})`);
    } catch (e) {
      console.warn('Failed to append categoryMasterData to form:', e.message);
    }

    // Other JSON fields
    if (options.whole_transaction_sheet) form.append('whole_transaction_sheet', JSON.stringify(options.whole_transaction_sheet));
    if (options.aiyazs_array_of_array) form.append('aiyazs_array_of_array', JSON.stringify(options.aiyazs_array_of_array));

    // Attach files
    for (const p of pdfPaths) {
      if (!fs.existsSync(p)) throw new Error(`File not found: ${p}`);
      const bas = path.basename(p);
      form.append('files', fs.createReadStream(p), { filename: bas });
    }

    console.log(`Uploading ${pdfPaths.length} file(s) to ${API_URL} ...`);
    const headers = form.getHeaders();

    const response = await axios.post(API_URL, form, {
      headers,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 10 * 60 * 1000
    });

    if (!response || !response.data) throw new Error('No response data from server');

    const resp = response.data;
    console.log('Server response:', resp);

    if (resp.status !== 'success') {
      console.error('Server returned non-success:', resp);
      throw new Error('Processing failed on server: ' + (resp.message || JSON.stringify(resp)));
    }

    const sheets = resp.data;
    if (!sheets || Object.keys(sheets).length === 0) {
      throw new Error('No sheet data returned from API');
    }

    const wb = XLSX.utils.book_new();
    if (Array.isArray(sheets)) {
      const ws = XLSX.utils.json_to_sheet(sheets);
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    } else {
      for (const [sheetName, rows] of Object.entries(sheets)) {
        const dataRows = Array.isArray(rows) ? rows : [rows];
        const ws = XLSX.utils.json_to_sheet(dataRows);
        const safeName = (sheetName || 'Sheet').toString().substring(0, 30);
        XLSX.utils.book_append_sheet(wb, ws, safeName || 'Sheet1');
      }
    }

    const outFile = options.output || `bank_statements_${Date.now()}.xlsx`;
    XLSX.writeFile(wb, outFile);
    console.log('Saved Excel file to', outFile);
    return { success: true, file: outFile, response: resp };

  } catch (err) {
    console.error('Error:', err.message || err);
    return { success: false, error: err.message || String(err) };
  }
}

// Example usage: update pdfs and options as needed
(async () => {
  const pdfs = ['output\\unprocessed\\narpat.pdf']; // your file(s)
  const options = {
    bank_names: ['HDFC'],
    is_ocr: ['false'],
    ca_id: 'my_ca_123',
    // optionally: categoryMasterDataPath: path.resolve(__dirname, 'category_master_data.json'),
    output: 'my_bank_statements.xlsx'
  };

  const result = await uploadPdfsAndSaveExcel(pdfs, options);
  if (!result.success) process.exitCode = 1;
})();
