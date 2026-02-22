/**
 * Admin Screen — loads admin.php inside an iframe within the mini app
 */

import router from './router.js';

export function renderAdmin(rootEl) {
  const adminUrl = window.location.origin + '/admin.php';

  rootEl.innerHTML = `
    <div class="screen screen-admin">
      <div class="screen-header">
        <button class="btn-back" id="backBtn">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <h1 class="screen-title">Админка</h1>
        <div style="width:40px"></div>
      </div>
      <div class="admin-iframe-container">
        <iframe
          id="adminIframe"
          src="${adminUrl}"
          class="admin-iframe"
          allow="camera; microphone"
        ></iframe>
      </div>
    </div>
  `;

  rootEl.querySelector('#backBtn').addEventListener('click', () => {
    router.navigate('/');
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
