'use strict';

// ── RECIPE FORM (DYNAMIC TAGS, CLEAR INPUTS, INGREDIENTS & STEPS) ──────────────
(function(App) {

  let flagRemoveImage = false;

  async function openAddRecipeForm() {
    App.state.currentEditingRecipeId = null;
    App.state.recipeFormIngredients = [];
    App.state.recipeFormSteps = [];
    App.state.recipeFormSelectedTagIds = new Set();
    
    document.getElementById('recipeFormTitle').textContent = 'Nieuw Recept Toevoegen';
    document.getElementById('recipeForm').reset();
    document.getElementById('recipeFormId').value = '';
    const excludeCheckAdd = document.getElementById('recipeExcludeFromMenuInput');
    if (excludeCheckAdd) excludeCheckAdd.checked = false;
    document.getElementById('deleteRecipeFormBtn')?.classList.add('hidden');
    
    // Image previews reset
    flagRemoveImage = false;
    App.state.selectedStockImage = null;
    const previewContainer = document.getElementById('imagePreviewContainer');
    if (previewContainer) previewContainer.classList.add('empty');
    const imgEl = document.getElementById('recipeImagePreview');
    if (imgEl) {
      imgEl.classList.add('hidden');
      imgEl.src = '';
    }
    document.getElementById('removeRecipeImageBtn')?.classList.add('hidden');
    document.getElementById('selectedStockBadge')?.classList.add('hidden');
    const uploadBtnText = document.getElementById('uploadBtnText');
    if (uploadBtnText) uploadBtnText.textContent = 'Upload foto';

    const timerInput = document.getElementById('stepTimerMinutes');
    if (timerInput) timerInput.value = '';
    const autoSugg = document.getElementById('stepTimerAutoSuggestion');
    if (autoSugg) autoSugg.classList.add('hidden');

    await App.fetchTags();
    renderRecipeFormIngredients();
    renderRecipeFormSteps();
    renderDynamicRecipeTags();
    
    App.showView('RecipeForm');
  }

  async function openEditRecipeForm(recipe) {
    App.state.currentEditingRecipeId = recipe.id;
    App.state.recipeFormIngredients = recipe.ingredients.map(i => ({
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      notes: i.notes
    }));
    App.state.recipeFormSteps = (recipe.steps || []).map(s => ({
      step_number: s.step_number,
      instruction: s.instruction,
      timer_seconds: (s.timer_seconds && s.timer_seconds > 0) ? s.timer_seconds : App.detectTimerInText(s.instruction)
    }));
    App.state.recipeFormSelectedTagIds = new Set(recipe.tags.map(t => t.id));

    const timerInput = document.getElementById('stepTimerMinutes');
    if (timerInput) timerInput.value = '';
    const autoSugg = document.getElementById('stepTimerAutoSuggestion');
    if (autoSugg) autoSugg.classList.add('hidden');

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
    flagRemoveImage = false;
    const previewContainer = document.getElementById('imagePreviewContainer');
    const imgEl = document.getElementById('recipeImagePreview');
    const removeBtn = document.getElementById('removeRecipeImageBtn');
    const uploadBtnText = document.getElementById('uploadBtnText');
    const badge = document.getElementById('selectedStockBadge');
    const badgeText = document.getElementById('selectedStockText');

    if (recipe.image_path) {
      previewContainer?.classList.remove('empty');
      if (imgEl) {
        imgEl.src = `/uploads/${recipe.image_path}`;
        imgEl.classList.remove('hidden');
      }
      removeBtn?.classList.remove('hidden');
      if (uploadBtnText) uploadBtnText.textContent = 'Afbeelding wijzigen';

      if (recipe.image_path.startsWith('stock/')) {
        App.state.selectedStockImage = recipe.image_path;
        if (badge && badgeText) {
          badgeText.textContent = 'Stockfoto uit bibliotheek';
          badge.classList.remove('hidden');
        }
      } else {
        App.state.selectedStockImage = null;
        badge?.classList.add('hidden');
      }
    } else {
      App.state.selectedStockImage = null;
      previewContainer?.classList.add('empty');
      if (imgEl) {
        imgEl.src = '';
        imgEl.classList.add('hidden');
      }
      removeBtn?.classList.add('hidden');
      badge?.classList.add('hidden');
      if (uploadBtnText) uploadBtnText.textContent = 'Upload foto';
    }

    await App.fetchTags();
    renderDynamicRecipeTags();
    renderRecipeFormIngredients();
    renderRecipeFormSteps();

    App.showView('RecipeForm');
  }

  let activeTagSuggestionIndex = -1;
  let activeIngSuggestionIndex = -1;

  // Render dynamic tag chip selector (pure client-side synchronous update)
  function renderDynamicRecipeTags() {
    const selectedContainer = document.getElementById('recipeSelectedTags');
    if (!selectedContainer) return;

    const selectedTags = (App.state.allTags || []).filter(t => App.state.recipeFormSelectedTagIds.has(t.id));

    if (selectedTags.length === 0) {
      selectedContainer.innerHTML = `<span style="color:var(--text-muted); font-size:0.82rem; font-style:italic;">Nog geen tags gekozen. Zoek of typ hierboven om toe te voegen.</span>`;
    } else {
      selectedContainer.innerHTML = selectedTags.map(tag => `
        <span class="tag-chip-selected" data-tag-id="${tag.id}">
          <i data-lucide="tag" class="tag-chip-icon"></i>
          <span>${App.escapeHtml(tag.name)}</span>
          <button type="button" class="tag-remove-btn" data-remove-tag="${tag.id}" aria-label="Verwijder tag ${App.escapeHtml(tag.name)}">
            <i data-lucide="x" style="width:12px;height:12px;"></i>
          </button>
        </span>
      `).join('');
    }

    if (window.lucide) lucide.createIcons();
  }

  // Render floating tag suggestions dropdown
  function renderTagSuggestions() {
    const input = document.getElementById('newTagInput');
    const box = document.getElementById('tagSuggestions');
    if (!input || !box) return;

    const query = input.value.trim();
    const queryLower = query.toLowerCase();

    // Available unselected tags matching query
    const unselected = (App.state.allTags || []).filter(t => !App.state.recipeFormSelectedTagIds.has(t.id));
    
    let matches = [];
    if (query) {
      matches = unselected.filter(t => t.name.toLowerCase().includes(queryLower));
    } else {
      matches = unselected; // show all available unselected tags when query is empty
    }

    const exactMatch = (App.state.allTags || []).some(t => t.name.toLowerCase() === queryLower);

    let html = '';
    let itemIndex = 0;

    matches.slice(0, 10).forEach(tag => {
      const isActive = itemIndex === activeTagSuggestionIndex;
      html += `
        <div class="suggestion-item ${isActive ? 'active' : ''}" data-select-tag="${tag.id}" data-item-index="${itemIndex}">
          <i data-lucide="tag" style="width:14px;height:14px;"></i>
          <span>${App.escapeHtml(tag.name)}</span>
        </div>
      `;
      itemIndex++;
    });

    if (query && !exactMatch) {
      const isActive = itemIndex === activeTagSuggestionIndex;
      const formattedTag = App.formatItemName(query);
      html += `
        <div class="suggestion-item add-new-item ${isActive ? 'active' : ''}" data-create-tag="${App.escapeHtml(formattedTag)}" data-item-index="${itemIndex}">
          <i data-lucide="plus" style="width:14px;height:14px;"></i>
          <span>Voeg "<strong>${App.escapeHtml(formattedTag)}</strong>" toe als nieuwe tag</span>
        </div>
      `;
      itemIndex++;
    }

    if (!html) {
      box.innerHTML = `<div style="padding:0.6rem 0.9rem; font-size:0.85rem; color:var(--text-muted); font-style:italic;">Geen categorieën gevonden.</div>`;
      box.classList.remove('hidden');
      return;
    }

    box.innerHTML = html;
    box.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }

  // Select existing tag or create & add new tag
  async function selectOrAddTag(tagId, tagName) {
    const input = document.getElementById('newTagInput');
    const box = document.getElementById('tagSuggestions');

    if (tagId !== null && tagId !== undefined) {
      App.state.recipeFormSelectedTagIds.add(tagId);
    } else if (tagName && tagName.trim()) {
      const cleanName = App.formatItemName(tagName);
      const lower = cleanName.toLowerCase();
      const existing = (App.state.allTags || []).find(t => t.name.toLowerCase() === lower);

      if (existing) {
        App.state.recipeFormSelectedTagIds.add(existing.id);
      } else {
        try {
          // Create tag dynamically with silent option (no full-screen loading spinner overlay!)
          const newTag = await App.apiFetch('/api/tags', {
            method: 'POST',
            body: JSON.stringify({ name: cleanName }),
            silent: true
          });

          if (!App.state.allTags.some(t => t.id === newTag.id)) {
            App.state.allTags.push(newTag);
            App.state.allTags.sort((a, b) => a.name.localeCompare(b.name, 'nl', { sensitivity: 'base' }));
          }
          App.state.recipeFormSelectedTagIds.add(newTag.id);
        } catch (err) {
          console.error('Failed to create tag dynamically:', err);
        }
      }
    }

    if (input) input.value = '';
    if (box) box.classList.add('hidden');
    activeTagSuggestionIndex = -1;
    renderDynamicRecipeTags();
  }

  // Tag input event listeners
  const newTagInput = document.getElementById('newTagInput');
  if (newTagInput) {
    newTagInput.addEventListener('focus', () => {
      activeTagSuggestionIndex = -1;
      renderTagSuggestions();
    });

    newTagInput.addEventListener('input', () => {
      activeTagSuggestionIndex = -1;
      renderTagSuggestions();
    });

    newTagInput.addEventListener('keydown', (e) => {
      const box = document.getElementById('tagSuggestions');
      const items = box ? box.querySelectorAll('.suggestion-item') : [];

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (items.length > 0) {
          activeTagSuggestionIndex = (activeTagSuggestionIndex + 1) % items.length;
          renderTagSuggestions();
          const activeEl = box.querySelector('.suggestion-item.active');
          if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (items.length > 0) {
          activeTagSuggestionIndex = (activeTagSuggestionIndex - 1 + items.length) % items.length;
          renderTagSuggestions();
          const activeEl = box.querySelector('.suggestion-item.active');
          if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeTagSuggestionIndex >= 0 && items[activeTagSuggestionIndex]) {
          const item = items[activeTagSuggestionIndex];
          const tagId = item.getAttribute('data-select-tag');
          const createTag = item.getAttribute('data-create-tag');
          if (tagId) {
            selectOrAddTag(parseInt(tagId, 10), null);
          } else if (createTag) {
            selectOrAddTag(null, createTag);
          }
        } else {
          selectOrAddTag(null, newTagInput.value.trim());
        }
      } else if (e.key === 'Escape') {
        box?.classList.add('hidden');
        activeTagSuggestionIndex = -1;
      }
    });
  }

  document.getElementById('addNewTagBtn')?.addEventListener('click', () => {
    const input = document.getElementById('newTagInput');
    if (input) selectOrAddTag(null, input.value.trim());
  });

  // Click delegation on tag suggestions box
  document.getElementById('tagSuggestions')?.addEventListener('click', (e) => {
    const item = e.target.closest('.suggestion-item');
    if (item) {
      const tagId = item.getAttribute('data-select-tag');
      const createTag = item.getAttribute('data-create-tag');
      if (tagId) {
        selectOrAddTag(parseInt(tagId, 10), null);
      } else if (createTag) {
        selectOrAddTag(null, createTag);
      }
    }
  });

  // Click delegation on selected tags container (remove tag chip)
  document.getElementById('recipeSelectedTags')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-tag]');
    if (btn) {
      const tagId = parseInt(btn.getAttribute('data-remove-tag'), 10);
      if (!isNaN(tagId)) {
        App.state.recipeFormSelectedTagIds.delete(tagId);
        renderDynamicRecipeTags();
      }
    }
  });


  // Ingredients Builder UI handlers
  document.getElementById('addIngBtn')?.addEventListener('click', async () => {
    const nameEl = document.getElementById('ingName');
    const qtyEl = document.getElementById('ingQty');
    const unitEl = document.getElementById('ingUnit');

    const name = App.formatItemName(nameEl.value);
    const qty = qtyEl.value ? parseFloat(qtyEl.value) : null;
    const unit = unitEl.value.trim();

    if (!name) {
      App.showToast('Ingrediëntnaam is verplicht!', 'error');
      nameEl.focus();
      return;
    }

    App.state.recipeFormIngredients.push({ name, quantity: qty, unit, notes: '' });
    
    // Silently register ingredient in DB if it doesn't exist yet
    try {
      await App.apiFetch('/api/ingredients', {
        method: 'POST',
        body: JSON.stringify({ name }),
        silent: true
      });
    } catch (err) {
      // Ignore background registration error
    }

    // Clear fields
    nameEl.value = '';
    qtyEl.value = '';
    unitEl.value = '';
    document.getElementById('ingSuggestions')?.classList.add('hidden');

    renderRecipeFormIngredients();
    nameEl.focus();
  });

  function renderRecipeFormIngredients() {
    const list = document.getElementById('addedIngredientsList');
    if (!list) return;
    list.innerHTML = '';
    App.state.recipeFormIngredients.forEach((ing, index) => {
      const li = document.createElement('li');
      const displayQty = ing.quantity ? ing.quantity : '';
      const displayUnit = ing.unit ? ing.unit : '';
      
      li.innerHTML = `
        <span>${displayQty} ${displayUnit} ${App.escapeHtml(ing.name)}</span>
        <button type="button" class="btn-icon" style="color:var(--danger)" data-remove-ingredient="${index}" aria-label="Verwijder ingrediënt">
          <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
        </button>
      `;
      list.appendChild(li);
    });
    if (window.lucide) lucide.createIcons();
  }

  function removeFormIngredient(index) {
    App.state.recipeFormIngredients.splice(index, 1);
    renderRecipeFormIngredients();
  }

  document.getElementById('addedIngredientsList')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-ingredient]');
    if (btn) {
      const index = parseInt(btn.getAttribute('data-remove-ingredient'), 10);
      if (!isNaN(index)) removeFormIngredient(index);
    }
  });

  // Recipe Steps Builder UI handlers & auto-detection
  const stepTextEl = document.getElementById('stepText');
  const stepTimerInput = document.getElementById('stepTimerMinutes');
  const stepTimerAutoSuggestion = document.getElementById('stepTimerAutoSuggestion');
  const stepTimerAutoSuggestionText = document.getElementById('stepTimerAutoSuggestionText');

  let detectedSecForStep = null;

  if (stepTextEl) {
    stepTextEl.addEventListener('input', () => {
      const text = stepTextEl.value;
      detectedSecForStep = App.detectTimerInText(text);

      if (detectedSecForStep && detectedSecForStep > 0 && stepTimerAutoSuggestion) {
        const badge = App.formatTimerBadgeText(detectedSecForStep);
        if (stepTimerAutoSuggestionText) {
          stepTimerAutoSuggestionText.textContent = `${badge} kookwekker gedetecteerd (klik om in te stellen)`;
        }
        stepTimerAutoSuggestion.classList.remove('hidden');
      } else if (stepTimerAutoSuggestion) {
        stepTimerAutoSuggestion.classList.add('hidden');
      }
    });
  }

  if (stepTimerAutoSuggestion) {
    stepTimerAutoSuggestion.addEventListener('click', () => {
      if (detectedSecForStep && stepTimerInput) {
        const minVal = detectedSecForStep / 60;
        stepTimerInput.value = (Math.round(minVal * 100) / 100).toString();
        stepTimerAutoSuggestion.classList.add('hidden');
        stepTimerInput.focus();
      }
    });
  }

  document.getElementById('addStepBtn')?.addEventListener('click', () => {
    const instruction = stepTextEl ? stepTextEl.value.trim() : '';

    if (!instruction) {
      App.showToast('Stap instructie is verplicht!', 'error');
      stepTextEl?.focus();
      return;
    }

    let timer_seconds = null;
    if (stepTimerInput && stepTimerInput.value) {
      const val = parseFloat(stepTimerInput.value);
      if (!isNaN(val) && val > 0) {
        timer_seconds = Math.round(val * 60);
      }
    } else {
      timer_seconds = App.detectTimerInText(instruction);
    }

    const nextStepNum = App.state.recipeFormSteps.length + 1;
    App.state.recipeFormSteps.push({
      step_number: nextStepNum,
      instruction,
      timer_seconds: timer_seconds && timer_seconds > 0 ? timer_seconds : null
    });

    if (stepTextEl) stepTextEl.value = '';
    if (stepTimerInput) stepTimerInput.value = '';
    if (stepTimerAutoSuggestion) stepTimerAutoSuggestion.classList.add('hidden');
    detectedSecForStep = null;

    renderRecipeFormSteps();
    stepTextEl?.focus();
  });

  function renderRecipeFormSteps() {
    const list = document.getElementById('addedStepsList');
    if (!list) return;
    list.innerHTML = '';
    App.state.recipeFormSteps.forEach((step, index) => {
      const li = document.createElement('li');
      let timerBadge = '';
      if (step.timer_seconds && step.timer_seconds > 0) {
        const badgeText = App.formatTimerBadgeText(step.timer_seconds);
        timerBadge = `<span class="step-timer-tag" title="Kookwekker: ${badgeText}"><i data-lucide="timer"></i> ${badgeText}</span>`;
      }

      li.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.5rem; flex:1; min-width:0; padding-right:1rem;">
          <span style="flex:1; word-break:break-word;">${App.escapeHtml(step.instruction)}</span>
          ${timerBadge}
        </div>
        <button type="button" data-remove-step="${index}" aria-label="Verwijder stap">
          <i data-lucide="x" style="width:16px;height:16px;"></i>
        </button>
      `;
      list.appendChild(li);
    });
    if (window.lucide) lucide.createIcons();
  }

  function removeFormStep(index) {
    App.state.recipeFormSteps.splice(index, 1);
    App.state.recipeFormSteps.forEach((s, idx) => {
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

  // Handle image preview, click & drag-and-drop on upload container
  const dropzone = document.getElementById('imagePreviewContainer');
  const recipeFileInput = document.getElementById('recipeImageFile');

  if (dropzone) {
    dropzone.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('label') || e.target.closest('input')) return;
      recipeFileInput?.click();
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('drag-over');
      }, false);
    });

    ['dragleave', 'dragend', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('drag-over');
      }, false);
    });

    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt?.files;
      if (files && files.length > 0 && recipeFileInput) {
        recipeFileInput.files = files;
        recipeFileInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }

  // Handle image preview on upload select
  recipeFileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    flagRemoveImage = false;
    App.state.selectedStockImage = null; // Uploading custom photo clears stock photo selection
    document.getElementById('selectedStockBadge')?.classList.add('hidden');

    const reader = new FileReader();
    reader.onload = (event) => {
      const previewContainer = document.getElementById('imagePreviewContainer');
      const imgEl = document.getElementById('recipeImagePreview');
      const removeBtn = document.getElementById('removeRecipeImageBtn');
      const uploadBtnText = document.getElementById('uploadBtnText');

      previewContainer?.classList.remove('empty');
      if (imgEl) {
        imgEl.src = event.target.result;
        imgEl.classList.remove('hidden');
      }
      removeBtn?.classList.remove('hidden');
      if (uploadBtnText) uploadBtnText.textContent = 'Afbeelding wijzigen';
      if (window.lucide) window.lucide.createIcons();
    };
    reader.readAsDataURL(file);
  });

  // Remove image click handler
  document.getElementById('removeRecipeImageBtn')?.addEventListener('click', () => {
    if (recipeFileInput) recipeFileInput.value = '';
    App.state.selectedStockImage = null;
    document.getElementById('selectedStockBadge')?.classList.add('hidden');
    
    const previewContainer = document.getElementById('imagePreviewContainer');
    const imgEl = document.getElementById('recipeImagePreview');
    const removeBtn = document.getElementById('removeRecipeImageBtn');
    const uploadBtnText = document.getElementById('uploadBtnText');

    previewContainer?.classList.add('empty');
    if (imgEl) {
      imgEl.src = '';
      imgEl.classList.add('hidden');
    }
    removeBtn?.classList.add('hidden');
    if (uploadBtnText) uploadBtnText.textContent = 'Upload foto';
    
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
    
    const selectedTagIds = Array.from(App.state.recipeFormSelectedTagIds);
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
    formData.append('ingredients', JSON.stringify(App.state.recipeFormIngredients));
    formData.append('steps', JSON.stringify(App.state.recipeFormSteps));

    if (App.state.currentEditingRecipeId) {
      formData.append('remove_image', flagRemoveImage ? 'true' : 'false');
    }

    if (imageFile) {
      formData.append('image', imageFile);
    } else if (App.state.selectedStockImage) {
      formData.append('stock_image', App.state.selectedStockImage);
    }

    let endpoint = '/api/recipes';
    let method = 'POST';

    if (App.state.currentEditingRecipeId) {
      endpoint += `/${App.state.currentEditingRecipeId}`;
      method = 'PUT';
    }

    try {
      const response = await App.apiFetch(endpoint, {
        method,
        body: formData
      });

      App.showToast(response.message, 'success');
      flagRemoveImage = false;
      App.showView('Recipes');
    } catch (err) {
      // Handled inside apiFetch
    }
  });

  // Autocomplete ingredient name suggestions with silent API fetch and keyboard support
  const ingNameInput = document.getElementById('ingName');
  
  function renderIngSuggestions(list, query) {
    const box = document.getElementById('ingSuggestions');
    if (!box) return;

    const queryLower = (query || '').toLowerCase();
    const exactMatch = list.some(item => item.name.toLowerCase() === queryLower);

    let html = '';
    let itemIndex = 0;

    list.slice(0, 10).forEach(item => {
      const isActive = itemIndex === activeIngSuggestionIndex;
      html += `
        <div class="suggestion-item ${isActive ? 'active' : ''}" data-suggestion="${App.escapeHtml(item.name)}" data-item-index="${itemIndex}">
          <i data-lucide="utensils" style="width:14px;height:14px;"></i>
          <span>${App.escapeHtml(item.name)}</span>
        </div>
      `;
      itemIndex++;
    });

    if (query && !exactMatch) {
      const isActive = itemIndex === activeIngSuggestionIndex;
      const formattedIng = App.formatItemName(query);
      html += `
        <div class="suggestion-item add-new-item ${isActive ? 'active' : ''}" data-suggestion="${App.escapeHtml(formattedIng)}" data-item-index="${itemIndex}">
          <i data-lucide="plus" style="width:14px;height:14px;"></i>
          <span>Voeg "<strong>${App.escapeHtml(formattedIng)}</strong>" toe als nieuw ingrediënt</span>
        </div>
      `;
    }

    if (!html) {
      box.innerHTML = '';
      box.classList.add('hidden');
      return;
    }

    box.innerHTML = html;
    box.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }

  async function fetchIngSuggestions(query) {
    if (!query) {
      const box = document.getElementById('ingSuggestions');
      if (box) {
        box.innerHTML = '';
        box.classList.add('hidden');
      }
      return;
    }

    try {
      const list = await App.apiFetch(`/api/ingredients?q=${encodeURIComponent(query)}`, { silent: true });
      renderIngSuggestions(list, query);
    } catch (e) {
      console.error(e);
    }
  }

  if (ingNameInput) {
    ingNameInput.addEventListener('input', App.debounce((e) => {
      activeIngSuggestionIndex = -1;
      fetchIngSuggestions(e.target.value.trim());
    }, 150));

    ingNameInput.addEventListener('keydown', (e) => {
      const box = document.getElementById('ingSuggestions');
      const items = box ? box.querySelectorAll('.suggestion-item') : [];

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (items.length > 0) {
          activeIngSuggestionIndex = (activeIngSuggestionIndex + 1) % items.length;
          const activeEl = items[activeIngSuggestionIndex];
          items.forEach(el => el.classList.remove('active'));
          if (activeEl) {
            activeEl.classList.add('active');
            activeEl.scrollIntoView({ block: 'nearest' });
          }
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (items.length > 0) {
          activeIngSuggestionIndex = (activeIngSuggestionIndex - 1 + items.length) % items.length;
          const activeEl = items[activeIngSuggestionIndex];
          items.forEach(el => el.classList.remove('active'));
          if (activeEl) {
            activeEl.classList.add('active');
            activeEl.scrollIntoView({ block: 'nearest' });
          }
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIngSuggestionIndex >= 0 && items[activeIngSuggestionIndex]) {
          const suggestionName = items[activeIngSuggestionIndex].getAttribute('data-suggestion');
          if (suggestionName) selectIngredientSuggestion(suggestionName);
        } else {
          document.getElementById('addIngBtn')?.click();
        }
      } else if (e.key === 'Escape') {
        box?.classList.add('hidden');
        activeIngSuggestionIndex = -1;
      }
    });
  }

  // Also submit ingredient when pressing Enter on Quantity or Unit inputs
  ['ingQty', 'ingUnit'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('addIngBtn')?.click();
      }
    });
  });

  function selectIngredientSuggestion(name) {
    if (ingNameInput) ingNameInput.value = name;
    const box = document.getElementById('ingSuggestions');
    if (box) {
      box.classList.add('hidden');
      box.innerHTML = '';
    }
    activeIngSuggestionIndex = -1;
    document.getElementById('ingQty')?.focus();
  }

  document.getElementById('ingSuggestions')?.addEventListener('click', (e) => {
    const item = e.target.closest('[data-suggestion]');
    if (item) {
      const name = item.getAttribute('data-suggestion');
      if (name) selectIngredientSuggestion(name);
    }
  });

  // Global click listener to close suggestions dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    const tagBox = document.getElementById('tagSuggestions');
    if (tagBox && !tagBox.classList.contains('hidden')) {
      if (!e.target.closest('.dynamic-tag-input-row')) {
        tagBox.classList.add('hidden');
        activeTagSuggestionIndex = -1;
      }
    }

    const ingBox = document.getElementById('ingSuggestions');
    if (ingBox && !ingBox.classList.contains('hidden')) {
      if (!e.target.closest('.ing-name-wrapper')) {
        ingBox.classList.add('hidden');
        activeIngSuggestionIndex = -1;
      }
    }
  });

  // Global recipe form buttons
  document.getElementById('addNewRecipeBtn')?.addEventListener('click', openAddRecipeForm);
  document.getElementById('cancelRecipeFormBtn')?.addEventListener('click', () => App.showView('Recipes'));
  document.getElementById('cancelRecipeFormBottomBtn')?.addEventListener('click', () => App.showView('Recipes'));
  document.getElementById('deleteRecipeFormBtn')?.addEventListener('click', () => {
    if (App.state.currentEditingRecipeId) {
      App.deleteCurrentRecipe(App.state.currentEditingRecipeId);
    }
  });

  App.openAddRecipeForm = openAddRecipeForm;
  App.openEditRecipeForm = openEditRecipeForm;

})(window.App);
