// ── AUTHENTICATION & MULTI-TIER SESSION STORAGE ─────────────────────────────
(function(App) {

  // IndexedDB helpers for extra persistence in iOS standalone webapps
  const DB_NAME = 'receptenboekje_auth_db';
  const STORE_NAME = 'auth_tokens';

  function openAuthDB() {
    return new Promise((resolve) => {
      if (!window.indexedDB) return resolve(null);
      try {
        const request = window.indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async function idbGet(key) {
    try {
      const db = await openAuthDB();
      if (!db) return null;
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
    } catch {
      return null;
    }
  }

  async function idbSet(key, value) {
    try {
      const db = await openAuthDB();
      if (!db) return;
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.put(value, key);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch {
          resolve(false);
        }
      });
    } catch {
      // Ignore IDB errors
    }
  }

  async function idbDelete(key) {
    try {
      const db = await openAuthDB();
      if (!db) return;
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.delete(key);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch {
          resolve(false);
        }
      });
    } catch {
      // Ignore IDB errors
    }
  }

  // Multi-tier storage layer: LocalStorage + SessionStorage + IndexedDB
  const AuthStorage = {
    async getToken() {
      // 1. In-memory state
      if (App.state.token) return App.state.token;

      // 2. LocalStorage (persistent)
      try {
        const local = localStorage.getItem('token');
        if (local) return local;
      } catch {}

      // 3. SessionStorage (session-only)
      try {
        const session = sessionStorage.getItem('token');
        if (session) return session;
      } catch {}

      // 4. IndexedDB backup (resilient against iOS WebKit localStorage eviction)
      try {
        const idbToken = await idbGet('token');
        if (idbToken) {
          try {
            if (localStorage.getItem('stay_logged_in') === 'true') {
              localStorage.setItem('token', idbToken);
            }
          } catch {}
          return idbToken;
        }
      } catch {}

      return null;
    },

    async setToken(token, stayLoggedIn = true) {
      App.state.token = token;

      if (stayLoggedIn) {
        try {
          localStorage.setItem('token', token);
          localStorage.setItem('stay_logged_in', 'true');
        } catch {}
        try {
          sessionStorage.removeItem('token');
        } catch {}
        await idbSet('token', token);
        await idbSet('stay_logged_in', true);

        // Request persistent storage in modern browsers / iOS WebKit
        if (navigator.storage && navigator.storage.persist) {
          try {
            await navigator.storage.persist();
          } catch {}
        }
      } else {
        try {
          sessionStorage.setItem('token', token);
        } catch {}
        try {
          localStorage.removeItem('token');
          localStorage.removeItem('stay_logged_in');
        } catch {}
        await idbDelete('token');
        await idbDelete('stay_logged_in');
      }
    },

    async clearToken() {
      App.state.token = null;
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('stay_logged_in');
      } catch {}
      try {
        sessionStorage.removeItem('token');
      } catch {}
      await idbDelete('token');
      await idbDelete('stay_logged_in');
    },

    isStayLoggedInPreferred() {
      try {
        const val = localStorage.getItem('login_stay_logged_in');
        if (val !== null) return val === 'true';
      } catch {}
      return true; // Default to true (checked) for smooth mobile webapp experience
    },

    setStayLoggedInPreference(val) {
      try {
        localStorage.setItem('login_stay_logged_in', val ? 'true' : 'false');
      } catch {}
    }
  };

  async function checkAuth() {
    // 1. Recover token from multi-tier client storage if available
    const storedToken = await AuthStorage.getToken();
    if (storedToken) {
      App.state.token = storedToken;
    }

    try {
      // 2. Query /api/auth/me (silent: true).
      // Even if client storage was cleared on iOS, the HTTP-only cookie will validate the session!
      const data = await App.apiFetch('/api/auth/me', { silent: true });
      App.state.user = data.user;

      // If token refreshed or confirmed by server, update local storage
      if (data.token) {
        const stayLoggedIn = data.stay_logged_in !== undefined 
          ? Boolean(data.stay_logged_in) 
          : (localStorage.getItem('stay_logged_in') === 'true');
        await AuthStorage.setToken(data.token, stayLoggedIn);
      }

      App.updateHeaderUserDisplay();
      document.getElementById('appHeader')?.classList.remove('hidden');
      document.getElementById('appNav')?.classList.remove('hidden');

      App.state.currentWeekMonday = null; // resets to today's week
      App.showView('Planner');
    } catch (err) {
      // Not authenticated or session expired
      await AuthStorage.clearToken();
      App.state.token = null;
      App.state.user = null;
      document.getElementById('appHeader')?.classList.add('hidden');
      document.getElementById('appNav')?.classList.add('hidden');
      App.showView('Auth');
    }
  }

  async function logout() {
    closeUserDropdown();
    try {
      await App.apiFetch('/api/auth/logout', { method: 'POST', silent: true });
    } catch (e) {
      // Ignore network errors during logout
    }
    await AuthStorage.clearToken();
    App.state.token = null;
    App.state.user = null;
    document.getElementById('appHeader')?.classList.add('hidden');
    document.getElementById('appNav')?.classList.add('hidden');
    App.showView('Auth');
  }

  // User Dropdown Menu Management
  const headerUserPill = document.getElementById('headerUserPill');
  const headerUserDropdown = document.getElementById('headerUserDropdown');

  function toggleUserDropdown(forceOpen) {
    if (!headerUserDropdown) return;
    const isCurrentlyOpen = !headerUserDropdown.classList.contains('hidden');
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !isCurrentlyOpen;
    
    if (shouldOpen) {
      headerUserDropdown.classList.remove('hidden');
      headerUserPill?.setAttribute('aria-expanded', 'true');
    } else {
      headerUserDropdown.classList.add('hidden');
      headerUserPill?.setAttribute('aria-expanded', 'false');
    }
  }

  function closeUserDropdown() {
    toggleUserDropdown(false);
  }

  headerUserPill?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleUserDropdown();
  });

  headerUserPill?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleUserDropdown();
    }
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (headerUserDropdown && !headerUserDropdown.contains(e.target) && !headerUserPill?.contains(e.target)) {
      closeUserDropdown();
    }
  });

  // Close dropdown on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeUserDropdown();
    }
  });

  // Dropdown menu items
  document.getElementById('headerMenuDashboardBtn')?.addEventListener('click', () => {
    closeUserDropdown();
    App.showView('Planner');
  });

  document.getElementById('headerMenuSettingsBtn')?.addEventListener('click', () => {
    closeUserDropdown();
    App.showView('Settings');
  });

  document.getElementById('headerMenuLogoutBtn')?.addEventListener('click', () => {
    closeUserDropdown();
    logout();
  });

  // Initialize Stay Logged In Checkbox state
  const stayLoggedInCheckbox = document.getElementById('loginStayLoggedIn');
  if (stayLoggedInCheckbox) {
    stayLoggedInCheckbox.checked = AuthStorage.isStayLoggedInPreferred();
    stayLoggedInCheckbox.addEventListener('change', () => {
      AuthStorage.setStayLoggedInPreference(stayLoggedInCheckbox.checked);
    });
  }

  // Handle login submission
  document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = e.target.username.value;
    const password = e.target.password.value;
    const stayLoggedIn = e.target.stay_logged_in ? Boolean(e.target.stay_logged_in.checked) : true;

    AuthStorage.setStayLoggedInPreference(stayLoggedIn);

    try {
      const data = await App.apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ 
          username, 
          password,
          stay_logged_in: stayLoggedIn
        })
      });
      
      await AuthStorage.setToken(data.token, stayLoggedIn);
      App.state.user = data.user;
      App.showToast('Inloggen geslaagd!', 'success');
      e.target.reset();

      // Restore checkbox state after form reset
      if (stayLoggedInCheckbox) {
        stayLoggedInCheckbox.checked = stayLoggedIn;
      }

      await checkAuth();
    } catch (err) {
      // Handled in apiFetch
    }
  });

  document.getElementById('logoutBtn')?.addEventListener('click', logout);
  document.getElementById('headerLogoBtn')?.addEventListener('click', () => App.showView('Planner'));
  document.getElementById('headerSettingsBtn')?.addEventListener('click', () => App.showView('Settings'));

  App.AuthStorage = AuthStorage;
  App.checkAuth = checkAuth;
  App.logout = logout;
  App.closeUserDropdown = closeUserDropdown;

})(window.App);
