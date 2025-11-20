// /**
//  *  ===============================
//  *   EMAIL BACKGROUND + BANK SCANNER SERVICE
//  *  ===============================
//  *  Integrated version of your server.js + scanne3.py
//  */

// // Fix for pdf-parse in pkg builds
// if (typeof global.DOMMatrix === "undefined") {
//   global.DOMMatrix = class {
//     constructor() {}
//     multiply() { return this; }
//     invertSelf() { return this; }
//     translate() { return this; }
//     scale() { return this; }
//     rotate() { return this; }
//   };
// }


// const { execSync } = require('child_process');
// global.pdf = require("pdf-parse");
// const express = require("express");
// const cors = require("cors");
// const sqlite3 = require("sqlite3").verbose();
// const imaps = require("imap-simple");
// const path = require("path");
// const fs = require("fs").promises;
// const http = require("http");
// const crypto = require("crypto");
// const AdmZip = require("adm-zip");
// const XLSX = require("xlsx");
// const csvParser = require("csv-parser");
// const mime = require("mime-types");
// const { PDFDocument } = require("pdf-lib");

// // -----------------------------------------------------------------------------
// // PROCESS FAIL-SAFE HANDLERS
// // -----------------------------------------------------------------------------
// process.on("uncaughtException", (err) => console.error("❌ Uncaught Exception:", err));
// process.on("unhandledRejection", (reason) => console.error("❌ Unhandled Rejection:", reason));

// // -----------------------------------------------------------------------------
// // PORT DISCOVERY
// // -----------------------------------------------------------------------------
// function findAvailablePort(startPort = 3001, maxAttempts = 20) {
//   const net = require("net");
//   return new Promise((resolve, reject) => {
//     let port = startPort;
//     let tries = 0;
//     const tryNext = () => {
//       if (tries >= maxAttempts)
//         return reject(new Error(`No free ports ${startPort}-${startPort + maxAttempts}`));
//       const server = net.createServer();
//       server.once("error", (e) => {
//         if (e.code === "EADDRINUSE") {
//           port++;
//           tries++;
//           setTimeout(tryNext, 100);
//         } else reject(e);
//       });
//       server.once("listening", () => {
//         server.close();
//         resolve(port);
//       });
//       server.listen(port);
//     };
//     tryNext();
//   });
// }

// // -----------------------------------------------------------------------------
// // BANK-STATEMENT SCANNER (converted from scanne3.py)
// // -----------------------------------------------------------------------------


// // class BankStatementScanner {
// //   constructor(baseDir = path.join(__dirname, "storage", "attachments")) {
// //     this.inputDir = baseDir;
// //     this.outputDir = path.join(__dirname, "storage", "classified");
// //     this.allowedExts = [".pdf", ".xls", ".xlsx", ".csv", ".zip"];
// //     this.bankPatterns = [
// //       /ICICI/i,
// //       /HDFC/i,
// //       /AXIS/i,
// //       /SBI/i,
// //       /State\s*Bank\s*of\s*India/i,
// //       /Kotak/i,
// //       /YES\s*Bank/i,
// //       /Bank\s*of\s*Baroda/i,
// //       /Canara/i,
// //       /Union\s*Bank/i,
// //       /IndusInd/i,
// //       /IDFC/i,
// //       /Federal\s*Bank/i,
// //       /Punjab\s*National/i,
// //       /BOB\s*Bank/i,
// //       /Kurur\s*Bank/i,
// //       /indian\s*Bank/i,
// //     ];
// //     this.keywordReject = [/offer/i, /invoice/i, /bill/i, /payment/i, /advertisement/i];
// //   }

// //   async scanFile(filePath) {
// //     const ext = path.extname(filePath).toLowerCase();
// //     const fileName = path.basename(filePath);
// //     const result = {
// //       file: fileName,
// //       type: ext,
// //       bankMatch: null,
// //       rejected: false,
// //       reason: null,
// //       details: {},
// //     };

// //     try {
// //       if (!this.allowedExts.includes(ext)) {
// //         result.rejected = true;
// //         result.reason = "Unsupported file type";
// //         return result;
// //       }

// //       // --- Hash check to detect duplicates
// //       const hash = await this._hashFile(filePath);
// //       result.details.hash = hash;

// //       // --- Dispatch by file type
// //       if (ext === ".pdf") {
// //         Object.assign(result, await this._scanPDF(filePath));
// //       } else if ([".xls", ".xlsx"].includes(ext)) {
// //         Object.assign(result, await this._scanExcel(filePath));
// //       } else if (ext === ".csv") {
// //         Object.assign(result, await this._scanCSV(filePath));
// //       } else if (ext === ".zip") {
// //         Object.assign(result, await this._scanZIP(filePath));
// //       }

// //       // --- Final decision
// //       if (!result.bankMatch) {
// //         result.rejected = true;
// //         result.reason = "No bank keyword matched";
// //       }
// //       return result;
// //     } catch (err) {
// //       result.rejected = true;
// //       result.reason = "Error during scan: " + err.message;
// //       return result;
// //     }
// //   }

// //   // ---------------------------------------------------------------------------
// //   async _scanPDF(filePath) {
// //   const buf = await fs.readFile(filePath);
// //   const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
// //   let text = "";
// //   const pages = pdfDoc.getPages();
// //   for (const p of pages) {
// //     const txt = await p.getTextContent?.();
// //     if (txt && txt.items) {
// //       text += txt.items.map(i => i.str).join(" ");
// //     }
// //   }

// //   const res = { type: "pdf", textExtracted: text.slice(0, 2000) };
// //   if (text.length < 50) {
// //     res.rejected = true;
// //     res.reason = "Empty or image-based PDF";
// //     return res;
// //   }
// //   for (const pat of this.bankPatterns) {
// //     if (pat.test(text)) { res.bankMatch = pat.source; break; }
// //   }
// //   for (const bad of this.keywordReject) {
// //     if (bad.test(text)) {
// //       res.rejected = true; res.reason = "Contains non-statement keyword"; break;
// //     }
// //   }
// //   return res;
// // }

// //   async _scanExcel(filePath) {
// //     const workbook = XLSX.readFile(filePath, { cellDates: true });
// //     const sheet = workbook.Sheets[workbook.SheetNames[0]];
// //     const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0 });
// //     const firstRows = rows.slice(0, 20).flat().join(" ");
// //     const res = { type: "excel", preview: firstRows.slice(0, 1000) };

// //     for (const pat of this.bankPatterns) {
// //       if (pat.test(firstRows)) {
// //         res.bankMatch = pat.source;
// //         break;
// //       }
// //     }
// //     return res;
// //   }

// //   async _scanCSV(filePath) {
// //     const lines = [];
// //     await new Promise((resolve, reject) => {
// //       require("fs")
// //         .createReadStream(filePath)
// //         .pipe(csvParser())
// //         .on("data", (row) => lines.push(Object.values(row).join(" ")))
// //         .on("end", resolve)
// //         .on("error", reject);
// //     });
// //     const text = lines.slice(0, 30).join(" ");
// //     const res = { type: "csv", preview: text.slice(0, 1000) };
// //     for (const pat of this.bankPatterns) {
// //       if (pat.test(text)) {
// //         res.bankMatch = pat.source;
// //         break;
// //       }
// //     }
// //     return res;
// //   }

// //   async _scanZIP(filePath) {
// //     const res = { type: "zip", bankMatch: null, children: [] };
// //     const zip = new AdmZip(filePath);
// //     const entries = zip.getEntries();
// //     for (const e of entries) {
// //       if (e.isDirectory) continue;
// //       const name = e.entryName;
// //       const ext = path.extname(name).toLowerCase();
// //       if (!this.allowedExts.includes(ext)) continue;

// //       const tmpPath = path.join(this.outputDir, "tmp_" + Date.now() + "_" + name);
// //       await fs.mkdir(path.dirname(tmpPath), { recursive: true });
// //       await fs.writeFile(tmpPath, e.getData());

// //       const childRes = await this.scanFile(tmpPath);
// //       res.children.push(childRes);
// //       if (childRes.bankMatch) res.bankMatch = childRes.bankMatch;

// //       // cleanup
// //       await fs.unlink(tmpPath).catch(() => {});
// //     }
// //     return res;
// //   }

// //   async _hashFile(filePath) {
// //     const fileBuffer = await fs.readFile(filePath);
// //     return crypto.createHash("sha256").update(fileBuffer).digest("hex");
// //   }
// // }

// // ===============================
// // 🔍 Enhanced BankStatementScanner
// // ===============================

// // class BankStatementScanner {
// //   constructor() {
// //     // Bank name patterns (ported directly from scanne3.py)
// //     this.bankPatterns = [
// //       /hdfc/i,
// //       /icici/i,
// //       /state\s*bank/i,
// //       /sbi/i,
// //       /axis/i,
// //       /bank\s*of\s*baroda/i,
// //       /bob/i,
// //       /idfc/i,
// //       /canara/i,
// //       /union\s*bank/i,
// //       /kotak/i,
// //       /federal/i,
// //       /karur/i,
// //       /rbl/i,
// //       /yes\s*bank/i,
// //       /indusind/i,
// //       /punjab\s*national/i,
// //       /pnb/i,
// //       /bank\s*of\s*india/i,
// //       /uco\s*bank/i,
// //       /central\s*bank/i,
// //       /indian\s*overseas/i,
// //       /south\s*indian\s*bank/i,
// //       /city\s*union/i,
// //       /idbi/i,
// //       /bank\s*of\s*maharashtra/i
// //     ];

// //     // Currencies and symbols
// //     this.currencyPatterns = [/inr/i, /₹/, /rs\./i, /usd/i, /eur/i, /gbp/i];

// //     // Date formats (statement period)
// //     this.datePatterns = [
// //       /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g,
// //       /\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g
// //     ];

// //     // Keywords that frequently appear in statements
// //     this.statementKeywords = [
// //       /statement/i,
// //       /account\s*summary/i,
// //       /transaction/i,
// //       /deposit/i,
// //       /withdrawal/i,
// //       /balance/i,
// //       /credited/i,
// //       /debited/i,
// //       /account\s*number/i,
// //       /branch/i
// //     ];
// //   }

// //   async scanFile(filePath) {
// //     const ext = path.extname(filePath).toLowerCase();
// //     let textContent = "";

// //     try {
// //       if (ext === ".pdf") {
// //         const buffer = await fs.readFile(filePath);
// //         const data = await global.pdf(buffer);
// //         textContent = data.text;
// //       } else if (ext === ".xlsx" || ext === ".xls") {
// //         const workbook = XLSX.readFile(filePath);
// //         const sheetNames = workbook.SheetNames;
// //         textContent = sheetNames
// //           .map(name => XLSX.utils.sheet_to_csv(workbook.Sheets[name]))
// //           .join("\n");
// //       } else if (ext === ".csv") {
// //         textContent = await this._readCSV(filePath);
// //       } else if (ext === ".txt" || ext === ".xml") {
// //         textContent = await fs.readFile(filePath, "utf8");
// //       } else {
// //         return { success: false, reason: "Unsupported format" };
// //       }

// //       return this._analyzeText(textContent, path.basename(filePath));
// //     } catch (err) {
// //       return {
// //         success: false,
// //         reason: `Error during scan: ${err.message}`
// //       };
// //     }
// //   }

// //   async _readCSV(filePath) {
// //     return new Promise((resolve, reject) => {
// //       let text = "";
// //       fs.createReadStream(filePath)
// //         .pipe(csv())
// //         .on("data", row => {
// //           text += Object.values(row).join(" ") + "\n";
// //         })
// //         .on("end", () => resolve(text))
// //         .on("error", err => reject(err));
// //     });
// //   }

