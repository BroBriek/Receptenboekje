'use strict';
/* global App, lucide */

// ── MODAL: WEEKLY SHOPPING LIST ─────────────────────────────────────────────
(function(App) {
  let shoppingListData = null;
  let activeView = 'category'; // 'category' | 'combined' | 'byDay'
  let checkedItemKeys = new Set();
  let currentShoppingMonday = null; // YYYY-MM-DD for week navigation

  // Categories definition for supermarket organization
  const CATEGORIES = [
    { id: 'produce', name: 'Groente & Fruit', icon: 'apple', regex: /\b(ui|uien|knoflook|sjalot|wortel|wortelen|tomaat|tomaten|paprika|champignon|champignons|citroen|citroenen|citroensap|limoen|spinazie|courgette|aubergine|broccoli|bloemkool|sla|komkommer|prei|selderij|peterselie|basilicum|koriander|bieslook|tijm|rosmarijn|gember|avocado|appel|banaan|aardappel|aardappelen|zoete aardappel|boerenkool|spruitjes|witlof|radijs|asperges|kouseband|peper|pepers|spaanse peper|rode peper|groene peper|boontjes|sperziebonen|doperwten|doperwtjes)\b/i },
    { id: 'meat_fish', name: 'Vlees, Vis & Vega', icon: 'beef', regex: /\b(gehakt|rundergehakt|half-om-half gehakt|kip|kipfilet|kippendijen|biefstuk|varkensvlees|spek|spekjes|bacon|ham|worst|rookworst|gehaktbal|gehaktballen|zalm|kabeljauw|tonijn|garnalen|vis|visfilet|tofu|tempé|tempeh|vegetarisch|vega|falafel)\b/i },
    { id: 'dairy', name: 'Zuivel & Gekoeld', icon: 'egg', regex: /\b(melk|kaas|parmezaan|parmezaanse kaas|mozzarella|cheddar|feta|geitenkaas|geraspte kaas|goudse kaas|roomkaas|kwark|yoghurt|griekse yoghurt|slagroom|kookroom|crème fraîche|creme fraiche|zure room|boter|roofboter|margarine|ei|eieren|eidooier|eiwit)\b/i },
    { id: 'bakery', name: 'Brood & Bakkerij', icon: 'sandwich', regex: /\b(brood|stokbrood|pistolet|pistoletjes|bolletjes|pita|pitabroodje|pitabroodjes|tortilla|tortilla's|naan|naanbrood|croissant|wrap|wraps|afbakbrood)\b/i },
    { id: 'grains', name: 'Pasta, Rijst & Granen', icon: 'wheat', regex: /\b(pasta|spaghetti|penne|fusilli|macaroni|tagliatelle|lasagne|lasagnebladen|rijst|basmati|pandan|jasmijnrijst|risottorijst|gekookte rijst|mie|mie-nestjes|noodles|noodels|couscous|bulgur|quinoa|havermoes|havermout|bloem|zelfrijzend bakmeel|paneermeel)\b/i },
    { id: 'canned', name: 'Blik & Conserven', icon: 'package', regex: /\b(blik|pot|gepelde tomaten|tomatenblokjes|passata|tomatenpuree|kokosmelk|mais|maïs|kidneybonen|kikkererwten|zwarte bonen|witte bonen|linzen|augurken|zilveruien|olijven|kappers|zongedroogde tomaten|tonijn in blik)\b/i },
    { id: 'spices_pantry', name: 'Kruiden, Olie & Sauzen', icon: 'sparkles', regex: /\b(olie|olijfolie|zonnebloemolie|wokolie|sesamolie|azijn|balsamico|zout|peper|zwarte peper|oregano|paprikapoeder|kerrie|kerriepoeder|komijn|komijnpoeder|kaneel|muskaatnoot|ketjap|ketjap manis|sojasaus|oestersaus|vissaus|sambal|sambal oelek|mayonaise|mayo|ketchup|mosterd|scharrelmayo|tabasco|sriracha|bouillon|bouillonblokje|bouillonblokjes|suiker|basterdsuiker|honing|pindakaas|pesto)\b/i },
    { id: 'other', name: 'Overig / Voorraad', icon: 'package', regex: /.*/ }
  ];

  function getCategoryForIngredient(name) {
    const norm = (name || '').toLowerCase().trim();
    for (const cat of CATEGORIES) {
      if (cat.id === 'other') continue;
      if (cat.regex.test(norm)) return cat;
    }
    return CATEGORIES.find(c => c.id === 'other');
  }

  // Shift Monday string by offset days (+7 or -7)
  function getShiftedMonday(mondayStr, offsetDays) {
    if (!mondayStr) return App.getTodayDateString();
    const [y, m, d] = mondayStr.split('-').map(Number);
    const target = new Date(y, m - 1, d + offsetDays);
    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const dd = String(target.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // Load checked items state from localStorage for persistence
  function loadCheckedState(monday) {
    try {
      const stored = localStorage.getItem(`shopping_list_checked_${monday}`);
      if (stored) {
        checkedItemKeys = new Set(JSON.parse(stored));
      } else {
        checkedItemKeys = new Set();
      }
    } catch (e) {
      checkedItemKeys = new Set();
    }
  }

  function saveCheckedState(monday) {
    try {
      localStorage.setItem(`shopping_list_checked_${monday}`, JSON.stringify(Array.from(checkedItemKeys)));
    } catch (e) {
      // Ignore quota errors
    }
  }

  // Fetch shopping list data for a specific Monday date
  async function loadShoppingListData(monday) {
    currentShoppingMonday = monday;
    loadCheckedState(currentShoppingMonday);

    try {
      App.toggleLoading(true);
      shoppingListData = await App.apiFetch(`/api/meal-plan/shopping-list?start_date=${currentShoppingMonday}`);

      updateWeekNavigatorUI();
      renderShoppingList();
    } catch (err) {
      console.error('Failed to load shopping list:', err);
      App.showToast('Fout bij het laden van de boodschappenlijst', 'error');
    } finally {
      App.toggleLoading(false);
    }
  }

  function updateWeekNavigatorUI() {
    const labelEl = document.getElementById('shoppingWeekLabel');
    const subtitle = document.getElementById('shoppingListSubtitle');

    if (shoppingListData) {
      const monFormatted = App.formatDutchDate(shoppingListData.monday);
      const sunFormatted = App.formatDutchDate(shoppingListData.sunday);

      if (labelEl) {
        labelEl.textContent = `${monFormatted} – ${sunFormatted}`;
      }

      if (subtitle) {
        const recipeCount = shoppingListData.totalRecipes || 0;
        const totalItems = (shoppingListData.combined || []).length;
        subtitle.textContent = `${monFormatted} t/m ${sunFormatted} • ${recipeCount} ${recipeCount === 1 ? 'gerecht' : 'gerechten'} • ${totalItems} ingrediënten`;
      }
    }
  }

  // Open modal handler
  document.getElementById('openShoppingListBtn')?.addEventListener('click', async () => {
    const modal = document.getElementById('shoppingListModal');
    if (!modal) return;

    const initialMonday = App.state.currentWeekMonday || App.getTodayDateString();
    await loadShoppingListData(initialMonday);
    modal.showModal();
  });

  // Week navigation button handlers inside modal
  document.getElementById('shoppingPrevWeekBtn')?.addEventListener('click', () => {
    if (!currentShoppingMonday) return;
    const prevMon = getShiftedMonday(currentShoppingMonday, -7);
    loadShoppingListData(prevMon);
  });

  document.getElementById('shoppingNextWeekBtn')?.addEventListener('click', () => {
    if (!currentShoppingMonday) return;
    const nextMon = getShiftedMonday(currentShoppingMonday, 7);
    loadShoppingListData(nextMon);
  });

  document.getElementById('shoppingTodayWeekBtn')?.addEventListener('click', () => {
    const todayMon = App.state.currentWeekMonday || App.getTodayDateString();
    loadShoppingListData(todayMon);
  });

  // View mode switcher buttons
  document.getElementById('shoppingViewCategoryBtn')?.addEventListener('click', () => {
    activeView = 'category';
    updateToggleButtons();
    renderShoppingList();
  });

  document.getElementById('shoppingViewCombinedBtn')?.addEventListener('click', () => {
    activeView = 'combined';
    updateToggleButtons();
    renderShoppingList();
  });

  document.getElementById('shoppingViewByDayBtn')?.addEventListener('click', () => {
    activeView = 'byDay';
    updateToggleButtons();
    renderShoppingList();
  });

  function updateToggleButtons() {
    const catBtn = document.getElementById('shoppingViewCategoryBtn');
    const combinedBtn = document.getElementById('shoppingViewCombinedBtn');
    const byDayBtn = document.getElementById('shoppingViewByDayBtn');

    [
      { btn: catBtn, active: activeView === 'category' },
      { btn: combinedBtn, active: activeView === 'combined' },
      { btn: byDayBtn, active: activeView === 'byDay' }
    ].forEach(({ btn, active }) => {
      if (!btn) return;
      if (active) {
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
      }
    });
  }

  // Clear checked items
  function resetAllCheckedItems() {
    checkedItemKeys.clear();
    const monday = shoppingListData ? shoppingListData.monday : currentShoppingMonday;
    saveCheckedState(monday);
    renderShoppingList();
    App.showToast('Vinkjes hersteld', 'info');
  }

  document.getElementById('clearCheckedItemsBtn')?.addEventListener('click', resetAllCheckedItems);

  // Render shopping list items
  function renderShoppingList() {
    const container = document.getElementById('shoppingListContent');
    const summaryContainer = document.getElementById('shoppingListSummary');
    if (!container || !shoppingListData) return;

    if (shoppingListData.totalRecipes === 0) {
      if (summaryContainer) summaryContainer.innerHTML = '';
      container.innerHTML = `
        <div class="shopping-empty-state">
          <div class="shopping-empty-icon-wrap">
            <i data-lucide="shopping-bag" class="shopping-empty-icon"></i>
          </div>
          <h4>Geen maaltijden gepland voor deze week</h4>
          <p>Er zijn voor de geselecteerde week nog geen recepten ingepland op het weekmenu.</p>
          <button type="button" class="btn btn-primary btn-sm" data-close-modal="shoppingListModal" onclick="document.getElementById('openGenerateModalBtn')?.click()">
            <i data-lucide="wand-2"></i> Maak een weekmenu
          </button>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    const allCombinedItems = shoppingListData.combined || [];
    const totalItemsCount = allCombinedItems.length;

    // Calculate checked count
    let checkedCount = 0;
    let totalItemsForView = totalItemsCount;

    if (activeView === 'byDay') {
      const days = (shoppingListData.byDay || []).filter(d => d.recipeTitle && d.ingredients && d.ingredients.length > 0);
      let dayTotal = 0;
      days.forEach(day => {
        day.ingredients.forEach(ing => {
          dayTotal++;
          const qtyStr = ing.quantity
            ? (Number.isInteger(ing.quantity) ? ing.quantity : ing.quantity.toFixed(2).replace(/\.?0+$/, '')) + (ing.unit ? ` ${ing.unit}` : '')
            : ing.unit;
          const fullText = qtyStr ? `${qtyStr} ${ing.name}` : ing.name;
          const itemKey = `day_${day.date}_${fullText}`;
          if (checkedItemKeys.has(itemKey)) checkedCount++;
        });
      });
      totalItemsForView = dayTotal;
    } else {
      checkedCount = allCombinedItems.filter(it => checkedItemKeys.has(`item_${it.displayText}`)).length;
    }

    const percentage = totalItemsForView > 0 ? Math.round((checkedCount / totalItemsForView) * 100) : 0;

    if (summaryContainer) {
      summaryContainer.innerHTML = `
        <div class="shopping-summary-header">
          <div class="shopping-summary-left">
            <i data-lucide="check-circle-2" class="shopping-summary-icon"></i>
            <span><strong>${checkedCount}</strong> van <strong>${totalItemsForView}</strong> afgevinkt</span>
            <span class="shopping-summary-badge">${percentage}%</span>
          </div>
          ${checkedCount > 0 ? `
            <button type="button" id="summaryResetBtn" class="shopping-summary-reset-btn" title="Herstel alle vinkjes">
              <i data-lucide="rotate-ccw"></i> Reset
            </button>
          ` : ''}
        </div>
        <div class="shopping-progress-bar" role="progressbar" aria-valuenow="${percentage}" aria-valuemin="0" aria-valuemax="100">
          <div class="shopping-progress-fill" style="width: ${percentage}%;"></div>
        </div>
      `;

      // Attach reset button in summary if present
      document.getElementById('summaryResetBtn')?.addEventListener('click', resetAllCheckedItems);
    }

    if (activeView === 'category') {
      // Group combined items into categories
      const categoryMap = new Map();
      CATEGORIES.forEach(cat => categoryMap.set(cat.id, { ...cat, items: [] }));

      allCombinedItems.forEach(item => {
        const cat = getCategoryForIngredient(item.name);
        categoryMap.get(cat.id).items.push(item);
      });

      // Filter out empty categories
      const populatedCategories = Array.from(categoryMap.values()).filter(cat => cat.items.length > 0);

      container.innerHTML = `
        <div class="shopping-category-groups">
          ${populatedCategories.map(cat => `
            <div class="shopping-category-group">
              <div class="shopping-category-header">
                <div class="shopping-category-title-wrap">
                  <i data-lucide="${cat.icon}" class="shopping-category-icon"></i>
                  <h4 class="shopping-category-title">${App.escapeHtml(cat.name)}</h4>
                </div>
                <span class="shopping-category-count">${cat.items.length} ${cat.items.length === 1 ? 'item' : 'items'}</span>
              </div>
              <div class="shopping-items-list">
                ${cat.items.map(item => renderShoppingItem(item)).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else if (activeView === 'combined') {
      container.innerHTML = `
        <div class="shopping-combined-card">
          <div class="shopping-items-list">
            ${allCombinedItems.map(item => renderShoppingItem(item)).join('')}
          </div>
        </div>
      `;
    } else {
      // By Day View
      const days = (shoppingListData.byDay || []).filter(d => d.recipeTitle && d.ingredients && d.ingredients.length > 0);

      container.innerHTML = `
        <div class="shopping-days-list">
          ${days.map(day => `
            <div class="shopping-day-group">
              <div class="shopping-day-header">
                <div class="shopping-day-title">
                  <span class="shopping-day-badge">${App.escapeHtml(day.dayName.substring(0, 2))}</span>
                  <span class="shopping-day-name">${App.escapeHtml(day.dayName)}</span>
                  <span class="shopping-recipe-title">${App.escapeHtml(day.recipeTitle)}</span>
                  <span class="shopping-servings-badge"><i data-lucide="users"></i> ${day.servings || 4} pers.</span>
                </div>
                <span class="shopping-day-count">${day.ingredients.length} items</span>
              </div>
              <div class="shopping-items-list compact">
                ${day.ingredients.map(ing => {
                  const qtyFormatted = App.formatQuantity(ing.quantity);
                  const qtyStr = qtyFormatted
                    ? `${qtyFormatted}${ing.unit ? ` ${ing.unit}` : ''}`
                    : (ing.unit || '');
                  const fullText = qtyStr ? `${qtyStr} ${ing.name}` : ing.name;
                  const itemKey = `day_${day.date}_${fullText}`;
                  const isChecked = checkedItemKeys.has(itemKey);

                  return `
                    <label class="shopping-item ${isChecked ? 'checked' : ''}">
                      <input type="checkbox" class="shopping-item-checkbox" data-key="${App.escapeQuotes(itemKey)}" ${isChecked ? 'checked' : ''}>
                      <span class="shopping-item-custom-check">
                        <i data-lucide="check"></i>
                      </span>
                      <div class="shopping-item-content">
                        <div class="shopping-item-main">
                          ${qtyStr ? `<span class="shopping-item-qty">${App.escapeHtml(qtyStr)}</span>` : ''}
                          <span class="shopping-item-title">${App.escapeHtml(ing.name)}</span>
                          ${ing.notes ? `<span class="shopping-item-note">(${App.escapeHtml(ing.notes)})</span>` : ''}
                        </div>
                      </div>
                    </label>
                  `;
                }).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    // Attach checkbox handlers
    container.querySelectorAll('.shopping-item-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const key = e.target.getAttribute('data-key');
        const itemLabel = e.target.closest('.shopping-item');
        if (e.target.checked) {
          checkedItemKeys.add(key);
          if (itemLabel) itemLabel.classList.add('checked');
        } else {
          checkedItemKeys.delete(key);
          if (itemLabel) itemLabel.classList.remove('checked');
        }
        saveCheckedState(shoppingListData.monday);

        // Refresh live stats & progress bar
        renderShoppingList();
      });
    });

    if (window.lucide) lucide.createIcons();
  }

  // Render a single combined item card
  function renderShoppingItem(item) {
    const itemKey = `item_${item.displayText}`;
    const isChecked = checkedItemKeys.has(itemKey);
    const recipeListText = item.recipes && item.recipes.length > 0 ? item.recipes.join(', ') : '';

    return `
      <label class="shopping-item ${isChecked ? 'checked' : ''}">
        <input type="checkbox" class="shopping-item-checkbox" data-key="${App.escapeQuotes(itemKey)}" ${isChecked ? 'checked' : ''}>
        <span class="shopping-item-custom-check">
          <i data-lucide="check"></i>
        </span>
        <div class="shopping-item-content">
          <div class="shopping-item-main">
            ${item.displayQuantity ? `<span class="shopping-item-qty">${App.escapeHtml(item.displayQuantity)}</span>` : ''}
            <span class="shopping-item-title">${App.escapeHtml(item.name)}</span>
          </div>
          ${recipeListText ? `<div class="shopping-item-recipes" title="Gebruikt in: ${App.escapeQuotes(recipeListText)}"><i data-lucide="utensils"></i><span>${App.escapeHtml(recipeListText)}</span></div>` : ''}
        </div>
      </label>
    `;
  }

  // Generate structured plain text string for Notepad / Clipboard
  function generatePlainText() {
    if (!shoppingListData) return '';

    const monFormatted = App.formatDutchDate(shoppingListData.monday);
    const sunFormatted = App.formatDutchDate(shoppingListData.sunday);
    const lines = [];

    const dishSummaries = (shoppingListData.byDay || [])
      .filter(d => d.recipeTitle)
      .map(d => `${d.recipeTitle} (${d.servings || 4} pers.)`)
      .join(', ');

    lines.push(`BOODSCHAPPENLIJST (${monFormatted} t/m ${sunFormatted})`);
    lines.push(`Gerechten (${shoppingListData.totalRecipes}): ${dishSummaries}`);
    lines.push('========================================');

    if (activeView === 'category') {
      const categoryMap = new Map();
      CATEGORIES.forEach(cat => categoryMap.set(cat.id, { ...cat, items: [] }));

      (shoppingListData.combined || []).forEach(item => {
        const cat = getCategoryForIngredient(item.name);
        categoryMap.get(cat.id).items.push(item);
      });

      const populatedCategories = Array.from(categoryMap.values()).filter(cat => cat.items.length > 0);

      populatedCategories.forEach(cat => {
        lines.push('');
        lines.push(`${cat.name.toUpperCase()}`);
        lines.push('----------------------------------------');
        cat.items.forEach(item => {
          const itemKey = `item_${item.displayText}`;
          const isChecked = checkedItemKeys.has(itemKey);
          const checkMark = isChecked ? '[x]' : '[ ]';
          const recipeInfo = item.recipes && item.recipes.length > 0 ? ` (${item.recipes.join(', ')})` : '';
          lines.push(`${checkMark} ${item.displayText}${recipeInfo}`);
        });
      });
    } else if (activeView === 'combined') {
      const items = shoppingListData.combined || [];
      lines.push('');
      items.forEach(item => {
        const itemKey = `item_${item.displayText}`;
        const isChecked = checkedItemKeys.has(itemKey);
        const checkMark = isChecked ? '[x]' : '[ ]';
        const recipeInfo = item.recipes && item.recipes.length > 0 ? ` (${item.recipes.join(', ')})` : '';
        lines.push(`${checkMark} ${item.displayText}${recipeInfo}`);
      });
    } else {
      const days = (shoppingListData.byDay || []).filter(d => d.recipeTitle && d.ingredients && d.ingredients.length > 0);
      days.forEach(day => {
        lines.push('');
        lines.push(`--- ${day.dayName.toUpperCase()}: ${day.recipeTitle} (${day.servings || 4} personen) ---`);
        day.ingredients.forEach(ing => {
          const qtyFormatted = App.formatQuantity(ing.quantity);
          const qtyStr = qtyFormatted
            ? `${qtyFormatted}${ing.unit ? ` ${ing.unit}` : ''}`
            : (ing.unit || '');
          const fullText = qtyStr ? `${qtyStr} ${ing.name}` : ing.name;
          const itemKey = `day_${day.date}_${fullText}`;
          const isChecked = checkedItemKeys.has(itemKey);
          const checkMark = isChecked ? '[x]' : '[ ]';
          const notesText = ing.notes ? ` (${ing.notes})` : '';
          lines.push(`${checkMark} ${fullText}${notesText}`);
        });
      });
    }

    lines.push('');
    lines.push('Gegenereerd via Receptenboekje');
    return lines.join('\n');
  }

  // Copy plain text to Clipboard
  document.getElementById('copyShoppingListBtn')?.addEventListener('click', async () => {
    const text = generatePlainText();
    if (!text) return;

    const copyBtn = document.getElementById('copyShoppingListBtn');
    const originalHtml = copyBtn.innerHTML;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      copyBtn.innerHTML = '<i data-lucide="check"></i> <span>Gekopieerd!</span>';
      copyBtn.classList.remove('btn-primary');
      copyBtn.classList.add('btn-success');
      if (window.lucide) lucide.createIcons();

      App.showToast('Boodschappenlijst gekopieerd naar klembord!', 'success');

      setTimeout(() => {
        copyBtn.innerHTML = originalHtml;
        copyBtn.classList.remove('btn-success');
        copyBtn.classList.add('btn-primary');
        if (window.lucide) lucide.createIcons();
      }, 2500);

    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      App.showToast('Kopiëren mislukt. Probeer het handmatig.', 'error');
    }
  });

  // Download plain text file (.txt)
  document.getElementById('downloadShoppingListBtn')?.addEventListener('click', () => {
    const text = generatePlainText();
    if (!text || !shoppingListData) return;

    const monday = shoppingListData.monday;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `boodschappenlijst-week-${monday}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    App.showToast('Boodschappenlijst gedownload als .txt bestand!', 'success');
  });

})(window.App);
