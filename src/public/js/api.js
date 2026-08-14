'use strict';

// ── API CLIENT ────────────────────────────────────────────────────────────────
(function(App) {

  async function apiFetch(endpoint, options = {}) {
    const headers = {};
    
    if (App.state.token) {
      headers['Authorization'] = `Bearer ${App.state.token}`;
    }

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const config = {
      ...options,
      headers: {
        ...headers,
        ...options.headers
      }
    };

    if (!options.silent) {
      App.toggleLoading(true);
    }

    try {
      const response = await fetch(endpoint, config);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          App.logout();
          throw new Error(data.error || 'Sessie verlopen. Log opnieuw in.');
        }
        throw new Error(data.error || 'Er is iets misgegaan.');
      }

      return data;
    } catch (err) {
      App.showToast(err.message, 'error');
      throw err;
    } finally {
      if (!options.silent) {
        App.toggleLoading(false);
      }
    }
  }

  // Backend caching fetches
  async function fetchTags() {
    try {
      App.state.allTags = await apiFetch('/api/tags');
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchAllRecipesCache() {
    try {
      App.state.allRecipes = await apiFetch('/api/recipes');
    } catch (e) {
      console.error(e);
    }
  }

  App.apiFetch = apiFetch;
  App.fetchTags = fetchTags;
  App.fetchAllRecipesCache = fetchAllRecipesCache;

})(window.App);