// //   _analyzeText(text, filename) {
// //     const result = {
// //       filename,
// //       isBankStatement: false,
// //       bankMatch: null,
// //       statementPeriod: null,
// //       currency: null,
// //       confidence: 0
// //     };

// //     if (!text || text.trim().length === 0) return result;

// //     const lower = text.toLowerCase();
// //     let score = 0;

// //     // Match banks
// //     for (const pattern of this.bankPatterns) {
// //       if (pattern.test(lower)) {
// //         result.bankMatch = pattern.source;
// //         score += 40;
// //         break;
// //       }
// //     }

// //     // Currency
// //     for (const c of this.currencyPatterns) {
// //       if (c.test(lower)) {
// //         result.currency = c.source;
// //         score += 20;
// //         break;
// //       }
// //     }

// //     // Dates
// //     const dates = [];
// //     for (const d of this.datePatterns) {
// //       const found = lower.match(d);
// //       if (found && found.length > 0) {
// //         dates.push(...found);
// //       }
// //     }
// //     if (dates.length >= 2) {
// //       result.statementPeriod = `${dates[0]} to ${dates[dates.length - 1]}`;
// //       score += 20;
// //     }

// //     // Generic keywords
// //     for (const kw of this.statementKeywords) {
// //       if (kw.test(lower)) {
// //         score += 5;
// //       }
// //     }

// //     result.confidence = Math.min(100, score);
// //     result.isBankStatement = score >= 50;
// //     return result;
// //   }
// // }

// // ===============================
// // 🔍 Enhanced BankStatementScanner
// // ===============================

// // class BankStatementScanner {
// //   constructor() {
// //     // ✅ Inject pdf-parse explicitly inside the class
// //     this.pdf = require("pdf-parse");
// //     this.XLSX = require("xlsx");
// //     this.csv = require("csv-parser");
// //     this.fs = require("fs").promises;
// //     this.path = require("path");

// //     // Bank name patterns (ported directly from scanne3.py)
// //     this.bankPatterns = [
// //       /hdfc/i, /icici/i, /state\s*bank/i, /sbi/i, /axis/i, /bank\s*of\s*baroda/i, /bob/i, /idfc/i,
// //       /canara/i, /union\s*bank/i, /kotak/i, /federal/i, /karur/i, /rbl/i, /yes\s*bank/i, /indusind/i,
// //       /punjab\s*national/i, /pnb/i, /bank\s*of\s*india/i, /uco\s*bank/i, /central\s*bank/i,
// //       /indian\s*overseas/i, /south\s*indian\s*bank/i, /city\s*union/i, /idbi/i, /bank\s*of\s*maharashtra/i
// //     ];

// //     // Currency, date, and keywords
// //     this.currencyPatterns = [/inr/i, /₹/, /rs\./i, /usd/i, /eur/i, /gbp/i];
// //     this.datePatterns = [/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g, /\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g];
// //     this.statementKeywords = [
// //       /statement/i, /account\s*summary/i, /transaction/i, /deposit/i, /withdrawal/i,
// //       /balance/i, /credited/i, /debited/i, /account\s*number/i, /branch/i
// //     ];
// //   }

// //   async scanFile(filePath) {
// //     const ext = this.path.extname(filePath).toLowerCase();
// //     const DDMMatrix = new BankStatementScanner();

// //     let textContent = "";

// //     try {
// //       if (ext === ".pdf") {
// //         const buffer = await this.fs.readFile(filePath);
// //         const data = await this.pdf(buffer);
// //         textContent = data.text;
// //       } else if (ext === ".xlsx" || ext === ".xls") {
// //         const workbook = this.XLSX.readFile(filePath);
// //         const sheetNames = workbook.SheetNames;
// //         textContent = sheetNames
// //           .map(name => this.XLSX.utils.sheet_to_csv(workbook.Sheets[name]))
// //           .join("\n");
// //       } else if (ext === ".csv") {
// //         textContent = await this._readCSV(filePath);
// //       } else if (ext === ".txt" || ext === ".xml") {
// //         textContent = await this.fs.readFile(filePath, "utf8");
// //       } else {
// //         return { success: false, reason: "Unsupported format" };
// //       }

// //       return this._analyzeText(textContent, this.path.basename(filePath));
// //     } catch (err) {
// //       return { success: false, reason: `Error during scan: ${err.message}` };
// //     }
// //   }

// //   async _readCSV(filePath) {
// //     return new Promise((resolve, reject) => {
// //       let text = "";
// //       const fsStream = require("fs").createReadStream(filePath);
// //       fsStream
// //         .pipe(this.csv())
// //         .on("data", (row) => { text += Object.values(row).join(" ") + "\n"; })
// //         .on("end", () => resolve(text))
// //         .on("error", (err) => reject(err));
// //     });
// //   }

// //   _analyzeText(text, filename) {
// //     const result = {
// //       filename,
// //       isBankStatement: false,
// //       bankMatch: null,
// //       statementPeriod: null,
// //       currency: null,
// //       confidence: 0
// //     };

// //     if (!text || text.trim().length === 0) return result;

// //     const lower = text.toLowerCase();
// //     let score = 0;

// //     for (const pattern of this.bankPatterns) {
// //       if (pattern.test(lower)) {
// //         result.bankMatch = pattern.source;
// //         score += 40;
// //         break;
// //       }
// //     }

// //     for (const c of this.currencyPatterns) {
// //       if (c.test(lower)) {
// //         result.currency = c.source;
// //         score += 20;
// //         break;
// //       }
// //     }

// //     const dates = [];
// //     for (const d of this.datePatterns) {
// //       const found = lower.match(d);
// //       if (found) dates.push(...found);
// //     }
// //     if (dates.length >= 2) {
// //       result.statementPeriod = `${dates[0]} to ${dates[dates.length - 1]}`;
// //       score += 20;
// //     }

// //     for (const kw of this.statementKeywords) {
// //       if (kw.test(lower)) score += 5;
// //     }

// //     result.confidence = Math.min(100, score);
// //     result.isBankStatement = score >= 50;
// //     return result;
// //   }
// // }

// // ===============================
// // 🔍 Clean BankStatementScanner (Text-based PDF only)
// // ===============================
// // class BankStatementScanner {
// //   constructor() {
// //     this.pdf = require("pdf-parse");
// //     this.fs = require("fs").promises;
// //     this.path = require("path");

// //     // ✅ Bank name patterns
// //     this.bankPatterns = [
// //       /hdfc/i, /icici/i, /state\s*bank/i, /sbi/i, /axis/i, /bank\s*of\s*baroda/i, /bob/i, /idfc/i,
// //       /canara/i, /union\s*bank/i, /kotak/i, /federal/i, /karur/i, /rbl/i, /yes\s*bank/i, /indusind/i,
// //       /punjab\s*national/i, /pnb/i, /bank\s*of\s*india/i, /uco\s*bank/i, /central\s*bank/i,
// //       /indian\s*overseas/i, /south\s*indian\s*bank/i, /city\s*union/i, /idbi/i, /bank\s*of\s*maharashtra/i
// //     ];

// //     // ✅ Currency, dates, and keywords
// //     this.currencyPatterns = [/inr/i, /₹/, /rs\./i, /usd/i, /eur/i, /gbp/i];
// //     this.datePatterns = [/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g, /\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g];
// //     this.statementKeywords = [
// //       /statement/i, /account\s*summary/i, /transaction/i, /deposit/i, /withdrawal/i,
// //       /balance/i, /credited/i, /debited/i, /account\s*number/i, /branch/i
// //     ];
// //   }

// //   // 📄 Main file scanning logic
// //   // async scanFile(filePath) {
// //   //   const ext = this.path.extname(filePath).toLowerCase();
// //   //   let textContent = "";

// //   //   try {
// //   //     if (ext === ".pdf") {
// //   //       // 🧠 Only handle text-based PDFs
// //   //       const buffer = await this.fs.readFile(filePath);
// //   //       const data = await this.pdf(buffer); // ✅ fixed: removed .default
// //   //       textContent = data.text || "";
// //   //     } else {
// //   //       // Ignore non-PDFs for this version
// //   //       return { success: false, reason: "Only PDF supported" };
// //   //     }

// //   //     // Pass extracted text to analyzer
// //   //     return this._analyzeText(textContent, this.path.basename(filePath));
// //   //   } catch (err) {
// //   //     return { success: false, reason: `Error during scan: ${err.message}` };
// //   //   }
// //   // }

// //   async scanFile(filePath) {
// //   const ext = this.path.extname(filePath).toLowerCase();
// //   let textContent = "";

// //   try {
// //     if (ext === ".pdf") {
// //       const buffer = await this.fs.readFile(filePath);
// //       const data = await this.pdf(buffer);
// //       textContent = data.text || "";
// //     } else if (ext === ".xlsx" || ext === ".xls") {
// //       const XLSX = require("xlsx");
// //       const workbook = XLSX.readFile(filePath);
// //       const sheetNames = workbook.SheetNames;
// //       textContent = sheetNames
// //         .map(name => XLSX.utils.sheet_to_csv(workbook.Sheets[name]))
// //         .join("\n");
// //     } else if (ext === ".csv") {
// //       textContent = await this._readCSV(filePath);
// //     } else if (ext === ".txt" || ext === ".xml") {
// //       textContent = await this.fs.readFile(filePath, "utf8");
// //     } else if (ext === ".zip") {
// //       const AdmZip = require("adm-zip");
// //       const zip = new AdmZip(filePath);
// //       const entries = zip.getEntries();
// //       for (const e of entries) {
// //         if (!e.isDirectory) {
// //           const name = e.entryName;
// //           const tmpPath = this.path.join(process.cwd(), "storage", "tmp", name);
// //           await this.fs.mkdir(this.path.dirname(tmpPath), { recursive: true });
// //           await this.fs.writeFile(tmpPath, e.getData());
// //           const inner = await this.scanFile(tmpPath);
// //           if (inner.bankMatch) return inner; // early return if bank found
// //         }
// //       }
// //       return { success: false, reason: "No bank file in ZIP" };
// //     } else {
// //       return { success: false, reason: "Unsupported format" };
// //     }

// //     return this._analyzeText(textContent, this.path.basename(filePath));
// //   } catch (err) {
// //     return { success: false, reason: `Error during scan: ${err.message}` };
// //   }
// // }


// //   // 🧩 Analyzer: Decide if it's a bank statement
// //   _analyzeText(text, filename) {
// //   const result = {
// //     filename,
// //     isBankStatement: false,
// //     bankMatch: null,
// //     statementPeriod: null,
// //     currency: null,
// //     confidence: 0,
// //     confidenceLevel: "Low",
// //     reason: ""
// //   };

// //   if (!text || text.trim().length === 0) {
// //     result.reason = "Empty or image-based PDF";
// //     return result;
// //   }

// //   const lower = text.toLowerCase();
// //   let score = 0;

// //   // ⚠️ Reject trading or portfolio documents
// //   const rejectPatterns = [
// //     /mutual\s*fund/i,
// //     /portfolio\s+summary/i,
// //     /pnl\s+report/i,
// //     /capital\s+gains/i,
// //     /contract\s+note/i,
// //     /holding\s+statement/i,
// //     /shares\s+statement/i,
// //     /stock\s+statement/i,
// //     /brokerage/i,
// //     /nse/i,
// //     /bse/i,
// //     /demat/i
// //   ];

// //   let rejectHits = 0;
// //   for (const r of rejectPatterns) {
// //     const matches = lower.match(r);
// //     if (matches && matches.length > 1) rejectHits++;
// //   }
// //   if (rejectHits >= 2) {
// //     result.reason = "Likely a share/trading document";
// //     result.confidenceLevel = "Low";
// //     return result;
// //   }

