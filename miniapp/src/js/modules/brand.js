/**
 * Brand configuration module
 * Reads window.__brand (set by PHP) and provides brand-specific theming
 */

const BRANDS = {
  coldbet: {
    id: 'coldbet',
    name: 'ColdBet',
    accent: '#0F917E',
    accentHover: '#0d7d6d',
    bg: '#1a1a2e',
    secondaryBg: '#16213e',
    headerBg: '#0f3460',
    text: '#ffffff',
    hint: '#a0a0a0',
    cardBg: '#1e2a4a',
    buttonText: '#ffffff',
    logo: '/assets/brands/coldbet-logo.svg',
  },
  spinbetter: {
    id: 'spinbetter',
    name: 'SpinBetter',
    accent: '#E6A817',
    accentHover: '#d49a14',
    bg: '#1a1a2e',
    secondaryBg: '#16213e',
    headerBg: '#0f3460',
    text: '#ffffff',
    hint: '#a0a0a0',
    cardBg: '#1e2a4a',
    buttonText: '#ffffff',
    logo: '/assets/brands/spinbetter-logo.svg',
  },
};

/**
 * Get the current brand config
 * @returns {object} Brand configuration object
 */
export function getBrand() {
  const brandKey = window.__brand || 'coldbet';
  return BRANDS[brandKey] || BRANDS.coldbet;
}

/**
 * Get the brand ID string
 * @returns {string} 'coldbet' or 'spinbetter'
 */
export function getBrandId() {
  return getBrand().id;
}

/**
 * Apply brand-specific CSS custom properties to :root
 * Falls back to Telegram theme params where available
 */
export function applyBrandTheme() {
  const brand = getBrand();
  const root = document.documentElement;
  const webapp = window.Telegram?.WebApp;
  const theme = webapp?.themeParams || {};

  // Brand colors take precedence, Telegram theme as fallback
  root.style.setProperty('--tg-bg', theme.bg_color || brand.bg);
  root.style.setProperty('--tg-text', theme.text_color || brand.text);
  root.style.setProperty('--tg-hint', theme.hint_color || brand.hint);
  root.style.setProperty('--tg-button', brand.accent); // Always use brand accent
  root.style.setProperty('--tg-button-text', theme.button_text_color || brand.buttonText);
  root.style.setProperty('--tg-secondary-bg', theme.secondary_bg_color || brand.secondaryBg);
  root.style.setProperty('--tg-header-bg', theme.header_bg_color || brand.headerBg);

  // Additional brand-specific properties
  root.style.setProperty('--brand-accent', brand.accent);
  root.style.setProperty('--brand-accent-hover', brand.accentHover);
  root.style.setProperty('--brand-card-bg', brand.cardBg);
}

export default { getBrand, getBrandId, applyBrandTheme };
