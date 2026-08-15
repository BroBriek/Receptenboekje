'use strict';

// ── MODAL: VIEW FULL NOTE ─────────────────────────────────────────────────────
(function(App) {

  let activeNoteDayDate = null;

  function openViewNoteModal(dayName, date, fullNote) {
    activeNoteDayDate = date;
    const modal = document.getElementById('viewNoteModal');
    const title = document.getElementById('viewNoteModalTitle');
    const text = document.getElementById('viewNoteFullText');

    title.textContent = `📝 Notitie: ${dayName} (${App.formatDutchDate(date)})`;
    text.textContent = fullNote;

    modal.showModal();
    if (window.lucide) lucide.createIcons();
  }

  document.getElementById('editDayFromNoteBtn')?.addEventListener('click', () => {
    const noteModal = document.getElementById('viewNoteModal');
    if (noteModal) noteModal.close();

    if (activeNoteDayDate) {
      const planItem = App.state.currentMealPlan ? App.state.currentMealPlan.find(item => item.date === activeNoteDayDate) : null;
      const entry = planItem ? planItem.entry : null;
      const recipeId = entry && entry.recipe_id ? entry.recipe_id : '';
      const isSkipped = entry ? (entry.skip_planning == 1 || entry.skip_planning === true) : false;
      const notes = entry && entry.notes ? entry.notes : '';
      App.openEditDayModal(activeNoteDayDate, recipeId, isSkipped, notes);
    }
  });

  App.openViewNoteModal = openViewNoteModal;

})(window.App);
