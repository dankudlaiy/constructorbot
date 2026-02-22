/**
 * Gallery Screen
 * Grid of templates + single download button at bottom.
 * Uses wizardState for filtering instead of raw sessionStorage.
 */

import router from './router.js';
import logger from './logger.js';
import wizardState from './wizard-state.js';
import { drawPromoOnCanvas, loadImage } from './canvas-renderer.js';
import { downloadSelectedAsZip } from './download.js';

let selectedIds = new Set();
let isSelectAll = false;

function filterTemplates(templates) {
  return templates.filter(t => {
    // Filter by mode (banner vs video)
    const tplType = t.template_type || (t.has_video ? 'video' : 'banner');
    if (wizardState.mode === 'video' && tplType !== 'video') return false;
    if (wizardState.mode === 'banner' && tplType === 'video') return false;

    // Filter by directions (multi-select)
    if (wizardState.directions.length > 0) {
      const tDirs = Array.isArray(t.directions) ? t.directions : [t.direction];
      if (!wizardState.directions.some(d => tDirs.includes(d))) return false;
    }

    // Filter by language (geo field)
    if (wizardState.language) {
      if (t.geo !== wizardState.language) return false;
    }

    // Filter by currency
    if (wizardState.currency) {
      if (t.currency !== wizardState.currency) return false;
    }

    return true;
  });
}

function sortTemplates(templates) {
  return [...templates].sort((a, b) => {
    if (a.size === '1x1' && b.size !== '1x1') return -1;
    if (a.size !== '1x1' && b.size === '1x1') return 1;
    return 0;
  });
}

async function renderCard(template, promoText) {
  const card = document.createElement('div');
  card.className = 'gallery-card';
  card.dataset.imageId = template.image_id;

  const canvas = document.createElement('canvas');
  const isVertical = template.size === '9x16';
  canvas.width = isVertical ? 135 : 160;
  canvas.height = isVertical ? 240 : 160;
  canvas.className = 'gallery-canvas';

  const label = document.createElement('div');
  label.className = 'gallery-label';
  label.textContent = template.template_name || `#${template.image_id}`;

  const checkbox = document.createElement('div');
  checkbox.className = 'gallery-checkbox';
  checkbox.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20">
    <circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="1.5" fill="none"/>
    <path class="check-mark" d="M6 10L9 13L14 7" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0"/>
  </svg>`;

  card.appendChild(canvas);
  card.appendChild(label);
  card.appendChild(checkbox);

  try {
    const image = await loadImage(template.preview_url || template.image_url);
    drawPromoOnCanvas(canvas, image, template, promoText);
  } catch (err) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#666';
    ctx.font = '11px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('Error', canvas.width / 2, canvas.height / 2);
  }

  card.addEventListener('click', () => {
    const id = template.image_id;
    if (selectedIds.has(id)) {
      selectedIds.delete(id);
      card.classList.remove('selected');
    } else {
      selectedIds.add(id);
      card.classList.add('selected');
    }
    updateSelectionUI();
  });

  if (selectedIds.has(template.image_id)) {
    card.classList.add('selected');
  }

  return card;
}

function updateSelectionUI() {
  const counter = document.getElementById('selectionCounter');
  const selectAllBtn = document.getElementById('selectAllBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const allCards = document.querySelectorAll('.gallery-card');

  if (counter) counter.textContent = selectedIds.size > 0 ? `${selectedIds.size}` : '';

  if (downloadBtn) downloadBtn.disabled = selectedIds.size === 0;

  isSelectAll = allCards.length > 0 && selectedIds.size === allCards.length;
  if (selectAllBtn) selectAllBtn.classList.toggle('active', isSelectAll);
}

export function renderGallery(rootEl) {
  wizardState.load();
  const mode = wizardState.mode;
  const isBanner = mode === 'banner';
  const templates = window.templates || [];
  const promoText = wizardState.promo;

  logger.log('gallery', `mode=${mode}, total templates=${templates.length}, promo="${promoText}"`);
  logger.log('gallery', `filters: dirs=${wizardState.directions}, lang=${wizardState.language}, cur=${wizardState.currency}`);

  const filtered = sortTemplates(filterTemplates(templates));
  logger.log('gallery', `After filtering: ${filtered.length} templates`);

  selectedIds = new Set();

  const titleLabel = isBanner ? 'Banners' : 'Videos';
  const emptyLabel = isBanner
    ? 'No banners found for selected filters'
    : 'No videos found for selected filters';

  rootEl.innerHTML = `
    <div class="screen screen-gallery">
      <div class="screen-header">
        <button class="btn-back" id="backBtn">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <h1 class="screen-title">${titleLabel}</h1>
        <div style="width:40px"></div>
      </div>

      <div class="gallery-controls">
        <button id="selectAllBtn" class="btn-select-all">Select all</button>
        <span id="selectionCounter" class="selection-counter"></span>
      </div>

      <div id="galleryGrid" class="gallery-grid">
        ${filtered.length === 0 ? `<div class="gallery-empty">${emptyLabel}</div>` : ''}
      </div>

      <div class="bottom-bar">
        <div class="bottom-bar-buttons">
          <button id="downloadBtn" class="btn-download btn-download-primary" disabled>
            Download
          </button>
        </div>
      </div>
    </div>
  `;

  rootEl.querySelector('#backBtn').addEventListener('click', () => {
    router.navigate('/step/promo');
  });

  rootEl.querySelector('#selectAllBtn').addEventListener('click', () => {
    const allCards = document.querySelectorAll('.gallery-card');
    if (isSelectAll) {
      selectedIds.clear();
      allCards.forEach(c => c.classList.remove('selected'));
    } else {
      allCards.forEach(c => {
        const id = parseInt(c.dataset.imageId, 10);
        selectedIds.add(id);
        c.classList.add('selected');
      });
    }
    updateSelectionUI();
  });

  rootEl.querySelector('#downloadBtn').addEventListener('click', async () => {
    const selectedTemplates = filtered.filter(t => selectedIds.has(t.image_id));
    logger.log('gallery', `Download clicked, ${selectedTemplates.length} templates selected`);
    if (selectedTemplates.length === 0) return;
    await downloadSelectedAsZip(selectedTemplates, promoText);
  });

  const grid = rootEl.querySelector('#galleryGrid');
  if (filtered.length > 0) {
    renderCards(grid, filtered, promoText);
  }

  const webapp = window.Telegram?.WebApp;
  if (webapp) {
    webapp.BackButton.show();
    webapp.BackButton.onClick(() => {
      router.navigate('/step/promo');
    });
  }
}

async function renderCards(grid, templates, promoText) {
  grid.innerHTML = templates.map(() =>
    '<div class="gallery-card skeleton"><div class="skeleton-canvas"></div></div>'
  ).join('');

  const BATCH_SIZE = 4;
  const cards = [];

  for (let i = 0; i < templates.length; i += BATCH_SIZE) {
    const batch = templates.slice(i, i + BATCH_SIZE);
    const batchCards = await Promise.all(batch.map(t => renderCard(t, promoText)));
    cards.push(...batchCards);
    grid.innerHTML = '';
    cards.forEach(card => grid.appendChild(card));
  }
}
