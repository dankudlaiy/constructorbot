/**
 * Debug logger for Telegram Mini App
 * Collects logs in memory and can display them in an on-screen panel
 * (useful since there's no DevTools in Telegram WebApp)
 */

const MAX_LOGS = 200;

const logger = {
  logs: [],
  panelEl: null,
  visible: false,

  log(tag, ...args) {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    const entry = { time: new Date().toLocaleTimeString(), tag, msg, level: 'log' };
    this.logs.push(entry);
    if (this.logs.length > MAX_LOGS) this.logs.shift();
    console.log(`[${tag}]`, ...args);
    this._updatePanel();
  },

  error(tag, ...args) {
    const msg = args.map(a => {
      if (a instanceof Error) return `${a.message}\n${a.stack || ''}`;
      if (typeof a === 'object') return JSON.stringify(a);
      return String(a);
    }).join(' ');
    const entry = { time: new Date().toLocaleTimeString(), tag, msg, level: 'error' };
    this.logs.push(entry);
    if (this.logs.length > MAX_LOGS) this.logs.shift();
    console.error(`[${tag}]`, ...args);
    this._updatePanel();
  },

  toggle() {
    this.visible = !this.visible;
    if (this.visible) {
      this._createPanel();
      this.panelEl.style.display = 'flex';
    } else if (this.panelEl) {
      this.panelEl.style.display = 'none';
    }
  },

  _createPanel() {
    if (this.panelEl) return;

    this.panelEl = document.createElement('div');
    this.panelEl.id = 'debugPanel';
    this.panelEl.className = 'debug-panel';
    this.panelEl.innerHTML = `
      <div class="debug-header">
        <span>Debug Logs</span>
        <div>
          <button class="debug-clear-btn" id="debugClearBtn">Clear</button>
          <button class="debug-close-btn" id="debugCloseBtn">X</button>
        </div>
      </div>
      <div class="debug-content" id="debugContent"></div>
    `;
    document.body.appendChild(this.panelEl);

    this.panelEl.querySelector('#debugCloseBtn').addEventListener('click', () => this.toggle());
    this.panelEl.querySelector('#debugClearBtn').addEventListener('click', () => {
      this.logs = [];
      this._updatePanel();
    });

    this._updatePanel();
  },

  _updatePanel() {
    if (!this.panelEl || !this.visible) return;
    const content = this.panelEl.querySelector('#debugContent');
    if (!content) return;

    content.innerHTML = this.logs.map(e => {
      const cls = e.level === 'error' ? 'debug-error' : '';
      return `<div class="debug-line ${cls}"><span class="debug-time">${e.time}</span> <span class="debug-tag">[${e.tag}]</span> ${this._escapeHtml(e.msg)}</div>`;
    }).join('');

    content.scrollTop = content.scrollHeight;
  },

  _escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },
};

export default logger;
