/**
 * Canvas rendering module
 * Extracted from files/script.js — drawOneVideo() and related functions
 * Renders promo text overlay on template preview images
 */

import logger from './logger.js';

/**
 * Calculate "contain" scaling to fit media into canvas preserving aspect ratio
 * Verbatim from script.js lines 898-912
 */
export function getContainDrawParams(mediaWidth, mediaHeight, canvasWidth, canvasHeight) {
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

/**
 * Calculate font size with dynamic shrinking for long text
 * From script.js lines 785-786
 *
 * @param {number} baseSize - Base font size from template
 * @param {number} textLength - Length of the promo text
 * @returns {number} Adjusted font size
 */
export function calcFontSize(baseSize, textLength) {
  let fontSize = baseSize || 45;
  if (textLength > 6) {
    fontSize = fontSize - 2 * (textLength - 6);
  }
  if (fontSize < 10) fontSize = 10;
  return fontSize;
}

/**
 * Draw promo text on a canvas with template settings
 * Extracted from script.js drawOneVideo() lines 715-805
 *
 * @param {HTMLCanvasElement} canvas - Target canvas
 * @param {HTMLImageElement} image - Loaded preview image
 * @param {Object} template - Template data object
 * @param {string} promoText - Promo code text (already uppercased)
 */
export function drawPromoOnCanvas(canvas, image, template, promoText) {
  const ctx = canvas.getContext('2d');

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw image
  if (image && image.complete && image.naturalWidth > 0) {
    const { dx, dy, drawWidth, drawHeight } = getContainDrawParams(
      image.naturalWidth,
      image.naturalHeight,
      canvas.width,
      canvas.height
    );
    ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
  }

  // If no promo text, just show the image
  if (!promoText) return;

  // Text area dimensions (fixed, from admin)
  const rect = {
    width: 450,
    height: 100,
  };

  // Positioning and scaling
  let centerX = template.position_x || 0;
  let centerY = template.position_y || 0;
  let scale = 1;

  // For 9x16 templates, scale coordinates from original video dimensions to canvas
  if (template.size === '9x16') {
    const videoWidth = 1080;   // Default 9x16 video width
    const videoHeight = 1920;  // Default 9x16 video height

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

  // Skew and rotation
  const angle = parseFloat(template.skew_angle) || 0;
  const radians = angle * Math.PI / 180;
  const skewValue = Math.tan(radians);

  // Draw text
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.transform(1, 0, skewValue, 1, 0, 0);
  ctx.rotate(-radians);

  // Color
  let textColor = template.text_color || '#000000';
  if (textColor && !textColor.startsWith('#')) textColor = '#' + textColor;

  // Font size with dynamic shrinking
  const fontSize = calcFontSize(
    template.text_size ? parseInt(template.text_size, 10) : 45,
    promoText.length
  );

  ctx.font = `900 italic ${fontSize * scale}px Inter`;
  ctx.fillStyle = textColor;
  ctx.textAlign = template.text_alignment || 'center';
  ctx.textBaseline = 'middle';

  // Calculate text X based on alignment
  let textX;
  if (ctx.textAlign === 'left') {
    textX = -rect.width / 2 * scale;
  } else if (ctx.textAlign === 'right') {
    textX = rect.width / 2 * scale;
  } else {
    textX = 0;
  }

  ctx.fillText(promoText, textX, 0);
  ctx.restore();
}

/**
 * Load an image and return a Promise
 * @param {string} src - Image URL
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    logger.log('canvas', 'Loading image:', src);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      logger.log('canvas', 'Image loaded:', src, `${img.naturalWidth}x${img.naturalHeight}`);
      resolve(img);
    };
    img.onerror = (e) => {
      logger.error('canvas', 'Image load failed:', src, e);
      // Retry without crossOrigin (CORS fallback)
      logger.log('canvas', 'Retrying without crossOrigin:', src);
      const img2 = new Image();
      img2.onload = () => {
        logger.log('canvas', 'Image loaded (no CORS):', src);
        resolve(img2);
      };
      img2.onerror = () => {
        logger.error('canvas', 'Image load failed even without CORS:', src);
        reject(new Error(`Failed to load image: ${src}`));
      };
      img2.src = src;
    };
    img.src = src;
  });
}

/**
 * Render a template to an offscreen canvas at full resolution and return as blob
 * @param {Object} template - Template data
 * @param {string} promoText - Promo code text
 * @param {string} format - 'image/jpeg' or 'image/png'
 * @param {number} quality - JPEG quality (0-1)
 * @returns {Promise<Blob>}
 */
export async function renderTemplateToBlob(template, promoText, format = 'image/jpeg', quality = 0.92) {
  const image = await loadImage(template.preview_url || template.image_url);

  // Create offscreen canvas at full resolution
  const canvas = document.createElement('canvas');
  if (template.size === '9x16') {
    canvas.width = 1080;
    canvas.height = 1920;
  } else {
    canvas.width = 1000;
    canvas.height = 1000;
  }

  drawPromoOnCanvas(canvas, image, template, promoText);

  return new Promise((resolve) => {
    canvas.toBlob(resolve, format, quality);
  });
}

/**
 * Render a template to a base64 data URL
 * @param {Object} template - Template data
 * @param {string} promoText - Promo code text
 * @returns {Promise<string>} Base64 data URL
 */
export async function renderTemplateToBase64(template, promoText) {
  const imgSrc = template.preview_url || template.image_url;
  logger.log('canvas', 'renderTemplateToBase64 for template:', template.image_id, 'src:', imgSrc);
  const image = await loadImage(imgSrc);

  const canvas = document.createElement('canvas');
  if (template.size === '9x16') {
    canvas.width = 1080;
    canvas.height = 1920;
  } else {
    canvas.width = 1000;
    canvas.height = 1000;
  }

  drawPromoOnCanvas(canvas, image, template, promoText);

  return canvas.toDataURL('image/jpeg', 0.92);
}
