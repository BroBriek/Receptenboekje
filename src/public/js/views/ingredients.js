'use strict';

// ── INGREDIENTS BROWSER & RECIPE MATCHER LOGIC ─────────────────────────────────
(function(App) {

  // Selected ingredients state: Map<id (number), { id, name, recipe_count }>
  const selectedIngredients = new Map();
  let currentMatchMode = 'any'; // 'any' or 'all'
  let cachedIngredientsList = [];
  let matchCountDebounceTimer = null;

  async function loadIngredients() {
    const searchInput = document.getElementById('ingredientSearchInput');
    const q = searchInput ? searchInput.value.trim() : '';
    
    // Toggle search clear button
    const clearSearchBtn = document.getElementById('clearIngredientSearchBtn');
    if (clearSearchBtn) {
      if (q) {
        clearSearchBtn.classList.remove('hidden');
      } else {
        clearSearchBtn.classList.add('hidden');
      }
    }

    let url = '/api/ingredients';
    if (q) {
      url += `?q=${encodeURIComponent(q)}`;
    }

    try {
      const list = await App.apiFetch(url);
      cachedIngredientsList = list || [];
      renderIngredientsBrowser(cachedIngredientsList);
      updateFloatingBar();
      updateAlphabetSelectionDots();
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

    if (!ingredients || ingredients.length === 0) {
      container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem 1rem; color: var(--text-muted);">Geen ingrediënten gevonden.</div>';
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
        btn.id = `alphabetNavBtn_${letter}`;
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
        const isSelected = selectedIngredients.has(ing.id);
        const li = document.createElement('li');
        li.className = `ingredient-list-item ${isSelected ? 'selected' : ''}`;
        li.id = `ingItem_${ing.id}`;
        li.setAttribute('role', 'checkbox');
        li.setAttribute('aria-checked', isSelected ? 'true' : 'false');
        li.tabIndex = 0;

        const countBadge = ing.recipe_count > 0 
          ? `<span class="ingredient-count-badge" title="Gebruikt in ${ing.recipe_count} recept(en)">${ing.recipe_count} ${ing.recipe_count === 1 ? 'recept' : 'recepten'}</span>` 
          : '<span class="ingredient-count-badge" style="opacity:0.5;">0</span>';

        li.innerHTML = `
          <div class="ingredient-item-info">
            <span class="ingredient-checkbox">
              <i data-lucide="check"></i>
            </span>
            <span class="ingredient-item-name" title="${App.escapeQuotes(ing.name)}">${App.escapeHtml(ing.name)}</span>
          </div>
          ${countBadge}
        `;

        const handleToggle = (e) => {
          e.preventDefault();
          toggleIngredientSelection(ing);
        };

        li.addEventListener('click', handleToggle);
        li.addEventListener('keydown', (e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            handleToggle(e);
          }
        });

        ul.appendChild(li);
      });

      groupDiv.appendChild(header);
      groupDiv.appendChild(ul);
      container.appendChild(groupDiv);
    });

    if (window.lucide) lucide.createIcons();
    updateAlphabetSelectionDots();
  }

  function updateAlphabetSelectionDots() {
    document.querySelectorAll('.alphabet-nav-btn').forEach(btn => {
      btn.classList.remove('has-selected');
    });

    selectedIngredients.forEach(ing => {
      const letter = ing.name.charAt(0).toUpperCase();
      const btn = document.getElementById(`alphabetNavBtn_${letter}`);
      if (btn) {
        btn.classList.add('has-selected');
      }
    });
  }

  function toggleIngredientSelection(ing) {
    if (selectedIngredients.has(ing.id)) {
      selectedIngredients.delete(ing.id);
    } else {
      selectedIngredients.set(ing.id, {
        id: ing.id,
        name: ing.name,
        recipe_count: ing.recipe_count || 0
      });
    }

    // Update list item visual state
    const el = document.getElementById(`ingItem_${ing.id}`);
    if (el) {
      const isSelected = selectedIngredients.has(ing.id);
      el.classList.toggle('selected', isSelected);
      el.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    }

    updateAlphabetSelectionDots();
    updateFloatingBar();
  }

  function removeIngredientSelection(id) {
    const numericId = parseInt(id, 10);
    if (selectedIngredients.has(numericId)) {
      selectedIngredients.delete(numericId);
      const el = document.getElementById(`ingItem_${numericId}`);
      if (el) {
        el.classList.remove('selected');
        el.setAttribute('aria-checked', 'false');
      }
      updateAlphabetSelectionDots();
      updateFloatingBar();

      // If currently on Results view, reload results
      if (App.state.currentView === 'IngredientResults') {
        loadIngredientResultsView();
      }
    }
  }

  function clearIngredientSelection() {
    selectedIngredients.clear();
    document.querySelectorAll('.ingredient-list-item.selected').forEach(el => {
      el.classList.remove('selected');
      el.setAttribute('aria-checked', 'false');
    });
    updateAlphabetSelectionDots();
    updateFloatingBar();

    if (App.state.currentView === 'IngredientResults') {
      loadIngredientResultsView();
    }
  }

  // ── FLOATING BOTTOM BAR LOGIC ──
  function updateFloatingBar() {
    const bar = document.getElementById('ingredientFloatingBar');
    const countEl = document.getElementById('floatingSelectedCount');
    const matchEl = document.getElementById('floatingMatchCount');

    if (!bar) return;

    if (selectedIngredients.size === 0) {
      bar.classList.add('hidden');
      return;
    }

    bar.classList.remove('hidden');

    const totalSelected = selectedIngredients.size;
    if (countEl) {
      countEl.textContent = `${totalSelected} ${totalSelected === 1 ? 'ingrediënt' : 'ingrediënten'} gekozen`;
    }

    if (matchEl) {
      matchEl.innerHTML = '<span style="opacity:0.7;">Zoeken...</span>';
    }

    // Debounce live match count fetching
    if (matchCountDebounceTimer) clearTimeout(matchCountDebounceTimer);
    matchCountDebounceTimer = setTimeout(async () => {
      if (selectedIngredients.size === 0) return;
      const ids = Array.from(selectedIngredients.keys());
      try {
        const recipes = await App.apiFetch(`/api/recipes?ingredients=${ids.join(',')}&match_mode=any`);
        const count = Array.isArray(recipes) ? recipes.length : 0;
        if (matchEl) {
          if (count === 1) {
            matchEl.innerHTML = `<strong>1</strong> recept gevonden`;
          } else {
            matchEl.innerHTML = `<strong>${count}</strong> recepten gevonden`;
          }
        }
      } catch (err) {
        if (matchEl) {
          matchEl.innerHTML = `Bekijk matches`;
        }
      }
    }, 180);
  }

  // ── DEDICATED INGREDIENT RESULTS VIEW LOGIC ──
  async function loadIngredientResultsView() {
    const chipsContainer = document.getElementById('resultsIngredientChips');
    const badgeEl = document.getElementById('resultsFoundBadge');
    const loadingEl = document.getElementById('resultsRecipesLoading');
    const gridEl = document.getElementById('resultsRecipesGrid');

    // Update active segmented mode buttons
    document.querySelectorAll('#viewIngredientResults .segment-btn').forEach(btn => {
      if (btn.getAttribute('data-mode') === currentMatchMode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Render active chips
    if (chipsContainer) {
      if (selectedIngredients.size > 0) {
        chipsContainer.innerHTML = Array.from(selectedIngredients.values()).map(ing => `
          <span class="selected-chip" data-ing-id="${ing.id}">
            <span>${App.escapeHtml(ing.name)}</span>
            <button type="button" class="selected-chip-remove" data-remove-ing-id="${ing.id}" title="Verwijder ${App.escapeQuotes(ing.name)}">
              <i data-lucide="x"></i>
            </button>
          </span>
        `).join('');
      } else {
        chipsContainer.innerHTML = '<span style="color:var(--text-muted); font-size:0.85rem; font-style:italic;">Geen ingrediënten geselecteerd</span>';
      }
    }

    if (window.lucide) lucide.createIcons();

    if (selectedIngredients.size === 0) {
      if (badgeEl) badgeEl.textContent = '0 recepten gevonden';
      if (gridEl) {
        gridEl.innerHTML = `
          <div class="matching-empty-state">
            <div class="matching-empty-icon">
              <i data-lucide="chef-hat"></i>
            </div>
            <h4>Geen ingrediënten geselecteerd</h4>
            <p>Selecteer ingrediënten in de bibliotheek om bijpassende recepten te zien.</p>
            <button type="button" id="emptyStateGoToLibBtn" class="btn btn-primary btn-sm">
              <i data-lucide="arrow-left"></i> Naar Ingrediënten Bibliotheek
            </button>
          </div>
        `;
        document.getElementById('emptyStateGoToLibBtn')?.addEventListener('click', () => App.showView('Ingredients'));
        if (window.lucide) lucide.createIcons();
      }
      return;
    }

    if (loadingEl) loadingEl.classList.remove('hidden');
    if (gridEl) gridEl.innerHTML = '';

    const ingredientIds = Array.from(selectedIngredients.keys());
    const queryParams = [
      `ingredients=${ingredientIds.join(',')}`,
      `match_mode=${currentMatchMode}`
    ];

    try {
      const recipes = await App.apiFetch(`/api/recipes?${queryParams.join('&')}`);
      if (loadingEl) loadingEl.classList.add('hidden');

      const count = Array.isArray(recipes) ? recipes.length : 0;
      if (badgeEl) {
        badgeEl.textContent = `${count} ${count === 1 ? 'recept' : 'recepten'} gevonden`;
      }

      renderRankedResultsGrid(recipes, ingredientIds);
    } catch (err) {
      if (loadingEl) loadingEl.classList.add('hidden');
      console.error('Error fetching ingredient result recipes:', err);
      if (gridEl) {
        gridEl.innerHTML = '<div class="matching-empty-state"><p>Er is een fout opgetreden bij het ophalen van de recepten.</p></div>';
      }
    }
  }

  function renderRankedResultsGrid(recipes, selectedIngredientIds) {
    const grid = document.getElementById('resultsRecipesGrid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!recipes || recipes.length === 0) {
      const isAllMode = (currentMatchMode === 'all');
      grid.innerHTML = `
        <div class="matching-empty-state">
          <div class="matching-empty-icon">
            <i data-lucide="cooking-pot"></i>
          </div>
          <h4>Geen recepten gevonden</h4>
          <p>
            ${isAllMode 
              ? 'Er zijn geen recepten gevonden die <strong>alle</strong> geselecteerde ingrediënten bevatten. Schakel over naar <em>Minstens 1 match</em> voor meer resultaten.' 
              : 'Er zijn geen recepten gevonden met de gekozen ingrediënten.'}
          </p>
          ${isAllMode ? `
            <button type="button" id="resultsSwitchToAnyBtn" class="btn btn-secondary btn-sm">
              <i data-lucide="layers"></i> Schakel over naar 'Minstens 1 match'
            </button>
          ` : `
            <button type="button" id="resultsGoBackBtn" class="btn btn-outline btn-sm">
              <i data-lucide="arrow-left"></i> Kies andere ingrediënten
            </button>
          `}
        </div>
      `;

      document.getElementById('resultsSwitchToAnyBtn')?.addEventListener('click', () => {
        setResultsMatchMode('any');
      });
      document.getElementById('resultsGoBackBtn')?.addEventListener('click', () => {
        App.showView('Ingredients');
      });
      if (window.lucide) lucide.createIcons();
      return;
    }

    const selectedIdsSet = new Set(selectedIngredientIds);
    const selectedNamesSet = new Set(Array.from(selectedIngredients.values()).map(i => i.name.toLowerCase()));

    // Calculate matches for each recipe & sort strictly by most matches first
    const recipeMatchDetails = recipes.map(recipe => {
      const recipeIngredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
      const matchedList = [];
      const unmatchedList = [];

      recipeIngredients.forEach(ri => {
        const matchesById = (ri.ingredient_id && selectedIdsSet.has(ri.ingredient_id));
        const matchesByName = (ri.name && selectedNamesSet.has(ri.name.toLowerCase()));
        if (matchesById || matchesByName) {
          matchedList.push(ri);
        } else {
          unmatchedList.push(ri);
        }
      });

      return {
        recipe,
        matchedList,
        unmatchedList,
        matchedCount: matchedList.length,
        totalRecipeIngCount: recipeIngredients.length
      };
    });

    // Sort: 1) Most matched ingredients descending, 2) Highest match ratio, 3) Newest date
    recipeMatchDetails.sort((a, b) => {
      if (b.matchedCount !== a.matchedCount) {
        return b.matchedCount - a.matchedCount;
      }
      const ratioA = a.totalRecipeIngCount > 0 ? (a.matchedCount / a.totalRecipeIngCount) : 0;
      const ratioB = b.totalRecipeIngCount > 0 ? (b.matchedCount / b.totalRecipeIngCount) : 0;
      if (ratioB !== ratioA) {
        return ratioB - ratioA;
      }
      return new Date(b.recipe.created_at || 0) - new Date(a.recipe.created_at || 0);
    });

    const totalSelected = selectedIngredientIds.length;

    recipeMatchDetails.forEach(({ recipe, matchedList, unmatchedList, matchedCount }) => {
      const card = document.createElement('div');
      card.className = 'recipe-card matching-recipe-card';
      card.addEventListener('click', () => App.viewRecipeDetails(recipe.id, { fromRecipeTab: false }));

      const isPerfectMatch = (matchedCount >= totalSelected);

      // Match rank badge on top-left of image
      let matchPillHtml = '';
      if (isPerfectMatch) {
        matchPillHtml = `
          <div class="recipe-match-pill match-perfect" title="Bevat alle ${totalSelected} gekozen ingrediënten!">
            <i data-lucide="check-check" style="width:13px;height:13px;color:var(--secondary);"></i>
            <span>${matchedCount}/${totalSelected} ingrediënten (100%)</span>
          </div>
        `;
      } else {
        matchPillHtml = `
          <div class="recipe-match-pill match-partial" title="Bevat ${matchedCount} van de ${totalSelected} gekozen ingrediënten">
            <i data-lucide="layers" style="width:13px;height:13px;color:var(--primary);"></i>
            <span>${matchedCount} van ${totalSelected} ingrediënten</span>
          </div>
        `;
      }

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

      // Render matched ingredient tags in green + other ingredients preview
      let matchedTagsHtml = matchedList.map(ri => `
        <span class="ingredient-match-tag matched" title="Geselecteerd ingrediënt aanwezig">
          <i data-lucide="check"></i> ${App.escapeHtml(ri.name)}
        </span>
      `).join('');

      if (unmatchedList.length > 0) {
        const previewLimit = Math.max(1, 4 - matchedList.length);
        const previewUnmatched = unmatchedList.slice(0, previewLimit);
        const remainingCount = unmatchedList.length - previewUnmatched.length;

        matchedTagsHtml += previewUnmatched.map(ri => `
          <span class="ingredient-match-tag unmatched">${App.escapeHtml(ri.name)}</span>
        `).join('');

        if (remainingCount > 0) {
          matchedTagsHtml += `
            <span class="ingredient-match-tag unmatched" style="font-style:italic;">+${remainingCount} meer</span>
          `;
        }
      }

      const descHtml = recipe.description 
        ? `<p class="recipe-card-desc">${App.escapeHtml(recipe.description)}</p>` 
        : `<p class="recipe-card-desc" style="font-style:italic;">Geen omschrijving toegevoegd.</p>`;

      card.innerHTML = `
        <div class="recipe-card-img-box">
          ${matchPillHtml}
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
          <div class="recipe-card-matched-ingredients">
            ${matchedTagsHtml}
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

  function setResultsMatchMode(mode) {
    if (mode !== 'any' && mode !== 'all') return;
    currentMatchMode = mode;
    loadIngredientResultsView();
  }

  // ── EVENT LISTENERS ──
  // Search input in ingredients browser
  document.getElementById('ingredientSearchInput')?.addEventListener('input', App.debounce(loadIngredients, 250));

  // Clear search input button
  document.getElementById('clearIngredientSearchBtn')?.addEventListener('click', () => {
    const searchInput = document.getElementById('ingredientSearchInput');
    if (searchInput) {
      searchInput.value = '';
      loadIngredients();
    }
  });

  // Floating Bar: Clear all button
  document.getElementById('floatingClearBtn')?.addEventListener('click', clearIngredientSelection);

  // Floating Bar: View Matching Recipes CTA button
  document.getElementById('floatingViewRecipesBtn')?.addEventListener('click', () => {
    App.showView('IngredientResults');
  });

  // Results View: Clear all selections button
  document.getElementById('resultsClearSelectionBtn')?.addEventListener('click', clearIngredientSelection);

  // Results View: Match mode toggle buttons
  document.getElementById('resultsMatchModeAnyBtn')?.addEventListener('click', () => setResultsMatchMode('any'));
  document.getElementById('resultsMatchModeAllBtn')?.addEventListener('click', () => setResultsMatchMode('all'));

  // Results View: Chips deletion click delegation
  document.getElementById('resultsIngredientChips')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-ing-id]');
    if (btn) {
      const ingId = btn.getAttribute('data-remove-ing-id');
      removeIngredientSelection(ingId);
    }
  });

  // Expose on App
  App.loadIngredients = loadIngredients;
  App.loadIngredientResultsView = loadIngredientResultsView;
  App.selectedIngredients = selectedIngredients;
  App.clearIngredientSelection = clearIngredientSelection;

})(window.App);

