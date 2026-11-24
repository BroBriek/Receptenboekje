'use strict';

// ── MODAL: GENERATE WEEK MENU ─────────────────────────────────────────────────
(function(App) {

  document.getElementById('openGenerateModalBtn')?.addEventListener('click', async () => {
    const modal = document.getElementById('generateMenuModal');
    
    // Reset day exclusions checkboxes on open
    document.querySelectorAll('input[name="exclude_day"]').forEach(cb => cb.checked = false);

    // Fetch latest shared week locks and tags from server in parallel
    await Promise.all([
      typeof App.refreshWeekPlanningSilent === 'function'
        ? App.refreshWeekPlanningSilent(true)
        : Promise.resolve(),
      App.fetchTags()
    ]);

    // Render locked days notice inside the info box (ordered Mon-Sun from server data)
    const lockedNoticeContainer = document.getElementById('modalLockedDaysNotice');
    if (lockedNoticeContainer) {
      const lockedItems = (App.state.currentMealPlan || []).filter(
        p => p.entry && (p.entry.is_locked === 1 || p.entry.is_locked === true) && p.entry.recipe_id && p.entry.skip_planning !== 1
      );
      if (lockedItems.length > 0) {
        const lockedBadges = lockedItems.map(item => {
          const name = item.dayName || item.date;
          return `<span class="locked-badge"><i data-lucide="lock" style="width:12px;height:12px;"></i> ${App.escapeHtml(name)}</span>`;
        }).join('');

        lockedNoticeContainer.innerHTML = `
          <div class="locked-notice-header">
            <i data-lucide="shield-check" class="locked-notice-icon"></i>
            <span><strong>${lockedItems.length} ${lockedItems.length === 1 ? 'dag is' : 'dagen zijn'} vergrendeld:</strong> ${lockedItems.length === 1 ? 'deze wordt' : 'deze worden'} behouden</span>
          </div>
          <div class="locked-badges-list">${lockedBadges}</div>
        `;
      } else {
        lockedNoticeContainer.innerHTML = `
          <div class="locked-notice-header empty">
            <i data-lucide="info" class="locked-notice-icon"></i>
            <span><strong>Geen dagen vergrendeld:</strong> alle 7 dagen worden opnieuw gepland.</span>
          </div>
        `;
      }
    }

    // Render tags selection in modal as category chips
    const tagsGrid = document.getElementById('generateTagsGrid');
    if (tagsGrid) {
      if (App.state.allTags && App.state.allTags.length > 0) {
        tagsGrid.innerHTML = App.state.allTags.map(tag => `
          <label class="category-chip">
            <input type="checkbox" name="gen_tag" value="${tag.id}" class="category-chip-input">
            <span class="category-chip-body">
              <i data-lucide="check" class="category-chip-check"></i>
              <span class="category-chip-name">${App.escapeHtml(tag.name)}</span>
            </span>
          </label>
        `).join('');
      } else {
        tagsGrid.innerHTML = '<span style="color:var(--text-muted); font-size:0.85rem;">Geen categorieën gevonden.</span>';
      }
    }
    
    modal.showModal();
    if (window.lucide) lucide.createIcons();
  });

  // Action button: Clear category tags selection
  document.getElementById('clearTagsSelectionBtn')?.addEventListener('click', () => {
    document.querySelectorAll('input[name="gen_tag"]:checked').forEach(cb => cb.checked = false);
  });

  // Run generation algorithm (preventing duplicate dishes in a week)
  document.getElementById('confirmGenerateMenuBtn')?.addEventListener('click', async () => {
    const modal = document.getElementById('generateMenuModal');
    
    const [y, m, d] = App.state.currentWeekMonday.split('-').map(Number);
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

    if (typeof App.waitForPendingLocks === 'function') {
      await App.waitForPendingLocks();
    }

    const payload = {
      start_date: App.state.currentWeekMonday,
      excluded_days,
      tag_ids
    };

    try {
      const response = await App.apiFetch('/api/meal-plan/generate', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      if (response.warning) {
        App.showToast(response.warning, 'error');
      } else {
        App.showToast(response.message, 'success');
      }
      
      modal.close();
      App.loadWeekPlanning(App.state.currentWeekMonday);
    } catch (err) {
      // Handled inside apiFetch
    }
  });

})(window.App);
