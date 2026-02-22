import '../css/index.css'

// ── Global toast notification ──────────────────────────────────────────
(function() {
  let _toastTimer = null;

  function ensureToast() {
    let el = document.getElementById('app-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'app-toast';
      el.innerHTML = '<div class="toast-title"></div><div class="toast-body"></div><button class="toast-close" aria-label="close">×</button>';
      el.querySelector('.toast-close').addEventListener('click', () => hideToast());
      document.body.appendChild(el);
    }
    return el;
  }

  function hideToast() {
    const el = document.getElementById('app-toast');
    if (el) el.classList.remove('toast-show');
    if (_toastTimer) { clearTimeout(_toastTimer); _toastTimer = null; }
  }

  window.showAppError = function(msg, title) {
    const el = ensureToast();
    el.classList.remove('toast-ok');
    el.querySelector('.toast-title').textContent = title || 'Ошибка';
    el.querySelector('.toast-body').textContent = msg || '';
    el.classList.add('toast-show');
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(hideToast, 8000);
  };

  window.showAppSuccess = function(msg) {
    const el = ensureToast();
    el.classList.add('toast-ok');
    el.querySelector('.toast-title').textContent = 'Готово';
    el.querySelector('.toast-body').textContent = msg || '';
    el.classList.add('toast-show');
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(hideToast, 4000);
  };
})();

