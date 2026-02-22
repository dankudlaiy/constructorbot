import '../css/admin.css'
(function() {
  // === Tab Navigation (mobile) ===
  const adminTabs = document.querySelectorAll('.admin-tab:not(.admin-tab-link)');
  const tabPanels = document.querySelectorAll('.tab-panel');

  function switchTab(tabName) {
    adminTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    tabPanels.forEach(p => p.classList.toggle('active', p.dataset.tab === tabName));
  }

  adminTabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // === Direction Chips ===
  const directionChips = document.querySelectorAll('#directionChips input[type="checkbox"]');
  const directionsInput = document.getElementById('directionsInput');
  const directionSelectLegacy = document.getElementById('directionSelect');

  function syncDirections() {
    const selected = [];
    directionChips.forEach(cb => {
      if (cb.checked) selected.push(cb.value);
    });
    if (directionsInput) directionsInput.value = selected.join(',');
    // Legacy compat: set old select to first direction
    if (directionSelectLegacy && selected.length > 0) {
      directionSelectLegacy.value = selected[0];
    }
  }

  directionChips.forEach(cb => {
    cb.addEventListener('change', syncDirections);
  });

  function setDirectionChips(slugs) {
    if (!Array.isArray(slugs)) slugs = [];
    directionChips.forEach(cb => {
      cb.checked = slugs.includes(cb.value);
    });
    syncDirections();
  }

  let currentImageUrl = null;
  window.currentImageUrl = currentImageUrl;
  let image = new Image();
  image.crossOrigin = 'anonymous';
  
  // Video-related variables
  const previewVideo = document.getElementById('previewVideo');
  const playPauseBtn = document.getElementById('playPauseBtn');
  let isRendering = false;
  let rafId = null;
  let currentVideoUrl = null;
  
  // Timeline-related variables
  const videoTimelineContainer = document.getElementById('videoTimelineContainer');
  const videoTimeline = document.getElementById('videoTimeline');
  const selectedRange = document.getElementById('selectedRange');
  const startRangeMarker = document.getElementById('startRangeMarker');
  const endRangeMarker = document.getElementById('endRangeMarker');
  const startRangeLabel = document.getElementById('startRangeLabel');
  const endRangeLabel = document.getElementById('endRangeLabel');
  const durationLabel = document.getElementById('durationLabel');
  let isDraggingTimeline = false;
  let draggedMarker = null; // 'start' or 'end'
  let videoDuration = 0;
  let isSeeking = false;
  let dragThrottleTimeout = null;
  let startTime = 0; // Start time for promo display
  let endTime = 0; // End time for promo display
  let isInitialized = false; // Flag to track if timeline is initialized
  
  // Global video state variables
  let currentVideoTime = 0; // Current video position in seconds
  let lastSeekedTime = 0; // Last seeked time for video restoration
  let isVideoPaused = true; // Video pause state
  
  // Constants and flags for time restoration
const EPS = 0.01; // tolerance instead of strict 0
let pendingRestoreTime = null; // if we need to restore time after play()
let playGuardUntil = 0; // protection from brief rollback to 0 after play()

// === Новое: контролируемый рестор времени ===
let restoreTarget = null;
let restoreAttempts = 0;
let restoreTimer = null;
const MAX_RESTORE_ATTEMPTS = 8;

  let rect = {
    x: 0,
    y: 0,
    width: 450,
    height: 100,
    fill: 'rgba(255,0,0,0.7)'
  };

  let geoList = [];
  let currencyList = [];
  let countryCurrency = {};
  let selectedTemplateId = null;
  let templateToDelete = null;
  let currentImageIndex = 0;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  let dragStartTime = 0;
  let dragThreshold = 5; // Minimum distance to start dragging
  let imageDeleteGeo = null;
  let imageDeleteCurrency = null;

  const fileInput = document.getElementById('custom_image');
  const textInput = document.getElementById('textInput');
  const sizeInput = document.getElementById('text_size');
  const angleInput = document.getElementById('skew_angle');
  const alignSelect = document.getElementById('text_alignment');
  const colorInput = document.getElementById('text_color');
  const posXInput = document.getElementById('position_x');
  const posYInput = document.getElementById('position_y');
  const canvasEl = document.getElementById('canvas');
  const ctx = canvasEl ? canvasEl.getContext('2d') : null;
  const colorPreview = document.getElementById('colorPreview');
  const templateList = document.getElementById('templateList');
  const addTemplateBtn = document.getElementById('addTemplateBtn');
  const geoSelect = document.getElementById('geoSelect');
  const geoSelectDisplay = document.getElementById('geoSelectDisplay');
  const geoSelectOptions = document.getElementById('geoSelectOptions');
  const currencySelect = document.getElementById('currencySelect');
  const addGeoBtn = document.getElementById('addGeoBtn');
  const addCurrencyBtn = document.getElementById('addCurrencyBtn');
  const templateName = document.getElementById('templateName');
  const templateNameDisplay = document.getElementById('templateNameDisplay');
  const addTemplateNameBtn = document.getElementById('addTemplateNameBtn');
  const geoListInput = document.getElementById('geo_list');
  const currencyListInput = document.getElementById('currency_list');
  const config = window.adminConfig || {};
  const deleteModal = document.getElementById('deleteModal');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const uploadToClientBtn = document.getElementById('uploadToClientBtn');
  const videoSizeInput = document.getElementById('video_size');
  const sizeToggleBtns = document.querySelectorAll('.size-toggle-btn');
  const promoStartInput = document.getElementById('promo_start');
  const promoEndInput = document.getElementById('promo_end');

  // Video size management
  let currentVideoSize = '1x1'; // 1x1 or 9x16

  // Function to update canvas size
  function updateCanvasSize(size) {
    // Store current rectangle position before resize
    const oldRectX = rect.x;
    const oldSize = currentVideoSize;
    
    currentVideoSize = size;
    videoSizeInput.value = size;
    
    if (size === '1x1') {
      canvasEl.width = 400;
      canvasEl.height = 400;
    } else if (size === '9x16') {
      canvasEl.width = 225;
      canvasEl.height = 400;
    }
    
    // Adjust rectangle position for new canvas size
    // For 9x16, we need to scale the X position proportionally
    if (size === '9x16' && oldSize === '1x1') {
      // Scale from 400px width to 225px width
      rect.x = (oldRectX / 400) * 225;
    } else if (size === '1x1' && oldSize === '9x16') {
      // Scale from 225px width to 400px width
      rect.x = (oldRectX / 225) * 400;
    }
    
    // Update input fields
    posXInput.value = Math.round(rect.x);
    posYInput.value = Math.round(rect.y);
    
    // Update timeline positioning to fit within canvas
    updateTimelinePositioning();
    
    // Redraw everything
    draw();
    
    // Update timeline positioning again after a short delay to ensure CSS is applied
    setTimeout(() => {
      updateTimelinePositioning();
    }, 100);
  }

  // Function to update timeline positioning based on canvas size
  function updateTimelinePositioning() {
    const videoTimelineContainer = document.getElementById('videoTimelineContainer');
    if (!videoTimelineContainer) return;
    
    // Get the actual visual size of the canvas (including CSS scaling)
    const canvasRect = canvasEl.getBoundingClientRect();
    const canvasContainerRect = canvasEl.parentElement.getBoundingClientRect();
    
    // Calculate the actual canvas width within its container
    const actualCanvasWidth = canvasRect.width;
    const margin = 20; // Margin from edges
    const maxWidth = actualCanvasWidth - (margin * 2);
        
    // Ensure timeline doesn't exceed canvas width
    if (maxWidth > 0) {
      videoTimelineContainer.style.left = `${margin}px`;
      videoTimelineContainer.style.right = 'auto'; // Remove right positioning
      videoTimelineContainer.style.width = `${maxWidth}px`;
    }
  }

  // Function to update button states
  function updateSizeToggleButtons(activeSize) {
    sizeToggleBtns.forEach(btn => {
      if (btn.dataset.size === activeSize) {
        btn.classList.add('active');
        btn.style.border = '2px solid #0F917E';
        btn.style.background = '#0F917E';
        btn.style.color = 'white';
      } else {
        btn.classList.remove('active');
        btn.style.border = '2px solid #ccc';
        btn.style.background = 'white';
        btn.style.color = '#666';
      }
    });
  }

  // Add event listeners for size toggle buttons
  sizeToggleBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const size = this.dataset.size;
      updateCanvasSize(size);
      updateSizeToggleButtons(size);
    });
  });

  if (Array.isArray(config.geo_list)) {
    geoList = [...config.geo_list];
  }
  if (Array.isArray(config.currency_list)) {
    currencyList = [...config.currency_list];
  }

  if (geoSelectDisplay && geoSelectOptions) {
    geoSelectDisplay.addEventListener('click', function(e) {
      e.stopPropagation();
      geoSelectOptions.classList.toggle('select-hide');
      if (!geoSelectOptions.classList.contains('select-hide')) {
        geoSelectDisplay.classList.add('active');
        const items = geoSelectOptions.querySelectorAll('.select-item');
        items.forEach(item => {
          if (geoSelect && geoSelect.value === item.dataset.value) {
            item.classList.add('selected-geo');
          } else {
            item.classList.remove('selected-geo');
          }
        });
      } else {
        geoSelectDisplay.classList.remove('active');
      }
    });

    document.addEventListener('click', function(e) {
      if (!geoSelectDisplay.contains(e.target) && !geoSelectOptions.contains(e.target)) {
        geoSelectOptions.classList.add('select-hide');
        geoSelectDisplay.classList.remove('active');
      }
    });

    geoSelectOptions.addEventListener('click', function(e) {
      const selectItem = e.target.closest('.select-item');
      if (!selectItem) return;

      const value = selectItem.dataset.value;
      if (geoSelect) geoSelect.value = value;
      geoSelectDisplay.textContent = value;
      geoSelectOptions.classList.add('select-hide');

      const items = geoSelectOptions.querySelectorAll('.select-item');
      items.forEach(item => {
        if (geoSelect && geoSelect.value === item.dataset.value) {
          item.classList.add('selected-geo');
        } else {
          item.classList.remove('selected-geo');
        }
      });

      if (geoSelect) {
        const event = new Event('change');
        geoSelect.dispatchEvent(event);
      }
    });
  }

  function selectFirstTemplate() {
    const firstTemplate = document.querySelector('.template-item');
    if (firstTemplate) {
      const templateId = parseInt(firstTemplate.dataset.id);
      if (!isNaN(templateId)) {
        loadTemplateData(templateId);
      }
    };
  }

  // Wait for DOM and data to be fully loaded
  function restoreTemplateState() {
    const lastTemplateId = sessionStorage.getItem('selectedTemplateId');
    const lastImageIndex = sessionStorage.getItem('selectedImageIndex');
    
    if (lastTemplateId && window.templates && Array.isArray(window.templates)) {
      const templateId = parseInt(lastTemplateId, 10);
      const templateExists = window.templates.some(t => t.id === templateId);
      
      if (templateExists) {
        loadTemplateData(templateId);
        
        if (lastImageIndex !== null) {
          const imageIndex = parseInt(lastImageIndex, 10);
          const template = window.templates.find(t => t.id === templateId);
          if (template && template.images && template.images.length > imageIndex) {
            setTimeout(() => {
              navigateToImage(imageIndex);
            }, 500); // Increased delay to ensure template is fully loaded
          }
        }
        return;
      }
    }
    selectFirstTemplate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        restoreTemplateState();
        updateTimelinePositioning();
        // Force draw after template is loaded
        setTimeout(() => {
          draw();
        }, 500);
      }, 100);
    });
  } else {
    if (window.templates && Array.isArray(window.templates)) {
      restoreTemplateState();
      // Update timeline positioning
      updateTimelinePositioning();
      // Force draw after template is loaded
      setTimeout(() => {
        draw();
      }, 500);
    } else {
      setTimeout(() => {
        restoreTemplateState();
        // Update timeline positioning
        updateTimelinePositioning();
        // Force draw after template is loaded
        setTimeout(() => {
          draw();
        }, 500);
      }, 100);
    }
  }

  function renderGeoList() {
    if (!geoSelectOptions) return;
    
    geoSelectOptions.innerHTML = '';
    geoList.forEach(val => {
      const div = document.createElement('div');
      div.className = 'select-item';
      div.dataset.value = val;
      div.innerHTML = `
        <span>${val}</span>
      `;
      if (geoSelect && geoSelect.value === val) {
        div.classList.add('selected-geo');
      }
      geoSelectOptions.appendChild(div);
    });
    
    if (geoListInput) {
      geoListInput.value = JSON.stringify(geoList);
    }
    
    if (geoSelectDisplay) {
      if (geoSelect && geoSelect.value) {
        geoSelectDisplay.textContent = geoSelect.value;
      } else {
        geoSelectDisplay.textContent = 'Выберите гео';
      }
    }
  }

  function renderCurrencyList() {
    currencySelect.innerHTML = '';
    currencyList.forEach(val => {
      const option = document.createElement('option');
      option.value = val;
      option.textContent = val;
      currencySelect.appendChild(option);
    });
    currencyListInput.value = JSON.stringify(currencyList);
  }

  const geoInput = document.getElementById('geoInput');
  const geoSuggestions = document.getElementById('geoSuggestions');
  const currencyInput = document.getElementById('currencyInput');
  const currencySuggestions = document.getElementById('currencySuggestions');

  function updateClientAccessButton(clientAccess) {
    if (clientAccess) {
      uploadToClientBtn.textContent = 'СНЯТЬ С КЛИЕНТА';
      uploadToClientBtn.classList.add('active');
    } else {
      uploadToClientBtn.textContent = 'ЗАЛИТЬ НА КЛИЕНТ';
      uploadToClientBtn.classList.remove('active');
    }
  }

  function loadTemplateData(templateId) {
    sessionStorage.setItem('selectedTemplateId', templateId);
    const template = window.templates.find(t => t.id === templateId);
    if (!template) {
      return;
    }
    selectedTemplateId = templateId;
    document.querySelectorAll('.template-item').forEach(item => {
      item.classList.toggle('selected', item.dataset.id === String(templateId));
    });

    // Switch to editor tab on mobile
    switchTab('editor');

    updateClientAccessButton(template.client_access);

    templateName.value = template.template_name;
    templateNameDisplay.textContent = template.template_name;
    document.getElementById('directionSelect').value = template.direction;

    // Load direction chips from template data
    const dirs = template.directions_list || (template.direction ? [template.direction] : []);
    setDirectionChips(dirs);

    // Set template_type and update file input
    const tplType = template.template_type || 'video';
    const templateTypeInput = document.getElementById('template_type');
    if (templateTypeInput) templateTypeInput.value = tplType;
    const fileInputLabel = document.getElementById('fileInputLabel');
    if (tplType === 'banner') {
      fileInput.accept = 'image/*';
      if (fileInputLabel) fileInputLabel.textContent = 'ЗАГРУЗИТЬ ФОТО';
    } else {
      fileInput.accept = 'video/*';
      if (fileInputLabel) fileInputLabel.textContent = 'ЗАГРУЗИТЬ ВИДЕО';
    }
    
    // Load video size if available
    if (template.video_size) {
      currentVideoSize = template.video_size;
      videoSizeInput.value = template.video_size;
      updateCanvasSize(template.video_size);
      updateSizeToggleButtons(template.video_size);
    } else {
      // Default to 1x1 if no size is specified
      currentVideoSize = '1x1';
      videoSizeInput.value = '1x1';
      updateCanvasSize('1x1');
      updateSizeToggleButtons('1x1');
    }

    if (typeof template.images === 'string') {
      try {
        const outerStr = template.images.replace(/^{|}$/g, '');
        const items = outerStr.split('","').map(item => {
          const cleanItem = item
            .replace(/^"|"$/g, '')
            .replace(/\\"/g, '"')
            .replace(/\s*:\s*/g, ':')
            .replace(/\s*,\s*/g, ',');
          return JSON.parse(cleanItem);
        });
        template.images = items;
      } catch (e) {
        template.images = [];
      }
    }

    geoList = template.geo_list || [];
    currencyList = template.currency_list || [];
    renderGeoList();
    renderCurrencyList();

    // Check if we have a saved image index from sessionStorage
    const savedImageIndex = sessionStorage.getItem('selectedImageIndex');
    let initialImageIndex = 0;

    if (savedImageIndex !== null && template.images && Array.isArray(template.images)) {
      const parsedIndex = parseInt(savedImageIndex, 10);
      if (parsedIndex >= 0 && parsedIndex < template.images.length) {
        initialImageIndex = parsedIndex;
      }
    } else if (template.images && Array.isArray(template.images) && template.images.length > 0) {
      // Fallback: try to find matching image by geo/currency
      const currentGeo = geoSelect.value;
      const currentCurrency = currencySelect.value;
      const matchingImageIndex = template.images.findIndex(img =>
        img.geo === currentGeo && img.currency === currentCurrency
      );
      if (matchingImageIndex !== -1) {
        initialImageIndex = matchingImageIndex;
      }
    }
    currentImageIndex = initialImageIndex;

    renderImageNavigationButtons(template.images, currentImageIndex);
    displayImageSettings(template.images[currentImageIndex] || null);
    
    // Save current image index
    sessionStorage.setItem('selectedImageIndex', currentImageIndex);
    
    // Update delete button visibility after everything is loaded
    updateDeleteButtonVisibility();
  }

  templateList.addEventListener('click', function(e) {
    const deleteBtn = e.target.closest('.delete-template-btn');
    if (deleteBtn) {
      e.stopPropagation();
      templateToDelete = parseInt(deleteBtn.dataset.id);
      if (!isNaN(templateToDelete)) {
        deleteModal.style.display = 'flex';
      }
    } else {
      const templateItem = e.target.closest('.template-item');
      if (!templateItem) return;
      
      const templateId = templateItem.dataset.id;
      
      if (templateId === 'new') {
        // Обрабатываем новый шаблон
        selectedTemplateId = null;
        document.querySelectorAll('.template-item').forEach(item => {
          item.classList.toggle('selected', item === templateItem);
        });
        
        updateClientAccessButton(false);
        document.getElementById('configForm').reset();
        templateName.value = templateItem.dataset.name;
        templateNameDisplay.textContent = templateItem.dataset.name;
        colorInput.value = 'FFFFFF';
        rect.x = 0;
        rect.y = 0;
        geoList = [];
        currencyList = [];
        renderGeoList();
        renderCurrencyList();
        updateColorPreview();
        
        // Reset video size to default
        currentVideoSize = '1x1';
        videoSizeInput.value = '1x1';
        updateCanvasSize('1x1');
        updateSizeToggleButtons('1x1');

        image = new Image();
        image.crossOrigin = 'anonymous';
        currentImageUrl = null;
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
        canvasEl.style.backgroundImage = 'none';
        draw();
        fileInput.value = '';

        // Очищаем цифры под канвасом
        const imageNavButtonsContainer = document.querySelector('.image-nav-buttons');
        if (imageNavButtonsContainer) imageNavButtonsContainer.innerHTML = '';

        // Сбрасываем дропдауны
        if (geoSelect) geoSelect.value = '';
        if (geoSelectDisplay) geoSelectDisplay.textContent = 'Выберите гео';
        if (currencySelect) currencySelect.value = '';

        // Reset direction chips
        setDirectionChips([]);

        // Switch to editor tab
        switchTab('editor');

        // Загружаем все валюты для подсказок
        loadAllCurrencies();
      } else {
        // Обрабатываем существующий шаблон
        const numericId = parseInt(templateId);
        if (isNaN(numericId)) return;
        loadTemplateData(numericId);
      }
    }
  });

  uploadToClientBtn.addEventListener('click', function() {
    if (!selectedTemplateId) {
      alert('Пожалуйста, выберите шаблон');
      return;
    }

    const template = window.templates.find(t => t.id === selectedTemplateId);
    if (!template) return;

    const newStatus = !template.client_access;
    const action = newStatus ? 'enable_client_access' : 'disable_client_access';

    fetch('admin.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `action=${action}&template_id=${selectedTemplateId}`
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.success) {
        template.client_access = newStatus;
        updateClientAccessButton(newStatus);
        const templateElement = document.querySelector(`.template-item[data-id="${selectedTemplateId}"]`);
        if (templateElement) {
          templateElement.classList.toggle('client-access', newStatus);
        }
      } else {
        throw new Error(data.error || 'Unknown error occurred');
      }
    })
    .catch(error => {
      console.error('Error:', error);
      alert('Произошла ошибка при изменении статуса доступа: ' + error.message);
    });
  });

  // Create template modal logic
  const createTemplateModal = document.getElementById('createTemplateModal');
  const confirmCreateBtn = document.getElementById('confirmCreateBtn');
  const cancelCreateBtn = document.getElementById('cancelCreateBtn');
  const newTemplateNameInput = document.getElementById('newTemplateName');
  let pendingTemplateType = 'video';

  function openCreateModal() {
    const existingTemplates = templateList.querySelectorAll('.template-item');
    const newTemplateNumber = existingTemplates.length + 1;
    newTemplateNameInput.value = `Шаблон ${newTemplateNumber}`;
    pendingTemplateType = 'video';
    document.querySelectorAll('.create-type-btn').forEach(btn => {
      const isVideo = btn.dataset.type === 'video';
      btn.style.border = isVideo ? '2px solid #0F917E' : '2px solid #ccc';
      btn.style.background = isVideo ? '#0F917E' : '#fff';
      btn.style.color = isVideo ? '#fff' : '#666';
    });
    createTemplateModal.style.display = 'flex';
    setTimeout(() => newTemplateNameInput.focus(), 50);
  }

  document.querySelectorAll('.create-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      pendingTemplateType = btn.dataset.type;
      document.querySelectorAll('.create-type-btn').forEach(b => {
        const active = b.dataset.type === pendingTemplateType;
        b.style.border = active ? '2px solid #0F917E' : '2px solid #ccc';
        b.style.background = active ? '#0F917E' : '#fff';
        b.style.color = active ? '#fff' : '#666';
      });
    });
  });

  cancelCreateBtn && cancelCreateBtn.addEventListener('click', () => {
    createTemplateModal.style.display = 'none';
  });
  createTemplateModal && createTemplateModal.addEventListener('click', e => {
    if (e.target === createTemplateModal) createTemplateModal.style.display = 'none';
  });

  function applyNewTemplate(name, type) {
    selectedTemplateId = null;
    document.querySelectorAll('.template-item').forEach(item => item.classList.remove('selected'));

    const newTemplateItem = document.createElement('div');
    newTemplateItem.className = 'template-item selected';
    newTemplateItem.dataset.id = 'new';
    newTemplateItem.dataset.name = name;
    newTemplateItem.dataset.directions = '';
    newTemplateItem.innerHTML = `
      <div class="template-item-info">
        <span class="template-item-name">${name}</span>
        <span class="template-item-meta">${type === 'banner' ? '🖼' : '🎬'} новый</span>
      </div>
      <div class="template-item-actions">
        <button class="delete-template-btn" data-id="new" type="button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    `;
    templateList.insertBefore(newTemplateItem, templateList.firstChild);

    // Reset direction chips
    setDirectionChips([]);

    // Switch to editor tab
    switchTab('editor');

    // Set template_type in form
    const templateTypeInput = document.getElementById('template_type');
    if (templateTypeInput) templateTypeInput.value = type;

    // Update file input accept based on type
    const fileInputLabel = document.getElementById('fileInputLabel');
    if (type === 'banner') {
      fileInput.accept = 'image/*';
      if (fileInputLabel) fileInputLabel.textContent = 'ЗАГРУЗИТЬ ФОТО';
    } else {
      fileInput.accept = 'video/*';
      if (fileInputLabel) fileInputLabel.textContent = 'ЗАГРУЗИТЬ ВИДЕО';
    }

    updateClientAccessButton(false);
    document.getElementById('configForm').reset();
    templateName.value = name;
    templateNameDisplay.textContent = name;
    // Restore template_type after form reset
    if (templateTypeInput) templateTypeInput.value = type;
    colorInput.value = 'FFFFFF';
    rect.x = 0;
    rect.y = 0;
    geoList = [];
    currencyList = [];
    renderGeoList();
    renderCurrencyList();
    updateColorPreview();

    currentVideoSize = '1x1';
    videoSizeInput.value = '1x1';
    updateCanvasSize('1x1');
    updateSizeToggleButtons('1x1');

    image = new Image();
    image.crossOrigin = 'anonymous';
    currentImageUrl = null;
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    canvasEl.style.backgroundImage = 'none';
    draw();
    fileInput.value = '';

    const imageNavButtonsContainer = document.querySelector('.image-nav-buttons');
    if (imageNavButtonsContainer) imageNavButtonsContainer.innerHTML = '';

    if (geoSelect) geoSelect.value = '';
    if (geoSelectDisplay) geoSelectDisplay.textContent = 'Выберите гео';
    if (currencySelect) currencySelect.value = '';

    loadAllCurrencies();
  }

  confirmCreateBtn && confirmCreateBtn.addEventListener('click', () => {
    const name = newTemplateNameInput.value.trim() || newTemplateNameInput.placeholder;
    createTemplateModal.style.display = 'none';
    applyNewTemplate(name, pendingTemplateType);
  });

  newTemplateNameInput && newTemplateNameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmCreateBtn.click();
  });

  addTemplateBtn.addEventListener('click', () => {
    openCreateModal();
  });

  addTemplateNameBtn.addEventListener('click', () => {
    const templateNameDisplay = document.getElementById('templateNameDisplay');
    const templateName = document.getElementById('templateName');

    templateNameDisplay.style.display = 'none';
    templateName.style.display = 'block';
    templateName.focus();
    addTemplateNameBtn.classList.add('selected');

    if (templateNameDisplay.textContent !== 'Введите название шаблона') {
        templateName.value = templateNameDisplay.textContent;
    }
  });

  templateName.addEventListener('blur', function() {
    const templateNameDisplay = document.getElementById('templateNameDisplay');
    
    if (this.value.trim()) {
        templateNameDisplay.textContent = this.value;
        
        // Обновляем название в списке шаблонов, если это новый шаблон
        const selectedTemplateItem = document.querySelector('.template-item.selected');
        if (selectedTemplateItem && selectedTemplateItem.dataset.id === 'new') {
          selectedTemplateItem.dataset.name = this.value.trim();
          selectedTemplateItem.querySelector('span').textContent = this.value.trim();
        }
    } else {
        templateNameDisplay.textContent = 'Введите название шаблона';
    }
    this.style.display = 'none';
    templateNameDisplay.style.display = 'flex';
    addTemplateNameBtn.classList.remove('selected');
  });

  templateName.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        this.blur();
    }
  });

  // Add focus/blur handlers for template name input
  templateName.addEventListener('focus', () => {
    addTemplateNameBtn.classList.add('selected');
  });

  templateName.addEventListener('blur', () => {
    if (templateName.style.display === 'none') {
      addTemplateNameBtn.classList.remove('selected');
    }
  });

  addGeoBtn.addEventListener('click', () => {
    // Hide dropdown and show input
    const customSelect = geoSelectDisplay.closest('.custom-select');
    if (customSelect) customSelect.classList.add('hidden');
    if (geoSelectOptions) geoSelectOptions.classList.add('select-hide');
    const inputWithButton = document.querySelector('.input-with-button');
    if (inputWithButton) {
      inputWithButton.style.display = 'block';
    }
    if (geoInput) {
      geoInput.style.display = 'block';
      geoInput.value = '';
      geoInput.focus();
    }
    const geoDoneBtn = document.getElementById('geoDoneBtn');
    if (geoDoneBtn) {
      geoDoneBtn.style.display = 'block';
    }
    if (geoSuggestions) {
      geoSuggestions.style.display = 'none';
    }
    addGeoBtn.classList.add('selected');
  });

  // Add click handler for the done button
  const geoDoneBtn = document.getElementById('geoDoneBtn');
  if (geoDoneBtn) {
    geoDoneBtn.addEventListener('click', () => {
      if (!geoInput) return;
      const newGeo = geoInput.value.trim().toUpperCase();
      if (!newGeo) return;

      if (geoList.includes(newGeo)) {
        // Просто выбираем существующее гео, как из дропдауна
        if (geoSelect) geoSelect.value = newGeo;
        if (geoSelectDisplay) {
          geoSelectDisplay.textContent = newGeo;
          geoSelectDisplay.classList.remove('hidden');
        }
        // Если есть валюта для этого гео — выставляем её
        const currency = countryCurrency[newGeo];
        if (currency && currencySelect) {
          currencySelect.value = currency;
        }
      } else {
        // Добавляем как кастомное гео
        geoList.push(newGeo);
        renderGeoList();
        if (geoSelect) geoSelect.value = newGeo;
        if (geoSelectDisplay) {
          geoSelectDisplay.textContent = newGeo;
          geoSelectDisplay.classList.remove('hidden');
        }
        // Если есть валюта для этого гео — добавляем в список и выставляем
        const currency = countryCurrency[newGeo];
        if (currency && !currencyList.includes(currency)) {
          currencyList.push(currency);
          renderCurrencyList();
          if (currencySelect) currencySelect.value = currency;
        }
      }

      // Hide input and show dropdown
      geoInput.style.display = 'none';
      geoDoneBtn.style.display = 'none';
      const inputWithButton = document.querySelector('.input-with-button');
      if (inputWithButton) {
        inputWithButton.style.display = 'none';
      }
      const customSelect = document.querySelector('.custom-select');
      if (customSelect) customSelect.classList.remove('hidden');
      if (geoSuggestions) {
        geoSuggestions.style.display = 'none';
      }
      addGeoBtn.classList.remove('selected');
      // --- Программно вызываем change для geoSelect и currencySelect ---
      if (geoSelect) {
        geoSelect.dispatchEvent(new Event('change'));
      }
      if (currencySelect) {
        currencySelect.dispatchEvent(new Event('change'));
      }
    });
  }

  // Add click handlers for suggestions
  if (geoSuggestions) {
    geoSuggestions.addEventListener('mousedown', function(e) {
      if (!e.target.classList.contains('autocomplete-suggestion')) return;
      const country = e.target.textContent;
      
      // Add new geo to the list if it doesn't exist
      if (!geoList.includes(country)) {
        geoList.push(country);
        renderGeoList();
      }

      // Select the new geo in the dropdown
      if (geoSelect) geoSelect.value = country;
      if (geoSelectDisplay) {
        geoSelectDisplay.textContent = country;
        geoSelectDisplay.classList.remove('hidden');
      }
      
      const currency = countryCurrency[country];
      if (currency && !currencyList.includes(currency)) {
        currencyList.push(currency);
        renderCurrencyList();
        if (currencySelect) currencySelect.value = currency;
      }
      
      // Hide input and show dropdown
      if (geoInput) geoInput.style.display = 'none';
      geoSuggestions.style.display = 'none';
      const inputWithButton = document.querySelector('.input-with-button');
      if (inputWithButton) {
        inputWithButton.style.display = 'none';
      }
      const customSelect = document.querySelector('.custom-select');
      if (customSelect) customSelect.classList.remove('hidden');
      addGeoBtn.classList.remove('selected');
      // --- Программно вызываем change для geoSelect и currencySelect ---
      if (geoSelect) {
        geoSelect.dispatchEvent(new Event('change'));
      }
      if (currencySelect) {
        currencySelect.dispatchEvent(new Event('change'));
      }
    });
  }

  // Add document click handler to close input when clicking outside
  document.addEventListener('click', function(e) {
    const geoContainer = document.querySelector('.form-group:has(#geoInput)');
    if (geoInput && geoInput.style.display === 'block' && 
        !geoContainer.contains(e.target) && 
        e.target !== addGeoBtn) {
      // Hide input and show dropdown
      geoInput.style.display = 'none';
      const geoDoneBtn = document.getElementById('geoDoneBtn');
      if (geoDoneBtn) geoDoneBtn.style.display = 'none';
      const inputWithButton = document.querySelector('.input-with-button');
      if (inputWithButton) inputWithButton.style.display = 'none';
      const customSelect = document.querySelector('.custom-select');
      if (customSelect) customSelect.classList.remove('hidden');
      if (geoSuggestions) {
        geoSuggestions.style.display = 'none';
      }
      addGeoBtn.classList.remove('selected');
    }
  });

  addCurrencyBtn.addEventListener('click', () => {
    currencySelect.style.display = 'none';
    currencyInput.style.display = 'block';
    currencyInput.value = '';
    currencyInput.focus();
    currencySuggestions.style.display = 'none';
    addCurrencyBtn.classList.add('selected');
  });

  document.addEventListener('click', function(e) {
    const currencyContainer = document.querySelector('.form-group:has(#currencyInput)');
    if (currencyInput.style.display === 'block' && 
        !currencyContainer.contains(e.target) && 
        e.target !== addCurrencyBtn) {
      currencyInput.style.display = 'none';
      currencySelect.style.display = 'block';
      currencySuggestions.style.display = 'none';
      addCurrencyBtn.classList.remove('selected');
    }
  });

  // Add event listeners for input focus/blur
  geoInput.addEventListener('focus', () => {
    addGeoBtn.classList.add('selected');
    const val = geoInput.value.trim();
    fetch(`admin.php?action=get_countries&search=${encodeURIComponent(val)}`)
      .then(res => res.json())
      .then(data => {
        data.forEach(item => { countryCurrency[item.country_code] = item.currency; });
        const matches = data.map(i => i.country_code).filter(c => !geoList.includes(c));
        if (matches.length === 0) { geoSuggestions.style.display = 'none'; return; }
        geoSuggestions.innerHTML = matches.map(c => `<div class="autocomplete-suggestion">${c}</div>`).join('');
        geoSuggestions.style.display = 'block';
      })
      .catch(() => {});
  });

  geoInput.addEventListener('blur', () => {
    if (geoInput.style.display === 'none') {
      addGeoBtn.classList.remove('selected');
    }
  });

  currencyInput.addEventListener('focus', () => {
    addCurrencyBtn.classList.add('selected');
    const val = currencyInput.value.trim();
    fetch(`admin.php?action=get_currencies&search=${encodeURIComponent(val)}`)
      .then(res => res.json())
      .then(data => {
        const matches = data.map(i => i.currency).filter(c => !currencyList.includes(c));
        if (matches.length === 0) { currencySuggestions.style.display = 'none'; return; }
        currencySuggestions.innerHTML = matches.map(c => `<div class="autocomplete-suggestion">${c}</div>`).join('');
        currencySuggestions.style.display = 'block';
      })
      .catch(() => {});
  });

  currencyInput.addEventListener('blur', () => {
    if (currencyInput.style.display === 'none') {
      addCurrencyBtn.classList.remove('selected');
    }
  });

  geoInput.addEventListener('input', function(e) {
    const val = this.value.trim();
    if (!val) {
        geoSuggestions.style.display = 'none';
        return;
    }

    fetch(`admin.php?action=get_countries&search=${encodeURIComponent(val)}`)
      .then(res => res.json())
      .then(data => {
        
        if (data.length === 0) {
          geoSuggestions.style.display = 'none';
          return;
        }

        data.forEach(item => {
          countryCurrency[item.country_code] = item.currency;
        });

        const matches = data
          .map(item => item.country_code)
          .filter(country => !geoList.includes(country));

        if (matches.length === 0) {
          geoSuggestions.style.display = 'none';
          return;
        }

        geoSuggestions.innerHTML = matches.map(
          country => `<div class="autocomplete-suggestion">${country}</div>`
        ).join('');
        geoSuggestions.style.display = 'block';
      })
      .catch(error => {
        console.error('Error fetching countries:', error);
        geoSuggestions.style.display = 'none';
      });
  });

  currencyInput.addEventListener('input', function(e) {
    const val = this.value.trim().toUpperCase();
    if (!val) {
      currencySuggestions.style.display = 'none';
      return;
    }

    // Fetch currencies from database
    fetch(`admin.php?action=get_currencies&search=${encodeURIComponent(val)}`)
      .then(res => res.json())
      .then(data => {
        if (data.length === 0) {
          currencySuggestions.style.display = 'none';
          return;
        }

        const matches = data
          .map(item => item.currency)
          .filter(currency => !currencyList.includes(currency));

        if (matches.length === 0) {
          currencySuggestions.style.display = 'none';
          return;
        }

        currencySuggestions.innerHTML = matches.map(
          currency => `<div class="autocomplete-suggestion">${currency}</div>`
        ).join('');
        currencySuggestions.style.display = 'block';
      })
      .catch(error => {
        console.error('Error fetching currencies:', error);
        currencySuggestions.style.display = 'none';
      });
  });

  // Add keyboard navigation for suggestions
  geoInput.addEventListener('keydown', function(e) {
    const suggestions = geoSuggestions.querySelectorAll('.autocomplete-suggestion');
    const current = geoSuggestions.querySelector('.autocomplete-suggestion.selected');
    let next;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!current) {
        next = suggestions[0];
      } else {
        const currentIndex = Array.from(suggestions).indexOf(current);
        next = suggestions[currentIndex + 1];
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (current) {
        const currentIndex = Array.from(suggestions).indexOf(current);
        next = suggestions[currentIndex - 1];
      }
    } else if (e.key === 'Enter' && current) {
      e.preventDefault();
      current.click();
      return;
    } else if (e.key === 'Escape') {
      e.preventDefault();
      geoInput.style.display = 'none';
      geoSuggestions.style.display = 'none';
      geoSelect.style.display = 'block';
      return;
    }

    if (next) {
      if (current) current.classList.remove('selected');
      next.classList.add('selected');
      next.scrollIntoView({ block: 'nearest' });
    }
  });

  currencyInput.addEventListener('keydown', function(e) {
    const suggestions = currencySuggestions.querySelectorAll('.autocomplete-suggestion');
    const current = currencySuggestions.querySelector('.autocomplete-suggestion.selected');
    let next;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!current) {
        next = suggestions[0];
      } else {
        const currentIndex = Array.from(suggestions).indexOf(current);
        next = suggestions[currentIndex + 1];
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (current) {
        const currentIndex = Array.from(suggestions).indexOf(current);
        next = suggestions[currentIndex - 1];
      }
    } else if (e.key === 'Enter' && current) {
      e.preventDefault();
      current.click();
      return;
    } else if (e.key === 'Escape') {
      e.preventDefault();
      currencyInput.style.display = 'none';
      currencySuggestions.style.display = 'none';
      currencySelect.style.display = 'block';
      return;
    }

    if (next) {
      if (current) current.classList.remove('selected');
      next.classList.add('selected');
      next.scrollIntoView({ block: 'nearest' });
    }
  });

  function updateColorPreview() {
    let hex = colorInput.value.replace(/[^0-9A-Fa-f]/g, '').toUpperCase().slice(0,6);
    colorInput.value = hex;
    colorPreview.style.backgroundColor = hex ? `#${hex}` : 'transparent';
  }

  colorInput.addEventListener('input', updateColorPreview);
  updateColorPreview();

  function getScaleOffsets() {
    const cw    = canvasEl.width;
    const ch    = canvasEl.height;
    const scale = Math.min(cw / image.width, ch / image.height);
    const w     = image.width * scale;
    const h     = image.height * scale;
    return { scale, offsetX: (cw - w) / 2, offsetY: (ch - h) / 2 };
  }

  function getContainDrawParams(mediaWidth, mediaHeight, canvasWidth, canvasHeight) {
    const mediaAspect = mediaWidth / mediaHeight;
    const canvasAspect = canvasWidth / canvasHeight;
    let drawWidth, drawHeight;
    if (mediaAspect > canvasAspect) {
      drawWidth = canvasWidth;
      drawHeight = canvasWidth / mediaAspect;
    } else {
      drawHeight = canvasHeight;
      drawWidth = canvasHeight * mediaAspect;
    }
    const dx = (canvasWidth - drawWidth) / 2;
    const dy = (canvasHeight - drawHeight) / 2;
    return { dx, dy, drawWidth, drawHeight };
  }

  function draw() {    
    // For video, use drawOverlay directly
    if (previewVideo && currentVideoUrl) {
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      if (previewVideo.readyState >= 2) {
        const { dx, dy, drawWidth, drawHeight } = getContainDrawParams(previewVideo.videoWidth || 400, previewVideo.videoHeight || 400, canvasEl.width, canvasEl.height);
        try {
          ctx.drawImage(previewVideo, dx, dy, drawWidth, drawHeight);
        } catch (e) {
        }
      };
      drawOverlay();
      return;
    }
    
    // For images
    if (!image || !image.complete || !image.width) {
      return;
    }
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    
    // Если есть фоновое изображение, рисуем его
    if (canvasEl.style.backgroundImage && canvasEl.style.backgroundImage !== 'none') {
      const { scale, offsetX, offsetY } = getScaleOffsets();    
      const bgImage = new Image();
      bgImage.src = canvasEl.style.backgroundImage.slice(4, -1).replace(/"/g, "");
      bgImage.onload = () => {
        ctx.drawImage(bgImage, offsetX, offsetY, image.width * scale, image.height * scale);
        drawTextAndRect();
      };
    } else {
      drawTextAndRect();
    }
  }

  function drawTextAndRect() {
    const { scale, offsetX, offsetY } = getScaleOffsets();
    
    let angle = parseFloat(angleInput.value);
    if (isNaN(angle)) {
      angle = (typeof config.skew_angle === 'number' ? config.skew_angle : 0);
    }
    const radians = angle * Math.PI / 180;
    const skewValue = Math.tan(radians);
    const centerX = offsetX + rect.x * scale;
    const centerY = offsetY + rect.y * scale;
    // Рисуем прямоугольник
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.transform(1, 0, skewValue, 1, 0, 0);
    ctx.rotate(-radians);
    ctx.fillStyle = rect.fill;
    ctx.fillRect(-rect.width/2 * scale, -rect.height/2 * scale, rect.width * scale, rect.height * scale);
    ctx.restore();

    const text = (textInput.value.trim() || '').toUpperCase();
    if (text) {
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.transform(1, 0, skewValue, 1, 0, 0);
      ctx.rotate(-radians);
      ctx.font = `900 italic ${(parseInt(sizeInput.value, 10) || config.text_size || 45) * scale}px Inter`;
      ctx.fillStyle = '#' + colorInput.value.trim();
      ctx.textAlign = alignSelect.value;
      ctx.textBaseline = 'middle';

      let textX;
      if (alignSelect.value === 'left') {
        textX = -rect.width/2 * scale;
      } else if (alignSelect.value === 'right') {
        textX = rect.width/2 * scale;
      } else {
        textX = 0;
      }
      ctx.fillText(text, textX, 0);
      ctx.restore();
    }
  }

  // Video functions
  function getContainDrawParams(mediaWidth, mediaHeight, canvasWidth, canvasHeight) {
    const mediaAspect = mediaWidth / mediaHeight;
    const canvasAspect = canvasWidth / canvasHeight;
    let drawWidth, drawHeight;
    if (mediaAspect > canvasAspect) {
      drawWidth = canvasWidth;
      drawHeight = canvasWidth / mediaAspect;
    } else {
      drawHeight = canvasHeight;
      drawWidth = canvasHeight * mediaAspect;
    }
    const dx = (canvasWidth - drawWidth) / 2;
    const dy = (canvasHeight - drawHeight) / 2;
    return { dx, dy, drawWidth, drawHeight };
  }

  function renderFrame() {
    if (!previewVideo || !currentVideoUrl) return;
    if (!isRendering) return;
    
    // Update our global variable during rendering (only if time is not 0)
    if (previewVideo.currentTime > EPS) {
      // Round to 3 decimal places to avoid precision issues
      const roundedTime = Math.round(previewVideo.currentTime * 1000) / 1000;
      currentVideoTime = roundedTime;
      lastSeekedTime = roundedTime;
    }
    
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    if (previewVideo.readyState >= 2) {
      const { dx, dy, drawWidth, drawHeight } = getContainDrawParams(previewVideo.videoWidth || 400, previewVideo.videoHeight || 400, canvasEl.width, canvasEl.height);
      canvasEl.style.backgroundImage = '';
      try {
        ctx.drawImage(previewVideo, dx, dy, drawWidth, drawHeight);
      } catch (e) {
        // ignore draw issues
      }
    }
    drawOverlay();
    rafId = requestAnimationFrame(renderFrame);
  }

  function startRendering() {
    if (isRendering) return;
    
    // Backup start of render
    if (previewVideo && previewVideo.currentTime < EPS &&
       (lastSeekedTime > EPS || currentVideoTime > EPS)) {
      previewVideo.currentTime = (lastSeekedTime > EPS ? lastSeekedTime : currentVideoTime);
    }
    
    isRendering = true;
    
    // Update our global variable when starting (only if time is not 0)
    if (previewVideo && previewVideo.currentTime > EPS) {
      // Round to 3 decimal places to avoid precision issues
      const roundedTime = Math.round(previewVideo.currentTime * 1000) / 1000;
      currentVideoTime = roundedTime;
      lastSeekedTime = roundedTime;
    }
    
    rafId = requestAnimationFrame(renderFrame);
  }

  function stopRendering() {
    isRendering = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    
    // Update our global variable when stopping (only if time is not 0)
    if (previewVideo && previewVideo.currentTime > EPS) {
      // Round to 3 decimal places to avoid precision issues
      const roundedTime = Math.round(previewVideo.currentTime * 1000) / 1000;
      currentVideoTime = roundedTime;
      lastSeekedTime = roundedTime;
    }
  }

  function setPlayButtonLabel(isPlaying) {
    const img = playPauseBtn?.querySelector('img');
    if (!img) return;
    // Меняем иконку в зависимости от состояния
    img.src = isPlaying ? 'assets/images/pause.svg' : 'assets/images/play_arrow.svg';
    img.alt = isPlaying ? 'Pause' : 'Play';
  }
  
  function cancelRestore() {
    restoreTarget = null;
    if (restoreTimer) { clearTimeout(restoreTimer); restoreTimer = null; }
  }

  function requestRestore(to) {
    if (!previewVideo) return;
    restoreTarget   = to;
    restoreAttempts = 0;
    if (restoreTimer) clearTimeout(restoreTimer);
    doRestore();
  }

  function doRestore() {
    if (restoreTarget == null) return;
    if (restoreAttempts >= MAX_RESTORE_ATTEMPTS) {
      console.warn('Restore: giving up at', previewVideo.currentTime, 'wanted', restoreTarget);
      pendingRestoreTime = null;
      cancelRestore();
      return;
    }
    try { previewVideo.currentTime = restoreTarget; } catch(e) {}
    restoreAttempts++;
    restoreTimer = setTimeout(() => {
      const ok = Math.abs(previewVideo.currentTime - restoreTarget) <= 0.05;
      if (ok) {
        const t = Math.round(previewVideo.currentTime * 1000) / 1000;
        currentVideoTime   = t;
        lastSeekedTime     = t;
        pendingRestoreTime = null;
        cancelRestore();
        updateTimeline();
      } else {
        doRestore();
      }
    }, 60 + restoreAttempts * 40);
  }

  // Timeline functions
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function updateTimeline() {
    if (!previewVideo || !videoDuration) return;
    
    // Ensure startTime and endTime are within valid bounds
    const originalStartTime = startTime;
    const originalEndTime = endTime;
    startTime = Math.max(0, Math.min(startTime, videoDuration));
    endTime = Math.max(startTime, Math.min(endTime, videoDuration));
    
    // Log if values were clamped
    
    
    // Update duration label
    if (durationLabel) {
      durationLabel.textContent = formatTime(videoDuration);
    }
    
    // Update range labels
    if (startRangeLabel) {
      startRangeLabel.textContent = formatTime(startTime);
    }
    if (endRangeLabel) {
      endRangeLabel.textContent = formatTime(endTime);
    }
    
    // Update range markers position
    if (startRangeMarker) {
      const startProgress = Math.max(0, Math.min(100, (startTime / videoDuration) * 100));
      startRangeMarker.style.left = `${startProgress}%`;
    }
    if (endRangeMarker) {
      const endProgress = Math.max(0, Math.min(100, (endTime / videoDuration) * 100));
      endRangeMarker.style.left = `${endProgress}%`;
    }
    
    // Update selected range background
    if (selectedRange) {
      const startProgress = Math.max(0, Math.min(100, (startTime / videoDuration) * 100));
      const endProgress = Math.max(0, Math.min(100, (endTime / videoDuration) * 100));
      selectedRange.style.left = `${startProgress}%`;
      selectedRange.style.width = `${endProgress - startProgress}%`;
    }
    
    // Update hidden form fields
    if (promoStartInput) {
      promoStartInput.value = startTime.toFixed(3);
    }
    if (promoEndInput) {
      promoEndInput.value = endTime.toFixed(3);
    }
  }

  function seekToTime(time) {
    if (!previewVideo || !videoDuration) return;
    
    const clampedTime = Math.max(0, Math.min(time, videoDuration));
    
    // Set video time
    previewVideo.currentTime = clampedTime;
    
    // Update current video time
    currentVideoTime = clampedTime;
    
    // Force frame update after seeking
    setTimeout(() => {
      if (previewVideo.readyState >= 2) {
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
        const { dx, dy, drawWidth, drawHeight } = getContainDrawParams(previewVideo.videoWidth || 400, previewVideo.videoHeight || 400, canvasEl.width, canvasEl.height);
        try {
          ctx.drawImage(previewVideo, dx, dy, drawWidth, drawHeight);
        } catch (e) {
          // ignore draw issues
        }
        drawOverlay();
      }
    }, 50);
  }

  function getTimelinePosition(event) {
    if (!videoTimeline) return 0;
    
    const rect = videoTimeline.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    
    return percentage;
  }

  function prepareVideo(videoUrl) {
    stopRendering();
    if (!previewVideo || !videoUrl) {
      if (playPauseBtn) playPauseBtn.style.display = 'none';
      if (videoTimelineContainer) videoTimelineContainer.style.display = 'none';
      currentVideoUrl = null;
      videoDuration = 0;
      return;
    }
    try { previewVideo.pause(); } catch(e) {}
    previewVideo.src = videoUrl;
    previewVideo.currentTime = 0;
    currentVideoUrl = videoUrl;
    if (playPauseBtn) playPauseBtn.style.display = 'block';
    if (videoTimelineContainer) videoTimelineContainer.style.display = 'block';
    setPlayButtonLabel(false);
    
    // Update timeline positioning to fit current canvas size
    updateTimelinePositioning();
    
    // Update timeline positioning again after a short delay to ensure video is loaded
    setTimeout(() => {
      updateTimelinePositioning();
    }, 200);
    
    // Wait for video metadata to load
    previewVideo.addEventListener('loadedmetadata', function() {
      videoDuration = previewVideo.duration;
      currentVideoTime = 0; // Initialize to beginning
      isVideoPaused = true; // Start paused
      
      // Initialize time range - use saved values if available, otherwise full duration
      if (!isInitialized) {
        if (startTime === 0 && endTime === 0) {
          startTime = 0; // Initialize start time
          endTime = videoDuration; // Initialize end time to full duration
        }
        isInitialized = true;
      } else {
        // If already initialized, ensure we have valid time range
        if (startTime === 0 && endTime === 0) {
          startTime = 0;
          endTime = videoDuration;
        }
      }
      
      // Update timeline with proper bounds checking
      updateTimeline();
      
      // Set video to start of promo range if we have a valid range
      if (startTime > 0 && endTime > startTime) {
        previewVideo.currentTime = startTime;
        currentVideoTime = startTime;
        
        // Add a one-time seeked listener to redraw after seeking
        const seekedHandler = () => {
          draw();
          previewVideo.removeEventListener('seeked', seekedHandler);
        };
        previewVideo.addEventListener('seeked', seekedHandler);
      }
      
      // Force redraw to show promo with correct time range
      setTimeout(() => {
        draw();
      }, 100);
    }, { once: true });
    
    // Add timeupdate listener for automatic timeline updates during playback (only once)
    if (!previewVideo.hasTimeupdateListener) {
      previewVideo.addEventListener('timeupdate', function() {
        // в окне защиты, если время «не там» — просто один раз запросим рестор
        if (playGuardUntil && performance.now() < playGuardUntil) {
          const desired = (pendingRestoreTime != null) ? pendingRestoreTime
                        : (lastSeekedTime > EPS) ? lastSeekedTime
                        : (currentVideoTime > EPS) ? currentVideoTime : null;
          if (desired != null &&
              Math.abs(previewVideo.currentTime - desired) > 0.05 &&
              restoreTarget == null) {
            requestRestore(desired);
            return; // не трогаем таймлайн этим событием
          }
        }

        // если идёт рестор — ждём его, не апдейтим UI
        if (restoreTarget != null) return;

        // обычное обновление состояния
        if (!isVideoPaused && previewVideo.currentTime > EPS) {
          const t = Math.round(previewVideo.currentTime * 1000) / 1000;
          currentVideoTime = t;
          lastSeekedTime   = t;
        }
        if (!isSeeking) updateTimeline();
      });
      previewVideo.hasTimeupdateListener = true;
    }
    
    // Add seeked listener to update frame after seeking (only once)
    if (!previewVideo.hasSeekedListener) {
      previewVideo.addEventListener('seeked', function() {

        // «Ложный ноль» после seek — тихо перезапускаем рестор (но не бесконечно)
        if (previewVideo.currentTime < EPS && lastSeekedTime > EPS) {
          if (restoreTarget == null) {
            requestRestore(lastSeekedTime);
          }
          return;
        }

        // если нормальное время — синхронизируем состояние
        if (previewVideo.currentTime > EPS) {
          const t = Math.round(previewVideo.currentTime * 1000) / 1000;
          currentVideoTime   = t;
          lastSeekedTime     = t;
          pendingRestoreTime = null;
          cancelRestore();
        }

        if (previewVideo.paused) {
          // показать кадр (как у тебя было)
          if (previewVideo.readyState >= 2) {
            ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
            const { dx, dy, drawWidth, drawHeight } = getContainDrawParams(previewVideo.videoWidth || 400, previewVideo.videoHeight || 400, canvasEl.width, canvasEl.height);
            try {
              ctx.drawImage(previewVideo, dx, dy, drawWidth, drawHeight);
            } catch (e) {
              // ignore draw issues
            }
          }
          drawOverlay();
        }
      });
      previewVideo.hasSeekedListener = true;
    }
    
    // Add play listener to confirm restoration and sync time (only once)
    if (!previewVideo.hasPlayListener) {
      previewVideo.addEventListener('play', function() {

        // Берём желаемое время: pending → lastSeeked → currentVideoTime
        const desired =
          (pendingRestoreTime != null ? pendingRestoreTime :
          (lastSeekedTime > EPS ? lastSeekedTime :
          (currentVideoTime > EPS ? currentVideoTime : null)));

        // Если play стартовал почти с 0, принудительно вернёмся на desired
        if (desired != null && Math.abs(previewVideo.currentTime - desired) > EPS) {
          try { previewVideo.currentTime = desired; } catch(e) {}
        }

        // Продлим «окно защиты» ещё немного после play
        playGuardUntil = performance.now() + 500;
        if (previewVideo.currentTime > EPS) {
          const t = Math.round(previewVideo.currentTime * 1000) / 1000;
          currentVideoTime = t;
          lastSeekedTime = t;
        }
        isVideoPaused = false;
      });
      previewVideo.hasPlayListener = true;
    }
    
    // Add pause listener
    if (!previewVideo.hasPauseListener) {
      previewVideo.addEventListener('pause', function() {
        isVideoPaused = true;
        
        // Only update currentVideoTime if time is not 0
        if (previewVideo.currentTime > EPS) {
          // Round to 3 decimal places to avoid precision issues
          const roundedTime = Math.round(previewVideo.currentTime * 1000) / 1000;
          currentVideoTime = roundedTime;
          lastSeekedTime = roundedTime;
        }
      });
      previewVideo.hasPauseListener = true;
    }
  }

  function drawOverlay() {
    
    // Проверяем, нужно ли показывать промокод в текущий момент времени
    let shouldShowPromo = true;
    
    if (previewVideo && currentVideoUrl) {
      const currentTime = previewVideo.currentTime;
      // Если временные отрезки не установлены (0,0), показываем промокод всегда
      if (startTime === 0 && endTime === 0) {
        shouldShowPromo = true;
      } else {
        shouldShowPromo = currentTime >= startTime && currentTime <= endTime;
      }
    }
    
    // Если промокод не должен показываться в этот момент, не рисуем ничего
    if (!shouldShowPromo) {
      return;
    }
        
    // рисуем только рамку и текст поверх текущего фона/кадра
    let centerX, centerY, scale;
    
    if (previewVideo && currentVideoUrl) {
      // Для видео используем параметры контейнера
      const { dx, dy, drawWidth, drawHeight } = getContainDrawParams(
        previewVideo.videoWidth || 400, 
        previewVideo.videoHeight || 400, 
        canvasEl.width, 
        canvasEl.height
      );
      const videoScale = Math.min(drawWidth / (previewVideo.videoWidth || 400), drawHeight / (previewVideo.videoHeight || 400));
      centerX = dx + rect.x * videoScale;
      centerY = dy + rect.y * videoScale;
      scale = videoScale;
    } else {
      // Для изображений используем старую логику
      const offsets = getScaleOffsets();
      centerX = offsets.offsetX + rect.x * offsets.scale;
      centerY = offsets.offsetY + rect.y * offsets.scale;
      scale = offsets.scale;
    }
    
    let angle = parseFloat(angleInput.value);
    if (isNaN(angle)) {
      angle = 0;
    }
    const radians = angle * Math.PI / 180;
    const skewValue = Math.tan(radians);
    
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.transform(1, 0, skewValue, 1, 0, 0);
    ctx.rotate(-radians);
    ctx.fillStyle = rect.fill;
    ctx.fillRect(-rect.width/2 * scale, -rect.height/2 * scale, rect.width * scale, rect.height * scale);
    ctx.restore();

    const text = (textInput.value.trim() || '').toUpperCase();
    if (!text) return;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.transform(1, 0, skewValue, 1, 0, 0);
    ctx.rotate(-radians);
    let textColor = colorInput.value || '#000000';
    if (textColor && !textColor.startsWith('#')) textColor = '#' + textColor;
    let fontSize = parseInt(sizeInput.value, 10) || 45;
    if (text.length > 6) fontSize = fontSize - 2 * (text.length - 6);
    if (fontSize < 10) fontSize = 10;
    ctx.font = `900 italic ${fontSize * scale}px Inter`;
    ctx.fillStyle = textColor;
    ctx.textAlign = alignSelect.value;
    ctx.textBaseline = 'middle';
    let textX;
    if (alignSelect.value === 'left') {
      textX = -rect.width/2 * scale;
    } else if (alignSelect.value === 'right') {
      textX = rect.width/2 * scale;
    } else {
      textX = 0;
    }
    ctx.fillText(text, textX, 0);
    ctx.restore();
  }

  function toCanvasCoords(e) {
    const rectCanvas = canvasEl.getBoundingClientRect();
    return {
      x: (e.clientX - rectCanvas.left),
      y: (e.clientY - rectCanvas.top)
    };
  }

  function getCanvasToImageCoords(canvasX, canvasY) {
    if (previewVideo && currentVideoUrl) {
      // Для видео используем параметры контейнера
      const { dx, dy, drawWidth, drawHeight } = getContainDrawParams(
        previewVideo.videoWidth || 400, 
        previewVideo.videoHeight || 400, 
        canvasEl.width, 
        canvasEl.height
      );
      const videoScale = Math.min(drawWidth / (previewVideo.videoWidth || 400), drawHeight / (previewVideo.videoHeight || 400));
      return {
        x: (canvasX - dx) / videoScale,
        y: (canvasY - dy) / videoScale
      };
    } else {
      // Для изображений используем старую логику
      const { scale, offsetX, offsetY } = getScaleOffsets();
      return {
        x: (canvasX - offsetX) / scale,
        y: (canvasY - offsetY) / scale
      };
    }
  }

  canvasEl.addEventListener('mousedown', e => {
    e.preventDefault();
    e.stopPropagation();
    
    const m = toCanvasCoords(e);
    const imgCoords = getCanvasToImageCoords(m.x, m.y);
    const imgX = imgCoords.x;
    const imgY = imgCoords.y;
    
    // Check if click is inside the rectangle
    if (imgX >= rect.x - rect.width/2 && imgX <= rect.x + rect.width/2 &&
        imgY >= rect.y - rect.height/2 && imgY <= rect.y + rect.height/2) {
      
      // Record start time and position
      dragStartTime = Date.now();
      dragOffset.x = imgX - rect.x;
      dragOffset.y = imgY - rect.y;
      
      // Add cursor style to indicate potential dragging
      canvasEl.style.cursor = 'grab';
    }
  });

  // Removed play/pause click handler - now only timeline controls video

  document.addEventListener('mousemove', e => {
    const m = toCanvasCoords(e);
    const imgCoords = getCanvasToImageCoords(m.x, m.y);
    const imgX = imgCoords.x;
    const imgY = imgCoords.y;
    
    // If we're not dragging but mouse is down on rectangle, check if we should start dragging
    if (!isDragging && dragStartTime > 0) {
      const timeSinceStart = Date.now() - dragStartTime;
      const distance = Math.sqrt(Math.pow(imgX - (rect.x + dragOffset.x), 2) + Math.pow(imgY - (rect.y + dragOffset.y), 2));
      
      // Start dragging if enough time has passed or mouse moved enough
      if (timeSinceStart > 50 || distance > dragThreshold) {
        isDragging = true;
        canvasEl.style.cursor = 'grabbing';
        canvasEl.classList.add('dragging');
      }
    }
    
    if (!isDragging) return;
    
    e.preventDefault();
    e.stopPropagation();

    // Update rectangle position
    rect.x = imgX - dragOffset.x;
    rect.y = imgY - dragOffset.y;
    
    // Update input fields
    posXInput.value = Math.round(rect.x);
    posYInput.value = Math.round(rect.y);
    
    // Redraw everything including video background
    if (previewVideo && currentVideoUrl && previewVideo.paused) {
      // If video is paused, redraw the current frame
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      if (previewVideo.readyState >= 2) {
        const { dx, dy, drawWidth, drawHeight } = getContainDrawParams(previewVideo.videoWidth || 400, previewVideo.videoHeight || 400, canvasEl.width, canvasEl.height);
        try {
          ctx.drawImage(previewVideo, dx, dy, drawWidth, drawHeight);
        } catch (e) {
          // ignore draw issues
        }
      }
      drawOverlay();
    } else {
      // For images or playing video, use regular draw
      draw();
    }
  });

  document.addEventListener('mouseup', (e) => {
    if (isDragging) {
      e.preventDefault();
      e.stopPropagation();
      
      // Final redraw after dragging to ensure video background is shown
      if (previewVideo && currentVideoUrl && previewVideo.paused) {
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
        if (previewVideo.readyState >= 2) {
          const { dx, dy, drawWidth, drawHeight } = getContainDrawParams(previewVideo.videoWidth || 400, previewVideo.videoHeight || 400, canvasEl.width, canvasEl.height);
          try {
            ctx.drawImage(previewVideo, dx, dy, drawWidth, drawHeight);
          } catch (e) {
            // ignore draw issues
          }
        }
        drawOverlay();
      }
    }
    
    // Always reset all dragging states
    isDragging = false;
    dragStartTime = 0;
    canvasEl.style.cursor = 'default';
    canvasEl.classList.remove('dragging');
  });

  // Handle mouse leave during drag
  canvasEl.addEventListener('mouseleave', (e) => {
    if (isDragging || dragStartTime > 0) {
      // Force end drag when mouse leaves canvas
      isDragging = false;
      dragStartTime = 0;
      canvasEl.style.cursor = 'default';
      canvasEl.classList.remove('dragging');
    }
  });

  image.onload = () => {
    posXInput.value = rect.x;
    posYInput.value = rect.y;
    if (!angleInput.value) angleInput.value = config.skew_angle || 0;
    requestAnimationFrame(draw);
  };

  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    if (!f) return;

    stopRendering();
    if (previewVideo) {
      try { previewVideo.pause(); } catch(e) {}
    }
    if (playPauseBtn) playPauseBtn.style.display = 'none';
    if (videoTimelineContainer) videoTimelineContainer.style.display = 'none';
    currentVideoTime = 0;
    isVideoPaused = true;
    lastSeekedTime = 0;
    pendingRestoreTime = null;

    const prevX = rect.x;
    const prevY = rect.y;

    if (f.type.startsWith('video/')) {
      // Video file: load into previewVideo, capture first frame on canvas
      const objectUrl = URL.createObjectURL(f);
      prepareVideo(objectUrl);

      const tmpVideo = document.createElement('video');
      tmpVideo.preload = 'metadata';
      tmpVideo.muted = true;
      tmpVideo.playsInline = true;
      tmpVideo.src = objectUrl;

      const captureFrame = () => {
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = canvasEl.width;
        tmpCanvas.height = canvasEl.height;
        const tmpCtx = tmpCanvas.getContext('2d');
        tmpCtx.drawImage(tmpVideo, 0, 0, tmpCanvas.width, tmpCanvas.height);
        const frameUrl = tmpCanvas.toDataURL('image/png');
        canvasEl.style.backgroundImage = `url(${frameUrl})`;
        canvasEl.style.backgroundSize = 'contain';
        canvasEl.style.backgroundPosition = 'center';
        canvasEl.style.backgroundRepeat = 'no-repeat';
        image.src = frameUrl;
        rect.x = (typeof prevX === 'number' && !isNaN(prevX)) ? prevX : 500;
        rect.y = (typeof prevY === 'number' && !isNaN(prevY)) ? prevY : 500;
        posXInput.value = rect.x;
        posYInput.value = rect.y;
        draw();
        setTimeout(draw, 100);
        tmpVideo.src = '';
      };

      tmpVideo.addEventListener('seeked', captureFrame, { once: true });
      tmpVideo.addEventListener('loadedmetadata', () => {
        tmpVideo.currentTime = 0.5;
      }, { once: true });
      tmpVideo.addEventListener('error', () => {
        // If frame capture fails, just clear the canvas background
        canvasEl.style.backgroundImage = 'none';
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
        tmpVideo.src = '';
      }, { once: true });
    } else {
      // Image file: use FileReader + Image (existing logic)
      const reader = new FileReader();
      reader.onload = e => {
        const originalImageUrl = e.target.result;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 1000;
        tempCanvas.height = 1000;
        const tempCtx = tempCanvas.getContext('2d');

        const img = new Image();
        img.onload = () => {
          tempCtx.clearRect(0, 0, 1000, 1000);
          const scale = Math.min(1000 / img.width, 1000 / img.height);
          const scaledWidth = img.width * scale;
          const scaledHeight = img.height * scale;
          const offsetX = (1000 - scaledWidth) / 2;
          const offsetY = (1000 - scaledHeight) / 2;
          tempCtx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);

          const resizedImageUrl = tempCanvas.toDataURL('image/png');
          image.src = resizedImageUrl;
          canvasEl.style.backgroundImage = `url(${resizedImageUrl})`;
          canvasEl.style.backgroundSize = 'contain';
          canvasEl.style.backgroundPosition = 'center';
          canvasEl.style.backgroundRepeat = 'no-repeat';

          rect.x = (typeof prevX === 'number' && !isNaN(prevX)) ? prevX : 500;
          rect.y = (typeof prevY === 'number' && !isNaN(prevY)) ? prevY : 500;
          posXInput.value = rect.x;
          posYInput.value = rect.y;
          draw();
          setTimeout(draw, 100);
        };
        img.src = originalImageUrl;
      };
      reader.readAsDataURL(f);
    }
  });

  [textInput, sizeInput, angleInput, alignSelect, colorInput,
   posXInput, posYInput]
    .forEach(el => el.addEventListener('input', () => {
      rect.x      = parseInt(posXInput.value, 10) || rect.x;
      rect.y      = parseInt(posYInput.value, 10) || rect.y;
      if (isRendering) {
        // при проигрывании — просто перерисуем следующий кадр с новым текстом
        // overlay обновится в рендер-цикле
      } else {
        draw();
      }
    }));

  // Play/Pause button handler
  if (playPauseBtn) {
    playPauseBtn.addEventListener('click', async () => {
      if (!currentVideoUrl || !previewVideo) return;
      if (previewVideo.paused || previewVideo.ended) {
        // начать проигрывание
        canvasEl.style.backgroundImage = '';
        try {
          const currentTime = previewVideo.currentTime;
          await previewVideo.play();
          
          // Check if time was reset and restore it
          if (previewVideo.currentTime === 0 && (currentTime > 0 || lastSeekedTime > 0)) {
            const restoreTime = lastSeekedTime > 0 ? lastSeekedTime : currentTime;
            previewVideo.currentTime = restoreTime;
          }
          
          startRendering();
          setPlayButtonLabel(true);
        } catch (e) {
          console.error('Cannot play video:', e);
        }
      } else {
        // пауза
        try { previewVideo.pause(); } catch(e) {}
        stopRendering();
        // Show current video frame instead of background image
        if (previewVideo.readyState >= 2) {
          ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
          const { dx, dy, drawWidth, drawHeight } = getContainDrawParams(previewVideo.videoWidth || 400, previewVideo.videoHeight || 400, canvasEl.width, canvasEl.height);
          try {
            ctx.drawImage(previewVideo, dx, dy, drawWidth, drawHeight);
          } catch (e) {
            // ignore draw issues
          }
        }
        drawOverlay();
        setPlayButtonLabel(false);
      }
    });

    // При завершении видео — вернуть кнопку в состояние Play
    if (previewVideo) {
      previewVideo.addEventListener('ended', () => {
        isVideoPaused = true;
        currentVideoTime = 0; // Reset to beginning
        lastSeekedTime = 0; // Reset to beginning
        pendingRestoreTime = null; // Clear any pending restoration
        stopRendering();
        // Show the last frame of the video instead of background image
        if (previewVideo.readyState >= 2) {
          ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
          const { dx, dy, drawWidth, drawHeight } = getContainDrawParams(previewVideo.videoWidth || 400, previewVideo.videoHeight || 400, canvasEl.width, canvasEl.height);
          try {
            ctx.drawImage(previewVideo, dx, dy, drawWidth, drawHeight);
          } catch (e) {
            // ignore draw issues
          }
        }
        drawOverlay();
        setPlayButtonLabel(false);
      });
    }
  }

  // Timeline event handlers
  if (videoTimeline) {
    // Mouse down on start range marker to start dragging
    if (startRangeMarker) {
      startRangeMarker.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        isDraggingTimeline = true;
        draggedMarker = 'start';
        videoTimeline.classList.add('dragging');
        startRangeMarker.classList.add('dragging');
        
        // Add global mouse move and up handlers
        document.addEventListener('mousemove', handleTimelineDrag);
        document.addEventListener('mouseup', handleTimelineDragEnd);
      });
    }

    // Mouse down on end range marker to start dragging
    if (endRangeMarker) {
      endRangeMarker.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        isDraggingTimeline = true;
        draggedMarker = 'end';
        videoTimeline.classList.add('dragging');
        endRangeMarker.classList.add('dragging');
        
        // Add global mouse move and up handlers
        document.addEventListener('mousemove', handleTimelineDrag);
        document.addEventListener('mouseup', handleTimelineDragEnd);
      });
    }
  }

  function handleTimelineDrag(e) {
    if (!isDraggingTimeline || !videoTimeline || !draggedMarker) return;
    
    // Throttle the drag updates to improve performance
    if (dragThrottleTimeout) {
      clearTimeout(dragThrottleTimeout);
    }
    
    dragThrottleTimeout = setTimeout(() => {
      const percentage = getTimelinePosition(e);
      const time = (percentage / 100) * videoDuration;
      
      
      // Update the appropriate time based on which marker is being dragged
      const roundedTime = Math.round(time * 1000) / 1000;
      
      if (draggedMarker === 'start') {
        startTime = Math.max(0, Math.min(roundedTime, endTime - 0.1)); // Don't go past end time
      } else if (draggedMarker === 'end') {
        endTime = Math.max(startTime + 0.1, Math.min(roundedTime, videoDuration)); // Don't go before start time
      }
      
      // Update timeline display
      updateTimeline();
      
      // Seek video to current position for real-time preview
      seekToTime(roundedTime);
    }, 16); // ~60fps
  }

  function handleTimelineDragEnd(e) {
    if (!isDraggingTimeline) return;
    
    // Clear any pending throttle timeout
    if (dragThrottleTimeout) {
      clearTimeout(dragThrottleTimeout);
      dragThrottleTimeout = null;
    }
    
    
    isDraggingTimeline = false;
    videoTimeline.classList.remove('dragging');
    
    if (draggedMarker === 'start') {
      startRangeMarker.classList.remove('dragging');
    } else if (draggedMarker === 'end') {
      endRangeMarker.classList.remove('dragging');
    }
    
    draggedMarker = null;
    
    document.removeEventListener('mousemove', handleTimelineDrag);
    document.removeEventListener('mouseup', handleTimelineDragEnd);
  }

  document.getElementById('configForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const isNewTemplate = !selectedTemplateId;
    const hasNewImage = fileInput.files.length > 0;
    if (isNewTemplate && !hasNewImage) {
        alert('Пожалуйста, загрузите изображение');
        return;
    }
    if (!templateName.value.trim()) {
        alert('Пожалуйста, введите название шаблона');
        return;
    }
    if (!geoSelect.value) {
        alert('Пожалуйста, выберите гео');
        return;
    }
    if (!currencySelect.value) {
        alert('Пожалуйста, выберите валюту');
        return;
    }

    const formData = new FormData(this);
    if (selectedTemplateId) {
        formData.append('template_id', selectedTemplateId);
    }

    // Always add current settings to formData
    formData.append('template_name', templateName.value);
    formData.append('text_size', sizeInput.value);
    formData.append('skew_angle', angleInput.value);
    formData.append('text_alignment', alignSelect.value);
    formData.append('text_color', colorInput.value);
    formData.append('position_x', posXInput.value);
    formData.append('position_y', posYInput.value);
    formData.append('geo', geoSelect.value);
    formData.append('currency', currencySelect.value);
    formData.append('video_size', currentVideoSize);
    formData.append('promo_start', promoStartInput.value);
    formData.append('promo_end', promoEndInput.value);

    // Directions: collect from chips
    const selectedDirs = [];
    document.querySelectorAll('#directionChips input[type="checkbox"]:checked').forEach(cb => {
      selectedDirs.push(cb.value);
    });
    formData.append('directions', selectedDirs.join(','));

    fetch('admin.php', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                console.error('Server response:', text);
                throw new Error(`HTTP error! status: ${response.status}, response: ${text}`);
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {            
            if (data.id) {
                sessionStorage.setItem('selectedTemplateId', data.id);
            }
            
            window.location.reload();
        } else {
            alert('Ошибка: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Произошла ошибка при сохранении шаблона: ' + error.message);
    });
  });

  confirmDeleteBtn.addEventListener('click', function() {
    if (!templateToDelete) return;

    fetch('admin.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `action=delete_template&template_id=${templateToDelete}`
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.success) {
        window.location.reload();
      } else {
        throw new Error(data.error || 'Unknown error occurred');
      }
    })
    .catch(error => {
      console.error('Error:', error);
      alert('Произошла ошибка при удалении шаблона: ' + error.message);
    });
  });

  cancelDeleteBtn.addEventListener('click', function() {
    deleteModal.style.display = 'none';
    templateToDelete = null;
  });

  deleteModal.addEventListener('click', function(e) {
    if (e.target === deleteModal) {
      deleteModal.style.display = 'none';
      templateToDelete = null;
    }
  });

  // Update geo and currency select event listeners
  geoSelect.addEventListener('change', function() {
    const template = window.templates.find(t => t.id === selectedTemplateId);
    if (!template || !template.images) return;

    const currentGeo = this.value;
    const currentCurrency = currencySelect.value;

    const matchingImageIndex = template.images.findIndex(img =>
      img.geo === currentGeo && img.currency === currentCurrency
    );

    if (matchingImageIndex !== -1) {
      navigateToImage(matchingImageIndex);
    } else {
      // If no matching image, display nothing and reset settings
      displayImageSettings(null);
      renderImageNavigationButtons(template.images, -1); // No active button
    }
  });

  currencySelect.addEventListener('change', function() {
    const template = window.templates.find(t => t.id === selectedTemplateId);
    if (!template || !template.images) return;

    const currentGeo = geoSelect.value;
    const currentCurrency = this.value;

    const matchingImageIndex = template.images.findIndex(img =>
      img.geo === currentGeo && img.currency === currentCurrency
    );

    if (matchingImageIndex !== -1) {
      navigateToImage(matchingImageIndex);
    } else {
      // If no matching image, display nothing and reset settings
      displayImageSettings(null);
      renderImageNavigationButtons(template.images, -1); // No active button
    }
  });

  // Event listeners for navigation arrows
  const leftArrowButton = document.querySelector('.left-button');
  const rightArrowButton = document.querySelector('.right-button');

  if (leftArrowButton) {
    leftArrowButton.addEventListener('click', () => {
      navigateToImage(currentImageIndex - 1);
    });
  }

  if (rightArrowButton) {
    rightArrowButton.addEventListener('click', () => {
      navigateToImage(currentImageIndex + 1);
    });
  }

  // Function to display image settings on canvas and form inputs
  function displayImageSettings(imageObject) {
    if (imageObject) {
      sizeInput.value = imageObject.text_size;
      angleInput.value = imageObject.skew_angle;
      alignSelect.value = imageObject.text_alignment;
      colorInput.value = imageObject.text_color.replace('#', '');
      
      // Update rectangle position first
      rect.x = imageObject.position_x;
      rect.y = imageObject.position_y;
      
      // Then update position inputs
      posXInput.value = Math.round(rect.x);
      posYInput.value = Math.round(rect.y);
      
      currentImageUrl = imageObject.image_url;

      // Update geo and currency dropdowns
      if (geoSelect) geoSelect.value = imageObject.geo || '';
      if (currencySelect) currencySelect.value = imageObject.currency || '';
      if (geoSelectDisplay) geoSelectDisplay.textContent = imageObject.geo || 'Выберите гео';
      
      // Update video size if available
      if (imageObject.video_size) {
        currentVideoSize = imageObject.video_size;
        videoSizeInput.value = imageObject.video_size;
        updateCanvasSize(imageObject.video_size);
        updateSizeToggleButtons(imageObject.video_size);
      } else {
        // Default to 1x1 if no size is specified for this image
        currentVideoSize = '1x1';
        videoSizeInput.value = '1x1';
        updateCanvasSize('1x1');
        updateSizeToggleButtons('1x1');
      }

      // Update promo time range if available
      if (imageObject.promo_start !== undefined && imageObject.promo_end !== undefined) {
        startTime = parseFloat(imageObject.promo_start);
        endTime = parseFloat(imageObject.promo_end);
        // Don't call updateTimeline here yet, wait for video to load
      } else {
        // Reset to default if no time range is saved
        startTime = 0;
        endTime = 0;
      }

      if (imageObject.image_url && imageObject.image_url !== 'tmp') {
        // Получаем путь к видео на основе пути к превью
        const previewFilename = imageObject.image_url.split('/').pop();
        const videoFilename = previewFilename.replace(/\.(jpg|jpeg|png)$/i, '.mp4');
        const videoUrl = '/uploads/videos/' + videoFilename;
                
        // Подготавливаем видео
        prepareVideo(videoUrl);
        
        canvasEl.style.backgroundImage = `url(${imageObject.image_url})`;
        canvasEl.style.backgroundSize = 'contain';
        canvasEl.style.backgroundPosition = 'center';
        canvasEl.style.backgroundRepeat = 'no-repeat';
        
        image.width = 1000;
        image.height = 1000;
        
        // Force redraw after a short delay to ensure video is loaded
        setTimeout(() => {
          // Set video to start of promo range if we have a valid range
          if (startTime > 0 && endTime > startTime && previewVideo) {
            previewVideo.currentTime = startTime;
            currentVideoTime = startTime;
          }
          draw();
          updateDeleteButtonVisibility();
        }, 200);
      } else {
        currentImageUrl = null;
        prepareVideo(null);
        canvasEl.style.backgroundImage = 'none';
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
        // For images, always show promo
        draw();
        updateDeleteButtonVisibility();
      }
    } else {
      // Reset form if no image found
      sizeInput.value = 45;
      angleInput.value = 0;
      alignSelect.value = 'center';
      colorInput.value = '000000';
      rect.x = 500;
      rect.y = 500;
      posXInput.value = 500;
      posYInput.value = 500;
      currentImageUrl = null;
      prepareVideo(null);
      canvasEl.style.backgroundImage = 'none';
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      
      // Reset video size to default when no image
      currentVideoSize = '1x1';
      videoSizeInput.value = '1x1';
      updateCanvasSize('1x1');
      updateSizeToggleButtons('1x1');
    }
    updateColorPreview();
    updateDeleteButtonVisibility();
  }

  // Function to render image navigation buttons
  function renderImageNavigationButtons(images, activeIndex) {
    const imageNavButtonsContainer = document.querySelector('.image-nav-buttons');
    if (!imageNavButtonsContainer) return;
    imageNavButtonsContainer.innerHTML = '';
    if (!images || !Array.isArray(images) || images.length === 0) return;
    

    const total = images.length;
    const maxButtons = 5;
    let start = 0;
    let end = total;

    if (total > maxButtons) {
      if (activeIndex <= 2) {
        start = 0;
        end = maxButtons;
      } else if (activeIndex >= total - 3) {
        start = total - maxButtons;
        end = total;
      } else {
        start = activeIndex - 2;
        end = activeIndex + 3;
      }
    }

    for (let i = start; i < end; i++) {
      const button = document.createElement('button');
      button.type = 'button';
      button.classList.add('image-nav-button');
      if (i === activeIndex) {
        button.classList.add('active');
      }
      button.textContent = i + 1;
      button.dataset.index = i;
      button.addEventListener('click', (e) => {
        navigateToImage(parseInt(e.target.dataset.index));
      });
      imageNavButtonsContainer.appendChild(button);
    }
  }

  // Function to navigate to a specific image by index
  function navigateToImage(index) {
    const template = window.templates.find(t => t.id === selectedTemplateId);
    if (!template) {
      return;
    }
    
    if (!template.images || template.images.length === 0) {
      return;
    }

    let newIndex = index;
    if (newIndex < 0) {
      newIndex = template.images.length - 1; // Wrap around to end
    } else if (newIndex >= template.images.length) {
      newIndex = 0; // Wrap around to beginning
    }
    
    currentImageIndex = newIndex;
    displayImageSettings(template.images[currentImageIndex]);
    renderImageNavigationButtons(template.images, currentImageIndex);
    updateDeleteButtonVisibility();
    
    // Save current image index
    sessionStorage.setItem('selectedImageIndex', currentImageIndex);
  }


  // --- Обработчики для модального окна удаления картинки ---
  const deleteImageModal = document.getElementById('deleteImageModal');
  const confirmImageDeleteBtn = document.getElementById('confirmImageDeleteBtn');
  const cancelImageDeleteBtn = document.getElementById('cancelImageDeleteBtn');

  if (confirmImageDeleteBtn) {
    confirmImageDeleteBtn.addEventListener('click', function() {
      if (!imageDeleteGeo || !imageDeleteCurrency || !selectedTemplateId) return;
      const formData = new FormData();
      formData.append('action', 'delete_template_image');
      formData.append('geo', imageDeleteGeo);
      formData.append('currency', imageDeleteCurrency);
      formData.append('template_id', selectedTemplateId);
      fetch('admin.php', {
        method: 'POST',
        body: formData
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          location.reload();
        } else {
          console.error('Error deleting image:', data.error);
          alert('Ошибка удаления: ' + data.error);
        }
      })
      .catch(error => {
        console.error('Error:', error);
        alert('Ошибка запроса: ' + error);
      });
      // Скрываем модалку и очищаем переменные
      deleteImageModal.style.display = 'none';
      imageDeleteGeo = null;
      imageDeleteCurrency = null;
    });
  }

  if (cancelImageDeleteBtn) {
    cancelImageDeleteBtn.addEventListener('click', function() {
      deleteImageModal.style.display = 'none';
      imageDeleteGeo = null;
      imageDeleteCurrency = null;
    });
  }

  // Клик вне модалки — закрыть
  if (deleteImageModal) {
    deleteImageModal.addEventListener('click', function(e) {
      if (e.target === deleteImageModal) {
        deleteImageModal.style.display = 'none';
        imageDeleteGeo = null;
        imageDeleteCurrency = null;
      }
    });
  }

  const customSelect = document.querySelector('.custom-select');
  if (customSelect) customSelect.classList.remove('hidden');
  const inputWithButton = document.querySelector('.input-with-button');
  if (inputWithButton) inputWithButton.style.display = 'none';

  // Handle delete current image button
  const deleteCurrentImageBtn = document.getElementById('deleteCurrentImageBtn');
  
  // Show/hide delete button based on whether there's a current image
  function updateDeleteButtonVisibility() {
    if (!deleteCurrentImageBtn || !selectedTemplateId) {
      return;
    }
    const template = window.templates.find(t => t.id === selectedTemplateId);
    if (!template || !template.images) {
      deleteCurrentImageBtn.style.display = 'none';
      return;
    }
    
    // Check if images is an array
    if (!Array.isArray(template.images) || template.images.length === 0) {
      deleteCurrentImageBtn.style.display = 'none';
      return;
    }
    
    const currentGeo = geoSelect.value;
    const currentCurrency = currencySelect.value;
    
    // Find if there's an image matching current geo/currency
    const hasMatchingImage = template.images.some(img => 
      img.geo === currentGeo && img.currency === currentCurrency
    );
    
    if (hasMatchingImage) {
      deleteCurrentImageBtn.style.display = 'block';
    } else {
      deleteCurrentImageBtn.style.display = 'none';
    }
  }
  
  // Add click handler for delete button
  if (deleteCurrentImageBtn) {
    deleteCurrentImageBtn.addEventListener('click', function() {
      if (!selectedTemplateId || !geoSelect.value || !currencySelect.value) return;
      
      imageDeleteGeo = geoSelect.value;
      imageDeleteCurrency = currencySelect.value;
      document.getElementById('deleteImageModal').style.display = 'flex';
    });
  }
  
  // Call this function when geo or currency changes
  if (geoSelect) {
    geoSelect.addEventListener('change', updateDeleteButtonVisibility);
  }
  if (currencySelect) {
    currencySelect.addEventListener('change', updateDeleteButtonVisibility);
  }

  // Function to load all currencies from database
  function loadAllCurrencies() {
    fetch('admin.php?action=get_countries&search=')
      .then(res => res.json())
      .then(data => {
        data.forEach(item => {
          countryCurrency[item.country_code] = item.currency;
        });
      })
      .catch(error => {
        console.error('Error loading currencies:', error);
      });
  }

  // Load currencies on page load
  loadAllCurrencies();

  // Add window resize handler to update timeline positioning
  window.addEventListener('resize', () => {
    updateTimelinePositioning();
  });

  // Add click handlers for currency suggestions
  if (currencySuggestions) {
    currencySuggestions.addEventListener('mousedown', function(e) {
      if (!e.target.classList.contains('autocomplete-suggestion')) return;
      const currency = e.target.textContent;
      
      // Add new currency to the list if it doesn't exist
      if (!currencyList.includes(currency)) {
        currencyList.push(currency);
        renderCurrencyList();
      }

      // Select the new currency in the dropdown
      if (currencySelect) currencySelect.value = currency;
      
      // Hide input and show dropdown
      if (currencyInput) currencyInput.style.display = 'none';
      currencySuggestions.style.display = 'none';
      if (currencySelect) currencySelect.style.display = 'block';
      addCurrencyBtn.classList.remove('selected');
    });
  }

  // Add document click handler to close input when clicking outside
  document.addEventListener('click', function(e) {
    const currencyContainer = document.querySelector('.form-group:has(#currencyInput)');
    if (currencyInput.style.display === 'block' && 
        !currencyContainer.contains(e.target) && 
        e.target !== addCurrencyBtn) {
      currencyInput.style.display = 'none';
      currencySelect.style.display = 'block';
      currencySuggestions.style.display = 'none';
      addCurrencyBtn.classList.remove('selected');
    }
  });
})();