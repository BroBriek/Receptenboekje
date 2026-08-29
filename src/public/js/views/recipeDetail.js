'use strict';

// ── VIEW RECIPE DETAILS MODAL ─────────────────────────────────────────────────
(function(App) {

  let currentRecipe = null;
  let baseServings = 4;
  let currentServings = 4;

  function renderDetailIngredients() {
    if (!currentRecipe) return;
    const ingList = document.getElementById('recipeDetailIngredientsList');
    const scaleIndicator = document.getElementById('recipeDetailScaleIndicator');
    const scaleCount = document.getElementById('scaleIndicatorCount');
    const servingsCount = document.getElementById('recipeDetailServingsCount');

    if (servingsCount) servingsCount.textContent = currentServings;
    if (scaleCount) scaleCount.textContent = currentServings;

    if (scaleIndicator) {
      if (currentServings !== baseServings) {
        scaleIndicator.classList.remove('hidden');
      } else {
        scaleIndicator.classList.add('hidden');
      }
    }

    const scaleFactor = baseServings > 0 ? (currentServings / baseServings) : 1;

    if (currentRecipe.ingredients && currentRecipe.ingredients.length > 0) {
      ingList.innerHTML = currentRecipe.ingredients.map(ing => {
        let displayQty = '';
        if (typeof ing.quantity === 'number' && !isNaN(ing.quantity)) {
          displayQty = App.formatQuantity(ing.quantity * scaleFactor);
        } else if (ing.quantity) {
          displayQty = ing.quantity;
        }

        const unit = ing.unit ? ing.unit : '';
        const notes = ing.notes ? `(${ing.notes})` : '';
        const qtyUnit = (displayQty || unit) ? `<strong>${displayQty} ${unit}</strong> ` : '';
        return `<li>${qtyUnit}${App.escapeHtml(ing.name)} ${App.escapeHtml(notes)}</li>`;
      }).join('');
    } else {
      ingList.innerHTML = '<li style="font-style:italic; border-left-color: var(--border);">Geen ingrediënten ingevoerd.</li>';
    }
  }

  // Hook up servings stepper buttons in modal header badge
  document.getElementById('detailServingsDecBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentServings > 1) {
      currentServings--;
      renderDetailIngredients();
    }
  });

  document.getElementById('detailServingsIncBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentServings < 50) {
      currentServings++;
      renderDetailIngredients();
    }
  });

  async function viewRecipeDetails(recipeId, options = {}) {
    try {
      const recipe = await App.apiFetch(`/api/recipes/${recipeId}`);
      currentRecipe = recipe;

      const modal = document.getElementById('recipeDetailModal');

      document.getElementById('recipeDetailTitle').textContent = recipe.title;
      document.getElementById('recipeDetailName').textContent = recipe.title;
      document.getElementById('recipeDetailDesc').textContent = recipe.description || 'Geen omschrijving.';
      document.getElementById('recipeDetailPrep').textContent = recipe.prep_time ? `${recipe.prep_time} min voorb.` : '- min';
      document.getElementById('recipeDetailCook').textContent = recipe.cook_time ? `${recipe.cook_time} min kook` : '- min';

      baseServings = (recipe.servings && recipe.servings > 0) 
        ? recipe.servings 
        : (App.state.user?.default_servings || 4);

      if (options.servings && options.servings > 0) {
        currentServings = options.servings;
      } else {
        currentServings = baseServings;
      }

      // Exclude from menu badge
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
        <span class="recipe-card-tag">${App.escapeHtml(tag.name)}</span>
      `).join('');

      // Author
      const authorContainer = document.getElementById('recipeDetailAuthorContainer');
      if (authorContainer) {
        const authorName = recipe.author || 'Onbekend';
        const authorInitial = authorName.charAt(0).toUpperCase();
        const avatarHtml = recipe.author_avatar
          ? `<img src="/uploads/${App.escapeHtml(recipe.author_avatar)}" alt="${App.escapeHtml(authorName)}">`
          : `<span>${App.escapeHtml(authorInitial)}</span>`;
        
        authorContainer.innerHTML = `
          <div class="recipe-detail-author-badge">
            ${avatarHtml}
          </div>
          <span class="recipe-detail-author-text">Toegevoegd door <strong>${App.escapeHtml(authorName)}</strong></span>
        `;
      }

      // Image
      const imgContainer = document.getElementById('recipeDetailImageContainer');
      if (recipe.image_path) {
        imgContainer.innerHTML = `<img src="/uploads/${recipe.image_path}" alt="${App.escapeHtml(recipe.title)}">`;
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

      // Render dynamically scaled ingredients list
      renderDetailIngredients();

      // Steps list with timer badges & click-to-cook
      const stepsList = document.getElementById('recipeDetailStepsList');
      if (recipe.steps && recipe.steps.length > 0) {
        stepsList.innerHTML = recipe.steps.map((step, idx) => {
          const timerSec = (step.timer_seconds && step.timer_seconds > 0) 
            ? step.timer_seconds 
            : App.detectTimerInText(step.instruction);

          let timerHtml = '';
          if (timerSec && timerSec > 0) {
            const badgeText = App.formatTimerBadgeText(timerSec);
            timerHtml = `
              <span class="step-timer-tag clickable" data-start-cooking-step="${idx}" title="Start kookmodus bij deze stap (${badgeText})">
                <i data-lucide="timer"></i> ${badgeText}
              </span>
            `;
          }

          return `
            <li>
              <span>${App.escapeHtml(step.instruction)}</span>
              ${timerHtml}
            </li>
          `;
        }).join('');
      } else {
        stepsList.innerHTML = '<li style="font-style:italic;">Geen bereidingsstappen ingevoerd.</li>';
      }

      // Hook up Start Cooking button in footer
      const handleStartCooking = () => {
        if (currentRecipe) {
          App.startCookingMode(currentRecipe, { servings: currentServings });
        }
      };

      const footerCookBtn = document.getElementById('startCookingFooterBtn');
      if (footerCookBtn) footerCookBtn.onclick = handleStartCooking;

      // Click delegation for step timer tags in modal
      stepsList.onclick = (e) => {
        const timerTag = e.target.closest('[data-start-cooking-step]');
        if (timerTag) {
          const stepIdx = parseInt(timerTag.getAttribute('data-start-cooking-step'), 10);
          if (!isNaN(stepIdx) && currentRecipe) {
            App.startCookingMode(currentRecipe, { servings: currentServings, stepIndex: stepIdx });
          }
        }
      };

      const isRecipeTab = (options.fromRecipeTab !== undefined)
        ? Boolean(options.fromRecipeTab)
        : (App.state.currentView === 'Recipes');

      const editBtn = document.getElementById('editDetailRecipeBtn');
      if (editBtn) {
        if (isRecipeTab) {
          editBtn.classList.remove('hidden');
          editBtn.onclick = () => {
            modal.close();
            App.openEditRecipeForm(recipe);
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
      const response = await App.apiFetch(`/api/recipes/${recipeId}`, {
        method: 'DELETE'
      });
      App.showToast(response.message || 'Recept succesvol verwijderd!', 'success');

      const modal = document.getElementById('recipeDetailModal');
      if (modal && typeof modal.close === 'function') modal.close();

      App.state.allRecipes = [];
      App.showView('Recipes');
      App.loadRecipes();
    } catch (err) {
      // Handled in apiFetch
    }
  }

  App.viewRecipeDetails = viewRecipeDetails;
  App.deleteCurrentRecipe = deleteCurrentRecipe;

})(window.App);
