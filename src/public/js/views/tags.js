'use strict';

// ── TAGS MANAGEMENT LOGIC (ADMIN) ─────────────────────────────────────────────
(function(App) {

  async function loadTags() {
    const searchInput = document.getElementById('tagSearchInput');
    const q = searchInput ? searchInput.value.trim() : '';
    let url = '/api/tags';
    if (q) {
      url += `?q=${encodeURIComponent(q)}`;
    }

    try {
      const tags = await App.apiFetch(url);
      renderTagsManager(tags);
    } catch (err) {
      console.error('Error loading tags in manager:', err);
    }
  }

  function renderTagsManager(tags) {
    const container = document.getElementById('tagsListContainer');
    if (!container) return;
    container.innerHTML = '';

    if (!tags || tags.length === 0) {
      container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem 0;">Geen tags gevonden.</div>';
      return;
    }

    const isAdmin = App.state.user && (App.state.user.is_admin == 1 || App.state.user.is_admin === true);

    tags.forEach(tag => {
      const div = document.createElement('div');
      div.className = 'tag-manage-item';

      const countBadge = (typeof tag.recipe_count !== 'undefined' && tag.recipe_count > 0)
        ? `<span class="tag-count-badge" title="Gekoppeld aan ${tag.recipe_count} recept(en)">${tag.recipe_count}</span>`
        : '';

      const deleteBtn = isAdmin ? `
        <button type="button" class="btn-icon btn-delete-tag" data-delete-tag="${tag.id}" data-tag-name="${App.escapeHtml(tag.name)}" title="Verwijder tag" aria-label="Verwijder tag">
          <i data-lucide="trash-2" style="width:15px;height:15px;"></i>
        </button>
      ` : '';

      div.innerHTML = `
        <div class="tag-manage-info">
          <i data-lucide="tag" style="width:16px;height:16px;"></i>
          <span class="tag-manage-name">${App.escapeHtml(tag.name)}</span>
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

  async function deleteTag(id, name) {
    if (!confirm(`Weet je zeker dat je de categorie/tag "${name}" wilt verwijderen? Dit ontkoppelt deze tag van alle recepten.`)) {
      return;
    }

    try {
      const res = await App.apiFetch(`/api/tags/${id}`, {
        method: 'DELETE'
      });
      App.showToast(res.message || 'Tag succesvol verwijderd.', 'success');
      
      // Update global tags cache
      if (typeof App.loadInitialData === 'function') {
        App.loadInitialData();
      } else {
        App.state.allTags = await App.apiFetch('/api/tags');
      }

      loadTags();
    } catch (err) {
      // Handled in apiFetch
    }
  }

  // Handle new tag form submission
  document.getElementById('adminCreateTagForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('adminNewTagName');
    if (!input) return;
    const name = App.formatItemName(input.value);
    if (!name) return;

    try {
      const res = await App.apiFetch('/api/tags', {
        method: 'POST',
        body: JSON.stringify({ name })
      });

      if (res.already_exists) {
        App.showToast(`Tag "${res.name}" bestaat al.`, 'info');
      } else {
        App.showToast(`Tag "${res.name}" succesvol aangemaakt!`, 'success');
      }

      input.value = '';
      
      // Update global tags cache
      App.state.allTags = await App.apiFetch('/api/tags');

      loadTags();
    } catch (err) {
      // Handled in apiFetch
    }
  });

  // Handle tag deletion click delegation
  document.getElementById('tagsListContainer')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-delete-tag]');
    if (btn) {
      const tagId = btn.getAttribute('data-delete-tag');
      const tagName = btn.getAttribute('data-tag-name') || '';
      if (tagId) deleteTag(tagId, tagName);
    }
  });

  document.getElementById('tagSearchInput')?.addEventListener('input', App.debounce(loadTags, 300));

  App.loadTags = loadTags;

})(window.App);
