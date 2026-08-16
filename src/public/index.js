'use strict';

// ── STATE MANAGEMENT ──────────────────────────────────────────────────────────
const state = {
  token: localStorage.getItem('token') || null,
  user: null,
  currentWeekMonday: null, // YYYY-MM-DD
  currentMealPlan: null,   // Holds the latest 7-day plan array
  allRecipes: [],
  allTags: [],
  
  // Recipe form state
  recipeFormIngredients: [],
  recipeFormSteps: [],
  recipeFormSelectedTagIds: new Set(),
  currentEditingRecipeId: null,
  
  // Day edit state
  currentEditDayRecipeId: null,
  
  // UI states
  currentView: 'Planner',
  lockedDates: new Set() // dates (YYYY-MM-DD) locked in the current planner
};

// ── UTILS ─────────────────────────────────────────────────────────────────────
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
  if (!state.user) return;
  const usernameDisplay = document.getElementById('usernameDisplay');
  if (usernameDisplay) usernameDisplay.textContent = state.user.username;

  const avatarContainer = document.getElementById('headerAvatarContainer');
  if (avatarContainer) {
    if (state.user.avatar_path) {
      avatarContainer.innerHTML = `<img src="/uploads/${state.user.avatar_path}" alt="${escapeHtml(state.user.username)}">`;
    } else {
      const initial = state.user.username.charAt(0).toUpperCase();
      avatarContainer.textContent = initial;
    }
  }

  // Update More options admin tile visibility
  const moreUsersCard = document.getElementById('moreOptionUsers');
  if (moreUsersCard) {
    if (state.user.is_admin == 1 || state.user.is_admin === true) {
      moreUsersCard.classList.remove('hidden');
    } else {
      moreUsersCard.classList.add('hidden');
    }
  }
}

// ── API CLIENT ────────────────────────────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  const headers = {};
  
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
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

  toggleLoading(true);

  try {
    const response = await fetch(endpoint, config);
    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        logout();
        throw new Error(data.error || 'Sessie verlopen. Log opnieuw in.');
      }
      throw new Error(data.error || 'Er is iets misgegaan.');
    }

    return data;
  } catch (err) {
    showToast(err.message, 'error');
    throw err;
  } finally {
    toggleLoading(false);
  }
}

// ── AUTHENTICATION ────────────────────────────────────────────────────────────
async function checkAuth() {
  if (!state.token) {
    showView('Auth');
    return;
  }
  
  try {
    const data = await apiFetch('/api/auth/me');
    state.user = data.user;
    updateHeaderUserDisplay();
    document.getElementById('appHeader').classList.remove('hidden');
    document.getElementById('appNav').classList.remove('hidden');

    state.currentWeekMonday = null; // resets to today's week
    showView('Planner');
  } catch (err) {
    console.error('checkAuth error:', err);
    logout();
  }
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('token');
  document.getElementById('appHeader').classList.add('hidden');
  document.getElementById('appNav').classList.add('hidden');
  showView('Auth');
}

// Handle login submission
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = e.target.username.value;
  const password = e.target.password.value;

  try {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('token', data.token);
    showToast('Inloggen geslaagd!', 'success');
    e.target.reset();
    await checkAuth();
  } catch (err) {
    // Handled in apiFetch
  }
});

document.getElementById('logoutBtn')?.addEventListener('click', logout);
document.getElementById('headerLogoBtn')?.addEventListener('click', () => showView('Planner'));
document.getElementById('headerUserPill')?.addEventListener('click', () => showView('Settings'));
document.getElementById('headerSettingsBtn')?.addEventListener('click', () => showView('Settings'));

