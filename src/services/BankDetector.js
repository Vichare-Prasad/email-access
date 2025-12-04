// src/services/BankDetector.js
// Detects bank name from filename, sender, or content

const config = require('../config');

class BankDetector {
  constructor() {
    this.senderDomains = config.bankSenderDomains || {};
    this.filenameKeywords = config.bankFilenameKeywords || {};
  }

  /**
   * Detect bank name from multiple sources
   * @param {Object} options
   * @param {string} options.filename - PDF filename
   * @param {string} options.sender - Email sender address
   * @param {string} options.subject - Email subject (optional)
   * @returns {Object} { name: string, method: string }
   */
  detect({ filename, sender, subject }) {
    // Try each detection method in priority order

    // Method 1: Filename parsing (highest priority)
    const filenameResult = this.detectFromFilename(filename);
    if (filenameResult.name && filenameResult.name !== 'Unknown') {
      return filenameResult;
    }

    // Method 2: Sender domain mapping
    const senderResult = this.detectFromSender(sender);
    if (senderResult.name && senderResult.name !== 'Unknown') {
      return senderResult;
    }

    // Method 3: Subject keywords (fallback)
    const subjectResult = this.detectFromSubject(subject);
    if (subjectResult.name && subjectResult.name !== 'Unknown') {
      return subjectResult;
    }

    // Unknown
    return { name: 'Unknown', method: 'unknown' };
  }

  /**
   * Detect bank from filename
   */
  detectFromFilename(filename) {
    if (!filename) {
      return { name: null, method: 'filename' };
    }

    const lowerFilename = filename.toLowerCase();

    // Check each keyword
    for (const [keyword, bankName] of Object.entries(this.filenameKeywords)) {
      if (lowerFilename.includes(keyword.toLowerCase())) {
        return { name: bankName, method: 'filename' };
      }
    }

    // Check for common bank patterns in filename
    const patterns = [
      { pattern: /hdfc/i, bank: 'HDFC Bank' },
      { pattern: /sbi|state\s*bank/i, bank: 'State Bank of India' },
      { pattern: /icici/i, bank: 'ICICI Bank' },
      { pattern: /axis/i, bank: 'Axis Bank' },
      { pattern: /kotak/i, bank: 'Kotak Mahindra Bank' },
      { pattern: /yes\s*bank/i, bank: 'Yes Bank' },
      { pattern: /indusind/i, bank: 'IndusInd Bank' },
      { pattern: /canara/i, bank: 'Canara Bank' },
      { pattern: /punjab|pnb/i, bank: 'Punjab National Bank' },
      { pattern: /baroda|bob/i, bank: 'Bank of Baroda' },
      { pattern: /union\s*bank/i, bank: 'Union Bank' },
      { pattern: /idbi/i, bank: 'IDBI Bank' },
      { pattern: /federal/i, bank: 'Federal Bank' },
      { pattern: /rbl/i, bank: 'RBL Bank' },
      { pattern: /bandhan/i, bank: 'Bandhan Bank' },
      { pattern: /sbm/i, bank: 'SBM Bank' },
    ];

    for (const { pattern, bank } of patterns) {
      if (pattern.test(filename)) {
        return { name: bank, method: 'filename' };
      }
    }

    return { name: null, method: 'filename' };
  }

  /**
   * Detect bank from sender email domain
   */
  detectFromSender(sender) {
    if (!sender) {
      return { name: null, method: 'sender' };
    }

    // Extract domain from email address
    const emailMatch = sender.match(/@([a-zA-Z0-9.-]+)/);
    if (!emailMatch) {
      return { name: null, method: 'sender' };
    }

    const domain = emailMatch[1].toLowerCase();

    // Direct domain match
    if (this.senderDomains[domain]) {
      return { name: this.senderDomains[domain], method: 'sender' };
    }

    // Partial domain match (e.g., alerts.sbi.co.in matches sbi.co.in)
    for (const [knownDomain, bankName] of Object.entries(this.senderDomains)) {
      if (domain.endsWith(knownDomain) || domain.includes(knownDomain.split('.')[0])) {
        return { name: bankName, method: 'sender' };
      }
    }

    // Pattern-based detection from sender domain
    const domainPatterns = [
      { pattern: /hdfc/i, bank: 'HDFC Bank' },
      { pattern: /sbi/i, bank: 'State Bank of India' },
      { pattern: /icici/i, bank: 'ICICI Bank' },
      { pattern: /axis/i, bank: 'Axis Bank' },
      { pattern: /kotak/i, bank: 'Kotak Mahindra Bank' },
      { pattern: /yesbank/i, bank: 'Yes Bank' },
      { pattern: /indusind/i, bank: 'IndusInd Bank' },
    ];

    for (const { pattern, bank } of domainPatterns) {
      if (pattern.test(domain)) {
        return { name: bank, method: 'sender' };
      }
    }

    return { name: null, method: 'sender' };
  }

