'use strict';

// ── UTILS ─────────────────────────────────────────────────────────────────────
(function(App) {
  function getTodayDateString() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // Convert YYYY-MM-DD to readable Dutch date (e.g., "12 aug")
  function formatDutchDate(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    return `${d} ${months[m - 1]}`;
  }

  // Toast Notifications
  function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    
    // Add icon
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', type === 'success' ? 'check-circle' : 'alert-circle');
    toast.prepend(icon);
    if (window.lucide) {
      lucide.createIcons({ attrs: { class: 'toast-icon-svg' } });
    }

    toast.classList.remove('hidden');
    
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 4000);
  }

  // Loading overlay toggle
  function toggleLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
      overlay.classList.remove('hidden');
    } else {
      overlay.classList.add('hidden');
    }
  }

  function updateHeaderUserDisplay() {
    if (!App.state.user) return;
    const usernameDisplay = document.getElementById('usernameDisplay');
    if (usernameDisplay) usernameDisplay.textContent = App.state.user.username;

    const dropdownUsername = document.getElementById('dropdownUsername');
    if (dropdownUsername) dropdownUsername.textContent = App.state.user.username;

    const dropdownRole = document.getElementById('dropdownRole');
    if (dropdownRole) {
      const isAdmin = (App.state.user.is_admin == 1 || App.state.user.is_admin === true);
      dropdownRole.textContent = isAdmin ? 'Beheerder' : 'Gezinslid';
    }

    const avatarContainer = document.getElementById('headerAvatarContainer');
    if (avatarContainer) {
      if (App.state.user.avatar_path) {
        avatarContainer.innerHTML = `<img src="/uploads/${App.state.user.avatar_path}" alt="${App.escapeHtml(App.state.user.username)}">`;
      } else {
        const initial = App.state.user.username.charAt(0).toUpperCase();
        avatarContainer.textContent = initial;
      }
    }

    // Update More options admin tile visibility
    const isAdmin = (App.state.user.is_admin == 1 || App.state.user.is_admin === true);

    const moreIngredientsManageCard = document.getElementById('moreOptionIngredientsManage');
    if (moreIngredientsManageCard) {
      if (isAdmin) {
        moreIngredientsManageCard.classList.remove('hidden');
      } else {
        moreIngredientsManageCard.classList.add('hidden');
      }
    }
    
    const moreTagsCard = document.getElementById('moreOptionTags');
    if (moreTagsCard) {
      if (isAdmin) {
        moreTagsCard.classList.remove('hidden');
      } else {
        moreTagsCard.classList.add('hidden');
      }
    }

    const moreUsersCard = document.getElementById('moreOptionUsers');
    if (moreUsersCard) {
      if (isAdmin) {
        moreUsersCard.classList.remove('hidden');
      } else {
        moreUsersCard.classList.add('hidden');
      }
    }
  }

  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeQuotes(str) {
    if (!str) return '';
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  // Format scaled quantities nicely (e.g. 2, 1.5, 0.75, 2.33)
  function formatQuantity(num) {
    if (num === null || num === undefined || num === '' || isNaN(num)) return '';
    const val = Number(num);
    if (isNaN(val) || val <= 0) return '';

    // If whole number
    if (Math.abs(val - Math.round(val)) < 0.005) {
      return Math.round(val).toString();
    }

    // Format with at most 2 decimal places and strip trailing zeroes
    return val.toFixed(2).replace(/\.?0+$/, '');
  }

  // Format ingredient and tag names: lowercase everything, then capitalize first letter (e.g. 'pApRiKa' -> 'Paprika')
  function formatItemName(str) {
    if (!str || typeof str !== 'string') return '';
    const trimmed = str.trim();
    if (!trimmed) return '';
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  }

  // Expose on App
  App.getTodayDateString = getTodayDateString;
  App.formatDutchDate = formatDutchDate;
  App.showToast = showToast;
  App.toggleLoading = toggleLoading;
  App.updateHeaderUserDisplay = updateHeaderUserDisplay;
  App.debounce = debounce;
  App.escapeHtml = escapeHtml;
  App.escapeQuotes = escapeQuotes;
  App.formatQuantity = formatQuantity;
  App.formatItemName = formatItemName;

})(window.App);