// ── VIEW ROUTING ──────────────────────────────────────────────────────────────
function showView(viewName) {
  state.currentView = viewName;
  // Hide all views
  document.querySelectorAll('.view-section').forEach(view => view.classList.add('hidden'));
  
  // Show target view
  const targetView = document.getElementById(`view${viewName}`);
  if (targetView) targetView.classList.remove('hidden');

  // Handle active navigation item state
  document.querySelectorAll('.nav-item').forEach(item => {
    const itemTarget = item.getAttribute('data-view');
    // If we're on Settings, or Users, highlight the 'More' nav item
    if (itemTarget === viewName || (itemTarget === 'More' && ['More', 'Settings', 'Users'].includes(viewName))) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Load view-specific data
  if (state.token) {
    if (viewName === 'Planner') {
      loadWeekPlanning(state.currentWeekMonday);
    } else if (viewName === 'Recipes') {
      renderFilterTagChips();
      loadRecipes();
    } else if (viewName === 'More') {
      updateHeaderUserDisplay();
    } else if (viewName === 'Settings') {
      renderSettingsView();
    } else if (viewName === 'Ingredients') {
      loadIngredients();
    } else if (viewName === 'Users') {
      loadUsers();
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
document.getElementById('moreOptionUsers')?.addEventListener('click', () => showView('Users'));
document.getElementById('moreOptionLogout')?.addEventListener('click', logout);

// Back buttons to More view
document.getElementById('backToMoreFromSettingsBtn')?.addEventListener('click', () => showView('More'));
document.getElementById('backToMoreFromIngBtn')?.addEventListener('click', () => showView('More'));
document.getElementById('backToMoreFromUsersBtn')?.addEventListener('click', () => showView('More'));


// ── WEEK PLANNING, MONTH CALENDAR & UNPLANNED DISHES ────────────────────────
const monthNamesDutch = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
];

function formatLastPlannedRelative(lastPlannedDateStr) {
  if (!lastPlannedDateStr) {
    return { text: '✨ Nog nooit gepland', isNever: true };
  }

  const [y, m, d] = lastPlannedDateStr.split('-').map(Number);
  const plannedDate = new Date(y, m - 1, d);
  const today = new Date();
  
  today.setHours(0, 0, 0, 0);
  plannedDate.setHours(0, 0, 0, 0);
  
  const diffTime = today.getTime() - plannedDate.getTime();
  const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

  if (diffDays === 0) return { text: 'Vandaag gepland', isNever: false };
  if (diffDays === 1) return { text: 'Gisteren gepland', isNever: false };
  if (diffDays < 7) return { text: `${diffDays} dagen geleden`, isNever: false };
  if (diffDays < 14) return { text: '1 week geleden', isNever: false };
  if (diffDays < 30) return { text: `${Math.floor(diffDays / 7)} weken geleden`, isNever: false };
  if (diffDays < 60) return { text: '1 maand geleden', isNever: false };
  if (diffDays < 365) return { text: `${Math.floor(diffDays / 30)} maanden geleden`, isNever: false };
  
  return { text: 'Langer dan 1 jaar geleden', isNever: false };
}

async function loadWeekPlanning(mondayStr = null) {
  let url = '/api/meal-plan';
  if (mondayStr) {
    url += `?start_date=${mondayStr}`;
  }

  try {
    const data = await apiFetch(url);
    state.currentWeekMonday = data.monday;
    state.currentMealPlan = data.plan;
    
    // Update week title
    const [y, m, d] = state.currentWeekMonday.split('-').map(Number);
    const sunDate = new Date(y, m - 1, d + 6);
    
    const monStr = formatDutchDate(state.currentWeekMonday);
    const sunStr = formatDutchDate(`${sunDate.getFullYear()}-${String(sunDate.getMonth() + 1).padStart(2, '0')}-${String(sunDate.getDate()).padStart(2, '0')}`);
    
    document.getElementById('weekTitle').textContent = `${monStr} t/m ${sunStr} (${sunDate.getFullYear()})`;
    
    renderPlanner(data.plan);

    // Refresh month calendar & unplanned dishes
    const activeYear = y;
    const activeMonth = m;
    loadMonthCalendar(state.calendarYear || activeYear, state.calendarMonth || activeMonth);
    loadUnplannedDishes();
  } catch (err) {
    console.error('Planner load error:', err);
  }
}

// Render the 7 planning days
function renderPlanner(plan) {
  const container = document.getElementById('weekPlanningGrid');
  if (!container) return;
  container.innerHTML = '';

  const todayStr = getTodayDateString();

  plan.forEach(({ date, dayName, entry }) => {
    const isToday = date === todayStr;
    const isSkipped = entry.skip_planning === 1;
    const isLocked = state.lockedDates.has(date);
    const hasRecipe = Boolean(entry.recipe_id);
    const hasNotes = Boolean(entry.notes && entry.notes.trim());

    const card = document.createElement('div');
    card.className = `planning-card ${isToday ? 'today' : ''} ${isSkipped ? 'skipped' : ''}`;
    card.setAttribute('data-date', date);

    // Day Header badge
    const dateNum = date.split('-')[2];
    const dayBadge = `
      <div class="planning-day-badge">
        <span class="planning-day-name">${dayName.substring(0, 2)}</span>
        <span class="planning-day-date">${dateNum}</span>
      </div>
    `;

    // Food thumbnail or placeholder
    let imageHtml = '';
    if (isSkipped) {
      imageHtml = `
        <div class="planning-img-placeholder" title="Niet koken">
          <i data-lucide="ban"></i>
        </div>
      `;
    } else if (hasRecipe && entry.recipe_image) {
      imageHtml = `<img src="/uploads/${entry.recipe_image}" alt="${escapeHtml(entry.recipe_title)}" class="planning-thumb clickable" data-view-recipe="${entry.recipe_id}">`;
    } else if (hasRecipe) {
      imageHtml = `
        <div class="planning-img-placeholder clickable" data-view-recipe="${entry.recipe_id}">
          <svg viewBox="0 0 100 100" width="32" height="32" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" style="color: var(--secondary)">
            <circle cx="50" cy="50" r="35" />
            <line x1="30" y1="50" x2="70" y2="50" />
            <line x1="50" y1="30" x2="50" y2="70" />
          </svg>
        </div>
      `;
    } else if (!hasNotes) {
      imageHtml = `
        <div class="planning-img-placeholder">
          <svg viewBox="0 0 100 100" width="32" height="32" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted); opacity: 0.5;">
            <circle cx="50" cy="50" r="35" />
          </svg>
        </div>
      `;
    }

    // Main Meal / Note Display Logic
    let mealContentHtml = '';

    if (isSkipped) {
      mealContentHtml = `
        <div class="planning-main">
          ${imageHtml}
          <div class="planning-info">
            <span class="planning-meal-skip">Niet koken / Vrij</span>
            ${hasNotes ? `
              <div class="planning-notes-compact" data-view-note="${escapeQuotes(entry.notes)}" data-day="${dayName}" data-date="${date}" title="Klik om notitie te lezen">
                <i data-lucide="sticky-note" style="width:12px;height:12px;flex-shrink:0;"></i>
                <span>${escapeHtml(entry.notes)}</span>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    } else if (hasRecipe) {
      mealContentHtml = `
        <div class="planning-main">
          ${imageHtml}
          <div class="planning-info">
            <span class="planning-meal-title clickable" data-view-recipe="${entry.recipe_id}">${escapeHtml(entry.recipe_title)}</span>
            ${hasNotes ? `
              <div class="planning-notes-compact" data-view-note="${escapeQuotes(entry.notes)}" data-day="${dayName}" data-date="${date}" title="Klik om notitie te lezen">
                <i data-lucide="sticky-note" style="width:12px;height:12px;flex-shrink:0;"></i>
                <span>${escapeHtml(entry.notes)}</span>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    } else if (hasNotes) {
      mealContentHtml = `
        <div class="planning-main" style="width:100%;">
          <div class="planning-note-card" data-view-note="${escapeQuotes(entry.notes)}" data-day="${dayName}" data-date="${date}" title="Klik om notitie te bekijken of aan te passen">
            <i data-lucide="sticky-note" class="planning-note-card-icon"></i>
            <div class="planning-note-card-body">
              <div class="planning-note-text">${escapeHtml(entry.notes)}</div>
            </div>
          </div>
        </div>
      `;
    } else {
      mealContentHtml = `
        <div class="planning-main">
          ${imageHtml}
          <div class="planning-info">
            <span class="planning-meal-empty">Geen maaltijd gepland</span>
          </div>
        </div>
      `;
    }

    // Action buttons: Lock & Edit
    const lockIcon = isLocked ? 'lock' : 'unlock';
    const lockColor = isLocked ? 'var(--primary)' : 'var(--text-muted)';
    const lockTitle = isLocked ? 'Ontgrendel dit recept' : 'Vergrendel dit recept (blijft behouden bij nieuw weekmenu)';

    const actionsHtml = `
      <div class="planning-actions">
        ${hasRecipe && !isSkipped ? `
          <button class="btn-icon lock-btn" title="${lockTitle}" data-lock-date="${date}">
            <i data-lucide="${lockIcon}" style="color:${lockColor};"></i>
          </button>
        ` : ''}
        <button class="btn-icon edit-planning-btn" title="Dagaanpassing" data-edit-date="${date}">
          <i data-lucide="edit-3"></i>
        </button>
      </div>
    `;

    card.innerHTML = `
      ${dayBadge}
      <div class="planning-content">
        ${mealContentHtml}
        ${actionsHtml}
      </div>
    `;

    container.appendChild(card);
  });

  if (window.lucide) lucide.createIcons();
}

function toggleLockDate(date) {
  if (state.lockedDates.has(date)) {
    state.lockedDates.delete(date);
  } else {
    state.lockedDates.add(date);
  }
  loadWeekPlanning(state.currentWeekMonday);
}

// ── MONTH CALENDAR ──────────────────────────────────────────────────────────
async function loadMonthCalendar(year = null, month = null) {
  const today = new Date();
  const y = year || state.calendarYear || today.getFullYear();
  const m = month || state.calendarMonth || (today.getMonth() + 1);

  try {
    const data = await apiFetch(`/api/meal-plan/month?year=${y}&month=${m}`);
    state.calendarYear = data.year;
    state.calendarMonth = data.month;
    state.currentCalendarData = data;

    renderMonthCalendar(data);
  } catch (err) {
    console.error('Calendar load error:', err);
  }
}

function renderMonthCalendar(data) {
  const titleEl = document.getElementById('calendarMonthTitle');
  const statsEl = document.getElementById('calendarStatsBar');
  const gridEl = document.getElementById('calendarDaysGrid');
  if (!titleEl || !gridEl) return;

  titleEl.textContent = `${monthNamesDutch[data.month - 1]} ${data.year}`;

  let plannedCount = 0;
  let skippedCount = 0;
  let openCount = 0;

  for (let day = 1; day <= data.totalDaysInMonth; day++) {
    const dStr = String(day).padStart(2, '0');
    const mStr = String(data.month).padStart(2, '0');
    const dateKey = `${data.year}-${mStr}-${dStr}`;
    const entry = data.entries[dateKey];

    if (entry) {
      if (entry.skip_planning === 1) {
        skippedCount++;
      } else if (entry.recipe_id) {
        plannedCount++;
      } else {
        openCount++;
      }
    } else {
      openCount++;
    }
  }

  if (statsEl) {
    statsEl.innerHTML = `
      <span class="cal-stat-badge" title="${plannedCount} gerechten ingepland"><span class="cal-stat-dot planned"></span> ${plannedCount} Gepland</span>
      <span class="cal-stat-badge" title="${skippedCount} dagen niet koken"><span class="cal-stat-dot skipped"></span> ${skippedCount} Vrij</span>
      <span class="cal-stat-badge" title="${openCount} dagen open"><span class="cal-stat-dot empty"></span> ${openCount} Open</span>
    `;
  }

  gridEl.innerHTML = '';

  const firstDate = new Date(data.year, data.month - 1, 1);
  let startDayOfWeek = firstDate.getDay() - 1;
  if (startDayOfWeek === -1) startDayOfWeek = 6;

  for (let i = 0; i < startDayOfWeek; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'cal-day-cell other-month';
    gridEl.appendChild(emptyCell);
  }

  const todayStr = getTodayDateString();

  const activeWeekDates = new Set();
  if (state.currentWeekMonday) {
    const [wy, wm, wd] = state.currentWeekMonday.split('-').map(Number);
    for (let i = 0; i < 7; i++) {
      const d = new Date(wy, wm - 1, wd + i);
      const yStr = d.getFullYear();
      const mStr = String(d.getMonth() + 1).padStart(2, '0');
      const dtStr = String(d.getDate()).padStart(2, '0');
      activeWeekDates.add(`${yStr}-${mStr}-${dtStr}`);
    }
  }

  for (let day = 1; day <= data.totalDaysInMonth; day++) {
    const dStr = String(day).padStart(2, '0');
    const mStr = String(data.month).padStart(2, '0');
    const dateKey = `${data.year}-${mStr}-${dStr}`;
    const entry = data.entries[dateKey];

    const isToday = dateKey === todayStr;
    const isActiveWeek = activeWeekDates.has(dateKey);

    let contentHtml = '';
    if (entry) {
      if (entry.skip_planning === 1) {
        contentHtml = `<span class="cal-skip-badge" title="Niet koken"><i data-lucide="ban" style="width:14px;height:14px;"></i></span>`;
      } else if (entry.recipe_title) {
        contentHtml = `<div class="cal-dish-badge" title="${escapeHtml(entry.recipe_title)}">${escapeHtml(entry.recipe_title)}</div>`;
      } else if (entry.notes) {
        contentHtml = `<span class="cal-note-badge" title="${escapeQuotes(entry.notes)}"><i data-lucide="sticky-note" style="width:14px;height:14px;"></i></span>`;
      }
    }

    const cell = document.createElement('div');
    cell.className = `cal-day-cell ${isToday ? 'is-today' : ''} ${isActiveWeek ? 'is-active-week' : ''}`;
    cell.setAttribute('data-cal-date', dateKey);

    cell.innerHTML = `
      <span class="cal-day-num">${day}</span>
      <div class="cal-day-content">
        ${contentHtml}
      </div>
    `;

    gridEl.appendChild(cell);
  }

  if (window.lucide) lucide.createIcons();
}

// ── UNPLANNED DISHES ───────────────────────────────────────────────────────
async function loadUnplannedDishes() {
  const gridEl = document.getElementById('unplannedDishesGrid');
  if (!gridEl) return;

  try {
    const data = await apiFetch('/api/meal-plan/unplanned-dishes?limit=12');
    renderUnplannedDishes(data.dishes || []);
  } catch (err) {
    console.error('Error loading unplanned dishes:', err);
  }
}

function renderUnplannedDishes(dishes) {
  const gridEl = document.getElementById('unplannedDishesGrid');
  if (!gridEl) return;
  gridEl.innerHTML = '';

  if (dishes.length === 0) {
    gridEl.innerHTML = `
      <div style="grid-column: 1/-1; padding: 1rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
        Geen gerechten gevonden.
      </div>
    `;
    return;
  }

  dishes.forEach(dish => {
    const rel = formatLastPlannedRelative(dish.last_planned_date);
    const thumbHtml = dish.image_path
      ? `<img src="/uploads/${dish.image_path}" class="unplanned-dish-thumb clickable" data-view-recipe="${dish.id}" alt="${escapeHtml(dish.title)}">`
      : `<div class="unplanned-dish-thumb-placeholder clickable" data-view-recipe="${dish.id}"><i data-lucide="utensils" style="width:20px;height:20px;"></i></div>`;

    const card = document.createElement('div');
    card.className = 'unplanned-dish-card';
    card.innerHTML = `
      <div class="unplanned-dish-top">
        ${thumbHtml}
        <div class="unplanned-dish-info">
          <div class="unplanned-dish-title" data-view-recipe="${dish.id}" title="${escapeHtml(dish.title)}">
            ${escapeHtml(dish.title)}
          </div>
          <span class="last-planned-badge ${rel.isNever ? 'never' : ''}">
            ${rel.text}
          </span>
        </div>
      </div>
      <button type="button" class="btn btn-secondary btn-sm unplanned-dish-btn" 
        data-quick-plan-id="${dish.id}" 
        data-quick-plan-title="${escapeQuotes(dish.title)}" 
        data-quick-plan-img="${dish.image_path || ''}" 
        data-quick-plan-meta="${escapeQuotes(rel.text)}">
        <i data-lucide="plus" style="width:14px;height:14px;"></i> Inplannen
      </button>
    `;

    gridEl.appendChild(card);
  });

  if (window.lucide) lucide.createIcons();
}

// ── QUICK PLAN MODAL ───────────────────────────────────────────────────────
function openQuickPlanModal(recipeId, recipeTitle, recipeImg, metaText) {
  const modal = document.getElementById('quickPlanModal');
  if (!modal) return;

  document.getElementById('quickPlanRecipeId').value = recipeId;
  document.getElementById('quickPlanRecipeTitle').textContent = recipeTitle;
  document.getElementById('quickPlanRecipeMeta').textContent = metaText || 'Lang niet gepland';
  document.getElementById('quickPlanNotes').value = '';

  const imgEl = document.getElementById('quickPlanRecipeImg');
  const placeholderEl = document.getElementById('quickPlanRecipePlaceholder');

  if (recipeImg) {
    imgEl.src = `/uploads/${recipeImg}`;
    imgEl.classList.remove('hidden');
    placeholderEl.classList.add('hidden');
  } else {
    imgEl.classList.add('hidden');
    placeholderEl.classList.remove('hidden');
  }

  const selectEl = document.getElementById('quickPlanDateSelect');
  selectEl.innerHTML = '';

  if (state.currentWeekMonday) {
    const dayNames = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];
    const [y, m, d] = state.currentWeekMonday.split('-').map(Number);

    for (let i = 0; i < 7; i++) {
      const dt = new Date(y, m - 1, d + i);
      const yStr = dt.getFullYear();
      const mStr = String(dt.getMonth() + 1).padStart(2, '0');
      const dtStr = String(dt.getDate()).padStart(2, '0');
      const isoDate = `${yStr}-${mStr}-${dtStr}`;

      const option = document.createElement('option');
      option.value = isoDate;
      option.textContent = `${dayNames[i]} ${dt.getDate()} ${monthNamesDutch[dt.getMonth()].substring(0, 3)}`;
      selectEl.appendChild(option);
    }
  }

  document.getElementById('quickPlanCustomDate').value = selectEl.value || getTodayDateString();

  selectEl.onchange = () => {
    document.getElementById('quickPlanCustomDate').value = selectEl.value;
  };

  modal.showModal();
  if (window.lucide) lucide.createIcons();
}

// Global Month Navigation & Listeners
document.getElementById('prevMonthBtn')?.addEventListener('click', () => {
  let y = state.calendarYear || new Date().getFullYear();
  let m = (state.calendarMonth || (new Date().getMonth() + 1)) - 1;
  if (m < 1) { m = 12; y--; }
  loadMonthCalendar(y, m);
});

document.getElementById('nextMonthBtn')?.addEventListener('click', () => {
  let y = state.calendarYear || new Date().getFullYear();
  let m = (state.calendarMonth || (new Date().getMonth() + 1)) + 1;
  if (m > 12) { m = 1; y++; }
  loadMonthCalendar(y, m);
});

document.getElementById('todayMonthBtn')?.addEventListener('click', () => {
  const today = new Date();
  loadMonthCalendar(today.getFullYear(), today.getMonth() + 1);
});

document.getElementById('refreshUnplannedBtn')?.addEventListener('click', () => {
  loadUnplannedDishes();
  showToast('Suggesties vernieuwd!', 'success');
});

document.getElementById('confirmQuickPlanBtn')?.addEventListener('click', async () => {
  const modal = document.getElementById('quickPlanModal');
  const recipeId = document.getElementById('quickPlanRecipeId').value;
  const date = document.getElementById('quickPlanCustomDate').value || document.getElementById('quickPlanDateSelect').value;
  const notes = document.getElementById('quickPlanNotes').value;

  if (!recipeId || !date) {
    showToast('Selecteer een datum voor het inplannen.', 'error');
    return;
  }

  try {
    await apiFetch('/api/meal-plan/save', {
      method: 'POST',
      body: JSON.stringify({
        planned_on: date,
        recipe_id: recipeId,
        notes: notes,
        skip_planning: 0
      })
    });

    showToast('Gerecht succesvol ingepland!', 'success');
    modal.close();
    loadWeekPlanning(state.currentWeekMonday);
  } catch (err) {
    // Handled in apiFetch
  }
});

document.querySelectorAll('.planner-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.planner-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const tab = btn.getAttribute('data-planner-tab');
    const weekSection = document.getElementById('plannerWeekSection');
    const monthSection = document.getElementById('plannerMonthSection');
    const unplannedSection = document.getElementById('plannerUnplannedSection');

    if (tab === 'all') {
      if (weekSection) weekSection.classList.remove('hidden');
      if (monthSection) monthSection.classList.remove('hidden');
      if (unplannedSection) unplannedSection.classList.remove('hidden');
    } else if (tab === 'week') {
      if (weekSection) weekSection.classList.remove('hidden');
      if (monthSection) monthSection.classList.add('hidden');
      if (unplannedSection) unplannedSection.classList.add('hidden');
    } else if (tab === 'month') {
      if (weekSection) weekSection.classList.add('hidden');
      if (monthSection) monthSection.classList.remove('hidden');
      if (unplannedSection) unplannedSection.classList.add('hidden');
    } else if (tab === 'unplanned') {
      if (weekSection) weekSection.classList.add('hidden');
      if (monthSection) monthSection.classList.add('hidden');
      if (unplannedSection) unplannedSection.classList.remove('hidden');
    }
  });
});

