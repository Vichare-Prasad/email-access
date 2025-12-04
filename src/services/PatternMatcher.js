// src/services/PatternMatcher.js
// Fuzzy pattern matching engine for bank statement detection

const fs = require('fs');
const path = require('path');

class PatternMatcher {
  constructor(patternsPath = null) {
    this.patternsPath = patternsPath || path.join(__dirname, '../patterns.json');
    this.patterns = null;
    this.loadPatterns();
  }

  /**
   * Load patterns from JSON file
   */
  loadPatterns() {
    try {
      const content = fs.readFileSync(this.patternsPath, 'utf8');
      this.patterns = JSON.parse(content);
      console.log(`[PatternMatcher] Loaded patterns v${this.patterns.version}`);
    } catch (e) {
      console.error('[PatternMatcher] Failed to load patterns:', e.message);
      this.patterns = this.getDefaultPatterns();
    }
  }

  /**
   * Reload patterns (for hot-reload without restart)
   */
  reloadPatterns() {
    this.loadPatterns();
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
    }
    return dp[m][n];
  }

  /**
   * Calculate similarity score (0-1) between two strings
   */
  similarityScore(str1, str2) {
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1;
    const distance = this.levenshteinDistance(str1, str2);
    return 1 - (distance / maxLen);
  }

  /**
   * Check if a string looks like a UUID or hex hash
   * UUIDs: 8-4-4-4-12 hex pattern, or long hex strings
   */
  isUuidOrHash(str) {
    // UUID pattern: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
    if (uuidPattern.test(str)) return true;

    // Long hex string (8+ chars of only hex)
    const hexPattern = /^[a-f0-9]{8,}$/i;
    if (hexPattern.test(str)) return true;

    // Hex with dashes (partial UUID)
    const partialUuidPattern = /^[a-f0-9]+(-[a-f0-9]+)+$/i;
    if (partialUuidPattern.test(str)) return true;

    return false;
  }

  /**
   * Normalize filename for matching
   * Removes extension, special chars, converts to lowercase
   */
  normalizeFilename(filename) {
    return filename
      .toLowerCase()
      .replace(/\.[^/.]+$/, '') // Remove extension
      .replace(/[_\-\.]/g, ' ') // Replace separators with space
      .replace(/[^a-z0-9\s]/g, '') // Remove special chars
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  }

  /**
   * Extract tokens from normalized filename
   */
  tokenize(text) {
    return text.split(' ').filter(t => t.length > 0);
  }

  /**
   * Check if any token matches any pattern (exact or fuzzy)
   */
  matchesAny(tokens, patterns, fuzzy = true) {
    const threshold = this.patterns?.fuzzyConfig?.threshold || 0.75;
    const maxDistance = this.patterns?.fuzzyConfig?.maxDistance || 2;

    // Short patterns that require exact token match (no substring)
    const shortPatternMinLength = 4; // Patterns shorter than this need exact word match

    for (const token of tokens) {
      // Skip tokens that look like UUIDs or hex hashes
      if (this.isUuidOrHash(token)) {
        continue;
      }

      for (const pattern of patterns) {
        const isShortPattern = pattern.length < shortPatternMinLength;

        // For short patterns (cc, dbs, sc, au, etc.), require exact token match
        if (isShortPattern) {
          if (token === pattern) {
            return { matched: true, token, pattern, score: 1, type: 'exact' };
          }
          // Skip substring matching for short patterns - too many false positives
          continue;
        }

        // For longer patterns, allow substring matching
        if (token === pattern) {
          return { matched: true, token, pattern, score: 1, type: 'exact' };
        }

        // Check if token contains pattern as a word (not in middle of another word)
        // e.g., "hdfcbank" contains "hdfc" at start - OK
        // e.g., "statement" contains "statement" - OK
        // e.g., "citibank" contains "citi" at start - OK
        if (token.startsWith(pattern) || token.endsWith(pattern)) {
          return { matched: true, token, pattern, score: 1, type: 'exact' };
        }

        // Check if pattern contains token (for compound patterns)
        if (pattern.length > token.length && pattern.includes(token) && token.length >= 4) {
          return { matched: true, token, pattern, score: 0.9, type: 'exact' };
        }

        // Fuzzy match (only for patterns 4+ chars)
        if (fuzzy && token.length >= 4 && pattern.length >= 4) {
          const score = this.similarityScore(token, pattern);
          if (score >= threshold) {
            return { matched: true, token, pattern, score, type: 'fuzzy' };
          }

          // Also check Levenshtein distance for short words
          const distance = this.levenshteinDistance(token, pattern);
          if (distance <= maxDistance && distance < Math.min(token.length, pattern.length)) {
            return { matched: true, token, pattern, score: 1 - (distance / Math.max(token.length, pattern.length)), type: 'fuzzy' };
          }
        }
      }
    }
    return { matched: false };
  }

  /**
   * Check if filename matches any statement keyword
   */
  hasStatementKeyword(tokens) {
    const keywords = [
      ...(this.patterns.statementKeywords?.exact || []),
      ...(this.patterns.statementKeywords?.variations || [])
    ];
    return this.matchesAny(tokens, keywords, true);
  }

  /**
   * Check if filename contains bank name
   */
  hasBankName(tokens) {
    return this.matchesAny(tokens, this.patterns.bankNames || [], true);
  }

  /**
   * Check if filename contains account keyword
   */
  hasAccountKeyword(tokens) {
    const keywords = [
      ...(this.patterns.accountKeywords?.exact || []),
      ...(this.patterns.accountKeywords?.variations || [])
    ];
    return this.matchesAny(tokens, keywords, true);
  }

  /**
   * Check if filename contains transaction keyword
   */
  hasTransactionKeyword(tokens) {
    return this.matchesAny(tokens, this.patterns.transactionKeywords || [], true);
  }

  /**
   * Check if filename contains time indicator
   */
  hasTimeIndicator(tokens) {
    return this.matchesAny(tokens, this.patterns.timeIndicators || [], false); // No fuzzy for dates
  }

  /**
   * Check if filename contains credit card keyword
   */
  hasCreditCardKeyword(tokens) {
    return this.matchesAny(tokens, this.patterns.creditCardKeywords || [], true);
  }

  /**
   * Check if filename contains negative keyword
   */
  hasNegativeKeyword(tokens) {
    return this.matchesAny(tokens, this.patterns.negativeKeywords || [], false); // No fuzzy for negative
  }

  /**
   * Check custom patterns
   */
  matchesCustomPattern(tokens) {
    const customPatterns = this.patterns.customPatterns || [];
    if (customPatterns.length === 0) return { matched: false };
    return this.matchesAny(tokens, customPatterns, true);
  }

  /**
   * Main detection function - returns confidence score and decision
   */
  detectBankStatement(filename) {
    const normalized = this.normalizeFilename(filename);
    const tokens = this.tokenize(normalized);
    const fullText = normalized.replace(/\s/g, ''); // Also check without spaces

    // Early exit: if the entire filename is a UUID/hash, skip it
    const filenameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    if (this.isUuidOrHash(filenameWithoutExt)) {
      return {
        filename,
        normalized,
        isStatement: false,
        confidence: 0,
        matches: [],
        reason: 'Filename is UUID/hash - skipped'
      };
    }

    // Add full text as a token for compound matches
    const allTokens = [...tokens, fullText];

    const result = {
      filename,
      normalized,
      isStatement: false,
      confidence: 0,
      matches: [],
      reason: ''
    };

    // Check for negative keywords first
    const negativeMatch = this.hasNegativeKeyword(allTokens);
    if (negativeMatch.matched) {
      // Check if there's a strong positive signal to override
      const statementMatch = this.hasStatementKeyword(allTokens);
      if (!statementMatch.matched) {
        result.reason = `Negative keyword: "${negativeMatch.pattern}"`;
        return result;
      }
    }

    // Check custom patterns (highest priority)
    const customMatch = this.matchesCustomPattern(allTokens);
    if (customMatch.matched) {
      result.isStatement = true;
      result.confidence = 0.95;
      result.matches.push({ ...customMatch, type: 'custom' });
      result.reason = `Custom pattern: "${customMatch.pattern}"`;
      return result;
    }

    // Rule 1: "statement" keyword alone = definitely a statement
    const statementMatch = this.hasStatementKeyword(allTokens);
    if (statementMatch.matched) {
      result.isStatement = true;
      result.confidence = 0.95;
      result.matches.push({ ...statementMatch, type: 'statement' });
      result.reason = `Statement keyword: "${statementMatch.pattern}"`;
      return result;
    }

    // Rule 2: Bank name + account/transaction keyword
    const bankMatch = this.hasBankName(allTokens);
    const accountMatch = this.hasAccountKeyword(allTokens);
    const txnMatch = this.hasTransactionKeyword(allTokens);
    const ccMatch = this.hasCreditCardKeyword(allTokens);

    if (bankMatch.matched) {
      result.matches.push({ ...bankMatch, type: 'bank' });

      if (accountMatch.matched || txnMatch.matched) {
        result.isStatement = true;
        result.confidence = 0.9;
        result.matches.push({ ...(accountMatch.matched ? accountMatch : txnMatch), type: accountMatch.matched ? 'account' : 'transaction' });
        result.reason = `Bank "${bankMatch.pattern}" + ${accountMatch.matched ? 'account' : 'transaction'} keyword`;
        return result;
      }

      // Rule 3: Bank name + time indicator
      const timeMatch = this.hasTimeIndicator(allTokens);
      if (timeMatch.matched) {
        result.isStatement = true;
        result.confidence = 0.75;
        result.matches.push({ ...timeMatch, type: 'time' });
        result.reason = `Bank "${bankMatch.pattern}" + time "${timeMatch.pattern}"`;
        return result;
      }

      // Rule 4: Just bank name (lower confidence)
      result.isStatement = true;
      result.confidence = 0.5;
      result.reason = `Bank name only: "${bankMatch.pattern}"`;
      return result;
    }

    // Rule 5: Credit card keywords
    if (ccMatch.matched) {
      result.isStatement = true;
      result.confidence = 0.85;
      result.matches.push({ ...ccMatch, type: 'creditcard' });
      result.reason = `Credit card keyword: "${ccMatch.pattern}"`;
      return result;
    }

    // Rule 6: Account keyword + time (might be a statement)
    if (accountMatch.matched) {
      const timeMatch = this.hasTimeIndicator(allTokens);
      if (timeMatch.matched) {
        result.isStatement = true;
        result.confidence = 0.6;
        result.matches.push({ ...accountMatch, type: 'account' });
        result.matches.push({ ...timeMatch, type: 'time' });
        result.reason = `Account keyword + time indicator`;
        return result;
      }
    }

    // No match
    result.reason = 'No matching patterns found';
    return result;
  }

  /**
   * Simple boolean check - should we download this PDF?
   */
  shouldDownload(filename, minConfidence = 0.5) {
    const result = this.detectBankStatement(filename);
    return result.isStatement && result.confidence >= minConfidence;
  }

  /**
   * Get default patterns (fallback)
   */
  getDefaultPatterns() {
    return {
      version: 'default',
      bankNames: ['hdfc', 'sbi', 'icici', 'axis', 'kotak', 'yes', 'indusind', 'canara', 'pnb', 'bob'],
      statementKeywords: {
        exact: ['statement', 'e-statement', 'stmt'],
        variations: ['statment', 'statemnt']
      },
      accountKeywords: {
        exact: ['account', 'acct', 'acc'],
        variations: ['acount']
      },
      transactionKeywords: ['transaction', 'txn', 'passbook'],
      timeIndicators: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
      creditCardKeywords: ['creditcard', 'credit_card'],
      negativeKeywords: ['invoice', 'receipt', 'contract'],
      customPatterns: [],
      fuzzyConfig: { enabled: true, threshold: 0.75, maxDistance: 2 }
    };
  }

  /**
   * Add a custom pattern (persists to JSON)
   */
  addCustomPattern(pattern) {
    if (!this.patterns.customPatterns.includes(pattern)) {
      this.patterns.customPatterns.push(pattern);
      this.savePatterns();
      return true;
    }
    return false;
  }

  /**
   * Save patterns to JSON file
   */
  savePatterns() {
    try {
      fs.writeFileSync(this.patternsPath, JSON.stringify(this.patterns, null, 2));
      console.log('[PatternMatcher] Patterns saved');
    } catch (e) {
      console.error('[PatternMatcher] Failed to save patterns:', e.message);
    }
  }
}

module.exports = PatternMatcher;
