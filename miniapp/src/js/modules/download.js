/**
 * Download module
 * Sends selected banners/videos as a single ZIP archive to the Telegram chat
 */

import api from './api.js';
import auth from './auth.js';
import logger from './logger.js';
import wizardState from './wizard-state.js';
import { renderTemplateToBase64 } from './canvas-renderer.js';
import { showArchivePreparingPopup, showArchiveSuccessPopup, showErrorPopup, hidePopup } from './popup.js';

/**
 * Show a toast notification
 */
function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('visible'));

  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Check auth
 */
function requireAuth() {
  if (auth.getInitData()) return true;
  showToast('Please open the app from the Telegram bot button', 'error');
  return false;
}

/**
 * Download selected templates as a ZIP archive sent to Telegram chat
 * Works for both banners and videos — sends everything in one request
 */
export async function downloadSelectedAsZip(templates, promoText) {
  if (!templates.length) return;
  if (!requireAuth()) return;

  const btn = document.getElementById('downloadBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Preparing...';
  }

  // Show preparing popup
  showArchivePreparingPopup();

  try {
    // Render banners to base64 and collect video IDs
    const banners = [];
    const videoItems = [];

    for (const t of templates) {
      const tplType = t.template_type || (t.has_video ? 'video' : 'banner');

      if (tplType === 'video') {
        // For videos, we send metadata — the server will process with FFmpeg
        let videoPath = t.video_url || '';
        if (!videoPath && t.image_url) {
          const previewFilename = t.image_url.split('/').pop();
          const baseName = previewFilename.replace(/\.[^.]+$/, '');
          videoPath = '/uploads/videos/' + baseName + '.mp4';
        }
        videoItems.push({
          image_id: t.image_id,
          video_path: videoPath,
          text_size: t.text_size || 45,
          skew_angle: t.skew_angle || 0,
          text_alignment: t.text_alignment || 'center',
          text_color: t.text_color || '#000000',
          position_x: t.position_x || 0,
          position_y: t.position_y || 0,
          promo_start: t.promo_start || 0,
          promo_end: t.promo_end || 0,
        });
      } else {
        // For banners, render client-side to base64
        try {
          const base64 = await renderTemplateToBase64(t, promoText);
          banners.push({
            image_id: t.image_id,
            template_name: t.template_name || `banner_${t.image_id}`,
            base64: base64,
          });
        } catch (err) {
          logger.error('download', `Failed to render banner ${t.image_id}:`, err);
        }
      }
    }

    logger.log('download', `Sending ZIP request: ${banners.length} banners, ${videoItems.length} videos`);

    // Send to server for ZIP creation and Telegram delivery
    const result = await api.post('/send_zip', {
      banners: banners,
      videos: videoItems,
      promo_text: promoText,
      directions: wizardState.directions,
      language: wizardState.language,
      currency: wizardState.currency,
    });

    hidePopup();

    logger.log('download', 'ZIP sent successfully:', result);

    // Show success popup
    showArchiveSuccessPopup(() => {
      // On close callback — optionally navigate back or do nothing
    });

    hapticSuccess();

  } catch (err) {
    hidePopup();
    logger.error('download', 'ZIP download failed:', err);
    showErrorPopup(err.message || 'Failed to create and send archive');
  }

  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Download';
  }
}

function hapticSuccess() {
  const webapp = window.Telegram?.WebApp;
  if (webapp?.HapticFeedback) {
    webapp.HapticFeedback.notificationOccurred('success');
  }
}