document.getElementById('viewPlanner')?.addEventListener('click', (e) => {
  const quickBtn = e.target.closest('[data-quick-plan-id]');
  if (quickBtn) {
    const id = quickBtn.getAttribute('data-quick-plan-id');
    const title = quickBtn.getAttribute('data-quick-plan-title');
    const img = quickBtn.getAttribute('data-quick-plan-img');
    const meta = quickBtn.getAttribute('data-quick-plan-meta');
    openQuickPlanModal(id, title, img, meta);
    return;
  }

  // 3. Calendar cell click -> Select that week (long-press and double-click edit the single day)
  const calCell = e.target.closest('[data-cal-date]');
  if (calCell) {
    if (longPressTriggered) {
      longPressTriggered = false;
      return;
    }
    const date = calCell.getAttribute('data-cal-date');
    if (date) {
      const [y, m, d] = date.split('-').map(Number);
      const cellDate = new Date(y, m - 1, d);
      const dayOfWeek = cellDate.getDay();
      const diff = cellDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const mondayDate = new Date(y, m - 1, diff);

      const mY = mondayDate.getFullYear();
      const mM = String(mondayDate.getMonth() + 1).padStart(2, '0');
      const mD = String(mondayDate.getDate()).padStart(2, '0');
      const mondayStr = `${mY}-${mM}-${mD}`;

      if (state.currentWeekMonday !== mondayStr) {
        loadWeekPlanning(mondayStr);
      }
      return;
    }
  }

  const noteElem = e.target.closest('[data-view-note]');
  if (noteElem) {
    const fullNote = noteElem.getAttribute('data-view-note');
    const day = noteElem.getAttribute('data-day') || 'Dag';
    const date = noteElem.getAttribute('data-date');
    if (fullNote) {
      openViewNoteModal(day, date, fullNote);
      return;
    }
  }

  const mealTitle = e.target.closest('[data-view-recipe]');
  if (mealTitle) {
    const recipeId = mealTitle.getAttribute('data-view-recipe');
    if (recipeId) viewRecipeDetails(recipeId, { fromRecipeTab: false });
    return;
  }

  const lockBtn = e.target.closest('[data-lock-date]');
  if (lockBtn) {
    const date = lockBtn.getAttribute('data-lock-date');
    if (date) toggleLockDate(date);
    return;
  }

  const editBtn = e.target.closest('[data-edit-date]');
  if (editBtn) {
    const date = editBtn.getAttribute('data-edit-date');
    const planItem = state.currentMealPlan ? state.currentMealPlan.find(item => item.date === date) : null;
    const entry = planItem ? planItem.entry : null;
    const recipeId = entry && entry.recipe_id ? entry.recipe_id : '';
    const isSkipped = entry ? (entry.skip_planning == 1 || entry.skip_planning === true) : false;
    const notes = entry && entry.notes ? entry.notes : '';
    openEditDayModal(date, recipeId, isSkipped, notes);
    return;
  }
});

function openCalendarDayEdit(date) {
  if (!date) return;
  const entry = state.currentCalendarData && state.currentCalendarData.entries
    ? state.currentCalendarData.entries[date]
    : null;
  
  const recipeId = entry ? entry.recipe_id : '';
  const isSkipped = entry ? (entry.skip_planning == 1 || entry.skip_planning === true) : false;
  const notes = entry ? entry.notes : '';
  openEditDayModal(date, recipeId, isSkipped, notes);
}

