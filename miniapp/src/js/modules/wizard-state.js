/**
 * Wizard State — centralized state manager for the step-by-step flow
 * Persists to sessionStorage so state survives page navigation
 */

const STORAGE_KEY = 'miniapp_wizard';

const wizardState = {
  mode: 'banner',       // 'banner' | 'video'
  directions: [],       // multi-select: ['casino', 'sport']
  language: '',         // single geo code: 'RU', 'EN', etc.
  currency: '',         // single currency: 'USD', 'EUR', etc.
  promo: '',            // promo code string (uppercase, latin+digits)

  /**
   * Save current state to sessionStorage
   */
  save() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.toJSON()));
    } catch (e) {
      // sessionStorage may be unavailable
    }
  },

  /**
   * Load state from sessionStorage
   */
  load() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.mode) this.mode = data.mode;
      if (Array.isArray(data.directions)) this.directions = data.directions;
      if (data.language) this.language = data.language;
      if (data.currency) this.currency = data.currency;
      if (data.promo) this.promo = data.promo;
    } catch (e) {
      // Ignore parse errors
    }
  },

  /**
   * Reset all state
   */
  reset() {
    this.mode = 'banner';
    this.directions = [];
    this.language = '';
    this.currency = '';
    this.promo = '';
    this.save();
  },

  /**
   * Serialize to plain object
   */
  toJSON() {
    return {
      mode: this.mode,
      directions: this.directions,
      language: this.language,
      currency: this.currency,
      promo: this.promo,
    };
  },

  /**
   * Get templates from window.templates filtered by current wizard state
   * @param {object} opts - optional overrides: { directions, language, currency, mode }
   * @returns {Array} filtered templates
   */
  getFilteredTemplates(opts = {}) {
    const templates = window.templates || [];
    const directions = opts.directions || this.directions;
    const language = opts.language || this.language;
    const currency = opts.currency || this.currency;

    return templates.filter(t => {
      // Filter by direction (multi-select)
      if (directions.length > 0) {
        const tDirs = Array.isArray(t.directions) ? t.directions : [t.direction];
        if (!directions.some(d => tDirs.includes(d))) return false;
      }

      // Filter by language (geo field)
      if (language && t.geo !== language) return false;

      // Filter by currency
      if (currency && t.currency !== currency) return false;

      return true;
    });
  },
};

export default wizardState;
