'use strict';

// ── AUTHENTICATION ────────────────────────────────────────────────────────────
(function(App) {

  async function checkAuth() {
    if (!App.state.token) {
      App.showView('Auth');
      return;
    }
    
    try {
      const data = await App.apiFetch('/api/auth/me');
      App.state.user = data.user;
      App.updateHeaderUserDisplay();
      document.getElementById('appHeader').classList.remove('hidden');
      document.getElementById('appNav').classList.remove('hidden');

      App.state.currentWeekMonday = null; // resets to today's week
      App.showView('Planner');
    } catch (err) {
      console.error('checkAuth error:', err);
      App.logout();
    }
  }

  function logout() {
    App.state.token = null;
    App.state.user = null;
    localStorage.removeItem('token');
    document.getElementById('appHeader').classList.add('hidden');
    document.getElementById('appNav').classList.add('hidden');
    App.showView('Auth');
  }

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
  document.getElementById('headerUserPill')?.addEventListener('click', () => App.showView('Settings'));
  document.getElementById('headerSettingsBtn')?.addEventListener('click', () => App.showView('Settings'));

  App.checkAuth = checkAuth;
  App.logout = logout;

})(window.App);
