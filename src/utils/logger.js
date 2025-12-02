// src/utils/logger.js
// Simple console logging wrapper

module.exports = {
  info: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
  debug: (...args) => console.log('[DEBUG]', ...args),
};
