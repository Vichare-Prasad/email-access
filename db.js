// Standalone database manager (works without Electron)
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

// Simple logging (can use console instead of electron-log)
const log = {
  info: (...args) => console.log("[INFO]", ...args),
  error: (...args) => console.error("[ERROR]", ...args),
  warn: (...args) => console.warn("[WARN]", ...args),
};

// Simplified - always use current directory for standalone script
const isDev = true;
const BASE_DIR = __dirname;

log.info("DB Initialized: isDev =", isDev, "BASE_DIR =", BASE_DIR);

const { drizzle } = require("drizzle-orm/libsql");

// const { createClient } = require("@libsql/client");
// const { schema } = require("./schema");

class DatabaseManager {
  static instance = null;
  #db = null;
  #initialized = false;

  constructor() {
    if (DatabaseManager.instance) {
      throw new Error("Use DatabaseManager.getInstance()");
    }
    DatabaseManager.instance = this;
  }

  static getInstance() {
    if (!DatabaseManager.instance) {
      log.info("Creating new DatabaseManager instance");
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  async initialize(dbPath = null) {
    if (this.#initialized) {
      log.info("Database already initialized");
      return this.#db;
    }

    try {
      // Use provided path or default to db.sqlite3 in current directory
      const dbName = dbPath || path.resolve(__dirname, "db.sqlite3");
      const dbUrl = `file:${dbName}`;

      log.info("Resolved dbUrl:", dbUrl);

      this.#db = drizzle(dbUrl);
      
      // Skip migrations for now (can be added if needed)
      // const migrationsFolder = path.resolve(__dirname, "drizzle");
      // await migrate(this.#db, { migrationsFolder });

      this.#initialized = true;
      log.info("Database initialized successfully.");
      return this.#db;
    } catch (error) {
      log.error("Error initializing database:", error);
      throw error;
    }
  }

  getDatabase() {
    if (!this.#initialized) {
      throw new Error("Database not initialized. Call initialize() first");
    }
    return this.#db;
  }
}

// Export the class instead of an instance
module.exports = DatabaseManager;