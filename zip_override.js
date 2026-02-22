;(function(){
  // Ensure JSZip is available
  if (typeof JSZip === 'undefined') return;

  // Функция для логирования скачиваний
  function logBannerDownload(localization, bannerCount, promo) {
    fetch('/log_download.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localization, bannerCount, promo })
    });
  }

  function blobToArrayBuffer(blob){
    return new Promise((resolve, reject)=>{
      const reader = new FileReader();
      reader.onload = ()=> resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
  }

  async function processSelectedToBlobs(selectedItems, hooks){
    const concurrency = 1; // sequential to reduce server load
    const items = Array.from(selectedItems);
    const out = [];

    for (let i = 0; i < items.length; i += concurrency) {
      const chunk = items.slice(i, i + concurrency);
      const results = await Promise.all(chunk.map(async (item)=>{
        try {
          if (hooks && typeof hooks.onStart === 'function') {
            try { hooks.onStart(item); } catch(_) {}
          }
          const imgEl = item.querySelector('img');
          if (!imgEl) return null;
          const imageId = imgEl.getAttribute('data-image-id');
          const template = Array.isArray(window.templates) ? window.templates.find(t => t.image_id == imageId) : null;
          if (!template || !template.video_url) return null;

          const textInput = document.getElementById('textInput');
          const sizeInput = document.getElementById('textSizeInput');
          const txt = textInput && textInput.value ? textInput.value.trim().toUpperCase() : '';
          if (!txt) return null;

          const formData = new FormData();
          formData.append('video_path', template.video_url);
          formData.append('promo_text', txt);
          formData.append('text_size', sizeInput && sizeInput.value ? sizeInput.value : (template.text_size || 45));
          formData.append('skew_angle', template.skew_angle || 0);
          formData.append('text_alignment', template.text_alignment || 'center');
          formData.append('text_color', template.text_color || '#000000');
          formData.append('position_x', template.position_x || 0);
          formData.append('position_y', template.position_y || 0);
          formData.append('promo_start', template.promo_start || 0);
          formData.append('promo_end', template.promo_end || 0);

          const resp = await fetch('/process_video.php', { method: 'POST', body: formData });
          if (!resp.ok) {
            if (hooks && typeof hooks.onDone === 'function') {
              try { hooks.onDone(item, false); } catch(_) {}
            }
            return null;
          }
          const blob = await resp.blob();
          const geo = (template.geo || 'GEO').toString().trim().toUpperCase();
          const cur = (template.currency || 'CUR').toString().trim().toUpperCase();
          const dir = (template.direction || 'DIR').toString().trim().toUpperCase();
          const filename = `${txt}_${geo}_${cur}_${dir}_${template.image_id}.mp4`;
          if (hooks && typeof hooks.onDone === 'function') {
            try { hooks.onDone(item, true); } catch(_) {}
          }
          return { filename, blob };
        } catch(e){
          if (hooks && typeof hooks.onDone === 'function') {
            try { hooks.onDone(item, false); } catch(_) {}
          }
          return null;
        }
      }));
      out.push(...results.filter(Boolean));
    }
    return out;
  }

  async function handleManyDownloadZip(ev){
    const manyBtn = document.getElementById('manyImagesBtn');
    const oneBtn = document.getElementById('oneImageBtn');
    if (!manyBtn || !oneBtn) return;
    // Only intercept when MANY mode is active
    if (!manyBtn.classList.contains('selected')) return;

    const selectedItems = document.querySelectorAll('.gallery-item-wrapper.selected');
    if (!selectedItems || selectedItems.length === 0) return; // let original handler show alert if any

    ev.stopImmediatePropagation();
    ev.preventDefault();

    try {
      const textInput = document.getElementById('textInput');
      const geoSelect = document.getElementById('geoSelect');
      const currencySelect = document.getElementById('currencySelect');
      const txt = textInput && textInput.value ? textInput.value.trim().toUpperCase() : '';
      if (!txt) { (window.showAppError || alert)('Введите промокод перед созданием архива.', 'Промокод не введён'); return; }

      // add spinners to each selected wrapper and remove on completion
      function ensureSpinnerStyles(){
        if (document.getElementById('zip-inline-spinner-style')) return;
        const style = document.createElement('style');
        style.id = 'zip-inline-spinner-style';
        style.textContent = '\n@keyframes zipSpin { to { transform: rotate(360deg); } }\n.zip-inline-spinner {\n  width: 24px; height: 24px;\n  border: 3px solid rgba(0,0,0,0.1);\n  border-top-color: rgb(183,187,190);\n  border-radius: 50%;\n  animation: zipSpin 0.8s linear infinite;\n}\n';
        document.head.appendChild(style);
      }
      ensureSpinnerStyles();

      const cleanup = [];
      function ensureSpinnerOn(wrapper){
        try {
          // make wrapper positioning predictable
          if (!wrapper.__oldPosition) {
            wrapper.__oldPosition = wrapper.style.position || '';
            if (!wrapper.style.position || wrapper.style.position === '') {
              wrapper.style.position = 'relative';
            }
          }
          let sp = wrapper.querySelector('.item-spinner-overlay');
          if (!sp) {
            sp = document.createElement('div');
            sp.className = 'item-spinner-overlay';
            sp.style.position = 'absolute';
            sp.style.top = '0';
            sp.style.left = '0';
            sp.style.right = '0';
            sp.style.bottom = '0';
            sp.style.display = 'flex';
            sp.style.alignItems = 'center';
            sp.style.justifyContent = 'center';
            sp.style.background = 'rgba(255,255,255,0.6)';
            const s = document.createElement('div');
            s.className = 'zip-inline-spinner';
            sp.appendChild(s);
            wrapper.appendChild(sp);
          } else {
            sp.style.display = 'flex';
          }
          cleanup.push(()=>{
            try {
              sp.remove();
              if (wrapper.__oldPosition !== undefined) {
                wrapper.style.position = wrapper.__oldPosition;
                delete wrapper.__oldPosition;
              }
            } catch(_) {}
          });
        } catch(_) {}
      }
      function removeSpinnerOn(wrapper){
        try {
          const sp = wrapper.querySelector('.item-spinner-overlay');
          if (sp) sp.remove();
          if (wrapper.__oldPosition !== undefined) {
            wrapper.style.position = wrapper.__oldPosition;
            delete wrapper.__oldPosition;
          }
        } catch(_) {}
      }

      Array.from(selectedItems).forEach(ensureSpinnerOn);

      const files = await processSelectedToBlobs(selectedItems, {
        onStart: (item)=>{
          // already shown above; noop
        },
        onDone: (item)=>{
          removeSpinnerOn(item);
        }
      });
      if (!files.length) { (window.showAppError || alert)('Не удалось обработать ни один файл. Проверьте логи.', 'Ошибка обработки'); return; }

      const zip = new JSZip();
      for (const { filename, blob } of files) {
        const ab = await blobToArrayBuffer(blob);
        zip.file(filename, ab);
      }

      const geo = geoSelect && geoSelect.value ? geoSelect.value.trim().toUpperCase() : 'GEO';
      const cur = currencySelect && currencySelect.value ? currencySelect.value.trim().toUpperCase() : 'CUR';
      const zipName = `${txt}_${geo}_${cur}.zip`;

      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
      const a = document.createElement('a');
      a.download = zipName;
      a.href = URL.createObjectURL(zipBlob);
      a.click();
      setTimeout(()=>URL.revokeObjectURL(a.href), 100);

      // Логируем скачивание ZIP архива
      const localization = `${geo}_${cur}`;
      logBannerDownload(localization, files.length, txt);
    } catch (e) {
      console.error(e);
      (window.showAppError || alert)(e.message || 'Неизвестная ошибка', 'Ошибка создания архива');
    } finally {
      // safety cleanup in case some remained
      try {
        document.querySelectorAll('.gallery-item-wrapper .item-spinner-overlay').forEach(el=>el.remove());
      } catch(_) {}
    }
  }

  // Capture-phase listener to override the existing click handler in many-mode
  // ZIP скачивание для множественных изображений
  document.addEventListener('click', function(ev){
    const el = ev.target;
    if (!el) return;
    // find download button by id
    const isDownload = (el.id === 'downloadBtn') || (el.closest && el.closest('#downloadBtn'));
    if (!isDownload) return;
    
    // ZIP скачивание для множественных изображений
    handleManyDownloadZip(ev);
  }, true);
})();


