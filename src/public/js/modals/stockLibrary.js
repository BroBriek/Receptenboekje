'use strict';

// ── STOCK PHOTO LIBRARY MODAL CONTROLLER ───────────────────────────────────────
(function(App) {

  let searchQuery = '';
  let activeCategory = 'all';
  let isFetching = false;

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
    if (isFetching) return [];

    isFetching = true;
    try {
      const stockImages = await App.apiFetch('/api/recipes/stock-images');
      App.state.stockImages = Array.isArray(stockImages) ? stockImages : [];
      return App.state.stockImages;
    } catch (err) {
      console.error('Error fetching stock images:', err);
      App.showToast('Kon voorraadfoto\'s niet laden', 'error');
      return [];
    } finally {
      isFetching = false;
    }
  }

  // Open the stock library modal
  async function openStockLibraryModal() {
    const modal = document.getElementById('stockLibraryModal');
    if (!modal) return;

    searchQuery = '';
    activeCategory = 'all';

    const searchInput = document.getElementById('stockSearchInput');
    if (searchInput) searchInput.value = '';
    document.getElementById('clearStockSearchBtn')?.classList.add('hidden');

    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }

    renderCategoryChips();
    renderImageGridLoading();

    const images = await ensureStockImagesLoaded();
    renderCategoryChips();
    renderStockGrid(images);
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

  // Render Loading Placeholder Grid
  function renderImageGridLoading() {
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

    if (countIndicator) {
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

  // Handle image selection
  function selectStockImage(filename, title) {
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
      badgeText.textContent = `Stockfoto: ${title || 'Geselecteerd'}`;
      badge.classList.remove('hidden');
    }

    // Close modal
    const modal = document.getElementById('stockLibraryModal');
    if (modal && typeof modal.close === 'function') {
      modal.close();
    }

    App.showToast(`Stockfoto "${title || 'Afbeelding'}" geselecteerd`, 'info');
  }

  // Bind Event Listeners
  document.addEventListener('DOMContentLoaded', () => {
    // Open modal button
    document.addEventListener('click', (e) => {
      const openBtn = e.target.closest('#openStockModalBtn');
      if (openBtn) {
        e.preventDefault();
        openStockLibraryModal();
      }
    });

    // Category click handler
    document.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-stock-cat]');
      if (chip) {
        activeCategory = chip.getAttribute('data-stock-cat');
        renderCategoryChips();
        renderStockGrid();
      }
    });

    // Card select handler
    document.addEventListener('click', (e) => {
      const card = e.target.closest('[data-stock-filename]');
      if (card) {
        const filename = card.getAttribute('data-stock-filename');
        const title = card.getAttribute('data-stock-title');
        selectStockImage(filename, title);
      }
    });

    // Keyboard enter/space select on stock card
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const card = e.target.closest('[data-stock-filename]');
        if (card) {
          e.preventDefault();
          const filename = card.getAttribute('data-stock-filename');
          const title = card.getAttribute('data-stock-title');
          selectStockImage(filename, title);
        }
      }
    });

    // Search input typing
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

    // Reset filters button in empty state
    document.getElementById('resetStockFiltersBtn')?.addEventListener('click', () => {
      searchQuery = '';
      activeCategory = 'all';
      if (searchInput) searchInput.value = '';
      clearSearchBtn?.classList.add('hidden');
      renderCategoryChips();
      renderStockGrid();
    });
  });

  // Attach module method
  App.openStockLibraryModal = openStockLibraryModal;

})(window.App || (window.App = {}));
