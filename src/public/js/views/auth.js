'use strict';

// ── AUTHENTICATION ────────────────────────────────────────────────────────────
(function(App) {

  async function checkAuth() {
    if (!App.state.token) {
      document.getElementById('appHeader')?.classList.add('hidden');
      document.getElementById('appNav')?.classList.add('hidden');
      App.showView('Auth');
      return;
    }
    
    try {
      const data = await App.apiFetch('/api/auth/me');
      App.state.user = data.user;
      App.updateHeaderUserDisplay();
      document.getElementById('appHeader')?.classList.remove('hidden');
      document.getElementById('appNav')?.classList.remove('hidden');

      App.state.currentWeekMonday = null; // resets to today's week
      App.showView('Planner');
    } catch (err) {
      console.error('checkAuth error:', err);
      App.logout();
    }
  }

  function logout() {
    closeUserDropdown();
    App.state.token = null;
    App.state.user = null;
    localStorage.removeItem('token');
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

  // Handle login submission
  document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = e.target.username.value;
    const password = e.target.password.value;

    try {
      const data = await App.apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      
      App.state.token = data.token;
      App.state.user = data.user;
      localStorage.setItem('token', data.token);
      App.showToast('Inloggen geslaagd!', 'success');
      e.target.reset();
      await checkAuth();
    } catch (err) {
      // Handled in apiFetch
    }
  });

  document.getElementById('logoutBtn')?.addEventListener('click', logout);
  document.getElementById('headerLogoBtn')?.addEventListener('click', () => App.showView('Planner'));
  document.getElementById('headerSettingsBtn')?.addEventListener('click', () => App.showView('Settings'));

  App.checkAuth = checkAuth;
  App.logout = logout;
  App.closeUserDropdown = closeUserDropdown;

})(window.App);
