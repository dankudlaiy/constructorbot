/**
 * Step 4: Promo Code Input
 * Latin letters + digits only, uppercase, with paste button
 */

import router from '../router.js';
import wizardState from '../wizard-state.js';
import logger from '../logger.js';

export function renderPromoStep(rootEl) {
  const modeLabel = wizardState.mode === 'video' ? 'Get Video' : 'Get Banner';

  rootEl.innerHTML = `
    <div class="screen step-screen">
      <div class="step-header">
        <button class="btn-back" id="stepBack">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <h1 class="step-title">${modeLabel}</h1>
        <div class="step-indicator">4/4</div>
      </div>

      <div class="step-body">
        <h2 class="step-subtitle">Enter Promo Code</h2>
        <p class="step-hint">Latin letters and digits only, no spaces</p>

        <div class="promo-input-wrapper">
          <input
            type="text"
            id="promoInput"
            class="promo-input"
            placeholder="YOUR PROMO CODE"
            value="${wizardState.promo}"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck="false"
          />
          <button class="btn-paste" id="btnPaste" title="Paste from clipboard">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <rect x="8" y="2" width="8" height="4" rx="1" stroke="currentColor" stroke-width="2"/>
            </svg>
            Paste
          </button>
        </div>
        <div class="promo-error" id="promoError" style="display:none;"></div>
      </div>

      <div class="step-footer">
        <button class="btn-primary btn-next" id="btnNext" ${!wizardState.promo ? 'disabled' : ''}>Show ${wizardState.mode === 'video' ? 'Videos' : 'Banners'}</button>
      </div>
    </div>
  `;

  const promoInput = rootEl.querySelector('#promoInput');
  const btnNext = rootEl.querySelector('#btnNext');
  const btnPaste = rootEl.querySelector('#btnPaste');
  const promoError = rootEl.querySelector('#promoError');

  /**
   * Validate and sanitize promo input
   */
  function sanitizePromo(value) {
    // Remove non-latin, non-digit characters and spaces
    return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  }

  function validatePromo(value) {
    if (!value) {
      promoError.style.display = 'none';
      return false;
    }
    if (/^[A-Z0-9]+$/.test(value)) {
      promoError.style.display = 'none';
      return true;
    }
    promoError.textContent = 'Only Latin letters (A-Z) and digits (0-9)';
    promoError.style.display = 'block';
    return false;
  }

  // Event: Input
  promoInput.addEventListener('input', (e) => {
    const sanitized = sanitizePromo(e.target.value);
    e.target.value = sanitized;
    wizardState.promo = sanitized;
    wizardState.save();
    const valid = validatePromo(sanitized);
    btnNext.disabled = !sanitized;
  });

  // Event: Paste button
  btnPaste.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      const sanitized = sanitizePromo(text);
      promoInput.value = sanitized;
      wizardState.promo = sanitized;
      wizardState.save();
      validatePromo(sanitized);
      btnNext.disabled = !sanitized;
      logger.log('promo-step', 'Pasted from clipboard:', sanitized);
    } catch (err) {
      logger.error('promo-step', 'Clipboard read failed:', err);
      promoError.textContent = 'Could not read clipboard. Please paste manually.';
      promoError.style.display = 'block';
    }
  });

  // Event: Enter key
  promoInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && wizardState.promo) {
      e.preventDefault();
      wizardState.save();
      router.navigate('/gallery');
    }
  });

  // Event: Back
  rootEl.querySelector('#stepBack').addEventListener('click', () => {
    router.navigate('/step/currency');
  });

  // Event: Next
  btnNext.addEventListener('click', () => {
    if (!wizardState.promo) return;
    wizardState.save();
    router.navigate('/gallery');
  });

  // Focus input
  setTimeout(() => promoInput.focus(), 100);

  // Telegram back button
  const webapp = window.Telegram?.WebApp;
  if (webapp) {
    webapp.BackButton.show();
    webapp.BackButton.onClick(() => {
      router.navigate('/step/currency');
    });
  }

  logger.log('promo-step', 'Rendered, current promo:', wizardState.promo);
}
