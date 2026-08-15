'use strict';

// ── INGREDIENTS BROWSER LOGIC ─────────────────────────────────────────────────
(function(App) {

  async function loadIngredients() {
    const q = document.getElementById('ingredientSearchInput').value.trim();
    let url = '/api/ingredients';
    if (q) {
      url += `?q=${encodeURIComponent(q)}`;
    }

    try {
      const list = await App.apiFetch(url);
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
        
        const countBadge = ing.recipe_count > 0 
          ? `<span class="ingredient-count-badge" title="Gebruikt in ${ing.recipe_count} recept(en)">${ing.recipe_count}</span>` 
          : '';

        li.innerHTML = `
          <div class="ingredient-item-info">
            <span class="ingredient-item-name">${App.escapeHtml(ing.name)}</span>
            ${countBadge}
          </div>
        `;
        ul.appendChild(li);
      });

      groupDiv.appendChild(header);
      groupDiv.appendChild(ul);
      container.appendChild(groupDiv);
    });

    if (window.lucide) lucide.createIcons();
  }

  document.getElementById('ingredientSearchInput')?.addEventListener('input', App.debounce(loadIngredients, 300));

  App.loadIngredients = loadIngredients;

})(window.App);
