/**
 * API helper module — fetch wrapper with auth
 */

import auth from './auth.js';
import logger from './logger.js';
import { getBrandId } from './brand.js';

const API_BASE = '/miniapp/api';

const api = {
  /**
   * GET request
   */
  async get(endpoint, params = {}) {
    const queryString = Object.keys(params).length
      ? '?' + new URLSearchParams(params).toString()
      : '';

    const url = API_BASE + endpoint + queryString;
    logger.log('api', `GET ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Telegram-Init-Data': auth.getInitData(),
      },
    });

    logger.log('api', `GET ${endpoint} → ${response.status}`);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      logger.error('api', `GET ${endpoint} failed: ${response.status}`, text.substring(0, 500));
      throw new Error(`API GET ${endpoint} failed: ${response.status}`);
    }

    return response.json();
  },

  /**
   * POST request with JSON body
   */
  async post(endpoint, body = {}) {
    // Always include initData and brand in the body
    const payload = {
      ...body,
      initData: auth.getInitData(),
      brand: getBrandId(),
    };

    const url = API_BASE + endpoint + '.php';
    logger.log('api', `POST ${url}, body keys: ${Object.keys(body).join(',')}`);

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (fetchErr) {
      logger.error('api', `POST ${endpoint} network error:`, fetchErr);
      throw fetchErr;
    }

    logger.log('api', `POST ${endpoint} → ${response.status}`);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      logger.error('api', `POST ${endpoint} error response:`, text.substring(0, 500));
      // Try to parse as JSON for error message
      let errorMsg = `API POST ${endpoint} failed: ${response.status}`;
      try {
        const errorData = JSON.parse(text);
        if (errorData.error) errorMsg = errorData.error;
      } catch (_) {}
      throw new Error(errorMsg);
    }

    return response.json();
  },
};

export default api;
