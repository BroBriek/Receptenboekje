'use strict';

// ── VIEW ROUTING ──────────────────────────────────────────────────────────────
(function(App) {

  function showView(viewName) {
    // If not logged in, enforce Auth view
    if (!App.state.token) {
      viewName = 'Auth';
    }

    // Role / permission check for admin-only views
    const adminViews = ['IngredientsManage', 'Tags', 'Users'];
    if (adminViews.includes(viewName)) {
      const isAdmin = App.state.user && (App.state.user.is_admin == 1 || App.state.user.is_admin === true);
      if (!isAdmin) {
        if (typeof App.showToast === 'function') {
          App.showToast('Je hebt geen beheerdersrechten voor deze pagina.', 'error');
        }
        viewName = 'More';
      }
    }

    App.state.currentView = viewName;

    // Ensure header and bottom nav visibility match auth & view status
    const appHeader = document.getElementById('appHeader');
    const appNav = document.getElementById('appNav');
    if (!App.state.token || viewName === 'Auth') {
      if (appHeader) appHeader.classList.add('hidden');
      if (appNav) appNav.classList.add('hidden');
    } else {
      if (appHeader) appHeader.classList.remove('hidden');
      if (appNav) appNav.classList.remove('hidden');
    }

    // Hide all views
    document.querySelectorAll('.view-section').forEach(view => view.classList.add('hidden'));
    
    // Show target view
    const targetView = document.getElementById(`view${viewName}`);
    if (targetView) targetView.classList.remove('hidden');

    // Handle active navigation item state
    document.querySelectorAll('.nav-item').forEach(item => {
      const itemTarget = item.getAttribute('data-view');
      // If we're on Settings, IngredientsManage, Tags, Users, Ingredients, or IngredientResults, highlight the 'More' nav item
      if (itemTarget === viewName || (itemTarget === 'More' && ['More', 'Settings', 'IngredientsManage', 'Tags', 'Users', 'Ingredients', 'IngredientResults'].includes(viewName))) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Load view-specific data
    if (App.state.token) {
      if (viewName === 'Planner') {
        App.loadWeekPlanning(App.state.currentWeekMonday);
      } else if (viewName === 'Recipes') {
        App.renderFilterTagChips();
        App.loadRecipes();
      } else if (viewName === 'More') {
        App.updateHeaderUserDisplay();
      } else if (viewName === 'Settings') {
        App.renderSettingsView();
      } else if (viewName === 'Ingredients') {
        App.loadIngredients();
      } else if (viewName === 'IngredientResults') {
        App.loadIngredientResultsView();
      } else if (viewName === 'IngredientsManage') {
        App.loadIngredientsManage();
      } else if (viewName === 'Tags') {
        App.loadTags();
      } else if (viewName === 'Users') {
        App.loadUsers();
      }
    }

    // Update icons
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  // Bottom nav items listeners
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const viewName = item.getAttribute('data-view');
      showView(viewName);
    });
  });

  // More options card navigation
  document.getElementById('moreOptionSettings')?.addEventListener('click', () => showView('Settings'));
  document.getElementById('moreOptionIngredients')?.addEventListener('click', () => showView('Ingredients'));
  document.getElementById('moreOptionIngredientsManage')?.addEventListener('click', () => showView('IngredientsManage'));
  document.getElementById('moreOptionTags')?.addEventListener('click', () => showView('Tags'));
  document.getElementById('moreOptionUsers')?.addEventListener('click', () => showView('Users'));
  document.getElementById('moreOptionLogout')?.addEventListener('click', () => App.logout());

  // Back buttons to More view / Parent view
  document.getElementById('backToMoreFromSettingsBtn')?.addEventListener('click', () => showView('More'));
  document.getElementById('backToMoreFromIngBtn')?.addEventListener('click', () => showView('More'));
  document.getElementById('backToMoreFromIngredientsManageBtn')?.addEventListener('click', () => showView('More'));
  document.getElementById('backToMoreFromTagsBtn')?.addEventListener('click', () => showView('More'));
  document.getElementById('backToMoreFromUsersBtn')?.addEventListener('click', () => showView('More'));
  document.getElementById('backToIngredientsFromResultsBtn')?.addEventListener('click', () => showView('Ingredients'));

  App.showView = showView;

})(window.App);