// //   // ✅ Bank name pattern
// //   for (const pattern of this.bankPatterns) {
// //     if (pattern.test(lower)) {
// //       result.bankMatch = pattern.source;
// //       score += 40;
// //       break;
// //     }
// //   }

// //   // ✅ Currency pattern
// //   for (const c of this.currencyPatterns) {
// //     if (c.test(lower)) {
// //       result.currency = c.source;
// //       score += 20;
// //       break;
// //     }
// //   }

// //   // ✅ Date pattern
// //   const dates = [];
// //   for (const d of this.datePatterns) {
// //     const found = lower.match(d);
// //     if (found) dates.push(...found);
// //   }
// //   if (dates.length >= 2) {
// //     result.statementPeriod = `${dates[0]} to ${dates[dates.length - 1]}`;
// //     score += 20;
// //   }

// //   // ✅ Bank-specific keywords
// //   for (const kw of this.statementKeywords) {
// //     if (kw.test(lower)) score += 5;
// //   }

// //   // ✅ Strong transactional indicators
// //   if (/(account\s+number|txn\s*id|transaction\s+date|debit|credit|balance\s+amount|ifsc)/i.test(lower)) {
// //     score += 10;
// //   }

// //   // ✅ Penalty for unrelated financial content
// //   if (/\bportfolio\b|\btrading\b|\bshares\b/i.test(lower)) {
// //     score -= 10;
// //   }

// //   // ✅ Final confidence
// //   result.confidence = Math.max(0, Math.min(100, score));

// //   // 🧠 Multi-level classification
// //   if (result.confidence >= 80) {
// //     result.confidenceLevel = "High";
// //     result.isBankStatement = true;
// //     result.reason = "High confidence: valid bank statement";
// //   } else if (result.confidence >= 50) {
// //     result.confidenceLevel = "Medium";
// //     result.isBankStatement = false;
// //     result.reason = "Medium confidence: may be a partial or unclear bank statement";
// //   } else {
// //     result.confidenceLevel = "Low";
// //     result.isBankStatement = false;
// //     result.reason = "Low confidence: unlikely to be a bank statement";
// //   }

// //   return result;
// // }



// // }

// class BankStatementScanner {
//   constructor(fs, path, pdf) {
//     this.fs = fs;
//     this.path = path;
//     this.pdf = pdf;

//     this.bankPatterns = [
//       /hdfc/i, /icici/i, /sbi/i, /axis/i, /kotak/i, /pnb/i,
//       /canara/i, /bank of india/i, /union bank/i
//     ];

//     this.currencyPatterns = [/₹/, /inr/i, /usd/i, /rs\./i];
//     this.datePatterns = [/\b\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\b/g];

//     this.bankKeywords = [
//       "account number", "transaction date", "description",
//       "debit", "credit", "balance", "ifsc", "utr",
//       "branch", "statement", "closing balance", "narration"
//     ];

//     this.shareKeywords = [
//       "isin", "script", "quantity", "price",
//       "nse", "bse", "trade date", "settlement",
//       "brokerage", "contract note", "holding",
//       "demat", "portfolio", "client id", "dp id"
//     ];
//   }

//   async scanFile(filePath) {
//     const ext = this.path.extname(filePath).toLowerCase();
//     let textContent = "";

//     try {
//       if (ext === ".pdf") {
//         const buffer = await this.fs.readFile(filePath);
//         const data = await this.pdf(buffer);
//         textContent = data.text || "";
//       } else if (ext === ".xlsx" || ext === ".xls" || ext === ".csv") {
//         const XLSX = require("xlsx");
//         const workbook = XLSX.readFile(filePath);
//         const sheetNames = workbook.SheetNames;
//         textContent = sheetNames
//           .map(name => {
//             const sheet = workbook.Sheets[name];
//             const csv = XLSX.utils.sheet_to_csv(sheet);
//             return csv;
//           })
//           .join("\n");
//       } else if (ext === ".txt" || ext === ".xml") {
//         textContent = await this.fs.readFile(filePath, "utf8");
//       } else if (ext === ".zip") {
//         const AdmZip = require("adm-zip");
//         const zip = new AdmZip(filePath);
//         const entries = zip.getEntries();
//         for (const e of entries) {
//           if (!e.isDirectory) {
//             const tmpPath = this.path.join(
//               process.cwd(),
//               "storage",
//               "tmp",
//               e.entryName
//             );
//             await this.fs.mkdir(this.path.dirname(tmpPath), { recursive: true });
//             await this.fs.writeFile(tmpPath, e.getData());
//             const inner = await this.scanFile(tmpPath);
//             if (inner.isBankStatement || inner.isShareStatement) return inner;
//           }
//         }
//         return { success: false, reason: "No valid document in ZIP" };
//       } else {
//         return { success: false, reason: "Unsupported file format" };
//       }

//       return this._analyzeText(textContent, this.path.basename(filePath));
//     } catch (err) {
//       return { success: false, reason: `Error scanning: ${err.message}` };
//     }
//   }

//   _analyzeText(text, filename) {
//     const result = {
//       filename,
//       classification: "Unrecognized",
//       isBankStatement: false,
//       isShareStatement: false,
//       confidence: 0,
//       confidenceLevel: "Low",
//       bankScore: 0,
//       shareScore: 0,
//       reason: ""
//     };

//     if (!text || text.trim().length === 0) {
//       result.reason = "Empty or unreadable file";
//       return result;
//     }

//     const lower = text.toLowerCase();
//     let score = 0;

//     // Match patterns
//     for (const b of this.bankPatterns) {
//       if (b.test(lower)) score += 20;
//     }
//     for (const c of this.currencyPatterns) {
//       if (c.test(lower)) score += 10;
//     }
//     if (this.datePatterns.some(d => lower.match(d))) score += 10;

//     // Keyword scoring
//     let bankHits = 0, shareHits = 0;
//     for (const kw of this.bankKeywords) {
//       if (lower.includes(kw)) bankHits++;
//     }
//     for (const kw of this.shareKeywords) {
//       if (lower.includes(kw)) shareHits++;
//     }

//     result.bankScore = bankHits * 5 + score;
//     result.shareScore = shareHits * 5;

//     // Classification logic
//     if (result.bankScore > result.shareScore + 20) {
//       result.classification = "Bank Statement";
//       result.isBankStatement = true;
//       result.confidence = Math.min(100, result.bankScore);
//       result.reason = "Detected banking patterns, account numbers, and debit/credit columns.";
//     } else if (result.shareScore > result.bankScore + 20) {
//       result.classification = "Share/Trading Statement";
//       result.isShareStatement = true;
//       result.confidence = Math.min(100, result.shareScore);
//       result.reason = "Detected trading terms, ISIN codes, and stock-related headers.";
//     } else {
//       result.classification = "Ambiguous";
//       result.confidence = Math.min(100, (result.bankScore + result.shareScore) / 2);
//       result.reason = "Contains mixed or unclear indicators.";
//     }

//     // Confidence levels
//     if (result.confidence >= 80) result.confidenceLevel = "High";
//     else if (result.confidence >= 50) result.confidenceLevel = "Medium";
//     else result.confidenceLevel = "Low";

//     return result;
//   }
// }





// // -----------------------------------------------------------------------------
// // EMAIL BACKGROUND SERVICE (with integrated BankStatementScanner)
// // -----------------------------------------------------------------------------
// class EmailBackgroundService {
//   constructor() {
//     this.isRunning = false;
//     this.db = null;
//     this.currentConfig = null;
//     this.scanner = new BankStatementScanner();
//     this.init();
//   }

//   async init() {
//     await this.initDatabase();
//     await this.loadConfig();
//   }

//   async initDatabase() {
//     const dbPath = path.join(__dirname, "storage", "databases", "email-service.db");
//     console.log({dbPath})
//     await fs.mkdir(path.dirname(dbPath), { recursive: true });
//     this.db = new sqlite3.Database(dbPath);

//     return new Promise((resolve, reject) => {
//       this.db.serialize(() => {
//         this.db.run(`
//           CREATE TABLE IF NOT EXISTS processed_emails (
//             id INTEGER PRIMARY KEY AUTOINCREMENT,
//             message_id TEXT UNIQUE,
//             subject TEXT,
//             from_email TEXT,
//             received_date DATETIME,
//             processed_date DATETIME DEFAULT CURRENT_TIMESTAMP,
//             has_attachments BOOLEAN DEFAULT false,
//             status TEXT DEFAULT 'processed'
//           )
//         `);
//         this.db.run(`
//           CREATE TABLE IF NOT EXISTS email_configs (
//             id INTEGER PRIMARY KEY AUTOINCREMENT,
//             email_provider TEXT DEFAULT 'gmail',
//             imap_host TEXT,
//             imap_port INTEGER,
//             email TEXT,
//             app_password TEXT,
//             check_interval INTEGER DEFAULT 3,
//             is_active BOOLEAN DEFAULT true,
//             created_at DATETIME DEFAULT CURRENT_TIMESTAMP
//           )
//         `);
//         this.db.run(`
//           CREATE TABLE IF NOT EXISTS processed_statements (
//             id INTEGER PRIMARY KEY AUTOINCREMENT,
//             email_id INTEGER,
//             original_filename TEXT,
//             processed_file_path TEXT,
//             file_size INTEGER,
//             transaction_count INTEGER DEFAULT 0,
//             processing_time_ms INTEGER,
//             bank_name TEXT,
//             classification TEXT,
//             status TEXT DEFAULT 'success',
//             error_message TEXT,
//             processed_date DATETIME DEFAULT CURRENT_TIMESTAMP,
//             FOREIGN KEY(email_id) REFERENCES processed_emails(id)
//           )
//         `, (err) => err ? reject(err) : resolve());
//       });
//     });
//   }

//   async loadConfig() {
//     return new Promise((resolve, reject) => {
//       this.db.get(
//         "SELECT * FROM email_configs WHERE is_active = true ORDER BY created_at DESC LIMIT 1",
//         (err, row) => {
//           if (err) reject(err);
//           else {
//             this.currentConfig = row;
//             console.log(`Configuration loaded: ${row ? "Active config found" : "No active config"}`);
//             if (row) {
//               console.log("🔧 Loaded config details:", {
//                 email: row.email,
//                 host: row.imap_host,
//                 port: row.imap_port,
//                 provider: row.email_provider,
//               });
//             }
//             resolve(row);
//           }
//         }
//       );
//     });
//   }

//   async start() {
//     if (!this.currentConfig) return console.log("⏳ No email configuration found.");
//     if (!this.currentConfig.email || !this.currentConfig.app_password)
//       return console.log("❌ Invalid configuration: email or app password missing");

//     if (this.isRunning) return console.log("⚠️ Service already running");

//     this.isRunning = true;
//     console.log("🚀 Starting background email service...");
//     await this.checkEmails();

//     const interval = (this.currentConfig.check_interval || 3) * 60 * 1000;
//     this.intervalId = setInterval(() => this.isRunning && this.checkEmails(), interval);
//     console.log(`✅ Background service started. Checking emails every ${this.currentConfig.check_interval || 3} min`);
//   }

//   stop() {
//     this.isRunning = false;
//     if (this.intervalId) clearInterval(this.intervalId);
//     console.log("🛑 Background service stopped");
//   }

//    async checkEmails() {

//     if (!this.currentConfig || !this.isRunning) return;
//     console.log("📧 Checking only emails that contain attachments...");

//     const config = this.getImapConfig();

//     try {
//       const connection = await imaps.connect(config);
//       await connection.openBox("INBOX");

//       // 🔍 Fetch unseen emails (we’ll manually filter those that have attachments)
//       const sinceDate = new Date();
//       sinceDate.setHours(0, 0, 0, 0); // ✅ today only
//       const searchCriteria = ['UNSEEN', ['SINCE', sinceDate.toISOString().split('T')[0]]];

