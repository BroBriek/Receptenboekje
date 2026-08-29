'use strict';

// ── RECIPES BROWSE LOGIC ──────────────────────────────────────────────────────
(function(App) {

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
      const recipes = await App.apiFetch(endpoint);
      App.state.allRecipes = recipes;
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
      card.addEventListener('click', () => App.viewRecipeDetails(recipe.id, { fromRecipeTab: true }));

      let imageHtml = '';
      if (recipe.image_path) {
        imageHtml = `<img src="/uploads/${recipe.image_path}" alt="${App.escapeHtml(recipe.title)}" class="recipe-card-img">`;
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
        authorAvatarHtml = `<img src="/uploads/${App.escapeHtml(recipe.author_avatar)}" alt="${App.escapeHtml(authorName)}">`;
      } else {
        authorAvatarHtml = `<span>${App.escapeHtml(authorInitial)}</span>`;
      }

      const tags = Array.isArray(recipe.tags) ? recipe.tags : [];
      let tagsHtml = tags.map(tag => `
        <span class="recipe-card-tag">${App.escapeHtml(tag.name)}</span>
      `).join('');

      if (recipe.exclude_from_menu) {
        tagsHtml += `
          <span class="recipe-card-tag" style="opacity: 0.85; font-size: 0.72rem; color: var(--text-muted);" title="Niet opnemen in het automatisch weekmenu">
            <i data-lucide="calendar-off" style="width:10px;height:10px;display:inline-block;vertical-align:-1px;margin-right:3px;"></i>Geen weekmenu
          </span>
        `;
      }

      const descHtml = recipe.description 
        ? `<p class="recipe-card-desc">${App.escapeHtml(recipe.description)}</p>` 
        : `<p class="recipe-card-desc" style="font-style:italic;">Geen omschrijving toegevoegd.</p>`;

      card.innerHTML = `
        <div class="recipe-card-img-box">
          ${imageHtml}
          <div class="recipe-card-author-badge" title="Toegevoegd door ${App.escapeHtml(authorName)}">
            ${authorAvatarHtml}
          </div>
          <button type="button" class="recipe-card-play-btn" data-start-cooking="${recipe.id}" title="Start kookmodus voor ${App.escapeQuotes(recipe.title)}">
            <i data-lucide="play" style="fill: currentColor;"></i>
            <span>Koken</span>
          </button>
        </div>
        <div class="recipe-card-content">
          <h3 class="recipe-card-title">${App.escapeHtml(recipe.title)}</h3>
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
            <div class="recipe-card-author-info" title="Toegevoegd door ${App.escapeHtml(authorName)}">
              <div class="recipe-card-author-avatar">
                ${authorAvatarHtml}
              </div>
              <span class="recipe-card-author-name">${App.escapeHtml(authorName)}</span>
            </div>
          </div>
        </div>
      `;

      grid.appendChild(card);
    });

    // Event delegation for card play buttons
    grid.onclick = (e) => {
      const playBtn = e.target.closest('[data-start-cooking]');
      if (playBtn) {
        e.stopPropagation();
        const id = playBtn.getAttribute('data-start-cooking');
        if (id) App.startCookingMode(id);
      }
    };

    if (window.lucide) lucide.createIcons();
  }

  async function renderFilterTagChips() {
    await App.fetchTags();
    const list = document.getElementById('filterTagsList');
    if (!list) return;
    list.innerHTML = App.state.allTags.map(tag => `
      <button type="button" class="filter-tag-chip" data-tag-id="${tag.id}">${App.escapeHtml(tag.name)}</button>
    `).join('');
  }

  document.getElementById('filterTagsList')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-tag-chip');
    if (chip) {
      chip.classList.toggle('active');
      loadRecipes();
    }
  });

  document.getElementById('recipeSearchInput')?.addEventListener('input', App.debounce(loadRecipes, 300));

  App.loadRecipes = loadRecipes;
  App.renderFilterTagChips = renderFilterTagChips;

})(window.App);
