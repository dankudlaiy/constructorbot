/**
 * Step 3: Currency Selection (Single Select)
 * Shows only currencies that have banners for the selected language + directions.
 */

import router from '../router.js';
import wizardState from '../wizard-state.js';
import logger from '../logger.js';

/**
 * Get available currencies filtered by selected directions + language
 */
function getAvailableCurrencies() {
  const templates = window.templates || [];
  const currencySet = new Set();

  templates.forEach(t => {
    // Match direction
    const tDirs = Array.isArray(t.directions) ? t.directions : [t.direction];
    const matchesDirection = wizardState.directions.length === 0 ||
      wizardState.directions.some(d => tDirs.includes(d));

    // Match language (geo)
    const matchesLanguage = !wizardState.language || t.geo === wizardState.language;

    if (matchesDirection && matchesLanguage && t.currency) {
      currencySet.add(t.currency);
    }
  });

  return [...currencySet].sort();
}

export function renderCurrencyStep(rootEl) {
  const currencies = getAvailableCurrencies();
  const modeLabel = wizardState.mode === 'video' ? 'Get Video' : 'Get Banner';

  rootEl.innerHTML = `
    <div class="screen step-screen">
      <div class="step-header">
        <button class="btn-back" id="stepBack">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <h1 class="step-title">${modeLabel}</h1>
        <div class="step-indicator">3/4</div>
      </div>

      <div class="step-body">
        <h2 class="step-subtitle">Select Currency</h2>
        <p class="step-hint">Available currencies for ${wizardState.language || 'selected language'}</p>

        <div class="step-list" id="currencyList">
          ${currencies.map(cur => `
            <div class="step-list-item step-list-item-radio ${wizardState.currency === cur ? 'selected' : ''}" data-value="${cur}">
              <span class="step-item-label">${cur}</span>
            </div>
          `).join('')}
          ${currencies.length === 0 ? '<div class="step-empty">No currencies available for the selected language and directions</div>' : ''}
        </div>
      </div>

      <div class="step-footer">
        <button class="btn-primary btn-next" id="btnNext" ${!wizardState.currency ? 'disabled' : ''}>Next</button>
      </div>
    </div>
  `;

  const listItems = rootEl.querySelectorAll('.step-list-item');
  const btnNext = rootEl.querySelector('#btnNext');

  // Event: Back
  rootEl.querySelector('#stepBack').addEventListener('click', () => {
    router.navigate('/step/language');
  });

  // Event: Select currency (single select)
  listItems.forEach(item => {
    item.addEventListener('click', () => {
      listItems.forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      wizardState.currency = item.dataset.value;
      wizardState.save();
      btnNext.disabled = false;
    });
  });

  // Event: Next
  btnNext.addEventListener('click', () => {
    if (!wizardState.currency) return;
    wizardState.save();
    router.navigate('/step/promo');
  });

  // Telegram back button
  const webapp = window.Telegram?.WebApp;
  if (webapp) {
    webapp.BackButton.show();
    webapp.BackButton.onClick(() => {
      router.navigate('/step/language');
    });
  }

  logger.log('currency-step', 'Rendered, available:', currencies.length, 'selected:', wizardState.currency);
}