//       const fetchOptions = { bodies: ['HEADER'], struct: true };

//       const messages = await connection.search(searchCriteria, fetchOptions);
//       console.log(`📨 Found ${messages.length} new emails, checking for attachments...`);

//       let validEmails = 0;
//       for (const msg of messages) {
//         const hasAttachment = this.emailHasValidAttachment(msg);
//         if (!hasAttachment) continue;

//         try {
//           console.log("We are here")
//           const processed = await this.processImapMessage(msg, connection);
//           if (processed) validEmails++;
//         } catch (err) {
//           console.error("❌ Error processing email:", err);
//         }
//       }

//       connection.end();
//       console.log(`✅ Scan complete. Processed ${validEmails} emails with valid attachments.`);
//     } catch (err) {
//       console.error("❌ Email check failed:", err.message);
//       if (/Invalid credentials/i.test(err.message)) {
//         console.log("🔐 AUTHENTICATION ISSUE: Check Gmail App Password and IMAP access.");
//       }
//     }
//   }

// // -----------------------------------------------------------------------------
// // 📨 Fetch & process all emails (seen + unseen) for PDF attachments
// // -----------------------------------------------------------------------------
// // async checkEmails(startDate = null, endDate = null) {
// //   if (!this.currentConfig || !this.isRunning) return;
// //   console.log("📧 Checking ALL emails (seen + unseen) that contain PDF attachments...");

// //   const config = this.getImapConfig();

// //   try {
// //     const connection = await imaps.connect(config);
// //     await connection.openBox("INBOX");

// //     // 🗓 Default to today's date if not specified
// //     const today = new Date();
// //     const todayISO = today.toISOString().split("T")[0];
// //     const sinceDate = startDate || todayISO;
// //     const beforeDate = endDate || todayISO;

// //     // 🔍 Fetch all emails (not just unseen)
// //     // SINCE includes date from, BEFORE excludes the end date (so we add +1 day)
// //     const searchCriteria = [
// //       ['SINCE', sinceDate],
// //       ['BEFORE', this.addOneDay(beforeDate)]
// //     ];

// //     const fetchOptions = { bodies: ['HEADER'], struct: true };

// //     const messages = await connection.search(searchCriteria, fetchOptions);
// //     console.log(`📨 Found ${messages.length} total emails between ${sinceDate} → ${beforeDate}`);

// //     let processedCount = 0;
// //     for (const msg of messages) {
// //       const hasAttachment = this.emailHasValidAttachment(msg);
// //       if (!hasAttachment) continue;

// //       try {
// //         const processed = await this.processImapMessage(msg, connection);
// //         if (processed) processedCount++;
// //       } catch (err) {
// //         console.error("⚠️ Error processing email:", err.message);
// //       }
// //     }

// //     connection.end();
// //     console.log(`✅ Scan complete — processed ${processedCount} valid emails.`);
// //   } catch (err) {
// //     console.error("❌ Email check failed:", err.message);
// //     if (/Invalid credentials/i.test(err.message)) {
// //       console.log("🔐 AUTH ERROR: Check Gmail App Password & IMAP Access.");
// //     }
// //   }
// // }

// // -----------------------------------------------------------------------------
// // 📨 Fetch & process all emails (seen + unseen) for PDF attachments
// // -----------------------------------------------------------------------------
// async checkEmails(startDate = null, endDate = null) {
//   if (!this.currentConfig || !this.isRunning) return;
//   console.log("📧 Checking ALL emails (seen + unseen) that contain PDF attachments...");

//   const config = this.getImapConfig();

//   try {
//     const connection = await imaps.connect(config);
//     await connection.openBox("INBOX");

//     // 🗓 Default to today's date if not specified
//     const today = new Date();
//     const todayISO = today.toISOString().split("T")[0];
//     const sinceDate = startDate || todayISO;
//     const beforeDate = endDate || todayISO;

//     // 🔍 Fetch all emails in date range
//     const searchCriteria = [
//       ['SINCE', sinceDate],
//       ['BEFORE', this.addOneDay(beforeDate)]
//     ];
//     const fetchOptions = { bodies: ['HEADER'], struct: true };

//     const messages = await connection.search(searchCriteria, fetchOptions);
//     console.log(`📨 Found ${messages.length} total emails between ${sinceDate} → ${beforeDate}`);

//     let processedCount = 0;
//     for (const msg of messages) {
//       const headers = msg.parts.find(p => p.which === "HEADER")?.body || {};
//       const messageId = headers["message-id"]?.[0] || null;

//       // 🧠 Skip already processed emails
//       if (messageId && await this.isEmailProcessed(messageId)) {
//         console.log(`⏩ Skipping already processed email: ${messageId}`);
//         continue;
//       }

//       const hasAttachment = this.emailHasValidAttachment(msg);
//       if (!hasAttachment) continue;

//       try {
//         const processed = await this.processImapMessage(msg, connection);
//         if (processed) processedCount++;
//       } catch (err) {
//         console.error("⚠️ Error processing email:", err.message);
//       }
//     }

//     connection.end();
//     console.log(`✅ Scan complete — processed ${processedCount} valid emails.`);
//   } catch (err) {
//     console.error("❌ Email check failed:", err.message);
//     if (/Invalid credentials/i.test(err.message)) {
//       console.log("🔐 AUTH ERROR: Check Gmail App Password & IMAP Access.");
//     }
//   }
// }

// // -----------------------------------------------------------------------------
// // 🔒 Check if email with same Message-ID already processed
// // -----------------------------------------------------------------------------
// async isEmailProcessed(messageId) {
//   return new Promise((resolve) => {
//     this.db.get(
//       "SELECT 1 FROM processed_emails WHERE message_id = ? LIMIT 1",
//       [messageId],
//       (err, row) => resolve(!!row)
//     );
//   });
// }



// // -----------------------------------------------------------------------------
// // Helper function — adds one day to end-date
// // -----------------------------------------------------------------------------
// addOneDay(dateString) {
//   const date = new Date(dateString);
//   date.setDate(date.getDate() + 1);
//   return date.toISOString().split("T")[0];
// }




//   // 🧠 Helper to detect valid attachments in a message
//   emailHasValidAttachment(msg) {
//     const attachments = this.findAttachmentParts(msg.attributes.struct);
//     if (!attachments.length) return false;

//     // Only count attachments with the right extensions
//     return attachments.some(p => {
//       const fname = p.disposition?.params?.filename || "";
//       const ext = path.extname(fname).toLowerCase();
//       return [".pdf", ".xlsx", ".xls", ".csv", ".txt", ".xml"].includes(ext);
//     });
//   }

    
  



//   getImapConfig() {
//     const provider = this.currentConfig.email_provider || "gmail";
//     const host = this.currentConfig.imap_host || this.getDefaultHost(provider);
//     const port = parseInt(this.currentConfig.imap_port || this.getDefaultPort(provider));

//     return {
//       imap: {
//         user: this.currentConfig.email,
//         password: this.currentConfig.app_password,
//         host,
//         port,
//         tls: true,
//         tlsOptions: { rejectUnauthorized: false, servername: host },
//         authTimeout: 30000,
//         connTimeout: 30000,
//       },
//     };
//   }

//   getDefaultHost(p) {
//     return {
//       gmail: "imap.gmail.com",
//       outlook: "outlook.office365.com",
//       yahoo: "imap.mail.yahoo.com",
//       icloud: "imap.mail.me.com",
//     }[p] || "imap.gmail.com";
//   }

//   getDefaultPort() { return 993; }

//   // ---------------------------------------------------------------------------
//   // EMAIL PROCESSING + ATTACHMENT HANDLING
//   // ---------------------------------------------------------------------------



//   async processImapMessage(msg, connection) {
//     const headers = msg.parts.find(p => p.which === "HEADER").body;
//     const subject = headers.subject?.[0] || "";
//     const from = headers.from?.[0] || "";
//     const date = headers.date?.[0] || new Date().toISOString();
//     const messageId = headers["message-id"]?.[0] || "";

//     console.log(`📩 Processing email: ${subject}`);
//     if (!this.isBankStatementEmail(subject, from)) return false;

//     console.log(`🏦 Bank-related email detected: ${subject}`);
//     const emailId = await this.saveEmailInfo({
//       messageId,
//       subject,
//       from,
//       date,
//     });

//     const parts = this.findAttachmentParts(msg.attributes.struct);
//     let processed = false;
//     for (const p of parts) {
//       const fname = p.disposition?.params?.filename;
//       if (fname && this.isStatementAttachment(fname)) {
//         try {
//           const data = await connection.getPartData(msg, p);
//           await this.processStatementAttachment({ filename: fname, content: data }, emailId);
//           processed = true;
//         } catch (err) {
//           console.error(`Error processing attachment ${fname}:`, err);
//         }
//       }
//     }
//     return processed;
//   }

//   async processImapMessage(msg, connection) {
//     const headers = msg.parts.find(p => p.which === "HEADER").body;
//     const subject = headers.subject?.[0] || "(no subject)";
//     const from = headers.from?.[0] || "";
//     const date = headers.date?.[0] || new Date().toISOString();
//     const messageId = headers["message-id"]?.[0] || "";

//     console.log(`📩 Processing email: ${subject}`);

//     const attachments = this.findAttachmentParts(msg.attributes.struct);
//     const validAttachments = attachments.filter(p => {
//       const fname = p.disposition?.params?.filename || "";
//       const ext = path.extname(fname).toLowerCase();
//       return [".pdf", ".xlsx", ".xls", ".csv", ".txt", ".xml"].includes(ext);
//     });

//     if (!validAttachments.length) return false;

//     const emailId = await this.saveEmailInfo({                                    
//       messageId,
//       subject,
//       from,
//       date,
//     });

//     let processed = false;
//     for (const part of validAttachments) {
//       const filename = part.disposition?.params?.filename;
//       if (!filename) continue;

//       try {
//         const data = await connection.getPartData(msg, part);
//         const attachmentPath = path.join(process.cwd(), "storage", "attachments1", filename);
//         await fs.mkdir(path.dirname(attachmentPath), { recursive: true });
//         await fs.writeFile(attachmentPath, data);

//         console.log(`💾 Saved: ${filename}, scanning for bank patterns...`);
//         const result = await this.scanner.scanFile(attachmentPath);

//         if (result.bankMatch) {
//           console.log(`🏦 Bank statement detected: ${result.bankMatch}`);
//           await this.saveProcessingResult(
//             emailId,
//             filename,
//             attachmentPath,
//             result,
//             2000,
//             "success",
//             null
//           );
//           processed = true;
//         } else {
//           console.log(`❌ Not a bank statement: ${filename} (${result.reason || "no match"})`);
//           await this.saveProcessingResult(
//             emailId,
//             filename,
//             attachmentPath,
//             result,
//             1000,
//             "rejected",
//             result.reason
//           );
//         }
//       } catch (err) {
//         console.error(`⚠️ Error processing ${filename}:`, err.message);
//       }
//     }
//     return processed;
//   }


//     findAttachmentParts(struct, parts = []) {
//     if (!struct) return parts;

//     // If it's a multipart container, recursively search
//     if (Array.isArray(struct)) {
//       struct.forEach((s) => this.findAttachmentParts(s, parts));
//       return parts;
//     }

//     const type = (struct.type || "").toLowerCase();
//     const subtype = (struct.subtype || "").toLowerCase();
//     const isAttachment =
//       (struct.disposition &&
//         (struct.disposition.type?.toLowerCase() === "attachment" ||
//          struct.disposition.params?.filename)) ||
//       struct.params?.name ||                                // Gmail sometimes uses "name"
//       struct.id?.endsWith("@gmail.com") ||                  // Inline attachments in Gmail
//       ["application", "text"].includes(type) &&              // Fallback for Gmail missing disposition
//       [ "pdf", "vnd.ms-excel", "vnd.openxmlformats-officedocument.spreadsheetml.sheet",
//         "csv", "plain", "xml"].includes(subtype);

