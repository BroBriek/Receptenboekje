'use strict';

// ── GLOBAL HANDLERS & BOOTSTRAP ───────────────────────────────────────────────
(function(App) {

  // Generic modal close handler for [data-close-modal]
  document.addEventListener('click', (e) => {
    const closeBtn = e.target.closest('[data-close-modal]');
    if (closeBtn) {
      const modalId = closeBtn.getAttribute('data-close-modal');
      const modal = document.getElementById(modalId);
      if (modal && typeof modal.close === 'function') {
        modal.close();
      }
    }
  });

  // Light-dismiss dialog click fallback
  document.querySelectorAll('dialog[closedby="any"]').forEach(dialog => {
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      dialog.addEventListener('click', (event) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent = (
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width
        );
        if (isDialogContent) return;
        dialog.close();
      });
    }
  });

  // ── BOOTSTRAP APP ─────────────────────────────────────────────────────────
  App.checkAuth();

})(window.App);
