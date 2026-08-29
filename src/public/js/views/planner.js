'use strict';

// ── PLANNER LOGIC (WEEK, MONTH CALENDAR & UNPLANNED DISHES) ───────────────────
(function(App) {

  const monthNamesDutch = [
    'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
    'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
  ];

  // Helper to format relative time in Dutch
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

  // ── 1. WEEK PLANNING ────────────────────────────────────────────────────────
  async function loadWeekPlanning(mondayStr = null) {
    let url = '/api/meal-plan';
    if (mondayStr) {
      url += `?start_date=${mondayStr}`;
    }

    try {
      const data = await App.apiFetch(url);
      App.state.currentWeekMonday = data.monday;
      App.state.currentMealPlan = data.plan;
      
      // Update week title
      const [y, m, d] = App.state.currentWeekMonday.split('-').map(Number);
      const sunDate = new Date(y, m - 1, d + 6);
      
      const monStr = App.formatDutchDate(App.state.currentWeekMonday);
      const sunStr = App.formatDutchDate(`${sunDate.getFullYear()}-${String(sunDate.getMonth() + 1).padStart(2, '0')}-${String(sunDate.getDate()).padStart(2, '0')}`);
      
      document.getElementById('weekTitle').textContent = `${monStr} t/m ${sunStr} (${sunDate.getFullYear()})`;
      
      renderPlanner(data.plan);

      // Also refresh month calendar & unplanned dishes to stay in sync
      const activeYear = y;
      const activeMonth = m; // Month of Monday
      loadMonthCalendar(App.state.calendarYear || activeYear, App.state.calendarMonth || activeMonth);
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

    const todayStr = App.getTodayDateString();

    plan.forEach(({ date, dayName, entry }) => {
      const isToday = date === todayStr;
      const isSkipped = entry.skip_planning === 1;
      const isLocked = App.state.lockedDates.has(date);
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
        imageHtml = `<img src="/uploads/${entry.recipe_image}" alt="${App.escapeHtml(entry.recipe_title)}" class="planning-thumb clickable" data-view-recipe="${entry.recipe_id}">`;
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
                <div class="planning-notes-compact" data-view-note="${App.escapeQuotes(entry.notes)}" data-day="${dayName}" data-date="${date}" title="Klik om notitie te lezen">
                  <i data-lucide="sticky-note" style="width:12px;height:12px;flex-shrink:0;"></i>
                  <span>${App.escapeHtml(entry.notes)}</span>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      } else if (hasRecipe) {
        const dayServings = entry.servings || entry.recipe_servings || App.state.user?.default_servings || 4;

        mealContentHtml = `
          <div class="planning-main">
            ${imageHtml}
            <div class="planning-info">
              <div class="planning-meal-header-row">
                <span class="planning-meal-title clickable" data-view-recipe="${entry.recipe_id}">${App.escapeHtml(entry.recipe_title)}</span>
              </div>
              <div class="planning-meta-row">
                <div class="planning-servings-badge" title="Aantal personen voor deze dag: klik op - of + om aan te passen" data-date="${date}">
                  <button type="button" class="planning-servings-step-btn" data-change-servings="${date}" data-delta="-1" title="Minder personen" aria-label="Minder personen">
                    <i data-lucide="minus"></i>
                  </button>
                  <span class="planning-servings-text"><i data-lucide="users"></i> <strong class="planning-servings-val">${dayServings}</strong> pers.</span>
                  <button type="button" class="planning-servings-step-btn" data-change-servings="${date}" data-delta="1" title="Meer personen" aria-label="Meer personen">
                    <i data-lucide="plus"></i>
                  </button>
                </div>
                ${hasNotes ? `
                  <div class="planning-notes-compact" data-view-note="${App.escapeQuotes(entry.notes)}" data-day="${dayName}" data-date="${date}" title="Klik om notitie te lezen">
                    <i data-lucide="sticky-note" style="width:12px;height:12px;flex-shrink:0;"></i>
                    <span>${App.escapeHtml(entry.notes)}</span>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      } else if (hasNotes) {
        mealContentHtml = `
          <div class="planning-main" style="width:100%;">
            <div class="planning-note-card" data-view-note="${App.escapeQuotes(entry.notes)}" data-day="${dayName}" data-date="${date}" title="Klik om notitie te bekijken of aan te passen">
              <i data-lucide="sticky-note" class="planning-note-card-icon"></i>
              <div class="planning-note-card-body">
                <div class="planning-note-text">${App.escapeHtml(entry.notes)}</div>
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

      // Action buttons
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
    if (App.state.lockedDates.has(date)) {
      App.state.lockedDates.delete(date);
    } else {
      App.state.lockedDates.add(date);
    }
    loadWeekPlanning(App.state.currentWeekMonday);
  }


  // ── 2. MONTH CALENDAR OVERVIEW ──────────────────────────────────────────────
  async function loadMonthCalendar(year = null, month = null) {
    const today = new Date();
    const y = year || App.state.calendarYear || today.getFullYear();
    const m = month || App.state.calendarMonth || (today.getMonth() + 1);

    try {
      const data = await App.apiFetch(`/api/meal-plan/month?year=${y}&month=${m}`);
      App.state.calendarYear = data.year;
      App.state.calendarMonth = data.month;
      App.state.currentCalendarData = data;

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

    // Compute month stats
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

    // Grid rendering
    gridEl.innerHTML = '';

    // Calculate weekday of 1st day (0 = Mon, 6 = Sun)
    const firstDate = new Date(data.year, data.month - 1, 1);
    let startDayOfWeek = firstDate.getDay() - 1; // 0 = Mon
    if (startDayOfWeek === -1) startDayOfWeek = 6; // Sunday

    // Leading empty cells
    for (let i = 0; i < startDayOfWeek; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.className = 'cal-day-cell other-month';
      gridEl.appendChild(emptyCell);
    }

    const todayStr = App.getTodayDateString();

    // Active week dates set for visual highlighting
    const activeWeekDates = new Set();
    if (App.state.currentWeekMonday) {
      const [wy, wm, wd] = App.state.currentWeekMonday.split('-').map(Number);
      for (let i = 0; i < 7; i++) {
        const d = new Date(wy, wm - 1, wd + i);
        const yStr = d.getFullYear();
        const mStr = String(d.getMonth() + 1).padStart(2, '0');
        const dtStr = String(d.getDate()).padStart(2, '0');
        activeWeekDates.add(`${yStr}-${mStr}-${dtStr}`);
      }
    }

    // Render month days
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
          contentHtml = `<div class="cal-dish-badge" title="${App.escapeHtml(entry.recipe_title)}">${App.escapeHtml(entry.recipe_title)}</div>`;
        } else if (entry.notes) {
          contentHtml = `<span class="cal-note-badge" title="${App.escapeQuotes(entry.notes)}"><i data-lucide="sticky-note" style="width:14px;height:14px;"></i></span>`;
        }
      }

      const cell = document.createElement('div');
      cell.className = `cal-day-cell ${isToday ? 'is-today' : ''} ${isActiveWeek ? 'is-active-week' : ''}`;
      cell.setAttribute('data-cal-date', dateKey);
      cell.setAttribute('title', entry && entry.recipe_title ? `${dateKey}: ${entry.recipe_title}\n(Klik: selecteer week | Dubbelklik / lang indrukken: bewerk dag)` : `${dateKey}\n(Klik: selecteer week | Dubbelklik / lang indrukken: bewerk dag)`);

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


  // ── 3. UNPLANNED DISHES WIDGET ─────────────────────────────────────────────
  async function loadUnplannedDishes() {
    const gridEl = document.getElementById('unplannedDishesGrid');
    if (!gridEl) return;

    try {
      const data = await App.apiFetch('/api/meal-plan/unplanned-dishes?limit=12');
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
        ? `<img src="/uploads/${dish.image_path}" class="unplanned-dish-thumb clickable" data-view-recipe="${dish.id}" alt="${App.escapeHtml(dish.title)}">`
        : `<div class="unplanned-dish-thumb-placeholder clickable" data-view-recipe="${dish.id}"><i data-lucide="utensils" style="width:20px;height:20px;"></i></div>`;

      const card = document.createElement('div');
      card.className = 'unplanned-dish-card';
      card.innerHTML = `
        <div class="unplanned-dish-top">
          ${thumbHtml}
          <div class="unplanned-dish-info">
            <div class="unplanned-dish-title" data-view-recipe="${dish.id}" title="${App.escapeHtml(dish.title)}">
              ${App.escapeHtml(dish.title)}
            </div>
            <span class="last-planned-badge ${rel.isNever ? 'never' : ''}">
              ${rel.text}
            </span>
          </div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm unplanned-dish-btn" 
          data-quick-plan-id="${dish.id}" 
          data-quick-plan-title="${App.escapeQuotes(dish.title)}" 
          data-quick-plan-img="${dish.image_path || ''}" 
          data-quick-plan-meta="${App.escapeQuotes(rel.text)}">
          <i data-lucide="plus" style="width:14px;height:14px;"></i> Inplannen
        </button>
      `;

      gridEl.appendChild(card);
    });

    if (window.lucide) lucide.createIcons();
  }


  // ── 4. QUICK PLAN MODAL ───────────────────────────────────────────────────
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

    // Populate week dates select dropdown
    const selectEl = document.getElementById('quickPlanDateSelect');
    selectEl.innerHTML = '';

    if (App.state.currentWeekMonday) {
      const dayNames = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];
      const [y, m, d] = App.state.currentWeekMonday.split('-').map(Number);

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

    // Set custom date default
    document.getElementById('quickPlanCustomDate').value = selectEl.value || App.getTodayDateString();

    // Servings prefill
    const servingsInput = document.getElementById('quickPlanServings');
    if (servingsInput) {
      servingsInput.value = App.state.user?.default_servings || 4;
    }

    // Sync select & date input
    selectEl.onchange = () => {
      document.getElementById('quickPlanCustomDate').value = selectEl.value;
    };

    modal.showModal();
    if (window.lucide) lucide.createIcons();
  }

  // Stepper handlers for quickPlanModal
  document.getElementById('quickPlanServingsDecBtn')?.addEventListener('click', () => {
    const input = document.getElementById('quickPlanServings');
    if (!input) return;
    const val = parseInt(input.value, 10) || 4;
    if (val > 1) input.value = val - 1;
  });

  document.getElementById('quickPlanServingsIncBtn')?.addEventListener('click', () => {
    const input = document.getElementById('quickPlanServings');
    if (!input) return;
    const val = parseInt(input.value, 10) || 4;
    if (val < 50) input.value = val + 1;
  });


  // ── EVENT LISTENERS & SETUP ───────────────────────────────────────────────
  
  // Week navigation
  document.getElementById('prevWeekBtn')?.addEventListener('click', () => {
    const [y, m, d] = App.state.currentWeekMonday.split('-').map(Number);
    const prevMon = new Date(y, m - 1, d - 7);
    const formatted = `${prevMon.getFullYear()}-${String(prevMon.getMonth() + 1).padStart(2, '0')}-${String(prevMon.getDate()).padStart(2, '0')}`;
    App.state.lockedDates.clear();
    loadWeekPlanning(formatted);
  });

  document.getElementById('nextWeekBtn')?.addEventListener('click', () => {
    const [y, m, d] = App.state.currentWeekMonday.split('-').map(Number);
    const nextMon = new Date(y, m - 1, d + 7);
    const formatted = `${nextMon.getFullYear()}-${String(nextMon.getMonth() + 1).padStart(2, '0')}-${String(nextMon.getDate()).padStart(2, '0')}`;
    App.state.lockedDates.clear();
    loadWeekPlanning(formatted);
  });

  // Month navigation
  document.getElementById('prevMonthBtn')?.addEventListener('click', () => {
    let y = App.state.calendarYear || new Date().getFullYear();
    let m = (App.state.calendarMonth || (new Date().getMonth() + 1)) - 1;
    if (m < 1) {
      m = 12;
      y--;
    }
    loadMonthCalendar(y, m);
  });

  document.getElementById('nextMonthBtn')?.addEventListener('click', () => {
    let y = App.state.calendarYear || new Date().getFullYear();
    let m = (App.state.calendarMonth || (new Date().getMonth() + 1)) + 1;
    if (m > 12) {
      m = 1;
      y++;
    }
    loadMonthCalendar(y, m);
  });

  document.getElementById('todayMonthBtn')?.addEventListener('click', () => {
    const today = new Date();
    loadMonthCalendar(today.getFullYear(), today.getMonth() + 1);
  });

  // Refresh unplanned dishes
  document.getElementById('refreshUnplannedBtn')?.addEventListener('click', () => {
    loadUnplannedDishes();
    App.showToast('Suggesties vernieuwd!', 'success');
  });

  // Quick Plan Confirmation
  document.getElementById('confirmQuickPlanBtn')?.addEventListener('click', async () => {
    const modal = document.getElementById('quickPlanModal');
    const recipeId = document.getElementById('quickPlanRecipeId').value;
    const date = document.getElementById('quickPlanCustomDate').value || document.getElementById('quickPlanDateSelect').value;
    const notes = document.getElementById('quickPlanNotes').value;
    const servings = parseInt(document.getElementById('quickPlanServings')?.value, 10) || (App.state.user?.default_servings || 4);

    if (!recipeId || !date) {
      App.showToast('Selecteer een datum voor het inplannen.', 'error');
      return;
    }

    try {
      await App.apiFetch('/api/meal-plan/save', {
        method: 'POST',
        body: JSON.stringify({
          planned_on: date,
          recipe_id: recipeId,
          servings: servings,
          notes: notes,
          skip_planning: 0
        })
      });

      App.showToast('Gerecht succesvol ingepland!', 'success');
      modal.close();
      loadWeekPlanning(App.state.currentWeekMonday);
    } catch (err) {
      // Handled in apiFetch
    }
  });

  // Event Delegation for Planner View (week cards, calendar cells, unplanned dishes)
  document.getElementById('viewPlanner')?.addEventListener('click', (e) => {
    // 1. Change day servings directly on planning card
    const changeServingsBtn = e.target.closest('[data-change-servings]');
    if (changeServingsBtn) {
      e.stopPropagation();
      const date = changeServingsBtn.getAttribute('data-change-servings');
      const delta = parseInt(changeServingsBtn.getAttribute('data-delta'), 10);
      const planItem = App.state.currentMealPlan ? App.state.currentMealPlan.find(item => item.date === date) : null;
      const entry = planItem ? planItem.entry : null;

      if (entry && entry.recipe_id) {
        const currentVal = entry.servings || entry.recipe_servings || App.state.user?.default_servings || 4;
        const newVal = Math.max(1, Math.min(50, currentVal + delta));

        if (newVal !== currentVal) {
          entry.servings = newVal;
          // Optimistically update badge in card
          const card = changeServingsBtn.closest('.planning-card');
          if (card) {
            const valEl = card.querySelector('.planning-servings-val');
            if (valEl) valEl.textContent = newVal;
          }

          // Save to backend
          App.apiFetch('/api/meal-plan/save', {
            method: 'POST',
            body: JSON.stringify({
              planned_on: date,
              recipe_id: entry.recipe_id,
              servings: newVal,
              notes: entry.notes || '',
              skip_planning: 0
            })
          }).catch(err => {
            console.error('Failed to update servings on card:', err);
          });
        }
      }
      return;
    }

    // 2. Quick Plan button click
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
        selectWeekForDate(date);
        return;
      }
    }

    // 4. View Note
    const noteElem = e.target.closest('[data-view-note]');
    if (noteElem) {
      const fullNote = noteElem.getAttribute('data-view-note');
      const day = noteElem.getAttribute('data-day') || 'Dag';
      const date = noteElem.getAttribute('data-date');
      if (fullNote) {
        App.openViewNoteModal(day, date, fullNote);
        return;
      }
    }

    // 5. View Recipe Details
    const mealTitle = e.target.closest('[data-view-recipe]');
    if (mealTitle) {
      const recipeId = mealTitle.getAttribute('data-view-recipe');
      const card = mealTitle.closest('.planning-card');
      const date = card ? card.getAttribute('data-date') : null;
      const planItem = App.state.currentMealPlan ? App.state.currentMealPlan.find(item => item.date === date) : null;
      const entry = planItem ? planItem.entry : null;
      const dayServings = entry ? (entry.servings || entry.recipe_servings || App.state.user?.default_servings || 4) : null;

      if (recipeId) App.viewRecipeDetails(recipeId, { fromRecipeTab: false, servings: dayServings });
      return;
    }

    // 6. Lock date
    const lockBtn = e.target.closest('[data-lock-date]');
    if (lockBtn) {
      const date = lockBtn.getAttribute('data-lock-date');
      if (date) toggleLockDate(date);
      return;
    }

    // 7. Edit day
    const editBtn = e.target.closest('[data-edit-date]');
    if (editBtn) {
      const date = editBtn.getAttribute('data-edit-date');
      const planItem = App.state.currentMealPlan ? App.state.currentMealPlan.find(item => item.date === date) : null;
      const entry = planItem ? planItem.entry : null;
      const recipeId = entry && entry.recipe_id ? entry.recipe_id : '';
      const isSkipped = entry ? (entry.skip_planning == 1 || entry.skip_planning === true) : false;
      const notes = entry && entry.notes ? entry.notes : '';
      const servings = entry ? (entry.servings || entry.recipe_servings || App.state.user?.default_servings || 4) : (App.state.user?.default_servings || 4);
      App.openEditDayModal(date, recipeId, isSkipped, notes, servings);
      return;
    }
  });

  // Helper: Open Edit Day modal for a calendar date
  function openCalendarDayEdit(date) {
    if (!date) return;
    const entry = App.state.currentCalendarData && App.state.currentCalendarData.entries
      ? App.state.currentCalendarData.entries[date]
      : null;
    
    const recipeId = entry ? entry.recipe_id : '';
    const isSkipped = entry ? (entry.skip_planning == 1 || entry.skip_planning === true) : false;
    const notes = entry ? entry.notes : '';
    const servings = entry ? (entry.servings || entry.recipe_servings || App.state.user?.default_servings || 4) : (App.state.user?.default_servings || 4);

    App.openEditDayModal(date, recipeId, isSkipped, notes, servings);
  }

  // Helper: Select the week containing a specific date
  function selectWeekForDate(date) {
    if (!date) return;
    const [y, m, d] = date.split('-').map(Number);
    const cellDate = new Date(y, m - 1, d);
    const dayOfWeek = cellDate.getDay();
    const diff = cellDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const mondayDate = new Date(y, m - 1, diff);

    const mY = mondayDate.getFullYear();
    const mM = String(mondayDate.getMonth() + 1).padStart(2, '0');
    const mD = String(mondayDate.getDate()).padStart(2, '0');
    const mondayStr = `${mY}-${mM}-${mD}`;

    if (App.state.currentWeekMonday !== mondayStr) {
      loadWeekPlanning(mondayStr);
    }
  }

  // Long-press and Double-click detection for Month Calendar
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
    // Pointer down: initiate long press timer
    plannerViewEl.addEventListener('pointerdown', (e) => {
      const calCell = e.target.closest('[data-cal-date]');
      if (!calCell) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return; // Primary button only

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

          // Suppress pointerup/mouseup/touchend/click from releasing the finger
          // so the newly opened dialog doesn't immediately close on backdrop click
          suppressNextPointerRelease();

          if (navigator.vibrate) {
            try { navigator.vibrate(40); } catch (_) {}
          }
          openCalendarDayEdit(targetDate);
        }
      }, 500);
    });

    // Pointer move: cancel long press if moved significantly (e.g. scrolling)
    plannerViewEl.addEventListener('pointermove', (e) => {
      if (!longPressTimer) return;
      const moveX = Math.abs(e.clientX - pointerStartX);
      const moveY = Math.abs(e.clientY - pointerStartY);
      if (moveX > 10 || moveY > 10) {
        clearLongPressTimer();
      }
    });

    // Pointer up/cancel/leave: clear timer
    plannerViewEl.addEventListener('pointerup', () => {
      clearLongPressTimer();
    });
    plannerViewEl.addEventListener('pointercancel', () => {
      clearLongPressTimer();
    });

    // Double click: open edit modal directly
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

  App.loadWeekPlanning = loadWeekPlanning;
  App.loadMonthCalendar = loadMonthCalendar;
  App.loadUnplannedDishes = loadUnplannedDishes;

})(window.App);