//     if (isAttachment) {
//       parts.push(struct);
//     }

//     // Recurse into subparts if available
//     if (struct.parts && Array.isArray(struct.parts)) {
//       struct.parts.forEach((s) => this.findAttachmentParts(s, parts));
//     }

//     return parts;
//   }


//   isBankStatementEmail(subject, from) {
//     const kws = ["statement", "bank", "account", "transaction", "credit card", "e-statement"];
//     const s = subject.toLowerCase();
//     const f = from.toLowerCase();
//     return kws.some((k) => s.includes(k) || f.includes(k));
//   }

//   isStatementAttachment(fname) {
//     const ext = path.extname(fname).toLowerCase();
//     return [".pdf", ".xlsx", ".xls", ".csv", ".zip"].includes(ext);
//   }

//   async saveEmailInfo(email) {
//     return new Promise((resolve, reject) => {
//       this.db.run(
//         `INSERT INTO processed_emails (message_id, subject, from_email, received_date, has_attachments)
//          VALUES (?, ?, ?, ?, ?)`,
//         [email.messageId, email.subject, email.from, email.date, true],
//         function (err) {
//           if (err && /UNIQUE/.test(err.message)) {
//             return resolve(null);
//           } else if (err) reject(err);
//           else resolve(this.lastID);
//         }
//       );
//     });
//   }

//   // ---------------------------------------------------------------------------
//   // REPLACEMENT FOR mockProcessStatement: real scanner integration
//   // ---------------------------------------------------------------------------
//   async processStatementAttachment(attachment, emailId) {
//     const attachmentPath = path.join(process.cwd(), "storage", "attachments1", filename);
//     await fs.mkdir(attachmentsDir, { recursive: true });
//     const fname = `statement_${emailId}_${Date.now()}_${attachment.filename}`;
//     const fpath = path.join(attachmentsDir, fname);
//     await fs.writeFile(fpath, attachment.content);

//     console.log(`💾 Saved attachment: ${fname}`);

//     const start = Date.now();
//     try {
//       const scanResult = await this.scanner.scanFile(fpath);
//       const dur = Date.now() - start;

//       await this.saveProcessingResult(
//         emailId,
//         attachment.filename,
//         fpath,
//         scanResult,
//         dur,
//         scanResult.rejected ? "rejected" : "success",
//         scanResult.reason || null
//       );

//       console.log(
//         `✅ ${scanResult.rejected ? "Rejected" : "Processed"} ${attachment.filename} → ${scanResult.bankMatch || "N/A"}`
//       );
//        const command = `python run_classifier.py "${pdf_path}"`;
//     const result = execSync(`python run_classifier.py "${pdf_path}"`, {encoding: 'utf8'});
//     console.log("command",command);
//       return scanResult;
//     } catch (err) {
//       console.error(`❌ Error scanning ${attachment.filename}:`, err);
//       await this.saveProcessingResult(emailId, attachment.filename, fpath, null, 0, "error", err.message);
      
//     }
   
//   }

//   async saveProcessingResult(emailId, origName, pathOut, result, ms, status = "success", errorMsg = null) {
//     return new Promise((resolve, reject) => {
//       this.db.run(
//         `INSERT INTO processed_statements
//           (email_id, original_filename, processed_file_path, file_size, transaction_count, processing_time_ms,
//            bank_name, classification, status, error_message)
//          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//         [
//           emailId,
//           origName,
//           pathOut,
//           result?.details?.size || 0,
//           result?.transactionCount || 0,
//           ms,
//           result?.bankMatch || null,
//           result?.reason || "ok",
//           status,
//           errorMsg,
//         ],
//         function (err) {
//           if (err) reject(err);
//           else resolve(this.lastID);
//         }
        
//       );
//     });
//   }
  
// }
// // -----------------------------------------------------------------------------
// // EXPRESS SERVER + ADMIN DASHBOARD
// // -----------------------------------------------------------------------------
// const app = express();
// const server = http.createServer(app);

// app.use(cors());
// app.use(express.json());

// const backgroundService = new EmailBackgroundService();

// // ---------------------------------------------------
// // ✅ API ENDPOINTS
// // ---------------------------------------------------
// app.get("/api/status", (req, res) => {
//   res.json({
//     status: "running",
//     service: backgroundService.isRunning ? "active" : "inactive",
//     timestamp: new Date().toISOString(),
//     version: "2.0.0-merged",
//   });
// });

// app.get("/api/service/status", async (req, res) => {
//   try {
//     const stats = await new Promise((resolve, reject) => {
//       backgroundService.db.get(
//         `SELECT 
//            COUNT(*) as total,
//            COUNT(CASE WHEN status='success' THEN 1 END) as success,
//            COUNT(CASE WHEN status='rejected' THEN 1 END) as rejected,
//            COUNT(CASE WHEN status='error' THEN 1 END) as error
//          FROM processed_statements`,
//         (err, row) => (err ? reject(err) : resolve(row))
//       );
//     });

//     res.json({
//       running: backgroundService.isRunning,
//       config: backgroundService.currentConfig
//         ? {
//             email: backgroundService.currentConfig.email,
//             provider: backgroundService.currentConfig.email_provider,
//             checkInterval: backgroundService.currentConfig.check_interval,
//           }
//         : null,
//       statistics: stats,
//     });
//   } catch (e) {
//     res.status(500).json({ error: e.message });
//   }
// });

// app.post("/api/email/configure", async (req, res) => {
//   const cfg = req.body;
//   try {
//     if (!cfg.email || !cfg.appPassword)
//       return res.status(400).json({ error: "Email and App Password required" });

//     const provider = cfg.emailProvider || "gmail";
//     const host = cfg.imapHost || backgroundService.getDefaultHost(provider);
//     const port = cfg.imapPort ? parseInt(cfg.imapPort) : backgroundService.getDefaultPort(provider);

//     backgroundService.db.run("UPDATE email_configs SET is_active = false");

//     backgroundService.db.run(
//       `INSERT INTO email_configs 
//        (email_provider, imap_host, imap_port, email, app_password, check_interval, is_active)
//        VALUES (?, ?, ?, ?, ?, ?, 1)`,
//       [provider, host, port, cfg.email, cfg.appPassword, cfg.checkInterval || 3],
//       (err) => {
//         if (err) return res.status(500).json({ error: err.message });
//         backgroundService.currentConfig = {
//           email: cfg.email,
//           app_password: cfg.appPassword,
//           email_provider: provider,
//           imap_host: host,
//           imap_port: port,
//           check_interval: cfg.checkInterval || 3,
//         };
//         backgroundService.stop();
//         setTimeout(() => backgroundService.start(), 1500);
//         res.json({ success: true, message: "Configuration saved & service restarted" });
//       }
//     );
//   } catch (e) {
//     res.status(500).json({ error: e.message });
//   }
// });

// app.post("/api/service/start", async (req, res) => {
//   try {
//     await backgroundService.start();
//     res.json({ success: true, message: "Service started" });
//   } catch (e) {
//     res.status(500).json({ error: e.message });
//   }
// });

// app.post("/api/service/stop", (req, res) => {
//   backgroundService.stop();
//   res.json({ success: true, message: "Service stopped" });
// });

// app.get("/api/statements", async (req, res) => {
//   try {
//     const rows = await new Promise((resolve, reject) => {
//       backgroundService.db.all(
//         `SELECT ps.*, pe.subject, pe.from_email
//          FROM processed_statements ps
//          JOIN processed_emails pe ON ps.email_id = pe.id
//          ORDER BY ps.processed_date DESC LIMIT 50`,
//         (err, data) => (err ? reject(err) : resolve(data))
//       );
//     });
//     res.json({ statements: rows });
//   } catch (e) {
//     res.status(500).json({ error: e.message });
//   }
// });

// // -----------------------------------------------------------------------------
// // ADMIN DASHBOARD PAGE (same look, now live scanner integrated)
// // -----------------------------------------------------------------------------
// app.get("/admin", (req, res) => {
//   res.send(`
//   <!DOCTYPE html>
//   <html>
//   <head>
//     <title>Email Background Service Admin</title>
//     <style>
//       body { font-family: Arial; margin: 40px; }
//       .card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 10px 0; }
//       button { padding: 8px 15px; margin: 4px; cursor: pointer; }
//       .success { color: green; } .error { color: red; } .warn { color: orange; }
//       input, select { padding: 8px; margin: 5px; width: 280px; }
//     </style>
//   </head>
//   <body>
//     <h1>📬 Email Background + Bank Scanner</h1>

//     <div class="card">
//       <h3>Service Control</h3>
//       <button onclick="startSvc()">Start</button>
//       <button onclick="stopSvc()">Stop</button>
//       <div id="svcStatus">Loading...</div>
//     </div>

//     <div class="card">
//       <h3>Email Configuration</h3>
//       <form id="cfgForm">
//         <input type="email" name="email" placeholder="Email" required><br>
//         <input type="password" name="appPassword" placeholder="App Password" required><br>
//         <select name="emailProvider" id="provSel">
//           <option value="gmail">Gmail</option>
//           <option value="outlook">Outlook</option>
//           <option value="yahoo">Yahoo</option>
//         </select><br>
//         <input type="text" name="imapHost" placeholder="IMAP Host"><br>
//         <input type="number" name="imapPort" placeholder="Port (993)" value="993"><br>
//         <button type="submit">Save Config</button>
//       </form>
//       <div id="cfgResult"></div>
//     </div>

//     <div class="card">
//       <h3>Processed Statements</h3>
//       <button onclick="loadStatements()">Refresh</button>
//       <div id="stmts"></div>
//     </div>

//     <script>
//       async function api(url, method='GET', body=null) {
//         const res = await fetch(url, {
//           method, headers: {'Content-Type':'application/json'},
//           body: body ? JSON.stringify(body): undefined
//         });
//         return res.json();
//       }

//       async function startSvc(){
//         const r = await api('/api/service/start','POST');
//         show('svcStatus', r);
//         loadStatus();
//       }
//       async function stopSvc(){
//         const r = await api('/api/service/stop','POST');
//         show('svcStatus', r);
//         loadStatus();
//       }

//       document.getElementById('cfgForm').onsubmit = async e=>{
//         e.preventDefault();
//         const f=new FormData(e.target);
//         const body=Object.fromEntries(f.entries());
//         const r = await api('/api/email/configure','POST',body);
//         show('cfgResult',r);
//         loadStatus();
//       };

//       async function loadStatus(){
//         const s=await api('/api/service/status');
//         let html = s.running ? '🟢 Running' : '🔴 Stopped';
//         if(s.config) html += '<br>Email: '+s.config.email;
//         html += '<br>Total: '+(s.statistics?.total || 0);
//         document.getElementById('svcStatus').innerHTML=html;
//       }

//       async function loadStatements(){
//         const r=await api('/api/statements');
//         const div=document.getElementById('stmts');
//         if(!r.statements || !r.statements.length) return div.innerHTML='No data yet';
//         div.innerHTML=r.statements.map(s=>\`
//           <div style="border-bottom:1px solid #eee;padding:6px">
//             <b>\${s.original_filename}</b><br>
//             Bank: \${s.bank_name || 'N/A'} | Status: \${s.status} | Date: \${new Date(s.processed_date).toLocaleString()}
//           </div>\`).join('');
//       }

//       function show(id,obj){
//         const el=document.getElementById(id);
//         if(obj.success) el.innerHTML='<span class="success">✅ '+(obj.message||'OK')+'</span>';
//         else el.innerHTML='<span class="error">❌ '+(obj.error||'Failed')+'</span>';
//       }

