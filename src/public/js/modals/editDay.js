'use strict';

// ── MODAL: EDIT DAY (SEARCHABLE COMBOBOX & SUGGESTIONS) ────────────────────────
(function(App) {

  async function openEditDayModal(date, currentRecipeId, isSkipped, currentNotes, currentServings = null) {
    const modal = document.getElementById('editDayModal');
    
    document.getElementById('editDayDate').value = date;
    document.getElementById('editDaySkipPlanning').checked = isSkipped;
    document.getElementById('editDayNotes').value = currentNotes || '';
    
    App.state.currentEditDayRecipeId = currentRecipeId || null;
    document.getElementById('editDayRecipeSelect').value = currentRecipeId || '';

    // Cache recipes
    await App.fetchAllRecipesCache();

    // Servings handling
    const servingsInput = document.getElementById('editDayServings');
    if (servingsInput) {
      if (currentServings && currentServings > 0) {
        servingsInput.value = currentServings;
      } else if (currentRecipeId) {
        const recipe = App.state.allRecipes.find(r => r.id === currentRecipeId);
        servingsInput.value = (recipe && recipe.servings) ? recipe.servings : (App.state.user?.default_servings || 4);
      } else {
        servingsInput.value = App.state.user?.default_servings || 4;
      }
    }

    // Search input reset
    const searchInput = document.getElementById('editDayDishSearch');
    searchInput.value = '';

    updateSelectedRecipeBanner();
    renderDishSuggestions('');

    const recipeGroup = document.getElementById('editDayRecipeGroup');
    const servingsGroup = document.getElementById('editDayServingsGroup');

    if (isSkipped) {
      if (recipeGroup) recipeGroup.classList.add('hidden');
      if (servingsGroup) servingsGroup.classList.add('hidden');
    } else {
      if (recipeGroup) recipeGroup.classList.remove('hidden');
      if (servingsGroup) servingsGroup.classList.remove('hidden');
    }

    // Toggle recipe and servings group visibility on skip checkbox
    document.getElementById('editDaySkipPlanning').onchange = (e) => {
      if (e.target.checked) {
        if (recipeGroup) recipeGroup.classList.add('hidden');
        if (servingsGroup) servingsGroup.classList.add('hidden');
      } else {
        if (recipeGroup) recipeGroup.classList.remove('hidden');
        if (servingsGroup) servingsGroup.classList.remove('hidden');
      }
    };

    modal.showModal();
    if (window.lucide) lucide.createIcons();
  }

  // Stepper handlers for editDayModal
  document.getElementById('editDayServingsDecBtn')?.addEventListener('click', () => {
    const input = document.getElementById('editDayServings');
    if (!input) return;
    const val = parseInt(input.value, 10) || 4;
    if (val > 1) {
      input.value = val - 1;
    }
  });

  document.getElementById('editDayServingsIncBtn')?.addEventListener('click', () => {
    const input = document.getElementById('editDayServings');
    if (!input) return;
    const val = parseInt(input.value, 10) || 4;
    if (val < 50) {
      input.value = val + 1;
    }
  });

  function updateSelectedRecipeBanner() {
    const banner = document.getElementById('editDaySelectedRecipeBanner');
    const titleEl = document.getElementById('editDaySelectedRecipeTitle');
    const hiddenInput = document.getElementById('editDayRecipeSelect');

    if (App.state.currentEditDayRecipeId) {
      const recipe = App.state.allRecipes.find(r => r.id === App.state.currentEditDayRecipeId);
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
    App.state.currentEditDayRecipeId = null;
    updateSelectedRecipeBanner();
    renderDishSuggestions(document.getElementById('editDayDishSearch').value);
  });

  function renderDishSuggestions(query = '') {
    const container = document.getElementById('editDayDishSuggestions');
    if (!container) return;

    const qClean = query.trim().toLowerCase();
    let filtered = App.state.allRecipes;

    if (qClean) {
      filtered = App.state.allRecipes.filter(r => {
        const matchTitle = r.title.toLowerCase().includes(qClean);
        const matchDesc = r.description ? r.description.toLowerCase().includes(qClean) : false;
        const matchTags = r.tags ? r.tags.some(t => t.name.toLowerCase().includes(qClean)) : false;
        return matchTitle || matchDesc || matchTags;
      });
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="padding: 0.75rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
          Geen recepten gevonden voor "${App.escapeHtml(query)}".
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.slice(0, 15).map(recipe => {
      const isSelected = recipe.id === App.state.currentEditDayRecipeId;
      const thumbHtml = recipe.image_path 
        ? `<img src="/uploads/${recipe.image_path}" class="dish-suggestion-thumb" alt="${App.escapeHtml(recipe.title)}">` 
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
            <div class="dish-suggestion-title">${App.escapeHtml(recipe.title)}</div>
            <div class="dish-suggestion-meta">
              ${timeStr ? `⏱️ ${timeStr}` : ''} ${tagsStr ? `• 🏷️ ${App.escapeHtml(tagsStr)}` : ''}
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
      App.state.currentEditDayRecipeId = dishId;
      updateSelectedRecipeBanner();
      renderDishSuggestions(document.getElementById('editDayDishSearch').value);

      const selRecipe = App.state.allRecipes.find(r => r.id === dishId);
      const servingsInput = document.getElementById('editDayServings');
      if (servingsInput && selRecipe && selRecipe.servings) {
        // If current value is empty, update with recipe's base servings
        if (!servingsInput.value) {
          servingsInput.value = selRecipe.servings;
        }
      }
    }
  });

  // Save day changes
  document.getElementById('saveDayChangesBtn')?.addEventListener('click', async () => {
    const modal = document.getElementById('editDayModal');
    const date = document.getElementById('editDayDate').value;
    const skip = document.getElementById('editDaySkipPlanning').checked;
    const recipeId = App.state.currentEditDayRecipeId;
    const notes = document.getElementById('editDayNotes').value;
    const servingsInput = document.getElementById('editDayServings');
    const servingsVal = servingsInput ? parseInt(servingsInput.value, 10) : (App.state.user?.default_servings || 4);

    const payload = {
      planned_on: date,
      recipe_id: skip ? null : (recipeId || null),
      servings: skip ? null : (servingsVal || 4),
      notes: notes,
      skip_planning: skip ? 1 : 0
    };

    try {
      await App.apiFetch('/api/meal-plan/save', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      App.showToast('Aanpassing opgeslagen!', 'success');
      modal.close();
      App.loadWeekPlanning(App.state.currentWeekMonday);
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
      const response = await App.apiFetch(`/api/meal-plan/entry/${date}`, {
        method: 'DELETE'
      });
      
      App.showToast(response.message || 'Dag leeggemaakt!', 'success');
      modal.close();
      App.loadWeekPlanning(App.state.currentWeekMonday);
    } catch (err) {
      // Handled in apiFetch
    }
  });

  App.openEditDayModal = openEditDayModal;

})(window.App);
