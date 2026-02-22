/**
 * Admin Screen — embedded admin panel inside the Telegram Mini App.
 * Shows a login form if not authenticated, then lists templates
 * with the ability to toggle client access and delete templates.
 */

import router from './router.js';
import logger from './logger.js';

const ADMIN_API = '/miniapp/api/admin_auth.php';
const TEMPLATES_API = '/miniapp/api/admin_templates.php';

// ─────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────
export async function renderAdminScreen(rootEl) {
  renderLoading(rootEl);

  try {
    const res = await fetch(ADMIN_API + '?action=check');
    const data = await res.json();

    if (data.logged_in) {
      await renderTemplateList(rootEl);
    } else {
      renderLoginForm(rootEl);
    }
  } catch (err) {
    logger.error('admin', 'Auth check failed', err);
    renderLoginForm(rootEl);
  }

  // Telegram back button → go home
  if (window.Telegram?.WebApp?.BackButton) {
    window.Telegram.WebApp.BackButton.show();
    window.Telegram.WebApp.BackButton.onClick(() => router.navigate('/'));
  }
}

// ─────────────────────────────────────────────
// Loading spinner
// ─────────────────────────────────────────────
function renderLoading(rootEl) {
  rootEl.innerHTML = `
    <div class="screen admin-screen">
      <div class="admin-topbar">
        <button class="admin-back-btn" id="adminBack">
          <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <span class="admin-topbar-title">Admin Panel</span>
      </div>
      <div class="loading-screen"><div class="loading-spinner"></div></div>
    </div>
  `;
  rootEl.querySelector('#adminBack')?.addEventListener('click', () => router.navigate('/'));
}

// ─────────────────────────────────────────────
// Login Form
// ─────────────────────────────────────────────
function renderLoginForm(rootEl, errorMsg = '') {
  rootEl.innerHTML = `
    <div class="screen admin-screen">
      <div class="admin-topbar">
        <button class="admin-back-btn" id="adminBack">
          <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <span class="admin-topbar-title">Admin Panel</span>
      </div>

      <div class="admin-login-wrap">
        <div class="admin-login-card">
          <div class="admin-login-icon">
            <svg viewBox="0 0 24 24" fill="none" width="40" height="40">
              <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z"
                stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
              <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.5"
                stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h2 class="admin-login-title">Вход</h2>
          ${errorMsg ? `<div class="admin-login-error">${errorMsg}</div>` : ''}
          <div class="admin-form-group">
            <label>Логин</label>
            <input type="text" id="adminUsername" autocomplete="username" placeholder="admin">
          </div>
          <div class="admin-form-group">
            <label>Пароль</label>
            <input type="password" id="adminPassword" autocomplete="current-password" placeholder="••••••">
          </div>
          <button class="admin-login-btn" id="adminLoginBtn">Войти</button>
        </div>
      </div>
    </div>
  `;

  rootEl.querySelector('#adminBack')?.addEventListener('click', () => router.navigate('/'));

  const loginBtn = rootEl.querySelector('#adminLoginBtn');
  const usernameInput = rootEl.querySelector('#adminUsername');
  const passwordInput = rootEl.querySelector('#adminPassword');

  async function doLogin() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    if (!username || !password) return;

    loginBtn.disabled = true;
    loginBtn.textContent = 'Вхожу...';

    try {
      const res = await fetch(ADMIN_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', username, password }),
      });
      const data = await res.json();

      if (data.ok) {
        await renderTemplateList(rootEl);
      } else {
        renderLoginForm(rootEl, data.error || 'Неверный логин или пароль');
      }
    } catch (err) {
      renderLoginForm(rootEl, 'Ошибка сети. Попробуй ещё раз.');
    }
  }

  loginBtn.addEventListener('click', doLogin);
  passwordInput.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  usernameInput.addEventListener('keydown', e => { if (e.key === 'Enter') passwordInput.focus(); });
}