//       loadStatus();
//       loadStatements();
//       setInterval(loadStatus,8000);
//     </script>
//   </body>
//   </html>
//   `);
// });

// // -----------------------------------------------------------------------------
// // SERVER STARTUP AND PORT MANAGEMENT
// // -----------------------------------------------------------------------------
// async function savePortToFile(port) {
//   try { await fs.writeFile("service.port", String(port), "utf8"); }
//   catch (e) { console.warn("⚠️ Could not save port file:", e.message); }
// }

// async function readPortFromFile() {
//   try { return parseInt(await fs.readFile("service.port", "utf8")); }
//   catch { return null; }
// }

// async function startServer() {
//   try {
//     console.log("Server started")
//     let port = await readPortFromFile();
//     if (!port) port = await findAvailablePort(3001, 10);
//     await savePortToFile(port);
//     server.listen(port, () => {
//       console.log(`🚀 Email + Scanner Service running on http://localhost:${port}`);
//       console.log(`📊 Admin: http://localhost:${port}/admin`);
//       console.log("✅ IMAP + File Classification Active");
//     });
//   } catch (e) {
//     console.error("❌ Failed to start server:", e);
//     process.exit(1);
//   }
// }

// process.on("SIGINT", () => {
//   console.log("\n🛑 Shutting down gracefully...");
//   backgroundService.stop();
//   server.close(() => process.exit(0));
// });
// process.on("SIGTERM", () => {
//   backgroundService.stop();
//   server.close(() => process.exit(0));
// });

// startServer();




// /**
//  * ===============================
//  *  EMAIL BACKGROUND SERVICE
//  * ===============================
//  * Completely Fixed Version
//  */

// console.log("🟢 server.js - Starting Completely Fixed Email Attachment Collector");
// const { execSync } = require('child_process');
// const express = require("express");
// const cors = require("cors");
// const sqlite3 = require("sqlite3").verbose();
// const path = require("path");
// const fs = require("fs").promises;
// const http = require("http");
// const imaps = require("imap-simple");
// const crypto = require("crypto");
// const AdmZip = require("adm-zip");

// // -----------------------------------------------------------------------------
// // ERROR HANDLING
// // -----------------------------------------------------------------------------
// process.on("uncaughtException", (err) => {
//   console.error("❌ UNCAUGHT EXCEPTION:", err);
// });

// process.on("unhandledRejection", (reason, promise) => {
//   console.error("❌ UNHANDLED REJECTION at:", promise, "reason:", reason);
// });

// // -----------------------------------------------------------------------------
// // PORT DISCOVERY
// // -----------------------------------------------------------------------------
// function findAvailablePort(startPort = 3001, maxAttempts = 20) {
//   const net = require("net");
//   return new Promise((resolve, reject) => {
//     let port = startPort;
//     let tries = 0;
    
//     const tryNext = () => {
//       if (tries >= maxAttempts) {
//         return reject(new Error(`No free ports ${startPort}-${startPort + maxAttempts}`));
//       }
      
//       const server = net.createServer();
      
//       server.once("error", (e) => {
//         if (e.code === "EADDRINUSE") {
//           port++;
//           tries++;
//           setTimeout(tryNext, 100);
//         } else {
//           reject(e);
//         }
//       });
      
//       server.once("listening", () => {
//         server.close();
//         resolve(port);
//       });
      
//       server.listen(port);
//     };
    
//     tryNext();
//   });
// }

// // -----------------------------------------------------------------------------
// // EMAIL BACKGROUND SERVICE
// // -----------------------------------------------------------------------------
// class EmailBackgroundService {
//   constructor() {
//     console.log("🟢 EmailBackgroundService initialized");
//     this.isRunning = false;
//     this.db = null;
//     this.currentConfig = null;
//     this.intervalId = null;
    
//     // ONLY these specific file formats
//     this.supportedFormats = [
//       '.pdf',           // PDF documents
//       '.xlsx', '.xls',  // Excel files
//       '.csv',           // CSV files
//       '.xml',           // XML files
//       '.zip'            // ZIP archives
//     ];
    
//     // Define absolute paths
//     this.baseDir = __dirname;
//     this.storageDir = path.join(this.baseDir, "storage");
//     this.inputDir = path.join(this.storageDir, "input");
//     this.databasesDir = path.join(this.storageDir, "databases");
    
//     console.log("📁 Paths initialized:");
//     console.log(`   - Base: ${this.baseDir}`);
//     console.log(`   - Input: ${this.inputDir}`);
//   }

//   async init() {
//     console.log("🟢 Initializing EmailBackgroundService...");
//     await this.createDirectories();
//     await this.initDatabase();
//     await this.loadConfig();
//     console.log("✅ EmailBackgroundService initialized");
    
//     // Auto-start the service if configuration exists
//     if (this.currentConfig) {
//       console.log("🚀 Auto-starting email scanning service...");
//       await this.start();
//     } else {
//       console.log("⏳ No email configuration found. Please configure email via admin panel.");
//     }
//   }

//   async createDirectories() {
//     console.log("📁 Creating necessary directories...");
//     try {
//       await fs.mkdir(this.storageDir, { recursive: true });
//       await fs.mkdir(this.inputDir, { recursive: true });
//       await fs.mkdir(this.databasesDir, { recursive: true });
//       console.log(`✅ Directories created successfully`);
//     } catch (error) {
//       console.error("❌ Error creating directories:", error.message);
//       throw error;
//     }
//   }

//   async initDatabase() {
//     console.log("🟢 Initializing database...");
    
//     const dbPath = path.join(this.databasesDir, "email-service.db");
//     console.log(`📁 Database path: ${dbPath}`);
    
//     return new Promise((resolve, reject) => {
//       this.db = new sqlite3.Database(dbPath, (err) => {
//         if (err) {
//           console.error("❌ Database connection failed:", err);
//           return reject(err);
//         }
        
//         console.log("✅ Database connected");
        
//         // Create tables
//         this.db.serialize(() => {
//           this.db.run(`
//             CREATE TABLE IF NOT EXISTS email_configs (
//               id INTEGER PRIMARY KEY AUTOINCREMENT,
//               email_provider TEXT DEFAULT 'gmail',
//               imap_host TEXT,
//               imap_port INTEGER,
//               email TEXT,
//               app_password TEXT,
//               check_interval INTEGER DEFAULT 3,
//               is_active BOOLEAN DEFAULT true,
//               created_at DATETIME DEFAULT CURRENT_TIMESTAMP
//             )
//           `);

//           this.db.run(`
//             CREATE TABLE IF NOT EXISTS processed_emails (
//               id INTEGER PRIMARY KEY AUTOINCREMENT,
//               message_id TEXT UNIQUE,
//               subject TEXT,
//               from_email TEXT,
//               received_date DATETIME,
//               processed_date DATETIME DEFAULT CURRENT_TIMESTAMP,
//               has_attachments BOOLEAN DEFAULT false,
//               status TEXT DEFAULT 'processed'
//             )
//           `);

//           this.db.run(`
//             CREATE TABLE IF NOT EXISTS saved_attachments (
//               id INTEGER PRIMARY KEY AUTOINCREMENT,
//               email_id INTEGER,
//               original_filename TEXT,
//               saved_file_path TEXT,
//               file_hash TEXT UNIQUE,
//               file_size INTEGER,
//               file_type TEXT,
//               processed_date DATETIME DEFAULT CURRENT_TIMESTAMP,
//               FOREIGN KEY(email_id) REFERENCES processed_emails(id)
//             )
//           `, (err) => {
//             if (err) reject(err);
//             else {
//               console.log("✅ Database tables ready");
//               resolve();
//             }
//           });
//         });
//       });
//     });
//   }

//   async loadConfig() {
//     console.log("🟢 Loading email configuration...");
    
//     return new Promise((resolve, reject) => {
//       this.db.get(
//         "SELECT * FROM email_configs WHERE is_active = true ORDER BY created_at DESC LIMIT 1",
//         (err, row) => {
//           if (err) {
//             console.error("❌ Error loading config:", err);
//             reject(err);
//           } else {
//             this.currentConfig = row;
//             if (row) {
//               console.log("✅ Active configuration found for:", row.email);
//             } else {
//               console.log("ℹ️ No active configuration found");
//             }
//             resolve(row);
//           }
//         }
//       );
//     });
//   }

//   async start() {
//     console.log("🚀 Starting background email service...");
    
//     if (!this.currentConfig) {
//       console.log("⏳ No email configuration found. Please configure email first.");
//       return;
//     }

//     if (this.isRunning) {
//       console.log("⚠️ Service already running");
//       return;
//     }

//     this.isRunning = true;
    
//     // Initial scan
//     console.log("🔍 Performing initial email scan...");
//     await this.checkEmails();
    
//     // Set up interval for scanning
//     const intervalMinutes = this.currentConfig.check_interval || 3;
//     const intervalMs = intervalMinutes * 60 * 1000;
    
//     this.intervalId = setInterval(async () => {
//       if (this.isRunning) {
//         console.log(`⏰ Scheduled email check (every ${intervalMinutes} minutes)`);
//         await this.checkEmails();
//       }
//     }, intervalMs);

//     console.log(`✅ Background service started. Checking emails every ${intervalMinutes} minutes`);
//   }

//   stop() {
//     console.log("🛑 Stopping background service...");
//     this.isRunning = false;
//     if (this.intervalId) {
//       clearInterval(this.intervalId);
//       this.intervalId = null;
//     }
//     console.log("✅ Background service stopped");
//   }

//   async checkEmails() {
//     if (!this.currentConfig || !this.isRunning) {
//       console.log("❌ Service not running or no configuration");
//       return;
//     }

//     console.log("📧 Checking for emails with supported attachments...");

//     const config = {
//       imap: {
//         user: this.currentConfig.email,
//         password: this.currentConfig.app_password,
//         host: this.currentConfig.imap_host || 'imap.gmail.com',
//         port: this.currentConfig.imap_port || 993,
//         tls: true,
//         tlsOptions: { rejectUnauthorized: false },
//         authTimeout: 30000
//       }
//     };

//     try {
//       const connection = await imaps.connect(config);
//       await connection.openBox("INBOX");

//       // Search for ALL emails (not just unseen) to ensure we capture everything
//       const searchCriteria = ['ALL'];
//       const fetchOptions = { 
//         bodies: ['HEADER'], 
//         struct: true 
//       };

//       const messages = await connection.search(searchCriteria, fetchOptions);
//       console.log(`📨 Found ${messages.length} emails in inbox`);

//       let processedCount = 0;
//       for (const msg of messages) {
//         try {
//           const processed = await this.processEmail(msg, connection);
//           if (processed) processedCount++;
//         } catch (error) {
//           console.error("❌ Error processing email:", error.message);
//         }
//       }

//       connection.end();
//       console.log(`✅ Email check complete. Processed ${processedCount} emails with attachments`);
      
//     } catch (error) {
//       console.error("❌ Email check failed:", error.message);
//       if (error.source === "authentication") {
//         console.log("🔐 Authentication failed. Please check your email and app password.");
//       }
//     }
//   }

//   async processEmail(msg, connection) {
//     try {
//       const headers = msg.parts.find(p => p.which === "HEADER").body;
//       const subject = headers.subject?.[0] || "(no subject)";
//       const from = headers.from?.[0] || "";
//       const date = headers.date?.[0] || new Date().toISOString();
//       const messageId = headers["message-id"]?.[0] || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

//       // Check if email is already processed
//       if (await this.isEmailProcessed(messageId)) {
//         console.log(`⏩ Skipping already processed email: "${subject}"`);
//         return false;
//       }

