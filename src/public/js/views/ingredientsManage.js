'use strict';

// ── INGREDIENT MANAGEMENT LOGIC (ADMIN) ───────────────────────────────────────
(function(App) {

  async function loadIngredientsManage() {
    const searchInput = document.getElementById('manageIngredientSearchInput');
    const q = searchInput ? searchInput.value.trim() : '';
    let url = '/api/ingredients';
    if (q) {
      url += `?q=${encodeURIComponent(q)}`;
    }

    try {
      const list = await App.apiFetch(url);
      renderIngredientsManage(list);
    } catch (err) {
      console.error('Error loading ingredients in manager:', err);
    }
  }

  function renderIngredientsManage(ingredients) {
    const container = document.getElementById('manageIngredientsListContainer');
    if (!container) return;
    container.innerHTML = '';

    if (!ingredients || ingredients.length === 0) {
      container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem 0;">Geen ingrediënten gevonden.</div>';
      return;
    }

    const isAdmin = App.state.user && (App.state.user.is_admin == 1 || App.state.user.is_admin === true);

    ingredients.forEach(ing => {
      const div = document.createElement('div');
      div.className = 'tag-manage-item';

      const countBadge = (typeof ing.recipe_count !== 'undefined' && ing.recipe_count > 0)
        ? `<span class="tag-count-badge" title="Gebruikt in ${ing.recipe_count} recept(en)">${ing.recipe_count}</span>`
        : '';

      const deleteBtn = isAdmin ? `
        <button type="button" class="btn-icon btn-delete-tag" data-delete-ingredient="${ing.id}" data-ingredient-name="${App.escapeHtml(ing.name)}" title="Verwijder ingrediënt" aria-label="Verwijder ingrediënt">
          <i data-lucide="trash-2" style="width:15px;height:15px;"></i>
        </button>
      ` : '';

      div.innerHTML = `
        <div class="tag-manage-info">
          <i data-lucide="apple" style="width:16px;height:16px;color:var(--secondary);"></i>
          <span class="tag-manage-name">${App.escapeHtml(ing.name)}</span>
          ${countBadge}
        </div>
        <div class="tag-manage-actions">
          ${deleteBtn}
        </div>
      `;

      container.appendChild(div);
    });

    if (window.lucide) lucide.createIcons();
  }

  async function deleteIngredient(id, name) {
    if (!confirm(`Weet je zeker dat je het ingrediënt "${name}" wilt verwijderen? Dit verwijdert het ingrediënt ook uit eventuele recepten.`)) {
      return;
    }

    try {
      const res = await App.apiFetch(`/api/ingredients/${id}`, {
        method: 'DELETE'
      });
      App.showToast(res.message || 'Ingrediënt succesvol verwijderd.', 'success');
      loadIngredientsManage();
    } catch (err) {
      // Handled in apiFetch
    }
  }

  // Handle new ingredient form submission
  document.getElementById('adminCreateIngredientForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('adminNewIngredientName');
    if (!input) return;
    const name = App.formatItemName(input.value);
    if (!name) return;

    try {
      const res = await App.apiFetch('/api/ingredients', {
        method: 'POST',
        body: JSON.stringify({ name })
      });

      if (res.already_exists) {
        App.showToast(`Ingrediënt "${res.name}" bestaat al.`, 'info');
      } else {
        App.showToast(`Ingrediënt "${res.name}" succesvol aangemaakt!`, 'success');
      }

      input.value = '';
      loadIngredientsManage();
    } catch (err) {
      // Handled in apiFetch
    }
  });

  // Handle ingredient deletion click delegation
  document.getElementById('manageIngredientsListContainer')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-delete-ingredient]');
    if (btn) {
      const ingId = btn.getAttribute('data-delete-ingredient');
      const ingName = btn.getAttribute('data-ingredient-name') || '';
      if (ingId) deleteIngredient(ingId, ingName);
    }
  });

  document.getElementById('manageIngredientSearchInput')?.addEventListener('input', App.debounce(loadIngredientsManage, 300));

  App.loadIngredientsManage = loadIngredientsManage;

})(window.App);
