/**
 * Step 1: Direction Selection (Multi-Select)
 * User picks one or more directions: Casino, Sport, Other, etc.
 */

import router from '../router.js';
import wizardState from '../wizard-state.js';
import logger from '../logger.js';
import { getBrand } from '../brand.js';

/**
 * Get available directions from templates (only those that have actual content)
 */
function getAvailableDirections() {
  const templates = window.templates || [];
  const dirSet = new Set();

  templates.forEach(t => {
    if (Array.isArray(t.directions)) {
      t.directions.forEach(d => dirSet.add(d));
    } else if (t.direction) {
      dirSet.add(t.direction);
    }
  });

  // Labels for known directions
  const labels = {
    casino: 'Casino',
    sport: 'Sport',
    other: 'Other',
    universal: 'Universal',
  };

  return [...dirSet].map(slug => ({
    slug,
    label: labels[slug] || slug.charAt(0).toUpperCase() + slug.slice(1),
  }));
}

export function renderDirectionStep(rootEl) {
  const brand = getBrand();
  const directions = getAvailableDirections();
  const modeLabel = wizardState.mode === 'video' ? 'Get Video' : 'Get Banner';

  rootEl.innerHTML = `
    <div class="screen step-screen">
      <div class="step-header">
        <button class="btn-back" id="stepBack">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <h1 class="step-title">${modeLabel}</h1>
        <div class="step-indicator">1/4</div>
      </div>

      <div class="step-body">
        <h2 class="step-subtitle">Select Direction</h2>
        <p class="step-hint">Choose one or more content directions</p>

        <div class="step-list" id="directionList">
          ${directions.map(d => `
            <label class="step-list-item step-list-item-checkbox ${wizardState.directions.includes(d.slug) ? 'selected' : ''}" data-slug="${d.slug}">
              <span class="step-item-check">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect x="0.5" y="0.5" width="17" height="17" rx="4" stroke="currentColor"/>
                  <path class="check-mark" d="M4 9l3 3 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <span class="step-item-label">${d.label}</span>
            </label>
          `).join('')}
        </div>
      </div>

      <div class="step-footer">
        <button class="btn-primary btn-next" id="btnNext" disabled>Next</button>
      </div>
    </div>
  `;

  // Event: Back
  rootEl.querySelector('#stepBack').addEventListener('click', () => {
    router.navigate('/');
  });

  // Event: Toggle direction selection
  const listItems = rootEl.querySelectorAll('.step-list-item');
  const btnNext = rootEl.querySelector('#btnNext');

  listItems.forEach(item => {
    item.addEventListener('click', () => {
      const slug = item.dataset.slug;
      const idx = wizardState.directions.indexOf(slug);
      if (idx >= 0) {
        wizardState.directions.splice(idx, 1);
        item.classList.remove('selected');
      } else {
        wizardState.directions.push(slug);
        item.classList.add('selected');
      }
      wizardState.save();
      btnNext.disabled = wizardState.directions.length === 0;
    });
  });

  // Initial button state
  btnNext.disabled = wizardState.directions.length === 0;

  // Event: Next
  btnNext.addEventListener('click', () => {
    if (wizardState.directions.length === 0) return;
    wizardState.save();
    router.navigate('/step/language');
  });

  // Telegram back button
  const webapp = window.Telegram?.WebApp;
  if (webapp) {
    webapp.BackButton.show();
    webapp.BackButton.onClick(() => {
      webapp.BackButton.hide();
      router.navigate('/');
    });
  }

  logger.log('direction-step', 'Rendered, available:', directions.length, 'selected:', wizardState.directions);
}