let longPressTimer = null;
let longPressTriggered = false;
let pointerStartX = 0;
let pointerStartY = 0;
let longPressTargetDate = null;

function clearLongPressTimer() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
  longPressTargetDate = null;
}

function suppressNextPointerRelease() {
  const swallow = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  };

  const events = ['click', 'pointerup', 'mouseup', 'touchend', 'contextmenu'];
  const cleanups = events.map((evt) => {
    window.addEventListener(evt, swallow, { capture: true });
    return () => window.removeEventListener(evt, swallow, { capture: true });
  });

  setTimeout(() => {
    cleanups.forEach((cleanup) => cleanup());
  }, 800);
}

const plannerViewEl = document.getElementById('viewPlanner');
if (plannerViewEl) {
  plannerViewEl.addEventListener('pointerdown', (e) => {
    const calCell = e.target.closest('[data-cal-date]');
    if (!calCell) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    clearLongPressTimer();
    longPressTriggered = false;
    pointerStartX = e.clientX;
    pointerStartY = e.clientY;
    const date = calCell.getAttribute('data-cal-date');
    longPressTargetDate = date;

    longPressTimer = setTimeout(() => {
      if (longPressTargetDate) {
        longPressTriggered = true;
        const targetDate = longPressTargetDate;
        clearLongPressTimer();

        suppressNextPointerRelease();

        if (navigator.vibrate) {
          try { navigator.vibrate(40); } catch (_) {}
        }
        openCalendarDayEdit(targetDate);
      }
    }, 500);
  });

  plannerViewEl.addEventListener('pointermove', (e) => {
    if (!longPressTimer) return;
    const moveX = Math.abs(e.clientX - pointerStartX);
    const moveY = Math.abs(e.clientY - pointerStartY);
    if (moveX > 10 || moveY > 10) {
      clearLongPressTimer();
    }
  });

  plannerViewEl.addEventListener('pointerup', () => {
    clearLongPressTimer();
  });
  plannerViewEl.addEventListener('pointercancel', () => {
    clearLongPressTimer();
  });

  plannerViewEl.addEventListener('dblclick', (e) => {
    const calCell = e.target.closest('[data-cal-date]');
    if (calCell) {
      const date = calCell.getAttribute('data-cal-date');
      if (date) {
        openCalendarDayEdit(date);
      }
    }
  });
}



// ── MODAL: VIEW FULL NOTE ─────────────────────────────────────────────────────
let activeNoteDayDate = null;

function openViewNoteModal(dayName, date, fullNote) {
  activeNoteDayDate = date;
  const modal = document.getElementById('viewNoteModal');
  const title = document.getElementById('viewNoteModalTitle');
  const text = document.getElementById('viewNoteFullText');

  title.textContent = `📝 Notitie: ${dayName} (${formatDutchDate(date)})`;
  text.textContent = fullNote;

  modal.showModal();
  if (window.lucide) lucide.createIcons();
}

document.getElementById('editDayFromNoteBtn')?.addEventListener('click', () => {
  const noteModal = document.getElementById('viewNoteModal');
  if (noteModal) noteModal.close();

  if (activeNoteDayDate) {
    const planItem = state.currentMealPlan ? state.currentMealPlan.find(item => item.date === activeNoteDayDate) : null;
    const entry = planItem ? planItem.entry : null;
    const recipeId = entry && entry.recipe_id ? entry.recipe_id : '';
    const isSkipped = entry ? (entry.skip_planning == 1 || entry.skip_planning === true) : false;
    const notes = entry && entry.notes ? entry.notes : '';
    openEditDayModal(activeNoteDayDate, recipeId, isSkipped, notes);
  }
});


// ── MODAL: GENERATE WEEK MENU ─────────────────────────────────────────────────
document.getElementById('openGenerateModalBtn')?.addEventListener('click', async () => {
  const modal = document.getElementById('generateMenuModal');
  
  // Render locked days notice inside the warning box
  const lockedNoticeContainer = document.getElementById('modalLockedDaysNotice');
  if (lockedNoticeContainer) {
    if (state.lockedDates.size > 0) {
      const dayNames = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];
      const [y, m, d] = state.currentWeekMonday.split('-').map(Number);
      
      const lockedBadges = Array.from(state.lockedDates).map(dateStr => {
        const item = state.currentMealPlan ? state.currentMealPlan.find(p => p.date === dateStr) : null;
        const name = item ? item.dayName : dateStr;
        return `<span class="locked-badge"><i data-lucide="lock" style="width:12px;height:12px;"></i> ${name}</span>`;
      }).join('');

      lockedNoticeContainer.innerHTML = `<strong>Vergrendelde dagen (worden behouden):</strong><br>${lockedBadges}`;
    } else {
      lockedNoticeContainer.innerHTML = `<span style="color:var(--text-muted); font-size:0.8rem;">Geen dagen vergrendeld (alle 7 dagen worden opnieuw gepland).</span>`;
    }
  }

  // Render tags selection in modal
  await fetchTags();
  const tagsGrid = document.getElementById('generateTagsGrid');
  tagsGrid.innerHTML = state.allTags.map(tag => `
    <label class="checkbox-label">
      <input type="checkbox" name="gen_tag" value="${tag.id}"> ${escapeHtml(tag.name)}
    </label>
  `).join('');
  
  modal.showModal();
  if (window.lucide) lucide.createIcons();
});

// Run generation algorithm (preventing duplicate dishes in a week)
document.getElementById('confirmGenerateMenuBtn')?.addEventListener('click', async () => {
  const modal = document.getElementById('generateMenuModal');
  
  const [y, m, d] = state.currentWeekMonday.split('-').map(Number);
  const dayNames = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];
  
  const selectedExclusions = Array.from(document.querySelectorAll('input[name="exclude_day"]:checked')).map(el => el.value);
  const excluded_days = [];
  
  selectedExclusions.forEach(dayName => {
    const index = dayNames.indexOf(dayName);
    if (index !== -1) {
      const dt = new Date(y, m - 1, d + index);
      const formatted = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      excluded_days.push(formatted);
    }
  });

  const tag_ids = Array.from(document.querySelectorAll('input[name="gen_tag"]:checked')).map(el => parseInt(el.value, 10));

  const payload = {
    start_date: state.currentWeekMonday,
    excluded_days,
    tag_ids,
    locked_dates: Array.from(state.lockedDates)
  };

  try {
    const response = await apiFetch('/api/meal-plan/generate', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    
    if (response.warning) {
      showToast(response.warning, 'error');
    } else {
      showToast(response.message, 'success');
    }
    
    modal.close();
    loadWeekPlanning(state.currentWeekMonday);
  } catch (err) {
    // Handled inside apiFetch
  }
});


// ── MODAL: EDIT DAY (SEARCHABLE COMBOBOX & SUGGESTIONS) ────────────────────────
async function openEditDayModal(date, currentRecipeId, isSkipped, currentNotes) {
  const modal = document.getElementById('editDayModal');
  
  document.getElementById('editDayDate').value = date;
  document.getElementById('editDaySkipPlanning').checked = isSkipped;
  document.getElementById('editDayNotes').value = currentNotes || '';
  
  state.currentEditDayRecipeId = currentRecipeId || null;
  document.getElementById('editDayRecipeSelect').value = currentRecipeId || '';

  // Cache recipes
  await fetchAllRecipesCache();

  // Search input reset
  const searchInput = document.getElementById('editDayDishSearch');
  searchInput.value = '';

  updateSelectedRecipeBanner();
  renderDishSuggestions('');

  const recipeGroup = document.getElementById('editDayRecipeGroup');
  if (isSkipped) {
    recipeGroup.classList.add('hidden');
  } else {
    recipeGroup.classList.remove('hidden');
  }

  // Toggle recipe group visibility on skip checkbox
  document.getElementById('editDaySkipPlanning').onchange = (e) => {
    if (e.target.checked) {
      recipeGroup.classList.add('hidden');
    } else {
      recipeGroup.classList.remove('hidden');
    }
  };

  modal.showModal();
  if (window.lucide) lucide.createIcons();
}

function updateSelectedRecipeBanner() {
  const banner = document.getElementById('editDaySelectedRecipeBanner');
  const titleEl = document.getElementById('editDaySelectedRecipeTitle');
  const hiddenInput = document.getElementById('editDayRecipeSelect');

  if (state.currentEditDayRecipeId) {
    const recipe = state.allRecipes.find(r => r.id === state.currentEditDayRecipeId);
    if (recipe) {
      titleEl.textContent = recipe.title;
      banner.classList.remove('hidden');
      hiddenInput.value = recipe.id;
    } else {
      banner.classList.add('hidden');
      hiddenInput.value = '';
    }
  } else {
    banner.classList.add('hidden');
    hiddenInput.value = '';
  }
  if (window.lucide) lucide.createIcons();
}

document.getElementById('clearSelectedRecipeBtn')?.addEventListener('click', () => {
  state.currentEditDayRecipeId = null;
  updateSelectedRecipeBanner();
  renderDishSuggestions(document.getElementById('editDayDishSearch').value);
});

