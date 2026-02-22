/**
 * Simple hash-based SPA router
 */

const router = {
  routes: {},
  currentRoute: null,
  rootEl: null,

  /**
   * Initialize router
   * @param {HTMLElement} rootEl - The root element to render into (#app)
   */
  init(rootEl) {
    this.rootEl = rootEl;

    window.addEventListener('hashchange', () => this.handleRoute());

    // Handle initial route
    this.handleRoute();
  },

  /**
   * Register a route handler
   * @param {string} path - Route path (e.g., '/', '/gallery')
   * @param {Function} handler - Function that returns HTML string or renders into rootEl
   */
  on(path, handler) {
    this.routes[path] = handler;
  },

  /**
   * Navigate to a route
   * @param {string} path - Route path
   * @param {Object} params - Optional params to pass
   */
  navigate(path, params = {}) {
    const paramStr = Object.keys(params).length
      ? '?' + new URLSearchParams(params).toString()
      : '';
    window.location.hash = '#' + path + paramStr;
  },

  /**
   * Handle current hash route
   */
  handleRoute() {
    const hash = window.location.hash.slice(1) || '/';
    const [path, queryString] = hash.split('?');
    const params = queryString ? Object.fromEntries(new URLSearchParams(queryString)) : {};

    // Try exact match first
    if (this.routes[path]) {
      this.currentRoute = path;
      this.routes[path](this.rootEl, params);
      return;
    }

    // Try pattern matching (e.g., /preview/:id)
    for (const routePath of Object.keys(this.routes)) {
      if (routePath.includes(':')) {
        const pattern = routePath.replace(/:([^/]+)/g, '([^/]+)');
        const regex = new RegExp('^' + pattern + '$');
        const match = path.match(regex);
        if (match) {
          const paramNames = (routePath.match(/:([^/]+)/g) || []).map(p => p.slice(1));
          const routeParams = { ...params };
          paramNames.forEach((name, i) => {
            routeParams[name] = match[i + 1];
          });
          this.currentRoute = routePath;
          this.routes[routePath](this.rootEl, routeParams);
          return;
        }
      }
    }

    // Default: go to home
    if (this.routes['/']) {
      this.currentRoute = '/';
      this.routes['/'](this.rootEl, params);
    }
  },

  /**
   * Go back in history
   */
  back() {
    window.history.back();
  },
};

export default router;
