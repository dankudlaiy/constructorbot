/**
 * Popup module — reusable popup/modal component
 * Used for "Preparing archive..." and "Archive sent successfully!" states
 */

let currentPopup = null;

/**
 * Show popup overlay
 * @param {object} opts - { title, message, icon, showSpinner, closeable, onClose }
 */
function showPopup(opts = {}) {
  hidePopup();

  const overlay = document.createElement('div');
  overlay.className = 'popup-overlay';
  overlay.innerHTML = `
    <div class="popup-card">
      ${opts.showSpinner ? `
        <div class="popup-spinner">
          <div class="loading-spinner"></div>
        </div>
      ` : ''}
      ${opts.icon ? `<div class="popup-icon">${opts.icon}</div>` : ''}
      ${opts.title ? `<h3 class="popup-title">${opts.title}</h3>` : ''}
      ${opts.message ? `<p class="popup-message">${opts.message}</p>` : ''}
      ${opts.closeable ? `<button class="popup-close-btn btn-primary">OK</button>` : ''}
    </div>
  `;

  document.body.appendChild(overlay);
  currentPopup = overlay;

  // Animate in
  requestAnimationFrame(() => {
    overlay.classList.add('popup-visible');
  });

  if (opts.closeable) {
    const closeBtn = overlay.querySelector('.popup-close-btn');
    closeBtn.addEventListener('click', () => {
      hidePopup();
      if (opts.onClose) opts.onClose();
    });
  }
}

/**
 * Hide current popup
 */
export function hidePopup() {
  if (currentPopup) {
    currentPopup.classList.remove('popup-visible');
    setTimeout(() => {
      if (currentPopup && currentPopup.parentNode) {
        currentPopup.parentNode.removeChild(currentPopup);
      }
      currentPopup = null;
    }, 300);
  }
}

/**
 * Show "Preparing archive..." popup with spinner
 */
export function showArchivePreparingPopup() {
  showPopup({
    title: 'Preparing Archive',
    message: 'Generating your banners and creating ZIP archive...',
    showSpinner: true,
    closeable: false,
  });
}

/**
 * Show "Archive sent successfully!" popup
 * @param {function} onClose - callback when user clicks OK
 */
export function showArchiveSuccessPopup(onClose) {
  showPopup({
    title: 'Success!',
    message: 'ZIP archive has been sent to your Telegram chat.',
    icon: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="var(--brand-accent, #0F917E)" stroke-width="2"/>
      <path d="M8 12l3 3 5-5" stroke="var(--brand-accent, #0F917E)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    closeable: true,
    onClose,
  });

  // Haptic feedback
  try {
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
  } catch (e) {}
}

/**
 * Show error popup
 * @param {string} message - error message
 * @param {function} onClose - callback
 */
export function showErrorPopup(message, onClose) {
  showPopup({
    title: 'Error',
    message: message || 'Something went wrong. Please try again.',
    icon: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="#e74c3c" stroke-width="2"/>
      <path d="M15 9l-6 6M9 9l6 6" stroke="#e74c3c" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
    closeable: true,
    onClose,
  });
}