function renderDishSuggestions(query = '') {
  const container = document.getElementById('editDayDishSuggestions');
  if (!container) return;

  const qClean = query.trim().toLowerCase();
  let filtered = state.allRecipes;

  if (qClean) {
    filtered = state.allRecipes.filter(r => {
      const matchTitle = r.title.toLowerCase().includes(qClean);
      const matchDesc = r.description ? r.description.toLowerCase().includes(qClean) : false;
      const matchTags = r.tags ? r.tags.some(t => t.name.toLowerCase().includes(qClean)) : false;
      return matchTitle || matchDesc || matchTags;
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="padding: 0.75rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
        Geen recepten gevonden voor "${escapeHtml(query)}".
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.slice(0, 15).map(recipe => {
    const isSelected = recipe.id === state.currentEditDayRecipeId;
    const thumbHtml = recipe.image_path 
      ? `<img src="/uploads/${recipe.image_path}" class="dish-suggestion-thumb" alt="${escapeHtml(recipe.title)}">` 
      : `<div class="dish-suggestion-thumb-placeholder"><i data-lucide="utensils" style="width:18px;height:18px;"></i></div>`;
    
    const tagsStr = (recipe.tags && recipe.tags.length > 0) 
      ? recipe.tags.map(t => t.name).join(', ') 
      : '';
    const timeStr = recipe.prep_time || recipe.cook_time 
      ? `${(recipe.prep_time || 0) + (recipe.cook_time || 0)} min` 
      : '';

    return `
      <div class="dish-suggestion-item ${isSelected ? 'selected' : ''}" data-select-dish="${recipe.id}">
        ${thumbHtml}
        <div class="dish-suggestion-details">
          <div class="dish-suggestion-title">${escapeHtml(recipe.title)}</div>
          <div class="dish-suggestion-meta">
            ${timeStr ? `⏱️ ${timeStr}` : ''} ${tagsStr ? `• 🏷️ ${escapeHtml(tagsStr)}` : ''}
          </div>
        </div>
        ${isSelected ? '<i data-lucide="check" style="color:var(--primary); width:18px;height:18px;"></i>' : ''}
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// Live search listener on dish search box
document.getElementById('editDayDishSearch')?.addEventListener('input', (e) => {
  renderDishSuggestions(e.target.value);
});

// Selection click on suggestion
document.getElementById('editDayDishSuggestions')?.addEventListener('click', (e) => {
  const item = e.target.closest('[data-select-dish]');
  if (item) {
    const dishId = item.getAttribute('data-select-dish');
    state.currentEditDayRecipeId = dishId;
    updateSelectedRecipeBanner();
    renderDishSuggestions(document.getElementById('editDayDishSearch').value);
  }
});

// Save day changes
document.getElementById('saveDayChangesBtn')?.addEventListener('click', async () => {
  const modal = document.getElementById('editDayModal');
  const date = document.getElementById('editDayDate').value;
  const skip = document.getElementById('editDaySkipPlanning').checked;
  const recipeId = state.currentEditDayRecipeId;
  const notes = document.getElementById('editDayNotes').value;

  const payload = {
    planned_on: date,
    recipe_id: skip ? null : (recipeId || null),
    notes: notes,
    skip_planning: skip ? 1 : 0
  };

  try {
    await apiFetch('/api/meal-plan/save', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    
    showToast('Aanpassing opgeslagen!', 'success');
    modal.close();
    loadWeekPlanning(state.currentWeekMonday);
  } catch (err) {
    // Handled in apiFetch
  }
});

// Delete day planning
document.getElementById('deleteDayPlanningBtn')?.addEventListener('click', async () => {
  const modal = document.getElementById('editDayModal');
  const date = document.getElementById('editDayDate').value;
  if (!date) return;

  if (!confirm('Weet je zeker dat je de maaltijd en notitie van deze dag wilt wissen?')) {
    return;
  }

  try {
    const response = await apiFetch(`/api/meal-plan/entry/${date}`, {
      method: 'DELETE'
    });
    
    showToast(response.message || 'Dag leeggemaakt!', 'success');
    modal.close();
    loadWeekPlanning(state.currentWeekMonday);
  } catch (err) {
    // Handled in apiFetch
  }
});


// ── RECIPES BROWSE LOGIC ──────────────────────────────────────────────────────
async function loadRecipes() {
  const searchInput = document.getElementById('recipeSearchInput');
  const q = searchInput ? searchInput.value.trim() : '';
  const selectedTagChips = Array.from(document.querySelectorAll('.filter-tag-chip.active')).map(el => el.getAttribute('data-tag-id'));
  
  let endpoint = '/api/recipes';
  const queryParams = [];
  if (q) queryParams.push(`q=${encodeURIComponent(q)}`);
  if (selectedTagChips.length > 0) queryParams.push(`tags=${selectedTagChips.join(',')}`);
  
  if (queryParams.length > 0) {
    endpoint += `?${queryParams.join('&')}`;
  }

  try {
    const recipes = await apiFetch(endpoint);
    state.allRecipes = recipes;
    renderRecipes(recipes);
  } catch (err) {
    console.error('Error listing recipes:', err);
  }
}

function renderRecipes(recipes) {
  const grid = document.getElementById('recipesGrid');
  if (!grid) return;
  grid.innerHTML = '';

  if (!recipes || recipes.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
        <i data-lucide="cookie" style="width: 48px; height: 48px; margin-bottom: 1rem; opacity: 0.5;"></i>
        <p>Geen recepten gevonden. Voeg er een toe om te beginnen!</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  recipes.forEach(recipe => {
    const card = document.createElement('div');
    card.className = 'recipe-card';
    card.addEventListener('click', () => viewRecipeDetails(recipe.id, { fromRecipeTab: true }));

    let imageHtml = '';
    if (recipe.image_path) {
      imageHtml = `<img src="/uploads/${recipe.image_path}" alt="${escapeHtml(recipe.title)}" class="recipe-card-img">`;
    } else {
      imageHtml = `
        <div class="recipe-card-placeholder">
          <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="50" cy="50" r="30"/>
            <path d="M50 20v60M20 50h60"/>
          </svg>
        </div>
      `;
    }

    const authorName = recipe.author || 'Onbekend';
    const authorInitial = authorName.charAt(0).toUpperCase();
    let authorAvatarHtml = '';
    if (recipe.author_avatar) {
      authorAvatarHtml = `<img src="/uploads/${escapeHtml(recipe.author_avatar)}" alt="${escapeHtml(authorName)}">`;
    } else {
      authorAvatarHtml = `<span>${escapeHtml(authorInitial)}</span>`;
    }

    const tags = Array.isArray(recipe.tags) ? recipe.tags : [];
    let tagsHtml = tags.map(tag => `
      <span class="recipe-card-tag">${escapeHtml(tag.name)}</span>
    `).join('');

    if (recipe.exclude_from_menu) {
      tagsHtml += `
        <span class="recipe-card-tag" style="opacity: 0.85; font-size: 0.72rem; color: var(--text-muted);" title="Niet opnemen in het automatisch weekmenu">
          <i data-lucide="calendar-off" style="width:10px;height:10px;display:inline-block;vertical-align:-1px;margin-right:3px;"></i>Geen weekmenu
        </span>
      `;
    }

    const descHtml = recipe.description 
      ? `<p class="recipe-card-desc">${escapeHtml(recipe.description)}</p>` 
      : `<p class="recipe-card-desc" style="font-style:italic;">Geen omschrijving toegevoegd.</p>`;

    card.innerHTML = `
      <div class="recipe-card-img-box">
        ${imageHtml}
        <div class="recipe-card-author-badge" title="Toegevoegd door ${escapeHtml(authorName)}">
          ${authorAvatarHtml}
        </div>
      </div>
      <div class="recipe-card-content">
        <h3 class="recipe-card-title">${escapeHtml(recipe.title)}</h3>
        ${descHtml}
        <div class="recipe-card-tags">
          ${tagsHtml}
        </div>
        <div class="recipe-card-footer">
          <div class="recipe-card-footer-info">
            <div class="recipe-card-info-item">
              <i data-lucide="users" style="width:14px;height:14px;"></i>
              <span>${recipe.servings ? recipe.servings + ' pers' : '- pers'}</span>
            </div>
            <div class="recipe-card-info-item">
              <i data-lucide="clock" style="width:14px;height:14px;"></i>
              <span>${recipe.prep_time ? recipe.prep_time + 'm' : '-'}</span>
            </div>
            <div class="recipe-card-info-item">
              <i data-lucide="flame" style="width:14px;height:14px;"></i>
              <span>${recipe.cook_time ? recipe.cook_time + 'm' : '-'}</span>
            </div>
          </div>
          <div class="recipe-card-author-info" title="Toegevoegd door ${escapeHtml(authorName)}">
            <div class="recipe-card-author-avatar">
              ${authorAvatarHtml}
            </div>
            <span class="recipe-card-author-name">${escapeHtml(authorName)}</span>
          </div>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });

  if (window.lucide) lucide.createIcons();
}

async function renderFilterTagChips() {
  await fetchTags();
  const list = document.getElementById('filterTagsList');
  if (!list) return;
  list.innerHTML = state.allTags.map(tag => `
    <button type="button" class="filter-tag-chip" data-tag-id="${tag.id}">${escapeHtml(tag.name)}</button>
  `).join('');
}

document.getElementById('filterTagsList')?.addEventListener('click', (e) => {
  const chip = e.target.closest('.filter-tag-chip');
  if (chip) {
    chip.classList.toggle('active');
    loadRecipes();
  }
});

document.getElementById('recipeSearchInput')?.addEventListener('input', debounce(loadRecipes, 300));


// ── VIEW RECIPE DETAILS MODAL ─────────────────────────────────────────────────
async function viewRecipeDetails(recipeId, options = {}) {
  try {
    const recipe = await apiFetch(`/api/recipes/${recipeId}`);
    const modal = document.getElementById('recipeDetailModal');

    document.getElementById('recipeDetailTitle').textContent = recipe.title;
    document.getElementById('recipeDetailName').textContent = recipe.title;
    document.getElementById('recipeDetailDesc').textContent = recipe.description || 'Geen omschrijving.';
    document.getElementById('recipeDetailServings').textContent = recipe.servings ? `${recipe.servings} personen` : '- personen';
    document.getElementById('recipeDetailPrep').textContent = recipe.prep_time ? `${recipe.prep_time} min voorb.` : '- min';
    document.getElementById('recipeDetailCook').textContent = recipe.cook_time ? `${recipe.cook_time} min kook` : '- min';

    // Exclude badge
    const excludeBadge = document.getElementById('recipeDetailExcludeBadge');
    if (excludeBadge) {
      if (recipe.exclude_from_menu) {
        excludeBadge.classList.remove('hidden');
      } else {
        excludeBadge.classList.add('hidden');
      }
    }

    // Tags
    const tagsContainer = document.getElementById('recipeDetailTags');
    tagsContainer.innerHTML = recipe.tags.map(tag => `
      <span class="recipe-card-tag">${escapeHtml(tag.name)}</span>
    `).join('');

    // Image
    const imgContainer = document.getElementById('recipeDetailImageContainer');
    if (recipe.image_path) {
      imgContainer.innerHTML = `<img src="/uploads/${recipe.image_path}" alt="${escapeHtml(recipe.title)}">`;
    } else {
      imgContainer.innerHTML = `
        <div class="recipe-card-placeholder" style="height: 100%; border-radius:0;">
          <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" style="width: 60px; height: 60px; color: var(--secondary);">
            <circle cx="50" cy="50" r="30"/>
            <path d="M50 20v60M20 50h60"/>
          </svg>
        </div>
      `;
    }

    // Ingredients list
    const ingList = document.getElementById('recipeDetailIngredientsList');
    if (recipe.ingredients && recipe.ingredients.length > 0) {
      ingList.innerHTML = recipe.ingredients.map(ing => {
        const qty = ing.quantity ? ing.quantity : '';
        const unit = ing.unit ? ing.unit : '';
        const notes = ing.notes ? `(${ing.notes})` : '';
        return `<li><strong>${qty} ${unit}</strong> ${escapeHtml(ing.name)} ${escapeHtml(notes)}</li>`;
      }).join('');
    } else {
      ingList.innerHTML = '<li style="font-style:italic; border-left-color: var(--border);">Geen ingrediënten ingevoerd.</li>';
    }

    // Steps list
    const stepsList = document.getElementById('recipeDetailStepsList');
    if (recipe.steps && recipe.steps.length > 0) {
      stepsList.innerHTML = recipe.steps.map(step => `
        <li>${escapeHtml(step.instruction)}</li>
      `).join('');
    } else {
      stepsList.innerHTML = '<li style="font-style:italic;">Geen bereidingsstappen ingevoerd.</li>';
    }

    const isRecipeTab = (options.fromRecipeTab !== undefined)
      ? Boolean(options.fromRecipeTab)
      : (state.currentView === 'Recipes');

    const editBtn = document.getElementById('editDetailRecipeBtn');
    if (editBtn) {
      if (isRecipeTab) {
        editBtn.classList.remove('hidden');
        editBtn.onclick = () => {
          modal.close();
          openEditRecipeForm(recipe);
        };
      } else {
        editBtn.classList.add('hidden');
      }
    }

    const deleteBtn = document.getElementById('deleteDetailRecipeBtn');
    if (deleteBtn) {
      if (isRecipeTab) {
        deleteBtn.classList.remove('hidden');
        deleteBtn.onclick = () => {
          deleteCurrentRecipe(recipe.id);
        };
      } else {
        deleteBtn.classList.add('hidden');
      }
    }

    modal.showModal();
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    // Handled in apiFetch
  }
}

async function deleteCurrentRecipe(recipeId) {
  if (!recipeId) return;
  if (!confirm('Weet je zeker dat je dit recept wilt verwijderen? Dit verwijdert het recept ook uit bestaande weekplanningen.')) {
    return;
  }

  try {
    const response = await apiFetch(`/api/recipes/${recipeId}`, {
      method: 'DELETE'
    });
    showToast(response.message || 'Recept succesvol verwijderd!', 'success');

    const modal = document.getElementById('recipeDetailModal');
    if (modal && typeof modal.close === 'function') modal.close();

    state.allRecipes = [];
    showView('Recipes');
    loadRecipes();
  } catch (err) {
    // Handled in apiFetch
  }
}


// ── RECIPE FORM (DYNAMIC TAGS, CLEAR INPUTS, INGREDIENTS & STEPS) ──────────────
function openAddRecipeForm() {
  state.currentEditingRecipeId = null;
  state.recipeFormIngredients = [];
  state.recipeFormSteps = [];
  state.recipeFormSelectedTagIds = new Set();
  
  document.getElementById('recipeFormTitle').textContent = 'Nieuw Recept Toevoegen';
  document.getElementById('recipeForm').reset();
  document.getElementById('recipeFormId').value = '';
  const excludeCheckAdd = document.getElementById('recipeExcludeFromMenuInput');
  if (excludeCheckAdd) excludeCheckAdd.checked = false;
  document.getElementById('deleteRecipeFormBtn')?.classList.add('hidden');
  
  // Image previews reset
  const previewContainer = document.getElementById('imagePreviewContainer');
  previewContainer.classList.add('empty');
  document.getElementById('recipeImagePreview').classList.add('hidden');
  document.getElementById('recipeImagePreview').src = '';
  document.getElementById('removeRecipeImageBtn').classList.add('hidden');

  renderRecipeFormIngredients();
  renderRecipeFormSteps();
  renderDynamicRecipeTags();
  
  showView('RecipeForm');
}

async function openEditRecipeForm(recipe) {
  state.currentEditingRecipeId = recipe.id;
  state.recipeFormIngredients = recipe.ingredients.map(i => ({
    name: i.name,
    quantity: i.quantity,
    unit: i.unit,
    notes: i.notes
  }));
  state.recipeFormSteps = recipe.steps.map(s => ({
    step_number: s.step_number,
    instruction: s.instruction
  }));
  state.recipeFormSelectedTagIds = new Set(recipe.tags.map(t => t.id));

  document.getElementById('recipeFormTitle').textContent = 'Recept Aanpassen';
  document.getElementById('recipeFormId').value = recipe.id;
  document.getElementById('recipeTitleInput').value = recipe.title;
  document.getElementById('recipeDescInput').value = recipe.description || '';
  document.getElementById('recipeServingsInput').value = recipe.servings || '';
  document.getElementById('recipePrepInput').value = recipe.prep_time || '';
  document.getElementById('recipeCookInput').value = recipe.cook_time || '';
  const excludeCheckEdit = document.getElementById('recipeExcludeFromMenuInput');
  if (excludeCheckEdit) excludeCheckEdit.checked = Boolean(recipe.exclude_from_menu);
  document.getElementById('deleteRecipeFormBtn')?.classList.remove('hidden');

  // Image preview handle
  const previewContainer = document.getElementById('imagePreviewContainer');
  const imgEl = document.getElementById('recipeImagePreview');
  const removeBtn = document.getElementById('removeRecipeImageBtn');

  if (recipe.image_path) {
    previewContainer.classList.remove('empty');
    imgEl.src = `/uploads/${recipe.image_path}`;
    imgEl.classList.remove('hidden');
    removeBtn.classList.remove('hidden');
  } else {
    previewContainer.classList.add('empty');
    imgEl.src = '';
    imgEl.classList.add('hidden');
    removeBtn.classList.add('hidden');
  }

  await renderDynamicRecipeTags();
  renderRecipeFormIngredients();
  renderRecipeFormSteps();

  showView('RecipeForm');
}

// Render dynamic tag chip selector & available tags pool
async function renderDynamicRecipeTags() {
  await fetchTags();

  const selectedContainer = document.getElementById('recipeSelectedTags');
  const availableContainer = document.getElementById('recipeAvailableTags');
  if (!selectedContainer || !availableContainer) return;

  // 1. Render selected tags chips with 'x' button
  const selectedTags = state.allTags.filter(t => state.recipeFormSelectedTagIds.has(t.id));

  if (selectedTags.length === 0) {
    selectedContainer.innerHTML = `<span style="color:var(--text-muted); font-size:0.8rem; font-style:italic;">Nog geen tags gekozen. Kies hieronder of typ een nieuwe tag.</span>`;
  } else {
    selectedContainer.innerHTML = selectedTags.map(tag => `
      <span class="tag-chip-selected">
        ${escapeHtml(tag.name)}
        <button type="button" data-remove-tag="${tag.id}" aria-label="Verwijder tag ${escapeHtml(tag.name)}">
          <i data-lucide="x" style="width:14px;height:14px;"></i>
        </button>
      </span>
    `).join('');
  }

  // 2. Render available unselected tags
  const availableTags = state.allTags.filter(t => !state.recipeFormSelectedTagIds.has(t.id));

  if (availableTags.length === 0) {
    availableContainer.innerHTML = `<span style="color:var(--text-muted); font-size:0.8rem; font-style:italic;">Alle beschikbare tags zijn geselecteerd.</span>`;
  } else {
    availableContainer.innerHTML = availableTags.map(tag => `
      <span class="tag-chip-available" data-add-tag="${tag.id}">
        <i data-lucide="plus" style="width:12px;height:12px;"></i>
        ${escapeHtml(tag.name)}
      </span>
    `).join('');
  }

  if (window.lucide) lucide.createIcons();
}

// Add tag dynamically on typing / Enter
async function handleAddDynamicTag() {
  const input = document.getElementById('newTagInput');
  if (!input) return;
  const tagName = input.value.trim();
  if (!tagName) return;

  // Case-insensitive check in local state
  const lower = tagName.toLowerCase();
  let existingTag = state.allTags.find(t => t.name.toLowerCase() === lower);

  if (existingTag) {
    state.recipeFormSelectedTagIds.add(existingTag.id);
    input.value = '';
    renderDynamicRecipeTags();
  } else {
    // Call POST /api/tags to create it dynamically
    try {
      const newTag = await apiFetch('/api/tags', {
        method: 'POST',
        body: JSON.stringify({ name: tagName })
      });

      // Add to global state if not already there
      if (!state.allTags.some(t => t.id === newTag.id)) {
        state.allTags.push(newTag);
        state.allTags.sort((a, b) => a.name.localeCompare(b.name, 'nl', { sensitivity: 'base' }));
      }

      state.recipeFormSelectedTagIds.add(newTag.id);
      input.value = '';
      renderDynamicRecipeTags();
    } catch (err) {
      // Handled in apiFetch
    }
  }
}

document.getElementById('newTagInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleAddDynamicTag();
  }
});

document.getElementById('addNewTagBtn')?.addEventListener('click', handleAddDynamicTag);

// Click delegation on selected tags container (remove tag)
document.getElementById('recipeSelectedTags')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-remove-tag]');
  if (btn) {
    const tagId = parseInt(btn.getAttribute('data-remove-tag'), 10);
    if (!isNaN(tagId)) {
      state.recipeFormSelectedTagIds.delete(tagId);
      renderDynamicRecipeTags();
    }
  }
});

