/**
 * Telegram Mini App — Banner Generator
 * Main entry point
 */

import '../css/miniapp.css';

import logger from './modules/logger.js';
import auth from './modules/auth.js';
import router from './modules/router.js';
import { getBrand, applyBrandTheme } from './modules/brand.js';
import { renderHome } from './modules/home.js';
import { renderGallery } from './modules/gallery.js';

// Wizard step screens
import { renderDirectionStep } from './modules/steps/direction-step.js';
import { renderLanguageStep } from './modules/steps/language-step.js';
import { renderCurrencyStep } from './modules/steps/currency-step.js';
import { renderPromoStep } from './modules/steps/promo-step.js';

// Stub screens
import { renderStubManager, renderStubVoucher, renderStubSupport, renderStubFAQ, renderStubSettings } from './modules/stubs.js';

// Admin screen
import { renderAdminScreen } from './modules/admin-screen.js';

import wizardState from './modules/wizard-state.js';

async function init() {
  const rootEl = document.getElementById('app');
  if (!rootEl) return;

  const brand = getBrand();
  logger.log('app', `Initializing mini app [${brand.name}]...`);
  logger.log('app', 'Templates loaded:', window.templates?.length || 0);

  rootEl.innerHTML = '<div class="loading-screen"><div class="loading-spinner"></div></div>';

  try {
    await auth.init();
    logger.log('app', 'Auth initialized, user:', auth.getUser());
  } catch (err) {
    logger.error('app', 'Auth init failed:', err);
  }

  applyBrandTheme();
  setupDebugToggle();
  wizardState.load();

  // Main routes
  router.on('/', renderHome);
  router.on('/gallery', renderGallery);

  // Wizard step routes
  router.on('/step/direction', renderDirectionStep);
  router.on('/step/language', renderLanguageStep);
  router.on('/step/currency', renderCurrencyStep);
  router.on('/step/promo', renderPromoStep);

  // Stub routes
  router.on('/stub/manager', renderStubManager);
  router.on('/stub/voucher', renderStubVoucher);
  router.on('/stub/support', renderStubSupport);
  router.on('/stub/faq', renderStubFAQ);
  router.on('/stub/settings', renderStubSettings);

  // Admin screen
  router.on('/admin', renderAdminScreen);

  // Legacy redirect
  router.on('/filters', (rootEl) => {
    wizardState.load();
    router.navigate('/step/direction');
  });

  router.init(rootEl);
  logger.log('app', 'Router initialized');
}

/**
 * Triple-tap anywhere to toggle debug panel
 */
function setupDebugToggle() {
  let tapCount = 0;
  let tapTimer = null;

  document.addEventListener('click', () => {
    tapCount++;
    if (tapCount === 5) {
      tapCount = 0;
      clearTimeout(tapTimer);
      logger.toggle();
      return;
    }
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => { tapCount = 0; }, 600);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
