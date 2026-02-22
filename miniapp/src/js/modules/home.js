/**
 * Home Screen — entry point with 4 action buttons + bottom navigation
 * Per new TZ: Banner, Video, Manager (stub), Voucher (stub)
 * Bottom nav: Support, FAQ, Settings (all stubs)
 */

import router from './router.js';
import wizardState from './wizard-state.js';
import { getBrand } from './brand.js';

export function renderHome(rootEl) {
  const brand = getBrand();

  rootEl.innerHTML = `
    <div class="screen screen-home">
      <div class="home-logo">
        <img class="logo-image" src="${brand.logo}" alt="${brand.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
        <div class="logo-fallback" style="display:none;">
          <span class="logo-text">${brand.name}</span>
          <span class="logo-sub">affiliate</span>
        </div>
      </div>

      <div class="home-menu">
        <button class="home-btn home-btn-banner" id="btnBanner">
          <span class="home-btn-icon">
            <svg viewBox="0 0 24 24" fill="none" width="28" height="28">
              <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" stroke-width="2"/>
              <path d="M8 21L12 17L16 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <div class="home-btn-content">
            <span class="home-btn-label">Get Banner</span>
            <span class="home-btn-desc">Download banners with your promo code</span>
          </div>
          <span class="home-btn-arrow">
            <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
              <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
        </button>

        <button class="home-btn home-btn-video" id="btnVideo">
          <span class="home-btn-icon">
            <svg viewBox="0 0 24 24" fill="none" width="28" height="28">
              <rect x="2" y="6" width="15" height="12" rx="2" stroke="currentColor" stroke-width="2"/>
              <path d="M17 9l5-3v12l-5-3V9z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
            </svg>
          </span>
          <div class="home-btn-content">
            <span class="home-btn-label">Get Video</span>
            <span class="home-btn-desc">Download videos with your promo code</span>
          </div>
          <span class="home-btn-arrow">
            <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
              <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
        </button>

        <button class="home-btn home-btn-manager" id="btnManager">
          <span class="home-btn-icon">
            <svg viewBox="0 0 24 24" fill="none" width="28" height="28">
              <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2"/>
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </span>
          <div class="home-btn-content">
            <span class="home-btn-label">Request Manager</span>
            <span class="home-btn-desc">Work with your personal manager</span>
          </div>
          <span class="home-btn-arrow">
            <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
              <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
        </button>

        <button class="home-btn home-btn-voucher" id="btnVoucher">
          <span class="home-btn-icon">
            <svg viewBox="0 0 24 24" fill="none" width="28" height="28">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="currentColor" stroke-width="2"/>
              <path d="M9 5a2 2 0 012-2h2a2 2 0 012 2v0a2 2 0 01-2 2h-2a2 2 0 01-2-2z" stroke="currentColor" stroke-width="2"/>
              <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <div class="home-btn-content">
            <span class="home-btn-label">Check Voucher</span>
            <span class="home-btn-desc">Check balance and referral activity</span>
          </div>
          <span class="home-btn-arrow">
            <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
              <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
        </button>
      </div>

      <nav class="bottom-nav">
        <button class="bottom-nav-item" id="navSupport">
          <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Support</span>
        </button>
        <button class="bottom-nav-item" id="navFAQ">
          <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="currentColor"/>
          </svg>
          <span>FAQ</span>
        </button>
        <button class="bottom-nav-item" id="navSettings">
          <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" stroke-width="2"/>
          </svg>
          <span>Settings</span>
        </button>
        <button class="bottom-nav-item bottom-nav-admin" id="navAdmin">
          <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
            <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
            <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Admin</span>
        </button>
      </nav>
    </div>
  `;

  // Main action buttons
  rootEl.querySelector('#btnBanner').addEventListener('click', () => {
    wizardState.reset();
    wizardState.mode = 'banner';
    wizardState.save();
    router.navigate('/step/direction');
  });

  rootEl.querySelector('#btnVideo').addEventListener('click', () => {
    wizardState.reset();
    wizardState.mode = 'video';
    wizardState.save();
    router.navigate('/step/direction');
  });

  // Stub buttons
  rootEl.querySelector('#btnManager').addEventListener('click', () => {
    router.navigate('/stub/manager');
  });

  rootEl.querySelector('#btnVoucher').addEventListener('click', () => {
    router.navigate('/stub/voucher');
  });

  // Bottom nav
  rootEl.querySelector('#navSupport').addEventListener('click', () => {
    router.navigate('/stub/support');
  });

  rootEl.querySelector('#navFAQ').addEventListener('click', () => {
    router.navigate('/stub/faq');
  });

  rootEl.querySelector('#navSettings').addEventListener('click', () => {
    router.navigate('/stub/settings');
  });

  rootEl.querySelector('#navAdmin').addEventListener('click', () => {
    router.navigate('/admin');
  });

  // Hide Telegram back button on home
  window.Telegram?.WebApp?.BackButton?.hide();
}
