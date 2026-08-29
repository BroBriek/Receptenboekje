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

  // Detect timer duration in text (returns seconds or null)
  function detectTimerInText(text) {
    if (!text || typeof text !== 'string') return null;
    const minMatch = text.match(/(?:(\d+)\s*(?:-|tot|à)\s*)?(\d+(?:[.,]\d+)?)\s*(?:minuten|minuut|min\b|mins\b)/i);
    if (minMatch) {
      const minutes = parseFloat(minMatch[2].replace(',', '.'));
      if (!isNaN(minutes) && minutes > 0) return Math.round(minutes * 60);
    }
    const secMatch = text.match(/(?:(\d+)\s*(?:-|tot|à)\s*)?(\d+)\s*(?:seconden|seconde|sec\b)/i);
    if (secMatch) {
      const seconds = parseInt(secMatch[2], 10);
      if (!isNaN(seconds) && seconds > 0) return seconds;
    }
    const hrMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:uur|uren|hour|hours)/i);
    if (hrMatch) {
      const hours = parseFloat(hrMatch[1].replace(',', '.'));
      if (!isNaN(hours) && hours > 0) return Math.round(hours * 3600);
    }
    return null;
  }

  // Format seconds to mm:ss (or hh:mm:ss if >= 1hr)
  function formatTimerDisplay(totalSeconds) {
    if (totalSeconds === null || totalSeconds === undefined || isNaN(totalSeconds)) return '00:00';
    const s = Math.max(0, Math.round(totalSeconds));
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = s % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  // Format seconds to human friendly badge (e.g. "10 min", "1m 30s", "45 sec")
  function formatTimerBadgeText(totalSeconds) {
    if (!totalSeconds || isNaN(totalSeconds) || totalSeconds <= 0) return '';
    const s = Math.round(totalSeconds);
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = s % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours} uur`);
    if (minutes > 0) parts.push(`${minutes} min`);
    if (seconds > 0 && hours === 0) parts.push(`${seconds} sec`);
    return parts.join(' ') || `${s} sec`;
  }

  // Synthesize a pleasant kitchen bell / chime using Web Audio API
  let audioCtx = null;
  function playTimerChime() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!audioCtx) audioCtx = new AudioContext();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (cheerful major chord chime)
      const now = audioCtx.currentTime;

      notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.14);

        gain.gain.setValueAtTime(0.001, now + i * 0.14);
        gain.gain.exponentialRampToValueAtTime(0.28, now + i * 0.14 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.14 + 0.8);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now + i * 0.14);
        osc.stop(now + i * 0.14 + 0.85);
      });

      // Repeat second chime wave 1.2 seconds later
      setTimeout(() => {
        if (!audioCtx) return;
        const now2 = audioCtx.currentTime;
        notes.forEach((freq, i) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now2 + i * 0.14);

          gain.gain.setValueAtTime(0.001, now2 + i * 0.14);
          gain.gain.exponentialRampToValueAtTime(0.25, now2 + i * 0.14 + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.0001, now2 + i * 0.14 + 0.8);

          osc.connect(gain);
          gain.connect(audioCtx.destination);

          osc.start(now2 + i * 0.14);
          osc.stop(now2 + i * 0.14 + 0.85);
        });
      }, 1100);

      // Trigger device vibration if available
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 400]);
      }
    } catch (e) {
      console.warn('Audio chime failed:', e);
    }
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
  App.detectTimerInText = detectTimerInText;
  App.formatTimerDisplay = formatTimerDisplay;
  App.formatTimerBadgeText = formatTimerBadgeText;
  App.playTimerChime = playTimerChime;

})(window.App);