  /**
   * Detect bank from email subject
   */
  detectFromSubject(subject) {
    if (!subject) {
      return { name: null, method: 'subject' };
    }

    const lowerSubject = subject.toLowerCase();

    // Check for bank names in subject (same patterns as filename detection)
    const subjectPatterns = [
      { pattern: /hdfc/i, bank: 'HDFC Bank' },
      { pattern: /sbi|state\s*bank/i, bank: 'State Bank of India' },
      { pattern: /icici/i, bank: 'ICICI Bank' },
      { pattern: /axis/i, bank: 'Axis Bank' },
      { pattern: /kotak/i, bank: 'Kotak Mahindra Bank' },
      { pattern: /yes\s*bank/i, bank: 'Yes Bank' },
      { pattern: /indusind/i, bank: 'IndusInd Bank' },
      { pattern: /canara/i, bank: 'Canara Bank' },
      { pattern: /punjab|pnb/i, bank: 'Punjab National Bank' },
      { pattern: /baroda|bob/i, bank: 'Bank of Baroda' },
      { pattern: /union\s*bank/i, bank: 'Union Bank' },
      { pattern: /idbi/i, bank: 'IDBI Bank' },
      { pattern: /federal/i, bank: 'Federal Bank' },
      { pattern: /rbl/i, bank: 'RBL Bank' },
      { pattern: /bandhan/i, bank: 'Bandhan Bank' },
      { pattern: /sbm/i, bank: 'SBM Bank' },
    ];

    for (const { pattern, bank } of subjectPatterns) {
      if (pattern.test(subject)) {
        return { name: bank, method: 'subject' };
      }
    }

    return { name: null, method: 'subject' };
  }

  /**
   * Check if email is likely a bank statement based on sender/subject
   */
  isBankStatementEmail({ sender, subject }) {
    // Check sender domain
    if (sender) {
      const senderResult = this.detectFromSender(sender);
      if (senderResult.name) {
        return true;
      }
    }

    // Check subject for statement keywords
    if (subject) {
      const lowerSubject = subject.toLowerCase();
      const keywords = config.emailSubjectKeywords || [];

      for (const keyword of keywords) {
        if (lowerSubject.includes(keyword.toLowerCase())) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get list of known bank sender domains for email filtering
   */
  getKnownBankDomains() {
    return Object.keys(this.senderDomains);
  }

  /**
   * Normalize bank keyword to proper bank name
   */
  normalizeBankName(keyword) {
    if (!keyword) return 'Unknown';

    const lowerKeyword = keyword.toLowerCase();

    // Bank name mapping
    const bankNameMap = {
      'hdfc': 'HDFC Bank',
      'hdfcbank': 'HDFC Bank',
      'sbi': 'State Bank of India',
      'statebank': 'State Bank of India',
      'icici': 'ICICI Bank',
      'icicibank': 'ICICI Bank',
      'axis': 'Axis Bank',
      'axisbank': 'Axis Bank',
      'kotak': 'Kotak Mahindra Bank',
      'kotakbank': 'Kotak Mahindra Bank',
      'kotakmahindra': 'Kotak Mahindra Bank',
      'yes': 'Yes Bank',
      'yesbank': 'Yes Bank',
      'indusind': 'IndusInd Bank',
      'indusindbank': 'IndusInd Bank',
      'canara': 'Canara Bank',
      'canarabank': 'Canara Bank',
      'pnb': 'Punjab National Bank',
      'punjab': 'Punjab National Bank',
      'punjabnational': 'Punjab National Bank',
      'bob': 'Bank of Baroda',
      'baroda': 'Bank of Baroda',
      'bankofbaroda': 'Bank of Baroda',
      'union': 'Union Bank',
      'unionbank': 'Union Bank',
      'idbi': 'IDBI Bank',
      'idbibank': 'IDBI Bank',
      'federal': 'Federal Bank',
      'federalbank': 'Federal Bank',
      'rbl': 'RBL Bank',
      'rblbank': 'RBL Bank',
      'bandhan': 'Bandhan Bank',
      'bandhanbank': 'Bandhan Bank',
      'dbs': 'DBS Bank',
      'dbsbank': 'DBS Bank',
      'hsbc': 'HSBC',
      'citi': 'Citibank',
      'citibank': 'Citibank',
      'sc': 'Standard Chartered',
      'scb': 'Standard Chartered',
      'standardchartered': 'Standard Chartered',
      'deutsche': 'Deutsche Bank',
      'uco': 'UCO Bank',
      'ucobank': 'UCO Bank',
      'iob': 'Indian Overseas Bank',
      'indianoverseas': 'Indian Overseas Bank',
      'boi': 'Bank of India',
      'bankofindia': 'Bank of India',
      'centralbank': 'Central Bank of India',
      'indianbank': 'Indian Bank',
      'paytm': 'Paytm Payments Bank',
      'paytmbank': 'Paytm Payments Bank',
      'airtel': 'Airtel Payments Bank',
      'airtelbank': 'Airtel Payments Bank',
      'fino': 'Fino Payments Bank',
      'finobank': 'Fino Payments Bank',
      'au': 'AU Small Finance Bank',
      'aubank': 'AU Small Finance Bank',
      'ausmallfinance': 'AU Small Finance Bank',
      'equitas': 'Equitas Small Finance Bank',
      'ujjivan': 'Ujjivan Small Finance Bank'
    };

    return bankNameMap[lowerKeyword] || 'Unknown';
  }
}

module.exports = BankDetector;