// Click delegation on available tags container (add tag)
document.getElementById('recipeAvailableTags')?.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-add-tag]');
  if (chip) {
    const tagId = parseInt(chip.getAttribute('data-add-tag'), 10);
    if (!isNaN(tagId)) {
      state.recipeFormSelectedTagIds.add(tagId);
      renderDynamicRecipeTags();
    }
  }
});


// Ingredients Builder UI handlers
document.getElementById('addIngBtn')?.addEventListener('click', () => {
  const nameEl = document.getElementById('ingName');
  const qtyEl = document.getElementById('ingQty');
  const unitEl = document.getElementById('ingUnit');

  const name = nameEl.value.trim();
  const qty = qtyEl.value ? parseFloat(qtyEl.value) : null;
  const unit = unitEl.value.trim();

  if (!name) {
    showToast('Ingrediëntnaam is verplicht!', 'error');
    nameEl.focus();
    return;
  }

  state.recipeFormIngredients.push({ name, quantity: qty, unit, notes: '' });
  
  // Clear fields
  nameEl.value = '';
  qtyEl.value = '';
  unitEl.value = '';
  document.getElementById('ingSuggestions').classList.add('hidden');

  renderRecipeFormIngredients();
  nameEl.focus();
});

function renderRecipeFormIngredients() {
  const list = document.getElementById('addedIngredientsList');
  if (!list) return;
  list.innerHTML = '';
  state.recipeFormIngredients.forEach((ing, index) => {
    const li = document.createElement('li');
    const displayQty = ing.quantity ? ing.quantity : '';
    const displayUnit = ing.unit ? ing.unit : '';
    
    li.innerHTML = `
      <span>${displayQty} ${displayUnit} ${escapeHtml(ing.name)}</span>
      <button type="button" class="btn-icon" style="color:var(--danger)" data-remove-ingredient="${index}" aria-label="Verwijder ingrediënt">
        <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
      </button>
    `;
    list.appendChild(li);
  });
  if (window.lucide) lucide.createIcons();
}

