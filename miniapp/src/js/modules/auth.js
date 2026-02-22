/**
 * Telegram WebApp SDK authentication module
 */

import logger from './logger.js';

const auth = {
  user: null,
  initData: '',
  webapp: null,

  /**
   * Initialize Telegram WebApp and validate auth
   */
  async init() {
    // Get Telegram WebApp instance
    this.webapp = window.Telegram?.WebApp;

    if (!this.webapp) {
      logger.log('auth', 'Telegram WebApp SDK not available, running in dev mode');
      this.user = { id: 0, first_name: 'Dev', username: 'dev' };
      return this.user;
    }

    // Tell Telegram the app is ready
    this.webapp.ready();

    // Expand to full height
    this.webapp.expand();

    // Store initData for API calls
    this.initData = this.webapp.initData || '';
    logger.log('auth', 'initData length:', this.initData.length);

    // Use initDataUnsafe for quick user info (already parsed by SDK)
    const unsafeUser = this.webapp.initDataUnsafe?.user;
    if (unsafeUser) {
      this.user = unsafeUser;
      logger.log('auth', 'User from initDataUnsafe:', unsafeUser.id, unsafeUser.first_name);
    }

    // If no initData — app was opened as a plain link, not via bot WebApp button
    if (!this.initData) {
      logger.log('auth', 'initData is empty — app not opened via bot WebApp button');
      return this.user;
    }

    // Validate on server
    try {
      const response = await fetch('/miniapp/api/telegram_auth.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: this.initData }),
      });

      logger.log('auth', 'Server validation response:', response.status);

      if (!response.ok) {
        logger.error('auth', 'Auth validation failed:', response.status);
        return this.user; // Still use unsafe data for UI
      }

      const data = await response.json();
      if (data.success) {
        this.user = {
          id: data.user_id,
          first_name: data.first_name,
          username: data.username,
        };
        logger.log('auth', 'Auth validated, user:', this.user.id);
      }
    } catch (err) {
      logger.error('auth', 'Auth error:', err);
    }

    return this.user;
  },

  /**
   * Get initData for API calls
   */
  getInitData() {
    return this.initData;
  },

  /**
   * Get current user info
   */
  getUser() {
    return this.user;
  },

  /**
   * Get Telegram WebApp theme params
   */
  getTheme() {
    return this.webapp?.themeParams || {};
  },

  /**
   * Access Telegram WebApp instance
   */
  getWebApp() {
    return this.webapp;
  },
};

export default auth;