// ─────────────────────────────────────────────
// Template List
// ─────────────────────────────────────────────
async function renderTemplateList(rootEl) {
  rootEl.innerHTML = `
    <div class="screen admin-screen">
      <div class="admin-topbar">
        <button class="admin-back-btn" id="adminBack">
          <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <span class="admin-topbar-title">Admin Panel</span>
        <button class="admin-logout-btn" id="adminLogout">Выйти</button>
      </div>

      <div class="admin-list-wrap">
        <div class="admin-list-header">
          <h2>Шаблоны</h2>
          <a href="/admin.php" class="admin-open-full-btn" id="adminOpenFull">
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M15 3h6v6M10 14L21 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Полная версия
          </a>
        </div>
        <div id="adminTemplateList" class="admin-tpl-list">
          <div class="loading-screen"><div class="loading-spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  rootEl.querySelector('#adminBack')?.addEventListener('click', () => router.navigate('/'));

  rootEl.querySelector('#adminLogout')?.addEventListener('click', async () => {
    try {
      await fetch(ADMIN_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      });
    } catch (_) {}
    renderLoginForm(rootEl);
  });

  rootEl.querySelector('#adminOpenFull')?.addEventListener('click', (e) => {
    e.preventDefault();
    const url = window.location.origin + '/admin.php';
    if (window.Telegram?.WebApp?.openLink) {
      window.Telegram.WebApp.openLink(url);
    } else {
      window.open(url, '_blank');
    }
  });

  // Load templates
  try {
    const res = await fetch(TEMPLATES_API + '?action=list');
    if (res.status === 401) {
      renderLoginForm(rootEl);
      return;
    }
    const data = await res.json();
    renderTemplates(rootEl, data.templates || []);
  } catch (err) {
    logger.error('admin', 'Failed to load templates', err);
    const listEl = rootEl.querySelector('#adminTemplateList');
    if (listEl) listEl.innerHTML = '<div class="admin-error">Ошибка загрузки</div>';
  }
}

// ─────────────────────────────────────────────
// Render templates list
// ─────────────────────────────────────────────
function renderTemplates(rootEl, templates) {
  const listEl = rootEl.querySelector('#adminTemplateList');
  if (!listEl) return;

  if (!templates.length) {
    listEl.innerHTML = '<div class="admin-empty">Нет шаблонов</div>';
    return;
  }

  listEl.innerHTML = templates.map(tpl => `
    <div class="admin-tpl-card ${tpl.client_access ? 'admin-tpl-active' : ''}" data-id="${tpl.id}">
      <div class="admin-tpl-info">
        <div class="admin-tpl-name">${escHtml(tpl.template_name)}</div>
        <div class="admin-tpl-meta">
          ${tpl.template_type === 'banner' ? '🖼' : '🎬'}
          ${tpl.image_count} файл${declension(tpl.image_count, ['', 'а', 'ов'])}
          ${tpl.directions_list?.length ? ' · ' + tpl.directions_list.join(', ') : ''}
          ${tpl.geo_list?.length ? ' · ' + tpl.geo_list.slice(0, 3).join(', ') + (tpl.geo_list.length > 3 ? '…' : '') : ''}
        </div>
      </div>
      <div class="admin-tpl-actions">
        <button class="admin-tpl-toggle ${tpl.client_access ? 'admin-tpl-toggle-on' : ''}"
                data-id="${tpl.id}" data-access="${tpl.client_access ? '1' : '0'}"
                title="${tpl.client_access ? 'Снять с клиента' : 'Залить на клиент'}">
          ${tpl.client_access
            ? `<svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>`
            : `<svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`
          }
        </button>
        <button class="admin-tpl-delete" data-id="${tpl.id}" title="Удалить">
          <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"
              stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');

  // Toggle client access
  listEl.querySelectorAll('.admin-tpl-toggle').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      btn.disabled = true;
      try {
        const res = await fetch(TEMPLATES_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'toggle_access', id }),
        });
        const data = await res.json();
        if (data.ok) {
          const card = listEl.querySelector(`.admin-tpl-card[data-id="${id}"]`);
          if (card) {
            card.classList.toggle('admin-tpl-active', data.client_access);
            btn.dataset.access = data.client_access ? '1' : '0';
            btn.classList.toggle('admin-tpl-toggle-on', data.client_access);
            btn.innerHTML = data.client_access
              ? `<svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>`
              : `<svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
          }
        }
      } catch (err) {
        logger.error('admin', 'Toggle failed', err);
      } finally {
        btn.disabled = false;
      }
    });
  });

  // Delete template
  listEl.querySelectorAll('.admin-tpl-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      const card = listEl.querySelector(`.admin-tpl-card[data-id="${id}"]`);
      const name = card?.querySelector('.admin-tpl-name')?.textContent || `#${id}`;

      if (!confirm(`Удалить шаблон «${name}»?`)) return;

      btn.disabled = true;
      try {
        const res = await fetch(TEMPLATES_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', id }),
        });
        const data = await res.json();
        if (data.ok && card) {
          card.style.transition = 'opacity 0.3s, transform 0.3s';
          card.style.opacity = '0';
          card.style.transform = 'translateX(40px)';
          setTimeout(() => card.remove(), 300);
        }
      } catch (err) {
        logger.error('admin', 'Delete failed', err);
        btn.disabled = false;
      }
    });
  });
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function declension(n, forms) {
  const absN = Math.abs(n);
  const mod10 = absN % 10;
  const mod100 = absN % 100;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}
