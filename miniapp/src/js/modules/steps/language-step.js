/**
 * Step 2: Language Selection (Single Select)
 * Shows available languages (geo codes) filtered by selected directions.
 * DB field is "geo" but UI shows "Language".
 */

import router from '../router.js';
import wizardState from '../wizard-state.js';
import logger from '../logger.js';

/**
 * Get available languages/geos filtered by selected directions
 */
function getAvailableLanguages() {
  const templates = window.templates || [];
  const geoSet = new Set();

  templates.forEach(t => {
    // Check if template matches at least one selected direction
    const tDirs = Array.isArray(t.directions) ? t.directions : [t.direction];
    const matchesDirection = wizardState.directions.length === 0 ||
      wizardState.directions.some(d => tDirs.includes(d));

    if (matchesDirection && t.geo) {
      geoSet.add(t.geo);
    }
  });

  return [...geoSet].sort();
}

// Language labels for common geo codes
const LANGUAGE_LABELS = {
  RU: 'Russian',
  EN: 'English',
  FR: 'French',
  ES: 'Spanish',
  DE: 'German',
  PT: 'Portuguese',
  IT: 'Italian',
  TR: 'Turkish',
  AR: 'Arabic',
  HI: 'Hindi',
  AM: 'Armenian',
  KA: 'Georgian',
  AZ: 'Azerbaijani',
  UZ: 'Uzbek',
  KZ: 'Kazakh',
  UA: 'Ukrainian',
  PL: 'Polish',
  CZ: 'Czech',
  RO: 'Romanian',
  BG: 'Bulgarian',
  JP: 'Japanese',
  KR: 'Korean',
  CN: 'Chinese',
  TH: 'Thai',
  VN: 'Vietnamese',
  ID: 'Indonesian',
  MS: 'Malay',
  FI: 'Finnish',
  SE: 'Swedish',
  NO: 'Norwegian',
  DK: 'Danish',
  NL: 'Dutch',
  GR: 'Greek',
  HU: 'Hungarian',
};

function getLanguageLabel(code) {
  return LANGUAGE_LABELS[code] || code;
}

export function renderLanguageStep(rootEl) {
  const languages = getAvailableLanguages();
  const modeLabel = wizardState.mode === 'video' ? 'Get Video' : 'Get Banner';

  rootEl.innerHTML = `
    <div class="screen step-screen">
      <div class="step-header">
        <button class="btn-back" id="stepBack">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <h1 class="step-title">${modeLabel}</h1>
        <div class="step-indicator">2/4</div>
      </div>

      <div class="step-body">
        <h2 class="step-subtitle">Select Language</h2>
        <p class="step-hint">Choose the language for banners</p>

        <div class="step-list" id="languageList">
          ${languages.map(geo => `
            <div class="step-list-item step-list-item-radio ${wizardState.language === geo ? 'selected' : ''}" data-value="${geo}">
              <span class="step-item-label">${getLanguageLabel(geo)}</span>
              <span class="step-item-code">${geo}</span>
            </div>
          `).join('')}
          ${languages.length === 0 ? '<div class="step-empty">No languages available for selected directions</div>' : ''}
        </div>
      </div>

      <div class="step-footer">
        <button class="btn-primary btn-next" id="btnNext" ${!wizardState.language ? 'disabled' : ''}>Next</button>
      </div>
    </div>
  `;

  const listItems = rootEl.querySelectorAll('.step-list-item');
  const btnNext = rootEl.querySelector('#btnNext');

  // Event: Back
  rootEl.querySelector('#stepBack').addEventListener('click', () => {
    router.navigate('/step/direction');
  });

  // Event: Select language (single select)
  listItems.forEach(item => {
    item.addEventListener('click', () => {
      // Deselect all
      listItems.forEach(i => i.classList.remove('selected'));
      // Select this one
      item.classList.add('selected');
      wizardState.language = item.dataset.value;
      // Reset currency since available currencies depend on language
      wizardState.currency = '';
      wizardState.save();
      btnNext.disabled = false;
    });
  });

  // Event: Next
  btnNext.addEventListener('click', () => {
    if (!wizardState.language) return;
    wizardState.save();
    router.navigate('/step/currency');
  });

  // Telegram back button
  const webapp = window.Telegram?.WebApp;
  if (webapp) {
    webapp.BackButton.show();
    webapp.BackButton.onClick(() => {
      router.navigate('/step/direction');
    });
  }

  logger.log('language-step', 'Rendered, available:', languages.length, 'selected:', wizardState.language);
}
