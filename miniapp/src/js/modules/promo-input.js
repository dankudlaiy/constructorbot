/**
 * Filters Screen — promo code + geo/currency/direction filters
 */

import router from './router.js';

function getFilterOptions(templates) {
  const geos = new Set();
  const currencies = new Set();
  const directions = new Set();

  templates.forEach(t => {
    if (t.geo) {
      (Array.isArray(t.geo) ? t.geo : [t.geo]).forEach(g => geos.add(g));
    }
    if (t.currency) {
      (Array.isArray(t.currency) ? t.currency : [t.currency]).forEach(c => currencies.add(c));
    }
    if (t.direction) directions.add(t.direction);
  });

  return {
    geos: [...geos].sort(),
    currencies: [...currencies].sort(),
    directions: [...directions].sort(),
  };
}

export function renderPromoInput(rootEl) {
  const mode = sessionStorage.getItem('miniapp_mode') || 'banner';
  const isBanner = mode === 'banner';
  const templates = window.templates || [];
  const { geos, currencies, directions } = getFilterOptions(templates);

  const savedPromo = sessionStorage.getItem('miniapp_promo') || '';
  const savedGeo = sessionStorage.getItem('miniapp_geo') || '';
  const savedCurrency = sessionStorage.getItem('miniapp_currency') || '';
  const savedDirection = sessionStorage.getItem('miniapp_direction') || 'all';

  const dirLabels = { sport: 'Спорт', casino: 'Казино', universal: 'Универсальный' };

  rootEl.innerHTML = `
    <div class="screen screen-filters">
      <div class="screen-header">
        <button class="btn-back" id="backBtn">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <h1 class="screen-title">${isBanner ? 'Баннер' : 'Видео'}</h1>
        <div style="width:40px"></div>
      </div>

      <div class="promo-form">
        <div class="form-group">
          <label for="promoInput">Промокод</label>
          <input
            type="text"
            id="promoInput"
            class="input-field"
            placeholder="ВВЕДИ ПРОМОКОД"
            value="${savedPromo}"
            autocomplete="off"
            autocapitalize="characters"
          >
        </div>

        <div class="form-group">
          <label for="geoSelect">Гео</label>
          <select id="geoSelect" class="select-field">
            <option value="">Все</option>
            ${geos.map(g => `<option value="${g}" ${g === savedGeo ? 'selected' : ''}>${g}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label for="currencySelect">Валюта</label>
          <select id="currencySelect" class="select-field">
            <option value="">Все</option>
            ${currencies.map(c => `<option value="${c}" ${c === savedCurrency ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label for="directionSelect">Направление</label>
          <select id="directionSelect" class="select-field">
            <option value="all" ${savedDirection === 'all' ? 'selected' : ''}>Все</option>
            ${directions.map(d =>
              `<option value="${d}" ${d === savedDirection ? 'selected' : ''}>${dirLabels[d] || d}</option>`
            ).join('')}
          </select>
        </div>

        <button id="showBtn" class="btn-primary">
          Показать ${isBanner ? 'баннеры' : 'видео'}
        </button>
      </div>
    </div>
  `;

  const promoInput = rootEl.querySelector('#promoInput');
  promoInput.addEventListener('input', () => {
    promoInput.value = promoInput.value.toUpperCase();
  });
  promoInput.focus();

  rootEl.querySelector('#backBtn').addEventListener('click', () => {
    router.navigate('/');
  });

  rootEl.querySelector('#showBtn').addEventListener('click', () => {
    const promo = promoInput.value.trim();
    if (!promo) {
      promoInput.classList.add('input-error');
      promoInput.placeholder = 'ВВЕДИ ПРОМОКОД!';
      setTimeout(() => promoInput.classList.remove('input-error'), 1000);
      return;
    }

    sessionStorage.setItem('miniapp_promo', promo);
    sessionStorage.setItem('miniapp_geo', rootEl.querySelector('#geoSelect').value);
    sessionStorage.setItem('miniapp_currency', rootEl.querySelector('#currencySelect').value);
    sessionStorage.setItem('miniapp_direction', rootEl.querySelector('#directionSelect').value);

    router.navigate('/gallery');
  });

  promoInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') rootEl.querySelector('#showBtn').click();
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
}
