'use strict';

// ── APP NAMESPACE & STATE MANAGEMENT ─────────────────────────────────────────
window.App = {
  state: {
    token: localStorage.getItem('token') || null,
    user: null,
    currentWeekMonday: null, // YYYY-MM-DD
    currentMealPlan: null,   // Holds the latest 7-day plan array
    allRecipes: [],
    allTags: [],
    
    // Recipe form state
    recipeFormIngredients: [],
    recipeFormSteps: [],
    recipeFormSelectedTagIds: new Set(),
    currentEditingRecipeId: null,
    
    // Day edit state
    currentEditDayRecipeId: null,
    
    // UI states
    currentView: 'Planner',
    lockedDates: new Set() // dates (YYYY-MM-DD) locked in the current planner
  }
};