//       console.log(`📩 Processing email: "${subject}"`);

//       // Find only supported attachments (PDF, XLSX, CSV, XML, ZIP)
//       const attachments = this.findSupportedAttachments(msg.attributes.struct);
      
//       if (attachments.length === 0) {
//         console.log("📭 No supported attachments found in this email");
        
//         // Mark email as processed even if no attachments
//         await this.saveEmailInfo({
//           messageId,
//           subject,
//           from,
//           date,
//           hasAttachments: false
//         });
//         return false;
//       }

//       console.log(`📎 Found ${attachments.length} supported attachment(s)`);

//       // Save email info to database
//       const emailId = await this.saveEmailInfo({
//         messageId,
//         subject,
//         from,
//         date,
//         hasAttachments: true
//       });

//       // Download and save attachments
//       let savedCount = 0;
//       for (const attachment of attachments) {
//         try {
//           const filename = attachment.disposition?.params?.filename || attachment.params?.name;
//           if (!filename) {
//             console.log("⚠️ Attachment without filename, skipping");
//             continue;
//           }

//           console.log(`📥 Downloading attachment: ${filename}`);
//           const data = await connection.getPartData(msg, attachment);
//           console.log(`📦 Attachment data size: ${data.length} bytes`);
          
//           if (!data || data.length === 0) {
//             console.log("⚠️ Empty attachment data, skipping");
//             continue;
//           }
          
//           const saved = await this.saveAttachment(filename, data, emailId);
          
//           if (saved) savedCount++;
          
//         } catch (error) {
//           console.error(`❌ Error processing attachment ${filename}:`, error.message);
//         }
//       }

//       console.log(`✅ Saved ${savedCount} file(s) from email: "${subject}"`);
//       return savedCount > 0;
//     } catch (error) {
//       console.error(`❌ Error processing email:`, error.message);
//       return false;
//     }
//   }

//   async isEmailProcessed(messageId) {
//     if (!messageId) return false;
    
//     return new Promise((resolve) => {
//       this.db.get(
//         "SELECT 1 FROM processed_emails WHERE message_id = ? LIMIT 1",
//         [messageId],
//         (err, row) => {
//           if (err) {
//             console.error("❌ Database error checking email:", err.message);
//             resolve(false);
//           } else {
//             resolve(!!row);
//           }
//         }
//       );
//     });
//   }

//   findSupportedAttachments(struct, attachments = []) {
//     if (!struct) return attachments;

//     if (Array.isArray(struct)) {
//       struct.forEach(s => this.findSupportedAttachments(s, attachments));
//       return attachments;
//     }

//     // Check if this part is an attachment
//     const disposition = struct.disposition;
//     const params = struct.params;
//     const filename = disposition?.params?.filename || params?.name;
    
//     if (filename) {
//       const extension = path.extname(filename).toLowerCase();
//       const isSupported = this.supportedFormats.includes(extension);
      
//       if (isSupported) {
//         console.log(`✅ Found supported attachment: ${filename}`);
//         attachments.push(struct);
//       }
//     }

//     // Recursively search subparts
//     if (struct.parts && Array.isArray(struct.parts)) {
//       struct.parts.forEach(s => this.findSupportedAttachments(s, attachments));
//     }

//     return attachments;
//   }

//   // async saveAttachment(filename, data, emailId) {
//   //   try {
//   //     console.log(`💾 Starting file save process for: ${filename}`);
      
//   //     // Ensure input directory exists
//   //     await fs.mkdir(this.inputDir, { recursive: true });
//   //     console.log(`📁 Input directory: ${this.inputDir}`);

//   //     // Generate file hash to prevent duplicates
//   //     const fileHash = crypto.createHash('sha256').update(data).digest('hex');
//   //     console.log(`🔐 File hash: ${fileHash.substring(0, 16)}...`);
      
//   //     // Check if file already exists (by hash)
//   //     if (await this.isFileAlreadySaved(fileHash)) {
//   //       console.log(`⏩ Skipping duplicate file: ${filename}`);
//   //       return false;
//   //     }

//   //     const extension = path.extname(filename).toLowerCase();
//   //     const baseName = path.basename(filename, extension);
      
//   //     // Clean filename and ensure it's unique
//   //     const cleanBaseName = baseName.replace(/[^a-zA-Z0-9._-]/g, "_");
//   //     const timestamp = Date.now();
//   //     const finalFilename = `${timestamp}_${cleanBaseName}${extension}`;
//   //     const filePath = path.join(this.inputDir, finalFilename);

//   //     console.log(`📄 Final file path: ${filePath}`);
//   //     console.log(`💿 Writing ${data.length} bytes to disk...`);

//   //     // Save the file with explicit error handling
//   //     try {
//   //       await fs.writeFile(filePath, data);
//   //       console.log(`✅ File successfully written to: ${filePath}`);
        
//   //       // Verify the file was actually written
//   //       const stats = await fs.stat(filePath);
//   //       console.log(`📊 File verification: ${stats.size} bytes on disk`);
        
//   //       if (stats.size === 0) {
//   //         console.error(`❌ File is empty after writing`);
//   //         await fs.unlink(filePath).catch(() => {}); // Clean up empty file
//   //         return false;
//   //       }
        
//   //       console.log(`✅ File saved successfully: ${finalFilename}`);
        
//   //     } catch (writeError) {
//   //       console.error(`❌ File write error:`, writeError.message);
//   //       return false;
//   //     }
      
//   //     // Handle ZIP files - extract only supported formats from ZIP
//   //     if (extension === '.zip') {
//   //       await this.extractZipFile(filePath, this.inputDir, emailId);
//   //     }
      
//   //     // Save attachment info to database
//   //     try {
//   //       await this.saveAttachmentInfo({
//   //         emailId,
//   //         originalFilename: filename,
//   //         savedFilePath: filePath,
//   //         fileHash,
//   //         fileSize: data.length,
//   //         fileType: extension
//   //       });
//   //       console.log(`💾 Database record created for: ${finalFilename}`);
//   //     } catch (dbError) {
//   //       console.error(`❌ Database save error:`, dbError.message);
//   //       // Continue even if database save fails - file is still saved
//   //     }
      
//   //     return true;
      
//   //   } catch (error) {
//   //     console.error(`❌ Critical error saving file ${filename}:`, error.message);
//   //     return false;
//   //   }
//   // }
//   async saveAttachment(filename, data, emailId) {
//   try {
//     // ... existing file saving code ...
    
//     // After successfully saving the file
//     if (saved) {
//       console.log(`✅ File saved successfully: ${finalFilename}`);
      
//       // 🔥 NEW: Trigger classification for supported file types
//       if (['.pdf', '.xlsx', '.xls', '.csv'].includes(extension)) {
//         setTimeout(() => {
//           this.classifyFile(filePath);
//         }, 1000); // Small delay to ensure file is fully written
//       }
//     }
    
//     return saved;
    
//   } catch (error) {
//     console.error(`❌ Critical error saving file ${filename}:`, error.message);
//     return false;
//   }
// }




//   // async extractZipFile(zipPath, outputFolder, emailId) {
//   //   try {
//   //     console.log(`📦 Extracting ZIP file: ${path.basename(zipPath)}`);
//   //     const zip = new AdmZip(zipPath);
//   //     const zipEntries = zip.getEntries();
      
//   //     let extractedCount = 0;
      
//   //     for (const entry of zipEntries) {
//   //       if (entry.isDirectory) continue;
        
//   //       const entryName = entry.entryName;
//   //       const entryExtension = path.extname(entryName).toLowerCase();
        
//   //       // Only extract our specific supported file types from ZIP
//   //       if (this.supportedFormats.includes(entryExtension)) {
//   //         const entryData = entry.getData();
//   //         const entryHash = crypto.createHash('sha256').update(entryData).digest('hex');
          
//   //         // Check for duplicates
//   //         if (!await this.isFileAlreadySaved(entryHash)) {
//   //           const timestamp = Date.now();
//   //           const cleanName = path.basename(entryName, entryExtension).replace(/[^a-zA-Z0-9._-]/g, "_");
//   //           const finalName = `${timestamp}_ZIP_${cleanName}${entryExtension}`;
//   //           const finalPath = path.join(outputFolder, finalName);
            
//   //           await fs.writeFile(finalPath, entryData);
            
//   //           await this.saveAttachmentInfo({
//   //             emailId,
//   //             originalFilename: `ZIP:${entryName}`,
//   //             savedFilePath: finalPath,
//   //             fileHash: entryHash,
//   //             fileSize: entryData.length,
//   //             fileType: entryExtension
//   //           });
            
//   //           console.log(`   📁 Extracted from ZIP: ${finalName}`);
//   //           extractedCount++;
//   //         } else {
//   //           console.log(`   ⏩ Skipping duplicate from ZIP: ${entryName}`);
//   //         }
//   //       } else {
//   //         console.log(`   ❌ Skipping unsupported format in ZIP: ${entryName} (${entryExtension})`);
//   //       }
//   //     }
      
//   //     console.log(`✅ Extracted ${extractedCount} supported files from ZIP`);
      
//   //   } catch (error) {
//   //     console.error(`❌ Error extracting ZIP file:`, error.message);
//   //   }
//   // }

//   async extractZipFile(zipPath, outputFolder, emailId) {
//   try {
//     // ... existing ZIP extraction code ...
    
//     for (const entry of zipEntries) {
//       // ... existing extraction logic ...
      
//       if (saved) {
//         console.log(`   📁 Extracted from ZIP: ${finalName}`);
//         extractedCount++;
        
//         // 🔥 NEW: Trigger classification for extracted files
//         if (['.pdf', '.xlsx', '.xls', '.csv'].includes(entryExtension)) {
//           setTimeout(() => {
//             this.classifyFile(finalPath);
//           }, 1000);
//         }
//       }
//     }
    
//     // ... rest of the method ...
//   } catch (error) {
//     console.error(`❌ Error extracting ZIP file:`, error.message);
//   }
// }

//   async isFileAlreadySaved(fileHash) {
//     return new Promise((resolve) => {
//       this.db.get(
//         "SELECT 1 FROM saved_attachments WHERE file_hash = ? LIMIT 1",
//         [fileHash],
//         (err, row) => {
//           if (err) {
//             console.error("❌ Database error checking file hash:", err.message);
//             resolve(false);
//           } else {
//             resolve(!!row);
//           }
//         }
//       );
//     });
//   }

//   async saveEmailInfo(email) {
//     return new Promise((resolve, reject) => {
//       this.db.run(
//         `INSERT INTO processed_emails (message_id, subject, from_email, received_date, has_attachments)
//          VALUES (?, ?, ?, ?, ?)`,
//         [email.messageId, email.subject, email.from, email.date, email.hasAttachments],
//         function (err) {
//           if (err) {
//             // If it's a duplicate, that's fine - just resolve with null
//             if (err.message.includes('UNIQUE')) {
//               resolve(null);
//             } else {
//               reject(err);
//             }
//           } else {
//             resolve(this.lastID);
//           }
//         }
//       );
//     });
//   }

//   async saveAttachmentInfo(attachment) {
//     return new Promise((resolve, reject) => {
//       this.db.run(
//         `INSERT INTO saved_attachments (email_id, original_filename, saved_file_path, file_hash, file_size, file_type)
//          VALUES (?, ?, ?, ?, ?, ?)`,
//         [
//           attachment.emailId,
//           attachment.originalFilename,
//           attachment.savedFilePath,
//           attachment.fileHash,
//           attachment.fileSize,
//           attachment.fileType
//         ],
//         function (err) {
//           if (err) {
//             // If duplicate hash, it's okay - we skip the file
//             if (err.message.includes('UNIQUE')) {
//               resolve(null);
//             } else {
//               reject(err);
//             }
//           } else {
//             resolve(this.lastID);
//           }
//         }
//       );
//     });
//   }

