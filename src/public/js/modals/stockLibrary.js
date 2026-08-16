'use strict';

// ── STOCK PHOTO LIBRARY & ONLINE SEARCH MODAL CONTROLLER ───────────────────────
(function(App) {

  let activeTab = 'local'; // 'local' | 'online'
  let searchQuery = '';
  let activeCategory = 'all';
  let isFetchingLocal = false;

  // Online search state
  let onlineQuery = '';
  let isSearchingOnline = false;
  let onlineSearchResults = [];
  let onlineSearchDebounceTimer = null;
  let downloadingCardId = null;

  const CATEGORIES = [
    { id: 'all', name: 'Alles' },
    { id: 'pasta', name: 'Pasta & Italiaans' },
    { id: 'burgers', name: 'Burgers & BBQ' },
    { id: 'salades', name: 'Salades & Groenten' },
    { id: 'soepen', name: 'Soepen & Stoofpotten' },
    { id: 'ontbijt', name: 'Ontbijt & Lunch' },
    { id: 'aziatisch', name: 'Aziatisch & Sushi' },
    { id: 'vis', name: 'Vis & Zeevruchten' },
    { id: 'desserts', name: 'Desserts & Gebak' },
    { id: 'mexicaans', name: 'Mexicaans' },
    { id: 'dranken', name: 'Dranken' }
  ];

  // Fetch stock images manifest from backend
  async function ensureStockImagesLoaded() {
    if (App.state.stockImages && App.state.stockImages.length > 0) {
      return App.state.stockImages;
    }
    if (isFetchingLocal) return [];

    isFetchingLocal = true;
    try {
      const stockImages = await App.apiFetch('/api/recipes/stock-images');
      App.state.stockImages = Array.isArray(stockImages) ? stockImages : [];
      return App.state.stockImages;
    } catch (err) {
      console.error('Error fetching stock images:', err);
      App.showToast('Kon voorraadfoto\'s niet laden', 'error');
      return [];
    } finally {
      isFetchingLocal = false;
    }
  }

  // Open the stock library modal
  async function openStockLibraryModal(initialTab = 'local') {
    const modal = document.getElementById('stockLibraryModal');
    if (!modal) return;

    activeTab = initialTab;
    activeCategory = 'all';

    // Check if a recipe title has already been entered in the recipe form
    const recipeTitleInput = document.getElementById('recipeTitleInput');
    const existingRecipeTitle = recipeTitleInput ? recipeTitleInput.value.trim() : '';

    const searchInput = document.getElementById('stockSearchInput');
    const clearSearchBtn = document.getElementById('clearStockSearchBtn');
    const onlineInput = document.getElementById('stockOnlineSearchInput');
    const clearOnlineBtn = document.getElementById('clearStockOnlineSearchBtn');

    if (existingRecipeTitle) {
      searchQuery = existingRecipeTitle;
      onlineQuery = existingRecipeTitle;

      if (searchInput) searchInput.value = existingRecipeTitle;
      clearSearchBtn?.classList.remove('hidden');

      if (onlineInput) onlineInput.value = existingRecipeTitle;
      clearOnlineBtn?.classList.remove('hidden');

      // Pre-load online search results for the recipe title
      performOnlineSearch(existingRecipeTitle);
    } else {
      searchQuery = '';
      onlineQuery = '';

      if (searchInput) searchInput.value = '';
      clearSearchBtn?.classList.add('hidden');

      if (onlineInput) onlineInput.value = '';
      clearOnlineBtn?.classList.add('hidden');
    }

    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }

    // Switch tab UI
    switchTab(activeTab);

    // Initial render
    renderCategoryChips();
    renderLocalImageGridLoading();

    const images = await ensureStockImagesLoaded();
    renderCategoryChips();
    renderStockGrid(images);

    // Update tab counter
    const tabCount = document.getElementById('stockTabCount');
    if (tabCount) tabCount.textContent = images.length;

    // Reset scroll to top
    const body = modal.querySelector('.stock-library-body');
    if (body) body.scrollTop = 0;
  }

  // Switch between Local Library and Online Search Tabs
  function switchTab(tab) {
    activeTab = tab;

    const modalHeading = document.getElementById('stockModalHeading');
    const modalSubheading = document.getElementById('stockModalSubheading');
    const localView = document.getElementById('stockLocalView');
    const onlineView = document.getElementById('stockOnlineView');
    const tabBtns = document.querySelectorAll('.stock-tab-btn');
    const countIndicator = document.getElementById('stockCountIndicator');

    tabBtns.forEach(btn => {
      if (btn.getAttribute('data-stock-tab') === tab) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (tab === 'local') {
      localView?.classList.remove('hidden');
      onlineView?.classList.add('hidden');
      if (modalHeading) modalHeading.textContent = 'Kies een Foto uit de Bibliotheek';
      if (modalSubheading) modalSubheading.textContent = 'Selecteer uit onze collectie van hoogwaardige gerechtenfoto\'s';
      renderStockGrid();
    } else {
      localView?.classList.add('hidden');
      onlineView?.classList.remove('hidden');
      if (modalHeading) modalHeading.textContent = 'Zoek Foto\'s op het Internet';
      if (modalSubheading) modalSubheading.textContent = 'Doorzoek het web naar miljoenen gerechtenfoto\'s';

      const onlineInput = document.getElementById('stockOnlineSearchInput');
      const queryToSearch = onlineInput ? onlineInput.value.trim() : '';

      if (queryToSearch && (!onlineSearchResults || onlineSearchResults.length === 0) && !isSearchingOnline) {
        performOnlineSearch(queryToSearch);
      } else if (countIndicator) {
        if (onlineSearchResults.length > 0) {
          countIndicator.textContent = `${onlineSearchResults.length} online foto's gevonden`;
        } else {
          countIndicator.textContent = 'Online zoekmachine';
        }
      }

      // Auto focus online search if empty
      if (onlineInput && !onlineInput.value.trim()) {
        setTimeout(() => onlineInput.focus(), 100);
      }
    }

    if (window.lucide) lucide.createIcons();
  }

  // Render Category Filter Chips
  function renderCategoryChips() {
    const container = document.getElementById('stockCategoriesContainer');
    if (!container) return;

    const allImages = App.state.stockImages || [];

    container.innerHTML = CATEGORIES.map(cat => {
      let count = 0;
      if (cat.id === 'all') {
        count = allImages.length;
      } else {
        count = allImages.filter(img => img.category === cat.id).length;
      }

      const isActive = cat.id === activeCategory;
      return `
        <button type="button" 
                class="stock-category-chip ${isActive ? 'active' : ''}" 
                data-stock-cat="${cat.id}">
          <span>${App.escapeHtml(cat.name)}</span>
          <span class="chip-count">${count}</span>
        </button>
      `;
    }).join('');
  }

  // Render Loading Placeholder Grid for Local
  function renderLocalImageGridLoading() {
    const grid = document.getElementById('stockImageGrid');
    if (!grid) return;

    document.getElementById('stockEmptyState')?.classList.add('hidden');
    grid.innerHTML = Array(8).fill(0).map(() => `
      <div class="stock-card skeleton-card">
        <div class="stock-card-img-placeholder"></div>
        <div class="stock-card-meta">
          <div class="skeleton-line line-title"></div>
          <div class="skeleton-line line-badge"></div>
        </div>
      </div>
    `).join('');
  }

  // Render Stock Image Grid with search & category filters
  function renderStockGrid(imagesList) {
    const grid = document.getElementById('stockImageGrid');
    const emptyState = document.getElementById('stockEmptyState');
    const countIndicator = document.getElementById('stockCountIndicator');
    if (!grid) return;

    const list = imagesList || App.state.stockImages || [];
    const q = searchQuery.trim().toLowerCase();

    const filtered = list.filter(item => {
      // Category match
      if (activeCategory !== 'all' && item.category !== activeCategory) {
        return false;
      }

      // Search match
      if (q) {
        const titleMatch = (item.title || '').toLowerCase().includes(q);
        const catMatch = (item.categoryName || '').toLowerCase().includes(q);
        const tagMatch = (item.tags || []).some(t => t.toLowerCase().includes(q));
        return titleMatch || catMatch || tagMatch;
      }

      return true;
    });

    if (activeTab === 'local' && countIndicator) {
      countIndicator.textContent = `${filtered.length} van ${list.length} foto's`;
    }

    if (filtered.length === 0) {
      grid.innerHTML = '';
      emptyState?.classList.remove('hidden');
      return;
    }

    emptyState?.classList.add('hidden');

    grid.innerHTML = filtered.map(item => {
      const isSelected = App.state.selectedStockImage === item.filename;
      return `
        <div class="stock-card ${isSelected ? 'selected' : ''}" 
             data-stock-filename="${item.filename}"
             data-stock-title="${App.escapeHtml(item.title)}"
             tabindex="0" role="button" aria-label="Kies ${App.escapeHtml(item.title)}">
          <div class="stock-card-img-wrapper">
            <img src="/uploads/${item.filename}" alt="${App.escapeHtml(item.title)}" loading="lazy">
            <span class="stock-card-badge">${App.escapeHtml(item.categoryName || '')}</span>
            <div class="stock-card-overlay">
              <i data-lucide="${isSelected ? 'check-circle-2' : 'plus-circle'}" class="overlay-icon"></i>
              <span class="overlay-text">${isSelected ? 'Gekozen' : 'Kies deze foto'}</span>
            </div>
          </div>
          <div class="stock-card-info">
            <h4 class="stock-card-title">${App.escapeHtml(item.title)}</h4>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  // ── ONLINE SEARCH FUNCTIONS ───────────────────────────────────────────────────

  function renderOnlineImageGridLoading() {
    const grid = document.getElementById('stockOnlineImageGrid');
    const initialState = document.getElementById('stockOnlineInitialState');
    const emptyState = document.getElementById('stockOnlineEmptyState');
    const errorState = document.getElementById('stockOnlineErrorState');

    initialState?.classList.add('hidden');
    emptyState?.classList.add('hidden');
    errorState?.classList.add('hidden');

    if (!grid) return;

    grid.innerHTML = Array(8).fill(0).map(() => `
      <div class="stock-card skeleton-card">
        <div class="stock-card-img-placeholder"></div>
        <div class="stock-card-meta">
          <div class="skeleton-line line-title"></div>
          <div class="skeleton-line line-badge"></div>
        </div>
      </div>
    `).join('');
  }

  async function performOnlineSearch(query) {
    const q = (query || '').trim();
    if (!q) {
      document.getElementById('stockOnlineInitialState')?.classList.remove('hidden');
      document.getElementById('stockOnlineEmptyState')?.classList.add('hidden');
      document.getElementById('stockOnlineErrorState')?.classList.add('hidden');
      const grid = document.getElementById('stockOnlineImageGrid');
      if (grid) grid.innerHTML = '';
      return;
    }

    onlineQuery = q;
    isSearchingOnline = true;
    renderOnlineImageGridLoading();

    const countIndicator = document.getElementById('stockCountIndicator');
    if (countIndicator) countIndicator.textContent = `Zoeken naar "${q}"...`;

    try {
      const results = await App.apiFetch(`/api/recipes/search-online-images?q=${encodeURIComponent(q)}`);
      onlineSearchResults = Array.isArray(results) ? results : [];
      renderOnlineGrid(onlineSearchResults);
    } catch (err) {
      console.error('Error searching online images:', err);
      const grid = document.getElementById('stockOnlineImageGrid');
      if (grid) grid.innerHTML = '';
      document.getElementById('stockOnlineInitialState')?.classList.add('hidden');
      document.getElementById('stockOnlineEmptyState')?.classList.add('hidden');
      document.getElementById('stockOnlineErrorState')?.classList.remove('hidden');
      if (countIndicator) countIndicator.textContent = 'Zoekfout opgetreden';
    } finally {
      isSearchingOnline = false;
    }
  }

  function renderOnlineGrid(results) {
    const grid = document.getElementById('stockOnlineImageGrid');
    const initialState = document.getElementById('stockOnlineInitialState');
    const emptyState = document.getElementById('stockOnlineEmptyState');
    const errorState = document.getElementById('stockOnlineErrorState');
    const countIndicator = document.getElementById('stockCountIndicator');

    if (!grid) return;

    initialState?.classList.add('hidden');
    errorState?.classList.add('hidden');

    if (!results || results.length === 0) {
      grid.innerHTML = '';
      emptyState?.classList.remove('hidden');
      if (countIndicator) countIndicator.textContent = `0 foto's voor "${onlineQuery}"`;
      return;
    }

    emptyState?.classList.add('hidden');
    if (countIndicator) countIndicator.textContent = `${results.length} gerechtenfoto's voor "${onlineQuery}"`;

    grid.innerHTML = results.map(item => {
      const isDownloading = downloadingCardId === item.id;
      const thumb = item.thumbnail || item.full_url;
      const full = item.full_url || item.thumbnail;
      const safeThumb = App.escapeHtml(thumb);
      const safeFull = App.escapeHtml(full);

      return `
        <div class="stock-card ${isDownloading ? 'downloading' : ''}" 
             data-online-id="${App.escapeHtml(item.id)}"
             data-online-url="${safeFull}"
             data-online-thumb="${safeThumb}"
             data-online-title="${App.escapeHtml(item.title)}"
             tabindex="0" role="button" aria-label="Kies ${App.escapeHtml(item.title)}">
          <div class="stock-card-img-wrapper">
            <img src="${safeThumb}" 
                 alt="${App.escapeHtml(item.title)}" 
                 loading="lazy" 
                 referrerpolicy="no-referrer"
                 class="online-dish-preview"
                 data-src="${safeThumb}">
            <span class="stock-card-badge">${App.escapeHtml(item.source || 'Web')}</span>
            <div class="stock-card-overlay">
              ${isDownloading 
                ? `<div class="spinner-download"></div><span class="overlay-text">Opslaan in kookboek...</span>`
                : `<i data-lucide="download" class="overlay-icon"></i><span class="overlay-text">Kies deze foto</span>`
              }
            </div>
          </div>
          <div class="stock-card-info">
            <h4 class="stock-card-title">${App.escapeHtml(item.title)}</h4>
            <div class="stock-card-meta-line" title="Bron: ${App.escapeHtml(item.creator || '')}">
              <i data-lucide="globe"></i>
              <span>${App.escapeHtml(item.creator || 'Web resultaat')}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach dynamic proxy fallback to any image that fails to load directly
    grid.querySelectorAll('img.online-dish-preview').forEach(img => {
      img.addEventListener('error', function onImgError() {
        if (!this.dataset.proxied) {
          this.dataset.proxied = '1';
          const originalSrc = this.getAttribute('data-src') || this.src;
          this.src = `/api/recipes/image-proxy?url=${encodeURIComponent(originalSrc)}`;
        }
      });
    });

    if (window.lucide) lucide.createIcons();
  }

  // Handle Online Image Selection & Local Download
  async function selectOnlineImage(cardEl, fullUrl, thumbUrl, title) {
    if (!cardEl || (!fullUrl && !thumbUrl) || downloadingCardId) return;

    const cardId = cardEl.getAttribute('data-online-id');
    downloadingCardId = cardId;
    cardEl.classList.add('downloading');

    const overlay = cardEl.querySelector('.stock-card-overlay');
    if (overlay) {
      overlay.innerHTML = `<div class="spinner-download"></div><span class="overlay-text">Opslaan in kookboek...</span>`;
    }

    try {
      const response = await App.apiFetch('/api/recipes/download-online-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: fullUrl || thumbUrl,
          fallback_url: thumbUrl || fullUrl,
          title: title || 'Online foto'
        })
      });

      if (!response || !response.filename) {
        throw new Error('Ongeldig antwoord van server');
      }

      // Select local downloaded image
      selectStockImage(response.filename, response.title, true);
    } catch (err) {
      console.error('Error downloading online image:', err);
      App.showToast('Fout bij het downloaden van de foto. Probeer een andere afbeelding.', 'error');
      cardEl.classList.remove('downloading');
      if (overlay) {
        overlay.innerHTML = `<i data-lucide="download" class="overlay-icon"></i><span class="overlay-text">Kies deze foto</span>`;
        if (window.lucide) lucide.createIcons();
      }
    } finally {
      downloadingCardId = null;
    }
  }

  // Handle image selection in Recipe Form
  function selectStockImage(filename, title, isOnlineDownload = false) {
    App.state.selectedStockImage = filename;

    // Clear uploaded file input
    const fileInput = document.getElementById('recipeImageFile');
    if (fileInput) fileInput.value = '';

    // Update recipe form preview
    const previewContainer = document.getElementById('imagePreviewContainer');
    const imgEl = document.getElementById('recipeImagePreview');
    const removeBtn = document.getElementById('removeRecipeImageBtn');
    const badge = document.getElementById('selectedStockBadge');
    const badgeText = document.getElementById('selectedStockText');

    if (previewContainer) previewContainer.classList.remove('empty');
    if (imgEl) {
      imgEl.src = `/uploads/${filename}`;
      imgEl.classList.remove('hidden');
    }
    if (removeBtn) removeBtn.classList.remove('hidden');
    if (badge && badgeText) {
      badgeText.textContent = isOnlineDownload ? `Online foto: ${title || 'Geselecteerd'}` : `Stockfoto: ${title || 'Geselecteerd'}`;
      badge.classList.remove('hidden');
    }

    // Close modal
    const modal = document.getElementById('stockLibraryModal');
    if (modal && typeof modal.close === 'function') {
      modal.close();
    }

    App.showToast(`Foto "${title || 'Afbeelding'}" ingesteld voor recept`, 'success');
  }

  // ── BIND EVENT LISTENERS ───────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    // Open modal button
    document.addEventListener('click', (e) => {
      const openBtn = e.target.closest('#openStockModalBtn');
      if (openBtn) {
        e.preventDefault();
        openStockLibraryModal('local');
      }
    });

    // Tab switcher click handler
    document.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('.stock-tab-btn');
      if (tabBtn) {
        const tab = tabBtn.getAttribute('data-stock-tab');
        switchTab(tab);
      }
    });

    // Category click handler (Local)
    document.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-stock-cat]');
      if (chip) {
        activeCategory = chip.getAttribute('data-stock-cat');
        renderCategoryChips();
        renderStockGrid();
      }
    });

    // Local Card select handler
    document.addEventListener('click', (e) => {
      const card = e.target.closest('[data-stock-filename]');
      if (card) {
        const filename = card.getAttribute('data-stock-filename');
        const title = card.getAttribute('data-stock-title');
        selectStockImage(filename, title, false);
      }
    });

    // Online Card select handler
    document.addEventListener('click', (e) => {
      const card = e.target.closest('[data-online-url]');
      if (card) {
        const fullUrl = card.getAttribute('data-online-url');
        const thumbUrl = card.getAttribute('data-online-thumb');
        const title = card.getAttribute('data-online-title');
        selectOnlineImage(card, fullUrl, thumbUrl, title);
      }
    });

    // Keyboard enter/space select on local & online cards
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const localCard = e.target.closest('[data-stock-filename]');
        if (localCard) {
          e.preventDefault();
          const filename = localCard.getAttribute('data-stock-filename');
          const title = localCard.getAttribute('data-stock-title');
          selectStockImage(filename, title, false);
          return;
        }

        const onlineCard = e.target.closest('[data-online-url]');
        if (onlineCard) {
          e.preventDefault();
          const fullUrl = onlineCard.getAttribute('data-online-url');
          const thumbUrl = onlineCard.getAttribute('data-online-thumb');
          const title = onlineCard.getAttribute('data-online-title');
          selectOnlineImage(onlineCard, fullUrl, thumbUrl, title);
        }
      }
    });

    // Local Search input typing
    const searchInput = document.getElementById('stockSearchInput');
    const clearSearchBtn = document.getElementById('clearStockSearchBtn');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        if (searchQuery) {
          clearSearchBtn?.classList.remove('hidden');
        } else {
          clearSearchBtn?.classList.add('hidden');
        }
        renderStockGrid();
      });
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.classList.add('hidden');
        renderStockGrid();
      });
    }

    // Reset filters button in local empty state
    document.getElementById('resetStockFiltersBtn')?.addEventListener('click', () => {
      searchQuery = '';
      activeCategory = 'all';
      if (searchInput) searchInput.value = '';
      clearSearchBtn?.classList.add('hidden');
      renderCategoryChips();
      renderStockGrid();
    });

    // Online Search inputs and triggers
    const onlineInput = document.getElementById('stockOnlineSearchInput');
    const clearOnlineBtn = document.getElementById('clearStockOnlineSearchBtn');
    const executeOnlineBtn = document.getElementById('executeOnlineSearchBtn');

    if (onlineInput) {
      onlineInput.addEventListener('input', (e) => {
        const val = e.target.value;
        if (val) {
          clearOnlineBtn?.classList.remove('hidden');
        } else {
          clearOnlineBtn?.classList.add('hidden');
        }

        clearTimeout(onlineSearchDebounceTimer);
        if (val.trim().length >= 3) {
          onlineSearchDebounceTimer = setTimeout(() => {
            performOnlineSearch(val);
          }, 450);
        }
      });

      onlineInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          clearTimeout(onlineSearchDebounceTimer);
          performOnlineSearch(onlineInput.value);
        }
      });
    }

    if (clearOnlineBtn) {
      clearOnlineBtn.addEventListener('click', () => {
        if (onlineInput) onlineInput.value = '';
        clearOnlineBtn.classList.add('hidden');
        performOnlineSearch('');
      });
    }

    if (executeOnlineBtn) {
      executeOnlineBtn.addEventListener('click', () => {
        if (onlineInput) {
          performOnlineSearch(onlineInput.value);
        }
      });
    }

    // Online suggestion chips click
    document.addEventListener('click', (e) => {
      const chip = e.target.closest('.online-tag-chip');
      if (chip) {
        const q = chip.getAttribute('data-online-query');
        if (onlineInput) {
          onlineInput.value = q;
          clearOnlineBtn?.classList.remove('hidden');
        }
        performOnlineSearch(q);
      }
    });

    // Retry online search button
    document.getElementById('retryOnlineSearchBtn')?.addEventListener('click', () => {
      if (onlineInput) performOnlineSearch(onlineInput.value);
    });
  });

  // Attach module method
  App.openStockLibraryModal = openStockLibraryModal;

})(window.App || (window.App = {}));