function removeFormIngredient(index) {
  state.recipeFormIngredients.splice(index, 1);
  renderRecipeFormIngredients();
}

document.getElementById('addedIngredientsList')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-remove-ingredient]');
  if (btn) {
    const index = parseInt(btn.getAttribute('data-remove-ingredient'), 10);
    if (!isNaN(index)) removeFormIngredient(index);
  }
});

// Recipe Steps Builder UI handlers
document.getElementById('addStepBtn')?.addEventListener('click', () => {
  const stepTextEl = document.getElementById('stepText');
  const instruction = stepTextEl.value.trim();

  if (!instruction) {
    showToast('Stap instructie is verplicht!', 'error');
    stepTextEl.focus();
    return;
  }

  const nextStepNum = state.recipeFormSteps.length + 1;
  state.recipeFormSteps.push({ step_number: nextStepNum, instruction });
  stepTextEl.value = '';

  renderRecipeFormSteps();
  stepTextEl.focus();
});

function renderRecipeFormSteps() {
  const list = document.getElementById('addedStepsList');
  if (!list) return;
  list.innerHTML = '';
  state.recipeFormSteps.forEach((step, index) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${escapeHtml(step.instruction)}</span>
      <button type="button" data-remove-step="${index}" aria-label="Verwijder stap">
        <i data-lucide="x" style="width:16px;height:16px;"></i>
      </button>
    `;
    list.appendChild(li);
  });
  if (window.lucide) lucide.createIcons();
}

function removeFormStep(index) {
  state.recipeFormSteps.splice(index, 1);
  state.recipeFormSteps.forEach((s, idx) => {
    s.step_number = idx + 1;
  });
  renderRecipeFormSteps();
}

document.getElementById('addedStepsList')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-remove-step]');
  if (btn) {
    const index = parseInt(btn.getAttribute('data-remove-step'), 10);
    if (!isNaN(index)) removeFormStep(index);
  }
});

// Handle image preview on upload select
document.getElementById('recipeImageFile')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const previewContainer = document.getElementById('imagePreviewContainer');
    const imgEl = document.getElementById('recipeImagePreview');
    const removeBtn = document.getElementById('removeRecipeImageBtn');

    previewContainer.classList.remove('empty');
    imgEl.src = event.target.result;
    imgEl.classList.remove('hidden');
    removeBtn.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
});

// Remove image click handler
let flagRemoveImage = false;

document.getElementById('removeRecipeImageBtn')?.addEventListener('click', () => {
  document.getElementById('recipeImageFile').value = '';
  
  const previewContainer = document.getElementById('imagePreviewContainer');
  const imgEl = document.getElementById('recipeImagePreview');
  const removeBtn = document.getElementById('removeRecipeImageBtn');

  previewContainer.classList.add('empty');
  imgEl.src = '';
  imgEl.classList.add('hidden');
  removeBtn.classList.add('hidden');
  
  flagRemoveImage = true;
});

// Submit Recipe Form
document.getElementById('recipeForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = document.getElementById('recipeTitleInput').value.trim();
  const description = document.getElementById('recipeDescInput').value.trim();
  const servings = document.getElementById('recipeServingsInput').value;
  const prep_time = document.getElementById('recipePrepInput').value;
  const cook_time = document.getElementById('recipeCookInput').value;
  
  const selectedTagIds = Array.from(state.recipeFormSelectedTagIds);
  const imageFile = document.getElementById('recipeImageFile').files[0];
  const excludeFromMenu = document.getElementById('recipeExcludeFromMenuInput')?.checked ? '1' : '0';

  const formData = new FormData();
  formData.append('title', title);
  formData.append('description', description);
  if (servings) formData.append('servings', servings);
  if (prep_time) formData.append('prep_time', prep_time);
  if (cook_time) formData.append('cook_time', cook_time);
  formData.append('exclude_from_menu', excludeFromMenu);
  
  formData.append('tags', JSON.stringify(selectedTagIds));
  formData.append('ingredients', JSON.stringify(state.recipeFormIngredients));
  formData.append('steps', JSON.stringify(state.recipeFormSteps));

  if (state.currentEditingRecipeId) {
    formData.append('remove_image', flagRemoveImage ? 'true' : 'false');
  }

  if (imageFile) {
    formData.append('image', imageFile);
  }

  let endpoint = '/api/recipes';
  let method = 'POST';

  if (state.currentEditingRecipeId) {
    endpoint += `/${state.currentEditingRecipeId}`;
    method = 'PUT';
  }

  try {
    const response = await apiFetch(endpoint, {
      method,
      body: formData
    });

    showToast(response.message, 'success');
    flagRemoveImage = false;
    showView('Recipes');
  } catch (err) {
    // Handled inside apiFetch
  }
});

// Autocomplete ingredient name suggestions
document.getElementById('ingName')?.addEventListener('input', debounce(async (e) => {
  const name = e.target.value.trim();
  const box = document.getElementById('ingSuggestions');
  if (!box) return;
  
  if (!name) {
    box.innerHTML = '';
    box.classList.add('hidden');
    return;
  }

  try {
    const list = await apiFetch(`/api/ingredients?q=${encodeURIComponent(name)}`);
    if (list.length === 0) {
      box.innerHTML = '';
      box.classList.add('hidden');
      return;
    }

    box.innerHTML = list.map(item => `
      <div class="suggestion-item" data-suggestion="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
    `).join('');
    box.classList.remove('hidden');
  } catch (e) {
    console.error(e);
  }
}, 200));

function selectIngredientSuggestion(name) {
  document.getElementById('ingName').value = name;
  const box = document.getElementById('ingSuggestions');
  if (box) {
    box.classList.add('hidden');
    box.innerHTML = '';
  }
}

document.getElementById('ingSuggestions')?.addEventListener('click', (e) => {
  const item = e.target.closest('[data-suggestion]');
  if (item) {
    const name = item.getAttribute('data-suggestion');
    if (name) selectIngredientSuggestion(name);
  }
});

document.addEventListener('click', (e) => {
  const box = document.getElementById('ingSuggestions');
  if (box && !box.classList.contains('hidden') && e.target.id !== 'ingName') {
    box.classList.add('hidden');
  }
});


// ── SETTINGS VIEW LOGIC (AVATAR & PASSWORD) ───────────────────────────────────
function renderSettingsView() {
  if (!state.user) return;
  const preview = document.getElementById('settingsAvatarPreview');
  const removeBtn = document.getElementById('removeAvatarBtn');

  if (state.user.avatar_path) {
    preview.innerHTML = `<img src="/uploads/${state.user.avatar_path}" alt="${escapeHtml(state.user.username)}">`;
    if (removeBtn) removeBtn.classList.remove('hidden');
  } else {
    const initial = state.user.username.charAt(0).toUpperCase();
    preview.textContent = initial;
    if (removeBtn) removeBtn.classList.add('hidden');
  }

  // Reset password form
  document.getElementById('changePasswordForm')?.reset();
}

// Avatar upload preview
document.getElementById('settingsAvatarInput')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    const preview = document.getElementById('settingsAvatarPreview');
    preview.innerHTML = `<img src="${ev.target.result}" alt="Preview">`;
    const removeBtn = document.getElementById('removeAvatarBtn');
    if (removeBtn) removeBtn.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
});

// Save Avatar form submit
document.getElementById('avatarForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fileInput = document.getElementById('settingsAvatarInput');
  const file = fileInput ? fileInput.files[0] : null;

  if (!file) {
    showToast('Kies eerst een fotobestand om op te slaan.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('avatar', file);

  try {
    const data = await apiFetch('/api/auth/settings', {
      method: 'PUT',
      body: formData
    });

    state.user = data.user;
    updateHeaderUserDisplay();
    renderSettingsView();
    showToast('Profielfoto succesvol opgeslagen!', 'success');
  } catch (err) {
    // Handled in apiFetch
  }
});

// Remove Avatar button
document.getElementById('removeAvatarBtn')?.addEventListener('click', async () => {
  const formData = new FormData();
  formData.append('remove_avatar', 'true');

  try {
    const data = await apiFetch('/api/auth/settings', {
      method: 'PUT',
      body: formData
    });

    state.user = data.user;
    const fileInput = document.getElementById('settingsAvatarInput');
    if (fileInput) fileInput.value = '';

    updateHeaderUserDisplay();
    renderSettingsView();
    showToast('Profielfoto verwijderd.', 'success');
  } catch (err) {
    // Handled in apiFetch
  }
});

// Change Password form submit
document.getElementById('changePasswordForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const current_password = document.getElementById('currentPassword').value;
  const new_password = document.getElementById('newPassword').value;
  const confirm_password = document.getElementById('confirmNewPassword').value;

  if (new_password !== confirm_password) {
    showToast('De nieuwe wachtwoorden komen niet overeen!', 'error');
    return;
  }

  if (new_password.length < 4) {
    showToast('Het nieuwe wachtwoord moet minimaal 4 tekens lang zijn.', 'error');
    return;
  }

  try {
    const data = await apiFetch('/api/auth/settings', {
      method: 'PUT',
      body: JSON.stringify({ current_password, new_password })
    });

    showToast('Wachtwoord succesvol gewijzigd!', 'success');
    e.target.reset();
  } catch (err) {
    // Handled in apiFetch
  }
});


// ── INGREDIENTS BROWSER LOGIC ─────────────────────────────────────────────────
async function loadIngredients() {
  const q = document.getElementById('ingredientSearchInput').value.trim();
  let url = '/api/ingredients';
  if (q) {
    url += `?q=${encodeURIComponent(q)}`;
  }

  try {
    const list = await apiFetch(url);
    renderIngredientsBrowser(list);
  } catch (err) {
    console.error('Error loading ingredients browser:', err);
  }
}

function renderIngredientsBrowser(ingredients) {
  const container = document.getElementById('ingredientsLetterGroups');
  if (!container) return;
  container.innerHTML = '';

  const alphabetNav = document.getElementById('alphabetNav');
  if (alphabetNav) {
    alphabetNav.innerHTML = '';
  }

  if (ingredients.length === 0) {
    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">Geen ingrediënten gevonden.</div>';
    return;
  }

  const groups = {};
  ingredients.forEach(ing => {
    const letter = ing.name.charAt(0).toUpperCase();
    if (!groups[letter]) {
      groups[letter] = [];
    }
    groups[letter].push(ing);
  });

  // Generate A-Z Alphabet Quick Navigation Bar
  if (alphabetNav) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    alphabet.forEach(letter => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'alphabet-nav-btn';
      btn.textContent = letter;

      if (groups[letter] && groups[letter].length > 0) {
        btn.classList.add('has-items');
        btn.title = `${groups[letter].length} ingrediënten met ${letter}`;
        btn.addEventListener('click', () => {
          const targetGroup = document.getElementById(`ingredient-group-${letter}`);
          if (targetGroup) {
            targetGroup.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      } else {
        btn.classList.add('disabled');
        btn.disabled = true;
      }
      alphabetNav.appendChild(btn);
    });
  }

  const sortedLetters = Object.keys(groups).sort();

  sortedLetters.forEach(letter => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'ingredient-letter-group';
    groupDiv.id = `ingredient-group-${letter}`;

    const header = document.createElement('h3');
    header.className = 'ingredient-letter-header';
    header.textContent = letter;

    const ul = document.createElement('ul');
    ul.className = 'ingredient-list';

    groups[letter].forEach(ing => {
      const li = document.createElement('li');
      li.className = 'ingredient-list-item';
      li.innerHTML = `<span>${escapeHtml(ing.name)}</span>`;
      ul.appendChild(li);
    });

    groupDiv.appendChild(header);
    groupDiv.appendChild(ul);
    container.appendChild(groupDiv);
  });
}

document.getElementById('ingredientSearchInput')?.addEventListener('input', debounce(loadIngredients, 300));


// ── USER MANAGEMENT FUNCTIONS (ADMIN ONLY) ────────────────────────────────────
async function loadUsers() {
  if (!state.user || (state.user.is_admin != 1 && state.user.is_admin !== true)) return;
  try {
    const users = await apiFetch('/api/auth/users');
    const list = document.getElementById('adminUsersList');
    if (list) {
      list.innerHTML = '';
      
      users.forEach(user => {
        const li = document.createElement('li');
        const isSelf = user.id === state.user.id;
        const roleText = (user.is_admin == 1 || user.is_admin === true) ? 'Beheerder' : 'Gebruiker';
        
        li.innerHTML = `
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <div style="width:28px;height:28px;border-radius:50%;background:var(--secondary);color:white;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;overflow:hidden;">
              ${user.avatar_path ? `<img src="/uploads/${user.avatar_path}" style="width:100%;height:100%;object-fit:cover;">` : user.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <strong>${escapeHtml(user.username)}</strong>
              <span style="font-size:0.75rem; color:var(--text-muted); margin-left:0.5rem; background:var(--white); border: 1px solid var(--border); padding:0.1rem 0.4rem; border-radius:var(--radius-pill);">${roleText}</span>
            </div>
          </div>
          ${!isSelf ? `
            <button type="button" class="btn-icon" style="color:var(--danger)" data-delete-user="${user.id}" title="Verwijder gebruiker">
              <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
            </button>
          ` : '<span style="font-size:0.75rem; color:var(--text-muted); font-style:italic;">Jij</span>'}
        `;
        list.appendChild(li);
      });
    }
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error('Error in loadUsers:', err);
  }
}

document.getElementById('adminUsersList')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-delete-user]');
  if (btn) {
    const userId = btn.getAttribute('data-delete-user');
    if (userId) deleteUser(userId);
  }
});

async function deleteUser(userId) {
  if (!confirm('Weet je zeker dat je deze gebruiker wilt verwijderen? Dit verwijdert ook alle recepten van deze gebruiker.')) {
    return;
  }
  try {
    const response = await apiFetch(`/api/auth/users/${userId}`, {
      method: 'DELETE'
    });
    showToast(response.message, 'success');
    loadUsers();
  } catch (err) {
    // Handled in apiFetch
  }
}

document.getElementById('adminCreateUserForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('adminNewUsername').value.trim();
  const password = document.getElementById('adminNewPassword').value;
  const is_admin = document.getElementById('adminNewIsAdmin').checked;

  try {
    const response = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, is_admin })
    });
    showToast(response.message, 'success');
    e.target.reset();
    loadUsers();
  } catch (err) {
    // Handled in apiFetch
  }
});


// ── BACKEND CACHING FETCHES ───────────────────────────────────────────────────
async function fetchTags() {
  try {
    state.allTags = await apiFetch('/api/tags');
  } catch (e) {
    console.error(e);
  }
}

async function fetchAllRecipesCache() {
  try {
    state.allRecipes = await apiFetch('/api/recipes');
  } catch (e) {
    console.error(e);
  }
}


// ── GLOBAL REGISTRATION HANDLERS ──────────────────────────────────────────────
document.getElementById('addNewRecipeBtn')?.addEventListener('click', openAddRecipeForm);
document.getElementById('cancelRecipeFormBtn')?.addEventListener('click', () => showView('Recipes'));
document.getElementById('cancelRecipeFormBottomBtn')?.addEventListener('click', () => showView('Recipes'));
document.getElementById('deleteRecipeFormBtn')?.addEventListener('click', () => {
  if (state.currentEditingRecipeId) {
    deleteCurrentRecipe(state.currentEditingRecipeId);
  }
});

// Generic modal close handler for [data-close-modal]
document.addEventListener('click', (e) => {
  const closeBtn = e.target.closest('[data-close-modal]');
  if (closeBtn) {
    const modalId = closeBtn.getAttribute('data-close-modal');
    const modal = document.getElementById(modalId);
    if (modal && typeof modal.close === 'function') {
      modal.close();
    }
  }
});

// Light-dismiss dialog click fallback
document.querySelectorAll('dialog[closedby="any"]').forEach(dialog => {
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isDialogContent = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      );
      if (isDialogContent) return;
      dialog.close();
    });
  }
});


// ── HELPERS ───────────────────────────────────────────────────────────────────
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

// ── BOOTSTRAP APP ─────────────────────────────────────────────────────────────
checkAuth();
