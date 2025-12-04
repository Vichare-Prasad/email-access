// src/services/SettingsManager.js
// Centralized settings management for auto-fetch email service

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const config = require('../config');

// Default settings structure
const DEFAULT_SETTINGS = {
  // Service mode: "24/7" or "when_app_open"
  mode: "when_app_open",

  // Fetch settings
  enabled: true,
  intervalMinutes: 30,

  // Date range preset: "today", "7days", "30days", "custom", "all"
  dateRangePreset: "30days",
  customStartDate: null, // ISO date string if preset is "custom"
  customEndDate: null,   // ISO date string if preset is "custom"

  // Legacy setting (for backwards compatibility)
  scanDays: 30,

  // Connected accounts
  activeAccounts: [],

  // Onboarding
  onboardingCompleted: false,

  // Auto-processing on app startup
  autoProcessOnStartup: true,

  // Service status tracking
  lastScanTime: null,
  serviceStartedAt: null,
  lastError: null,

  // Statistics
  totalFetched: 0,
  fetchedToday: 0,
  lastFetchDate: null
};

class SettingsManager {
  constructor(settingsPath = null) {
    this.settingsPath = settingsPath || config.paths.sharedSettings;
    this.settings = null;
    this.loaded = false;
  }

  /**
   * Load settings from file, creating defaults if needed
   */
  async load() {
    try {
      if (fsSync.existsSync(this.settingsPath)) {
        const content = await fs.readFile(this.settingsPath, 'utf8');
        const savedSettings = JSON.parse(content);

        // Merge with defaults (to handle new settings added in updates)
        this.settings = { ...DEFAULT_SETTINGS, ...savedSettings };

        // Ensure arrays exist
        if (!Array.isArray(this.settings.activeAccounts)) {
          this.settings.activeAccounts = [];
        }

        console.log('[SettingsManager] Loaded settings');
      } else {
        // Create default settings
        this.settings = { ...DEFAULT_SETTINGS };
        await this.save();
        console.log('[SettingsManager] Created default settings');
      }

      this.loaded = true;
      return this.settings;
    } catch (error) {
      console.error('[SettingsManager] Error loading settings:', error.message);
      this.settings = { ...DEFAULT_SETTINGS };
      this.loaded = true;
      return this.settings;
    }
  }

  /**
   * Save settings to file
   */
  async save() {
    try {
      await fs.mkdir(path.dirname(this.settingsPath), { recursive: true });
      await fs.writeFile(this.settingsPath, JSON.stringify(this.settings, null, 2));
      console.log('[SettingsManager] Settings saved');
      return true;
    } catch (error) {
      console.error('[SettingsManager] Error saving settings:', error.message);
      return false;
    }
  }

  /**
   * Get all settings
   */
  getAll() {
    if (!this.loaded) {
      throw new Error('Settings not loaded. Call load() first.');
    }
    return { ...this.settings };
  }

  /**
   * Get a specific setting
   */
  get(key) {
    if (!this.loaded) {
      throw new Error('Settings not loaded. Call load() first.');
    }
    return this.settings[key];
  }

  /**
   * Update a specific setting
   */
  async set(key, value) {
    if (!this.loaded) {
      await this.load();
    }
    this.settings[key] = value;
    return await this.save();
  }

  /**
   * Update multiple settings at once
   */
  async update(updates) {
    if (!this.loaded) {
      await this.load();
    }
    this.settings = { ...this.settings, ...updates };
    return await this.save();
  }

  // ============ Convenience Methods ============

  /**
   * Get service mode
   */
  getMode() {
    return this.settings?.mode || "when_app_open";
  }

  /**
   * Check if 24/7 mode
   */
  is24x7Mode() {
    return this.getMode() === "24/7";
  }

  /**
   * Get date range for email query
   * Returns { startDate: Date|null, endDate: Date|null, queryType: string }
   */
  getDateRange() {
    const preset = this.settings?.dateRangePreset || "30days";
    const now = new Date();

    switch (preset) {
      case "today": {
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        return {
          startDate: startOfDay,
          endDate: null,
          queryType: "newer_than:1d"
        };
      }

      case "7days": {
        return {
          startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          endDate: null,
          queryType: "newer_than:7d"
        };
      }

      case "30days": {
        return {
          startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          endDate: null,
          queryType: "newer_than:30d"
        };
      }

      case "custom": {
        const startDate = this.settings.customStartDate
          ? new Date(this.settings.customStartDate)
          : null;
        const endDate = this.settings.customEndDate
          ? new Date(this.settings.customEndDate)
          : null;

        // Build query parts
        let query = "";
        if (startDate) {
          const formatted = this.formatGmailDate(startDate);
          query += `after:${formatted}`;
        }
        if (endDate) {
          const formatted = this.formatGmailDate(endDate);
          query += query ? ` before:${formatted}` : `before:${formatted}`;
        }

        return {
          startDate,
          endDate,
          queryType: query || `newer_than:${this.settings.scanDays || 365}d`
        };
      }

      case "all":
      default: {
        const days = this.settings?.scanDays || 365;
        return {
          startDate: new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
          endDate: null,
          queryType: `newer_than:${days}d`
        };
      }
    }
  }

  /**
   * Format date for Gmail query (YYYY/MM/DD)
   */
  formatGmailDate(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}/${month}/${day}`;
  }

  /**
   * Check if auto-process on startup is enabled
   */
  shouldAutoProcess() {
    return this.settings?.autoProcessOnStartup === true;
  }

  /**
   * Check if onboarding is completed
   */
  isOnboarded() {
    return this.settings?.onboardingCompleted === true;
  }

  /**
   * Mark onboarding as completed
   */
  async completeOnboarding() {
    return await this.set('onboardingCompleted', true);
  }

  /**
   * Add an account
   */
  async addAccount(email) {
    if (!this.settings.activeAccounts.includes(email)) {
      this.settings.activeAccounts.push(email);
      return await this.save();
    }
    return true;
  }

  /**
   * Remove an account
   */
  async removeAccount(email) {
    const index = this.settings.activeAccounts.indexOf(email);
    if (index > -1) {
      this.settings.activeAccounts.splice(index, 1);
      return await this.save();
    }
    return true;
  }

  /**
   * Get active accounts
   */
  getActiveAccounts() {
    return this.settings?.activeAccounts || [];
  }

  /**
   * Update last scan time
   */
  async updateLastScan() {
    this.settings.lastScanTime = Date.now();

    // Update daily fetch count
    const today = new Date().toDateString();
    if (this.settings.lastFetchDate !== today) {
      this.settings.lastFetchDate = today;
      this.settings.fetchedToday = 0;
    }

    return await this.save();
  }

  /**
   * Increment fetch count
   */
  async incrementFetchCount(count = 1) {
    this.settings.totalFetched = (this.settings.totalFetched || 0) + count;
    this.settings.fetchedToday = (this.settings.fetchedToday || 0) + count;
    return await this.save();
  }

  /**
   * Record error
   */
  async recordError(error) {
    this.settings.lastError = {
      message: error.message || String(error),
      timestamp: Date.now()
    };
    return await this.save();
  }

  /**
   * Clear error
   */
  async clearError() {
    this.settings.lastError = null;
    return await this.save();
  }
}

module.exports = SettingsManager;
