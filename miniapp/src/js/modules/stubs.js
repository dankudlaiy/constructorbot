/**
 * Stub screens for features not yet implemented
 * Manager, Voucher, Support, FAQ, Settings
 */

import router from './router.js';
import { getBrand } from './brand.js';

function renderStubScreen(rootEl, title, icon, description) {
  rootEl.innerHTML = `
    <div class="screen stub-screen">
      <div class="step-header">
        <button class="btn-back" id="stubBack">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <h1 class="step-title">${title}</h1>
        <div style="width:40px"></div>
      </div>

      <div class="stub-body">
        <div class="stub-icon">${icon}</div>
        <h2 class="stub-title">${title}</h2>
        <p class="stub-description">${description}</p>
        <div class="stub-badge">Coming soon</div>
      </div>
    </div>
  `;

  rootEl.querySelector('#stubBack').addEventListener('click', () => {
    router.navigate('/');
  });

  const webapp = window.Telegram?.WebApp;
  if (webapp) {
    webapp.BackButton.show();
    webapp.BackButton.onClick(() => {
      webapp.BackButton.hide();
      router.navigate('/');
    });
  }
}

export function renderStubManager(rootEl) {
  renderStubScreen(rootEl, 'Request Manager',
    '<svg width="48" height="48" viewBox="0 0 24 24" fill="none"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="2"/></svg>',
    'Contact your personal manager for partnership details and custom offers.'
  );
}

export function renderStubVoucher(rootEl) {
  renderStubScreen(rootEl, 'Check Voucher',
    '<svg width="48" height="48" viewBox="0 0 24 24" fill="none"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="currentColor" stroke-width="2"/><path d="M9 5a2 2 0 012-2h2a2 2 0 012 2v0a2 2 0 01-2 2h-2a2 2 0 01-2-2z" stroke="currentColor" stroke-width="2"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    'Check your voucher balance and track referral activity.'
  );
}

export function renderStubSupport(rootEl) {
  renderStubScreen(rootEl, 'Support',
    '<svg width="48" height="48" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    'Get help from our support team.'
  );
}

export function renderStubFAQ(rootEl) {
  renderStubScreen(rootEl, 'FAQ',
    '<svg width="48" height="48" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="currentColor"/></svg>',
    'Frequently asked questions about the affiliate program.'
  );
}

export function renderStubSettings(rootEl) {
  renderStubScreen(rootEl, 'Settings',
    '<svg width="48" height="48" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" stroke-width="2"/></svg>',
    'Configure app language and preferences.'
  );
}