//   formatFileSize(bytes) {
//     if (bytes === 0) return '0 Bytes';
//     const k = 1024;
//     const sizes = ['Bytes', 'KB', 'MB', 'GB'];
//     const i = Math.floor(Math.log(bytes) / Math.log(k));
//     return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
//   }

//   async configure(config) {
//     console.log("🟢 Configuring email service...");
    
//     return new Promise((resolve, reject) => {
//       // Deactivate all other configs
//       this.db.run("UPDATE email_configs SET is_active = false", (err) => {
//         if (err) {
//           console.error("❌ Error deactivating old configs:", err);
//           return reject(err);
//         }

//         // Insert new config
//         this.db.run(
//           `INSERT INTO email_configs 
//            (email_provider, imap_host, imap_port, email, app_password, check_interval, is_active)
//            VALUES (?, ?, ?, ?, ?, ?, 1)`,
//           [
//             config.emailProvider || 'gmail',
//             config.imapHost || 'imap.gmail.com',
//             config.imapPort || 993,
//             config.email,
//             config.appPassword,
//             config.checkInterval || 3
//           ],
//           (err) => {
//             if (err) {
//               console.error("❌ Error saving configuration:", err);
//               reject(err);
//             } else {
//               this.currentConfig = {
//                 email: config.email,
//                 email_provider: config.emailProvider || 'gmail',
//                 check_interval: config.checkInterval || 3
//               };
//               console.log("✅ Configuration saved successfully");
              
//               // Auto-restart service with new config
//               this.stop();
//               setTimeout(() => this.start(), 2000);
              
//               resolve();
//             }
//           }
//         );
//       });
//     });
//   }

//   // Get statistics
//   async getStats() {
//     return new Promise((resolve, reject) => {
//       this.db.get(
//         `SELECT 
//           COUNT(*) as total_emails,
//           COUNT(CASE WHEN has_attachments = 1 THEN 1 END) as emails_with_attachments,
//           (SELECT COUNT(*) FROM saved_attachments) as total_files,
//           (SELECT GROUP_CONCAT(DISTINCT file_type) FROM saved_attachments) as file_types
//         FROM processed_emails`,
//         (err, row) => {
//           if (err) reject(err);
//           else resolve(row);
//         }
//       );
//     });
//   }

//   // Get files
//   async getFiles() {
//     return new Promise((resolve, reject) => {
//       this.db.all(
//         `SELECT sa.*, pe.subject, pe.from_email 
//          FROM saved_attachments sa 
//          JOIN processed_emails pe ON sa.email_id = pe.id 
//          ORDER BY sa.processed_date DESC LIMIT 50`,
//         (err, rows) => {
//           if (err) reject(err);
//           else resolve(rows);
//         }
//       );
//     });
//   }

//   // Debug: List files in input folder
//   async listInputFiles() {
//     try {
//       const files = await fs.readdir(this.inputDir);
//       console.log(`📁 Files in input folder (${files.length}):`, files);
//       return files;
//     } catch (error) {
//       console.error("❌ Error listing input files:", error.message);
//       return [];
//     }
//   }

//   // Test file writing
//   async testFileWrite() {
//     try {
//       const testFile = path.join(this.inputDir, `test_${Date.now()}.txt`);
//       const testContent = 'This is a test file to verify write permissions';
//       await fs.writeFile(testFile, testContent);
//       console.log(`✅ Test file written: ${testFile}`);
      
//       // Verify it exists
//       const stats = await fs.stat(testFile);
//       console.log(`✅ Test file verified: ${stats.size} bytes`);
      
//       // Read it back to verify
//       const content = await fs.readFile(testFile, 'utf8');
//       if (content === testContent) {
//         console.log(`✅ Test file content verified`);
//       } else {
//         console.error(`❌ Test file content mismatch`);
//       }
      
//       // Clean up
//       await fs.unlink(testFile);
//       console.log(`✅ Test file cleaned up`);
      
//       return true;
//     } catch (error) {
//       console.error(`❌ Test file write failed:`, error.message);
//       return false;
//     }
//   }
//   // Add this method to the EmailBackgroundService class
// async triggerClassification() {
//   try {
//     console.log("🔍 Triggering bank statement classification...");
    
//     // Check if there are files in the input directory
//     const files = await fs.readdir(this.inputDir);
//     const supportedFiles = files.filter(file => {
//       const ext = path.extname(file).toLowerCase();
//       return ['.pdf', '.xlsx', '.xls', '.csv'].includes(ext);
//     });
    
//     if (supportedFiles.length === 0) {
//       console.log("📭 No files to classify in input folder");
//       return;
//     }
    
//     console.log(`🎯 Found ${supportedFiles.length} file(s) to classify`);
    
//     // Trigger Python classifier for each file
//     for (const file of supportedFiles) {
//       const filePath = path.join(this.inputDir, file);
//       await this.classifyFile(filePath);
//     }
    
//   } catch (error) {
//     console.error("❌ Error triggering classification:", error.message);
//   }
// }

// async classifyFile(filePath) {
//   try {
//     console.log(`🤖 Classifying: ${path.basename(filePath)}`);
    
//     // Use the Python classifier
//     const result = execSync(`python run_classifier.py "${filePath}"`, {
//       encoding: 'utf8',
//       cwd: __dirname // Run from current directory
//     });
    
//     console.log(`✅ Classification result for ${path.basename(filePath)}:`, result);
    
//   } catch (error) {
//     console.error(`❌ Classification failed for ${path.basename(filePath)}:`, error.message);
//   }
// }
// }

// // -----------------------------------------------------------------------------
// // EXPRESS SERVER SETUP
// // -----------------------------------------------------------------------------
// const app = express();
// const server = http.createServer(app);

// app.use(cors());
// app.use(express.json());

// // Initialize background service
// const backgroundService = new EmailBackgroundService();

// // -----------------------------------------------------------------------------
// // API ENDPOINTS
// // -----------------------------------------------------------------------------

// // Health check
// app.get("/", (req, res) => {
//   res.json({ 
//     status: "running", 
//     service: "Fixed Email Attachment Collector",
//     auto_start: true,
//     scanning: backgroundService.isRunning,
//     supported_formats: ["PDF", "XLSX", "XLS", "CSV", "XML", "ZIP"],
//     timestamp: new Date().toISOString() 
//   });
// });

// // Service status
// app.get("/api/status", async (req, res) => {
//   try {
//     const stats = await backgroundService.getStats();
//     const files = await backgroundService.listInputFiles();
    
//     res.json({
//       running: backgroundService.isRunning,
//       config: backgroundService.currentConfig,
//       statistics: stats,
//       input_files: files,
//       input_folder: backgroundService.inputDir,
//       auto_start: true,
//       supported_formats: backgroundService.supportedFormats,
//       timestamp: new Date().toISOString()
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // Start service (manual override)
// app.post("/api/service/start", async (req, res) => {
//   try {
//     await backgroundService.start();
//     res.json({ success: true, message: "Service started successfully" });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // Stop service
// app.post("/api/service/stop", (req, res) => {
//   backgroundService.stop();
//   res.json({ success: true, message: "Service stopped successfully" });
// });

// // Configure email
// app.post("/api/email/configure", async (req, res) => {
//   try {
//     const config = req.body;
    
//     if (!config.email || !config.appPassword) {
//       return res.status(400).json({ 
//         error: "Email and App Password are required" 
//       });
//     }

//     await backgroundService.configure(config);
//     res.json({ success: true, message: "Configuration saved and service auto-started" });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }

//   // Manual classification trigger
// app.post("/api/classify/now", async (req, res) => {
//   try {
//     console.log("🔍 Manual classification triggered via API");
//     await backgroundService.triggerClassification();
//     res.json({ success: true, message: "Classification process completed" });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // Get classification status
// app.get("/api/classify/status", async (req, res) => {
//   try {
//     const inputFiles = await backgroundService.listInputFiles();
//     const outputDir = path.join(__dirname, "output", "unprocessed");
    
//     let classifiedFiles = [];
//     try {
//       classifiedFiles = await fs.readdir(outputDir);
//     } catch (e) {
//       // Output directory might not exist yet
//     }
    
//     res.json({
//       input_files: inputFiles,
//       input_count: inputFiles.length,
//       classified_files: classifiedFiles,
//       classified_count: classifiedFiles.length,
//       input_folder: backgroundService.inputDir,
//       output_folder: outputDir
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// });

// // Manual trigger for email check
// app.post("/api/email/check-now", async (req, res) => {
//   try {
//     console.log("🔍 Manual email check triggered via API");
//     await backgroundService.checkEmails();
//     res.json({ success: true, message: "Manual email check completed" });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // Get saved files
// app.get("/api/files", async (req, res) => {
//   try {
//     const files = await backgroundService.getFiles();
//     const inputFiles = await backgroundService.listInputFiles();
    
//     res.json({ 
//       files,
//       input_files: inputFiles,
//       count: files.length 
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
//   const result = execSync(`python run_classifier.py "${pdfPath}"`, {encoding: 'utf8'});
// });

// // Test file writing
// app.get("/api/test-file-write", async (req, res) => {
//   try {
//     const result = await backgroundService.testFileWrite();
//     res.json({ 
//       success: result,
//       message: result ? "File writing test passed" : "File writing test failed"
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // Debug: List input folder contents
// app.get("/api/debug/input-files", async (req, res) => {
//   try {
//     const files = await backgroundService.listInputFiles();
//     res.json({ 
//       input_folder: backgroundService.inputDir,
//       files: files,
//       count: files.length
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // -----------------------------------------------------------------------------
// // SERVER STARTUP
// // -----------------------------------------------------------------------------
// async function startServer() {
//   try {
//     console.log("🚀 STARTING COMPLETELY FIXED EMAIL ATTACHMENT COLLECTOR");
    
//     const port = await findAvailablePort(3001, 10);
//     console.log(`✅ Found available port: ${port}`);
    
//     // Initialize background service (this will auto-start if config exists)
//     await backgroundService.init();
//     console.log("✅ Background service initialized");
    
//     // Test file writing permissions
//     console.log("🧪 Testing file writing permissions...");
//     const writeTest = await backgroundService.testFileWrite();
//     if (!writeTest) {
//       console.error("❌ CRITICAL: File writing test failed! Check directory permissions.");
//     }
    
//     server.listen(port, () => {
//       console.log("=".repeat(60));
//       console.log(`✅ SERVER STARTED SUCCESSFULLY!`);
//       console.log(`📍 Local: http://localhost:${port}`);
//       console.log(`📊 Status: http://localhost:${port}/api/status`);
//       console.log(`🐛 Debug: http://localhost:${port}/api/debug/input-files`);
//       console.log(`🧪 Test: http://localhost:${port}/api/test-file-write`);
//       console.log("=".repeat(60));
//       console.log("🚀 AUTO-START FEATURE:");
//       if (backgroundService.isRunning) {
//         console.log("✅ Email scanning service is RUNNING automatically");
//       } else {
//         console.log("⏳ Configure email via API to auto-start scanning");
//       }
//       console.log("📁 FILE PATHS:");
//       console.log(`   - Input folder: ${backgroundService.inputDir}`);
//       console.log(`   - File writing test: ${writeTest ? '✅ PASSED' : '❌ FAILED'}`);
//       console.log("=".repeat(60));
//     });
    
//   } catch (error) {
//     console.error("❌ Failed to start server:", error);
//     process.exit(1);
//   }
// }

// // Graceful shutdown
// process.on("SIGINT", () => {
//   console.log("\n🛑 Shutting down gracefully...");
//   backgroundService.stop();
//   server.close(() => process.exit(0));
// });

// // Start the server
// startServer();

