(function() {
  const downloadBtn    = document.getElementById('downloadBtn');
  const textInput      = document.getElementById('textInput');
  const sizeInput      = document.getElementById('textSizeInput');
  const skewAngleInput = document.getElementById('skew_angle');
  const canvas         = document.getElementById('canvas');
  const ctx            = canvas.getContext('2d');
  const geoSelect      = document.getElementById('geoSelect');
  const currencySelect = document.getElementById('currencySelect');
  const directionSelect = document.getElementById('directionSelect');
  const oneImageBtn = document.getElementById('oneImageBtn');
  const manyImagesBtn = document.getElementById('manyImagesBtn');
  const canvasContainer = document.getElementById('canvasContainer');
  const galleryContainer = document.getElementById('galleryContainer');
  const selectAllBtn = document.querySelector('.select-all-btn');
  const selectAllImg = selectAllBtn?.querySelector('img');
  const previewVideo   = document.getElementById('previewVideo');
  const playPauseBtn   = document.getElementById('playPauseBtn');

  let currentFontSize = 45;

  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => {
    if (sizeInput) sizeInput.value = currentFontSize;
    const spinner = document.querySelector('.spinner');
    if (spinner) {
      spinner.style.display = 'none';
    }
  };
  image.onerror = () => {
    const spinner = document.querySelector('.spinner');
    if (spinner) {
      spinner.style.display = 'none';
    }
  };
  image.src = '';

  let isSelectAllActive = false;
  let currentTemplate = null;
  let isRendering = false;
  let rafId = null;
  
  // Переменные для временного отображения промокода
  let promoStartTime = 0;
  let promoEndTime = 0;
  
  // Переменная для текущего размера видео
  let currentVideoSize = '1x1';

  selectAllBtn?.addEventListener('click', function() {
    isSelectAllActive = !isSelectAllActive;
    const visibleWrappers = Array.from(galleryContainer.querySelectorAll('.gallery-item-wrapper'));
    
    visibleWrappers.forEach(wrapper => {
      if (isSelectAllActive) {
        wrapper.classList.add('selected');
        if (!wrapper.querySelector('.check-icon')) {
          const checkIcon = document.createElement('img');
          checkIcon.src = 'assets/images/check_circle_outline.svg';
          checkIcon.classList.add('check-icon');
          wrapper.appendChild(checkIcon);
        }
      } else {
        wrapper.classList.remove('selected');
        const checkIcon = wrapper.querySelector('.check-icon');
        if (checkIcon) {
          checkIcon.remove();
        }
      }
    });

    selectAllImg.src = isSelectAllActive ? 'assets/images/check_box.svg' : 'assets/images/check_box_outline_blank.svg';
    updateDownloadButtonState();
  });

  function selectDisplayMode(mode) {
    if (mode === 'one') {
      oneImageBtn?.classList.add('selected');
      manyImagesBtn?.classList.remove('selected');
      canvasContainer.style.display = 'flex';
      galleryContainer.style.display = 'none';
      downloadBtn.disabled = false;
      isSelectAllActive = false;
      if (selectAllImg) {
        selectAllImg.src = 'assets/images/check_box_outline_blank.svg';
      }
      selectAllBtn.disabled = true;
      selectAllBtn.style.opacity = '0.5';
      selectAllBtn.style.cursor = 'not-allowed';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.style.backgroundImage = '';
      // Устанавливаем размер canvas в зависимости от размера текущего шаблона
      const selectedSize = currentTemplate ? currentTemplate.size : '1x1';
      updateCanvasSize(selectedSize);
      // показать кнопку плей, если у шаблона есть видео
      if (currentTemplate && currentTemplate.video_url) {
        if (playPauseBtn) playPauseBtn.style.display = 'block';
      } else if (playPauseBtn) {
        playPauseBtn.style.display = 'none';
      }
    } else if (mode === 'many') {
      manyImagesBtn?.classList.add('selected');
      oneImageBtn?.classList.remove('selected');
      canvasContainer.style.display = 'none';
      galleryContainer.style.display = 'flex';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      loadGalleryImages();
      updateDownloadButtonState();
      selectAllBtn.disabled = false;
      selectAllBtn.style.opacity = '1';
      selectAllBtn.style.cursor = 'pointer';
      // остановить проигрывание при переходе в many
      stopRendering();
      if (previewVideo) {
        try { previewVideo.pause(); } catch (e) {}
      }
      if (playPauseBtn) {
        playPauseBtn.style.display = 'none';
        setPlayButtonLabel(false);
      }
    }
  }

  function updateDownloadButtonState() {
    const selectedImages = document.querySelectorAll('.gallery-item-wrapper.selected');
    downloadBtn.disabled = selectedImages.length === 0;
  }

  function updateCanvasSize(size) {
    currentVideoSize = size;
    
    if (size === '1x1') {
      canvas.width = 1000;
      canvas.height = 1000;
    } else if (size === '9x16') {
      canvas.width = 225;
      canvas.height = 400;
    }
    
    // Перерисовываем если есть активный шаблон
    if (currentTemplate) {
      drawOneVideo(currentTemplate);
    }
  }

  function loadGalleryImages() {
    if (!galleryContainer) return;
    galleryContainer.innerHTML = ''; 

    const selectedGeo = geoSelect.value;
    const selectedCurrency = currencySelect.value;

    const filteredTemplates = window.templates.filter(template => {
      const hasGeo = !selectedGeo || template.geo === selectedGeo;
      const hasCurrency = !selectedCurrency || template.currency === selectedCurrency;
      const hasDirection = !directionSelect.value || directionSelect.value === 'all' || template.direction === directionSelect.value;
      return hasGeo && hasCurrency && hasDirection;
    });

    // Сортируем по размеру: сначала 1x1, потом 9x16
    const sortedTemplates = filteredTemplates.sort((a, b) => {
      if (a.size === '1x1' && b.size === '9x16') return -1;
      if (a.size === '9x16' && b.size === '1x1') return 1;
      return 0;
    });

    let hasShown1x1 = false;
    let hasShown9x16 = false;

    sortedTemplates.forEach(template => {
      // Добавляем серую линию перед первым 9x16 элементом
      if (template.size === '9x16' && !hasShown9x16 && hasShown1x1) {
        const separatorDiv = document.createElement('div');
        separatorDiv.style.cssText = `
          width: 100%;
          height: 1px;
          background-color: #ccc;
          margin: 10px 0;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        `;
        
        const labelSpan = document.createElement('span');
        labelSpan.textContent = '9×16';
        labelSpan.style.cssText = `
          background-color: white;
          padding: 0 15px;
          color: #666;
          font-weight: bold;
          font-size: 14px;
        `;
        
        separatorDiv.appendChild(labelSpan);
        galleryContainer.appendChild(separatorDiv);
        hasShown9x16 = true;
      }
      
      if (template.size === '1x1') {
        hasShown1x1 = true;
      }

      const wrapper = document.createElement('div');
      wrapper.classList.add('gallery-item-wrapper');
      
      // Создаем превью для отображения
      const preview = document.createElement('img');
      preview.crossOrigin = 'anonymous';
      
      // Проверяем, что у нас есть правильные URL
      if (!template.preview_url && !template.image_url) {
        console.error('Template missing both preview_url and image_url:', template);
      }
      
      preview.src = template.preview_url || template.image_url; // fallback для совместимости
      preview.alt = template.template_name || 'Template Preview';
      preview.setAttribute('data-template-id', template.id);
      preview.setAttribute('data-image-id', template.image_id);
      
      // Добавляем обработчики ошибок
      preview.onerror = function() {
        console.error('Failed to load image:', this.src);
        this.style.display = 'none';
        const errorDiv = document.createElement('div');
        errorDiv.textContent = 'Ошибка загрузки изображения';
        errorDiv.style.color = 'red';
        errorDiv.style.padding = '20px';
        errorDiv.style.textAlign = 'center';
        wrapper.appendChild(errorDiv);
      };
      
      preview.addEventListener('click', function(e) {
        if (e.button === 0) {
          selectDisplayMode('one');
          const spinner = document.querySelector('.spinner');
          if (spinner) {
            spinner.style.display = 'block';
          }
          currentTemplate = template;
          // Синхронизируем поле размера текста с шаблоном
          if (sizeInput && template.text_size) {
            sizeInput.value = template.text_size;
          }
          // Автоматически устанавливаем гео и валюту из выбранной картинки
          if (geoSelect && template.geo) {
            geoSelect.value = template.geo;
          }
          if (currencySelect && template.currency) {
            currencySelect.value = template.currency;
          }
          // Устанавливаем временные рамки для отображения промокода
          promoStartTime = parseFloat(template.promo_start) || 0;
          promoEndTime = parseFloat(template.promo_end) || 0;
          // Обновляем размер канваса в соответствии с размером шаблона
          const templateSize = template.size || '1x1';
          updateCanvasSize(templateSize);
          prepareVideo(currentTemplate);
          drawOneVideo(currentTemplate);
          if (spinner) {
            spinner.style.display = 'none';
          }
          // Перерисовываем текст после небольшой задержки для гарантии
          setTimeout(() => {
            drawOneVideo(currentTemplate);
          }, 100);
        }
      });

      wrapper.addEventListener('contextmenu', function(e) {
        e.preventDefault(); 
        wrapper.classList.toggle('selected');
        
        if (wrapper.classList.contains('selected')) {
          if (!wrapper.querySelector('.check-icon')) {
            const checkIcon = document.createElement('img');
            checkIcon.src = 'assets/images/check_circle_outline.svg';
            checkIcon.classList.add('check-icon');
            wrapper.appendChild(checkIcon);
          }
        } else {
          const checkIcon = wrapper.querySelector('.check-icon');
          if (checkIcon) {
            checkIcon.remove();
          }
        }
        updateDownloadButtonState();
      });
      
      wrapper.appendChild(preview);
      galleryContainer.appendChild(wrapper);
    });
    updateDownloadButtonState();
  }

  oneImageBtn?.addEventListener('click', () => selectDisplayMode('one'));
  manyImagesBtn?.addEventListener('click', () => selectDisplayMode('many'));

  function logBannerDownload(localization, bannerCount, promo) {
    fetch('/log_download.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localization, bannerCount, promo })
    });
  }

  // Функция для проверки статуса задачи
  async function checkTaskStatus(taskId) {
    try {
      const response = await fetch(`/check_status.php?task_id=${encodeURIComponent(taskId)}`);
      if (!response.ok) {
        throw new Error('Failed to check task status');
      }
      const data = await response.json();
      return data.task;
    } catch (error) {
      console.error('Error checking task status:', error);
      return null;
    }
  }

  // Функция для ожидания завершения задачи
  async function waitForTaskCompletion(taskId, maxWaitTime = 300000) {
    const startTime = Date.now();
    const checkInterval = 2000; // Проверяем каждые 2 секунды

    return new Promise((resolve, reject) => {
      const checkStatus = async () => {
        if (Date.now() - startTime > maxWaitTime) {
          reject(new Error('Timeout waiting for task completion'));
          return;
        }

        const task = await checkTaskStatus(taskId);
        if (!task) {
          setTimeout(checkStatus, checkInterval);
          return;
        }

        if (task.status === 'completed') {
          resolve(task);
        } else if (task.status === 'failed') {
          reject(new Error(task.error || 'Task processing failed'));
        } else {
          setTimeout(checkStatus, checkInterval);
        }
      };

      checkStatus();
    });
  }

  async function downloadVideo() {
    if (!currentTemplate) return;
    
    const txt = textInput && textInput.value ? textInput.value.trim().toUpperCase() : '';
    if (!txt) {
      window.showAppError('Введите промокод перед созданием видео.', 'Промокод не введён');
      return;
    }
    
    if (!currentTemplate.video_url) {
      window.showAppError('Для этого шаблона не загружено видео. Добавьте видео в админ-панели.', 'Видео не найдено');
      return;
    }
    
    // Показываем спиннер
    const spinner = document.querySelector('.spinner');
    if (spinner) {
      spinner.style.display = 'block';
    }
    
    try {
      // Добавляем задачу в очередь
      const formData = new FormData();
      formData.append('video_path', currentTemplate.video_url);
      formData.append('promo_text', txt);
      formData.append('text_size', sizeInput && sizeInput.value ? sizeInput.value : currentTemplate.text_size || 45);
      formData.append('skew_angle', currentTemplate.skew_angle || 0);
      formData.append('text_alignment', currentTemplate.text_alignment || 'center');
      formData.append('text_color', currentTemplate.text_color || '#000000');
      formData.append('position_x', currentTemplate.position_x || 0);
      formData.append('position_y', currentTemplate.position_y || 0);
      formData.append('promo_start', promoStartTime);
      formData.append('promo_end', promoEndTime);
      
      const addResponse = await fetch('/add_task.php', {
        method: 'POST',
        body: formData
      });
      
      if (!addResponse.ok) {
        const errorResult = await addResponse.json().catch(() => ({}));
        throw new Error(errorResult.error || 'Failed to add task to queue');
      }
      
      const addData = await addResponse.json();
      const taskId = addData.task_id;
      
      // Ждем завершения обработки
      await waitForTaskCompletion(taskId);
      
      // Скачиваем готовый файл
      const geo = geoSelect && geoSelect.value ? geoSelect.value.trim().toUpperCase() : 'GEO';
      const cur = currencySelect && currencySelect.value ? currencySelect.value.trim().toUpperCase() : 'CUR';
      const dir = directionSelect && directionSelect.value ? directionSelect.value.trim().toUpperCase() : 'DIR';
      
      const downloadUrl = `/download_task.php?task_id=${encodeURIComponent(taskId)}&geo=${encodeURIComponent(geo)}&cur=${encodeURIComponent(cur)}&dir=${encodeURIComponent(dir)}`;
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${txt}_${geo}_${cur}_${dir}.mp4`;
      link.click();
      
      const localization = `${geo}_${cur}`;
      logBannerDownload(localization, 1, txt);
    } catch (error) {
      console.error('Error processing video:', error);
      window.showAppError(error.message, 'Ошибка обработки видео');
    } finally {
      if (spinner) spinner.style.display = 'none';
    }
  }

  async function processVideosInParallel(items) {
    const txt = textInput && textInput.value ? textInput.value.trim().toUpperCase() : '';
    if (!txt) {
      throw new Error('Promo text is required');
    }
    
    // Сначала добавляем все задачи в очередь
    const tasks = [];
    for (const item of items) {
        try {
          const imgEl = item.querySelector('img');
          if (!imgEl) {
            console.error('Image element not found in selected item');
          continue;
          }
          const imageId = imgEl.getAttribute('data-image-id');
          const template = window.templates.find(t => t.image_id == imageId);
          if (!template) {
            console.error('Template not found for image ID:', imageId);
          continue;
          }
          
          if (!template.video_url) {
            console.error('Video URL not found for template:', template.id);
          continue;
          }
          
        // Добавляем задачу в очередь
          const formData = new FormData();
          formData.append('video_path', template.video_url);
          formData.append('promo_text', txt);
          formData.append('text_size', sizeInput && sizeInput.value ? sizeInput.value : template.text_size || 45);
          formData.append('skew_angle', template.skew_angle || 0);
          formData.append('text_alignment', template.text_alignment || 'center');
          formData.append('text_color', template.text_color || '#000000');
          formData.append('position_x', template.position_x || 0);
          formData.append('position_y', template.position_y || 0);
          formData.append('promo_start', template.promo_start || 0);
          formData.append('promo_end', template.promo_end || 0);
          
        const response = await fetch('/add_task.php', {
            method: 'POST',
            body: formData
          });
          
          if (!response.ok) {
          const errorResult = await response.json().catch(() => ({}));
          console.error('Failed to add task:', errorResult.error);
          continue;
            }
        
        const data = await response.json();
        tasks.push({
          taskId: data.task_id,
          template: template,
          filename: `${txt}_${template.geo || 'GEO'}_${template.currency || 'CUR'}_${template.direction || 'DIR'}_${template.image_id}.mp4`
        });
        } catch (error) {
        console.error('Error adding task:', error);
      }
    }

    // Ждем завершения всех задач
    const completedTasks = [];
    for (const task of tasks) {
      try {
        await waitForTaskCompletion(task.taskId);
        completedTasks.push(task);
      } catch (error) {
        console.error('Task failed:', task.taskId, error);
        }
    }

    // Скачиваем все готовые файлы
    const geo = geoSelect && geoSelect.value ? geoSelect.value.trim().toUpperCase() : 'GEO';
    const cur = currencySelect && currencySelect.value ? currencySelect.value.trim().toUpperCase() : 'CUR';
    const dir = directionSelect && directionSelect.value ? directionSelect.value.trim().toUpperCase() : 'DIR';

    for (const task of completedTasks) {
      const downloadUrl = `/download_task.php?task_id=${encodeURIComponent(task.taskId)}&geo=${encodeURIComponent(geo)}&cur=${encodeURIComponent(cur)}&dir=${encodeURIComponent(dir)}`;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = task.filename;
      link.click();
      
      // Небольшая задержка между скачиваниями
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return completedTasks;
  }

  downloadBtn?.addEventListener('click', async () => {
    if (oneImageBtn?.classList.contains('selected')) {
      downloadVideo();
    } else if (manyImagesBtn?.classList.contains('selected')) {
      const selectedItems = document.querySelectorAll('.gallery-item-wrapper.selected');
      if (selectedItems.length === 0) {
        window.showAppError('Выберите хотя бы одно изображение в галерее.', 'Ничего не выбрано');
        return;
      }

      if (!window.templates || !Array.isArray(window.templates) || window.templates.length === 0) {
        console.error('Templates not loaded:', window.templates);
        window.showAppError('Шаблоны не загружены. Обновите страницу.', 'Ошибка загрузки');
        return;
      }

      // Показываем спиннер для множественной обработки
      const spinner = document.querySelector('.spinner');
      if (spinner) {
        spinner.style.display = 'block';
      }

      try {
        const processedFiles = await processVideosInParallel(Array.from(selectedItems));

        if (processedFiles.length === 0) {
          throw new Error('No files were processed successfully');
        }

        // Логируем скачивание
        const geo = geoSelect && geoSelect.value ? geoSelect.value.trim().toUpperCase() : 'GEO';
        const val = currencySelect && currencySelect.value ? currencySelect.value.trim().toUpperCase() : 'VAL';
        const promo = textInput && textInput.value ? textInput.value.trim().toUpperCase() : 'PROMO';
        const localization = `${geo}_${val}`;
        logBannerDownload(localization, selectedItems.length, promo);
      } catch (error) {
        console.error('Error processing videos:', error);
        window.showAppError(error.message, 'Ошибка обработки видео');
      } finally {
        if (spinner) spinner.style.display = 'none';
      }
    }
  });
  
  async function loadFreshData() {
    try {
      const response = await fetch(window.location.href, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error loading data:', error);
      return null;
    }
  }

  function updateSelectOptions(select, options, defaultText) {
    select.innerHTML = '';
    options.forEach(option => {
      if (option) {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        select.appendChild(optionElement);
      }
    });
    // Выбираем первый элемент по умолчанию, если есть
    if (options.length > 0) {
      select.value = options[0];
    } else {
      select.value = '';
    }
  }

  function fillGeoAndCurrencyDropdowns() {
    // Фильтруем гео по выбранному направлению, если выбрано и не "all"
    let filteredTemplates = window.templates;
    if (directionSelect && directionSelect.value && directionSelect.value !== 'all') {
      filteredTemplates = window.templates.filter(t => t.direction === directionSelect.value);
    }
    // Собираем уникальные значения гео из отфильтрованных шаблонов
    const geos = Array.from(new Set(filteredTemplates.map(t => t.geo).filter(Boolean)));
    geos.sort((a, b) => a.localeCompare(b, 'ru'));
    updateSelectOptions(geoSelect, geos, 'Выберите гео');
    // При первом заполнении валюты — все, но после выбора гео — только подходящие
    updateCurrencyDropdownForGeo();
  }

  function updateCurrencyDropdownForGeo() {
    const selectedGeo = geoSelect.value;
    let currencies = [];
    if (selectedGeo) {
      // Только валюты, которые есть для выбранного гео
      currencies = Array.from(new Set(window.templates.filter(t => t.geo === selectedGeo).map(t => t.currency).filter(Boolean)));
    } else {
      // Если гео не выбрано — все валюты
      currencies = Array.from(new Set(window.templates.map(t => t.currency).filter(Boolean)));
    }
    updateSelectOptions(currencySelect, currencies, 'Выберите валюту');
    // Если для выбранного гео только одна валюта — выбрать её автоматически
    if (currencies.length === 1) {
      currencySelect.value = currencies[0];
    }
  }

  document.addEventListener('DOMContentLoaded', function() {
    const geoSelect = document.getElementById('geoSelect');
    const currencySelect = document.getElementById('currencySelect');
    
    if (!geoSelect || !currencySelect) {
      return;
    }

    if (oneImageBtn) {
      oneImageBtn.style.pointerEvents = 'none';
      oneImageBtn.style.opacity = '0.5';
    }

    loadFreshData().then(data => {
      if (data) {
        window.templates = data.templates;

        fillGeoAndCurrencyDropdowns();
        selectDisplayMode('many');
      }
    });

    let isUpdating = false;

    geoSelect.addEventListener('change', function() {
      if (!isUpdating) {
        if (oneImageBtn && oneImageBtn.classList.contains('selected')) {
          selectDisplayMode('many');
        }
        updateCurrencyDropdownForGeo();
        loadGalleryImages();
      }
    });

    currencySelect.addEventListener('change', function() {
      if (!isUpdating) {
        if (oneImageBtn && oneImageBtn.classList.contains('selected')) {
          selectDisplayMode('many');
        }
        loadGalleryImages();
      }
    });

    geoSelect.addEventListener('focus', async function() {
      // убрано обновление данных при фокусе
    });

    currencySelect.addEventListener('focus', async function() {
      // убрано обновление данных при фокусе
    });

    if (directionSelect) {
      directionSelect.addEventListener('change', function() {
        fillGeoAndCurrencyDropdowns();
        loadGalleryImages();
      });
    }


    const langBtn = document.getElementById('langSwitchBtn');
    if (langBtn) {
      langBtn.addEventListener('click', toggleLanguage);
      // Установить язык при загрузке
      setLanguage(localStorage.getItem('lang') || 'RU');
    }

    // Добавляем вариант "все" в дропдаун направления
    if (directionSelect) {
      let hasAllOption = Array.from(directionSelect.options).some(opt => opt.value === 'all');
      if (!hasAllOption) {
        const allOption = document.createElement('option');
        allOption.value = 'all';
        allOption.textContent = 'Все';
        directionSelect.insertBefore(allOption, directionSelect.firstChild);
        directionSelect.value = 'all';
      }
    }
  });

  function drawOneVideo(template) {
    // Очищаем canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Показываем превью как фон
    if (template.preview_url) {
      canvas.style.backgroundImage = `url(${template.preview_url})`;
      canvas.style.backgroundSize = 'contain';
      canvas.style.backgroundPosition = 'center';
      canvas.style.backgroundRepeat = 'no-repeat';
    }
    
    // Рисуем рамку для текста - используем правильные размеры как в админке
    const rect = {
      width: 450, // Фиксированная ширина области текста
      height: 100, // Фиксированная высота области текста
      fill: 'rgba(255,0,0,0.1)' // Полупрозрачная рамка для видимости области текста
    };
    
    // Масштабируем координаты в зависимости от размера canvas
    let centerX = template.position_x || 0;
    let centerY = template.position_y || 0;
    let scale = 1; // Масштаб для размера шрифта и области
    
    if (currentVideoSize === '9x16') {
      // Для 9x16 масштабируем координаты с реальных размеров видео на 225x400
      const videoWidth = previewVideo ? previewVideo.videoWidth : 1080;
      const videoHeight = previewVideo ? previewVideo.videoHeight : 1920;
      
      // Используем логику как в админке для правильного позиционирования
      const { dx, dy, drawWidth, drawHeight } = getContainDrawParams(
        videoWidth, 
        videoHeight, 
        canvas.width, 
        canvas.height
      );
      const videoScale = Math.min(drawWidth / videoWidth, drawHeight / videoHeight);
      centerX = dx + (template.position_x || 0) * videoScale;
      centerY = dy + (template.position_y || 0) * videoScale;
      scale = videoScale;
    }
    
    let angle = parseFloat(template.skew_angle) || 0;
    const radians = angle * Math.PI / 180;
    const skewValue = Math.tan(radians);
    
    // Рисуем прямоугольник области текста
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.transform(1, 0, skewValue, 1, 0, 0);
    ctx.rotate(-radians);
    ctx.fillStyle = rect.fill;
    ctx.fillRect(-rect.width/2 * scale, -rect.height/2 * scale, rect.width * scale, rect.height * scale);
    ctx.restore();

    // Рисуем текст промокода
    const txt = textInput && textInput.value ? textInput.value.trim().toUpperCase() : '';
    if (txt) {
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.transform(1, 0, skewValue, 1, 0, 0);
      ctx.rotate(-radians);
      
      let textColor = template.text_color || '#000000';
      if (textColor && !textColor.startsWith('#')) textColor = '#' + textColor;
      
      let fontSize = template.text_size ? parseInt(template.text_size, 10) : 45;
      
      // Размер шрифта без дополнительного масштабирования (scale уже учтен в координатах)
      
      if (txt.length > 6) fontSize = fontSize - 2 * (txt.length - 6);
      if (fontSize < 10) fontSize = 10; // Увеличиваем минимальный размер шрифта еще больше
      
      ctx.font = `900 italic ${fontSize * scale}px Inter`;
      ctx.fillStyle = textColor;
      ctx.textAlign = template.text_alignment || 'center';
      ctx.textBaseline = 'middle';
      
      let textX;
      if (ctx.textAlign === 'left') {
        textX = -rect.width/2 * scale;
      } else if (ctx.textAlign === 'right') {
        textX = rect.width/2 * scale;
      } else {
        textX = 0;
      }
      
      ctx.fillText(txt, textX, 0);
      ctx.restore();
    }
  }

  function drawOverlay(template) {
    // Проверяем, нужно ли показывать промокод в текущий момент времени
    let shouldShowPromo = true;
    
    if (previewVideo && template && template.video_url) {
      const currentTime = previewVideo.currentTime;
      // Если временные отрезки не установлены (0,0), показываем промокод всегда
      if (promoStartTime === 0 && promoEndTime === 0) {
        shouldShowPromo = true;
      } else {
        shouldShowPromo = currentTime >= promoStartTime && currentTime <= promoEndTime;
      }
    }
    
    // Если промокод не должен показываться в этот момент, не рисуем ничего
    if (!shouldShowPromo) {
      return;
    }
    
    // Рисуем только рамку и текст поверх текущего фона/кадра - используем правильные размеры как в админке
    const rect = {
      width: 450, // Фиксированная ширина области текста
      height: 100, // Фиксированная высота области текста
      fill: 'rgba(255,0,0,0.1)'
    };
    
    // Масштабируем координаты в зависимости от размера canvas
    let centerX = template.position_x || 0;
    let centerY = template.position_y || 0;
    let scale = 1; // Масштаб для размера шрифта и области
    
    if (currentVideoSize === '9x16') {
      // Для 9x16 масштабируем координаты с реальных размеров видео на 225x400
      const videoWidth = previewVideo ? previewVideo.videoWidth : 1080;
      const videoHeight = previewVideo ? previewVideo.videoHeight : 1920;
      
      // Используем логику как в админке для правильного позиционирования
      const { dx, dy, drawWidth, drawHeight } = getContainDrawParams(
        videoWidth, 
        videoHeight, 
        canvas.width, 
        canvas.height
      );
      const videoScale = Math.min(drawWidth / videoWidth, drawHeight / videoHeight);
      centerX = dx + (template.position_x || 0) * videoScale;
      centerY = dy + (template.position_y || 0) * videoScale;
      scale = videoScale;
    }
    
    const angle = parseFloat(template.skew_angle) || 0;
    const radians = angle * Math.PI / 180;
    const skewValue = Math.tan(radians);
    
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.transform(1, 0, skewValue, 1, 0, 0);
    ctx.rotate(-radians);
    ctx.fillStyle = rect.fill;
    ctx.fillRect(-rect.width/2 * scale, -rect.height/2 * scale, rect.width * scale, rect.height * scale);
    ctx.restore();

    const txt = textInput && textInput.value ? textInput.value.trim().toUpperCase() : '';
    if (!txt) return;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.transform(1, 0, skewValue, 1, 0, 0);
    ctx.rotate(-radians);
    let textColor = template.text_color || '#000000';
    if (textColor && !textColor.startsWith('#')) textColor = '#' + textColor;
    let fontSize = template.text_size ? parseInt(template.text_size, 10) : 45;
    
    // Размер шрифта без дополнительного масштабирования (scale уже учтен в координатах)
    
    if (txt.length > 6) fontSize = fontSize - 2 * (txt.length - 6);
    if (fontSize < 10) fontSize = 10; // Увеличиваем минимальный размер шрифта еще больше
     ctx.font = `900 italic ${fontSize * scale}px Inter`;
    ctx.fillStyle = textColor;
    ctx.textAlign = template.text_alignment || 'center';
    ctx.textBaseline = 'middle';
    let textX;
    if (ctx.textAlign === 'left') {
      textX = -rect.width/2 * scale;
    } else if (ctx.textAlign === 'right') {
      textX = rect.width/2 * scale;
    } else {
      textX = 0;
    }
    ctx.fillText(txt, textX, 0);
    ctx.restore();
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

  function renderFrame() {
    if (!previewVideo || !currentTemplate) return;
    if (!isRendering) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (previewVideo.readyState >= 2) {
      const { dx, dy, drawWidth, drawHeight } = getContainDrawParams(previewVideo.videoWidth || 1000, previewVideo.videoHeight || 1000, canvas.width, canvas.height);
      canvas.style.backgroundImage = '';
      try {
        ctx.drawImage(previewVideo, dx, dy, drawWidth, drawHeight);
      } catch (e) {
        // ignore draw issues
      }
    }
    drawOverlay(currentTemplate);
    rafId = requestAnimationFrame(renderFrame);
  }

  function startRendering() {
    if (isRendering) return;
    isRendering = true;
    rafId = requestAnimationFrame(renderFrame);
  }

  function stopRendering() {
    isRendering = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function setPlayButtonLabel(isPlaying) {
    const img = playPauseBtn?.querySelector('img');
    if (!img) return;
    // Меняем иконку в зависимости от состояния
    img.src = isPlaying ? 'assets/images/pause.svg' : 'assets/images/play_arrow.svg';
    img.alt = isPlaying ? 'Pause' : 'Play';
  }

  function prepareVideo(template) {
    stopRendering();
    if (!previewVideo || !template || !template.video_url) {
      if (playPauseBtn) playPauseBtn.style.display = 'none';
      return;
    }
    try { previewVideo.pause(); } catch(e) {}
    previewVideo.src = template.video_url;
    previewVideo.currentTime = 0;
    if (playPauseBtn) playPauseBtn.style.display = 'block';
    setPlayButtonLabel(false);
  }

  [textInput, sizeInput, skewAngleInput].forEach(el => {
    if (el) {
      el.addEventListener('input', () => {
        if (oneImageBtn && oneImageBtn.classList.contains('selected') && currentTemplate) {
          if (isRendering) {
            // при проигрывании — просто перерисуем следующий кадр с новым текстом
            // overlay обновится в рендер-цикле
          } else {
            drawOneVideo(currentTemplate);
          }
        }
      });
    }
  });

  if (playPauseBtn) {
    playPauseBtn.addEventListener('click', async () => {
      if (!currentTemplate || !previewVideo) return;
      if (!currentTemplate.video_url) return;
      if (previewVideo.paused || previewVideo.ended) {
        // начать проигрывание
        canvas.style.backgroundImage = '';
        try {
          await previewVideo.play();
          startRendering();
          setPlayButtonLabel(true);
        } catch (e) {
          console.error('Cannot play video:', e);
        }
      } else {
        // пауза
        try { previewVideo.pause(); } catch(e) {}
        stopRendering();
        drawOneVideo(currentTemplate);
        setPlayButtonLabel(false);
      }
    });

    // При завершении видео — вернуть кнопку в состояние Play
    if (previewVideo) {
      previewVideo.addEventListener('ended', () => {
        stopRendering();
        setPlayButtonLabel(false);
        drawOneVideo(currentTemplate);
      });
    }
  }

  const translations = {
    RU: {
      geo: 'Гео',
      currency: 'Валюта',
      choose_direction: 'Выбери направление',
      sport: 'Спорт',
      casino: 'Казино',
      universal: 'Универсальный',
      enter_promocode: 'Введи промокод',
      display_mode: 'Режим отображения',
      download: 'Создать видео',
      select_all: 'Выбрать всё',
      all: 'Все',
      play: 'Плей',
      pause: 'Пауза',
      video_size: 'Размер видео',
    },
    ENG: {
      geo: 'Geo',
      currency: 'Currency',
      choose_direction: 'Choose direction',
      sport: 'Sport',
      casino: 'Casino',
      universal: 'Universal',
      enter_promocode: 'Enter promocode',
      display_mode: 'Display mode',
      download: 'Create Video',
      select_all: 'Select All',
      all: 'All',
      play: 'Play',
      pause: 'Pause',
      video_size: 'Video size',
    }
  };

  function setLanguage(lang) {
    localStorage.setItem('lang', lang);
    document.getElementById('langSwitchBtn').textContent = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = translations[lang][key] || '';
    });
  }

  function toggleLanguage() {
    const current = localStorage.getItem('lang') || 'RU';
    const next = current === 'RU' ? 'ENG' : 'RU';
    setLanguage(next);
  }
})();
