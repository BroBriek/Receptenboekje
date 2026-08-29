'use strict';

// ── FULLSCREEN COOKING MODE VIEW ──────────────────────────────────────────────
(function(App) {

  let session = {
    recipe: null,
    currentStepIndex: 0,
    servings: 4,
    baseServings: 4,
    completedSteps: new Set(),
    checkedIngredients: new Set(),
    timers: new Map(), // key: 'step_X' or 'custom_Y' -> { id, totalSec, remainingSec, isRunning, intervalId, label, isFinished }
    wakeLock: null,
    isIngredientsOpen: false
  };

  // ── Wake Lock API helper ──
  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        session.wakeLock = await navigator.wakeLock.request('screen');
        updateWakeLockUI(true);
        session.wakeLock.addEventListener('release', () => {
          session.wakeLock = null;
          updateWakeLockUI(false);
        });
      }
    } catch (err) {
      console.warn('Wake Lock error:', err);
      updateWakeLockUI(false);
    }
  }

  function releaseWakeLock() {
    if (session.wakeLock) {
      session.wakeLock.release().catch(() => {});
      session.wakeLock = null;
    }
    updateWakeLockUI(false);
  }

  function updateWakeLockUI(isActive) {
    const btn = document.getElementById('cookingWakeLockBtn');
    if (!btn) return;
    if (isActive) {
      btn.classList.add('active');
      btn.innerHTML = `<i data-lucide="sun-medium"></i> <span class="hide-mobile">Scherm blijft aan</span>`;
    } else {
      btn.classList.remove('active');
      btn.innerHTML = `<i data-lucide="moon"></i> <span class="hide-mobile">Scherm aan</span>`;
    }
    if (window.lucide) lucide.createIcons();
  }

  // ── Start Cooking Session ──
  async function startCookingMode(recipeOrId, options = {}) {
    try {
      let recipe = recipeOrId;
      if (typeof recipeOrId === 'string' || typeof recipeOrId === 'number') {
        recipe = await App.apiFetch(`/api/recipes/${recipeOrId}`);
      }

      if (!recipe || !recipe.steps || recipe.steps.length === 0) {
        // Fallback: if recipe has no explicit steps, create one step from description or title
        if (!recipe.steps || recipe.steps.length === 0) {
          recipe.steps = [{
            step_number: 1,
            instruction: recipe.description || 'Bereid het gerecht volgens je favoriete methode.',
            timer_seconds: null
          }];
        }
      }

      // Close recipe detail modal if open
      const detailModal = document.getElementById('recipeDetailModal');
      if (detailModal && typeof detailModal.close === 'function') {
        detailModal.close();
      }

      const initialServings = (options.servings && options.servings > 0)
        ? options.servings
        : (recipe.servings || App.state.user?.default_servings || 4);

      // Clean up previous session timers if any
      session.timers.forEach(timer => {
        if (timer.intervalId) clearInterval(timer.intervalId);
      });

      session = {
        recipe: recipe,
        currentStepIndex: options.stepIndex ? Math.min(options.stepIndex, recipe.steps.length - 1) : 0,
        servings: initialServings,
        baseServings: recipe.servings || initialServings,
        completedSteps: new Set(),
        checkedIngredients: new Set(),
        timers: new Map(),
        wakeLock: null,
        isIngredientsOpen: false
      };

      // Pre-initialize timers for steps that have timer_seconds or auto-detected durations
      recipe.steps.forEach((step, idx) => {
        const timerSec = (step.timer_seconds && step.timer_seconds > 0)
          ? step.timer_seconds
          : App.detectTimerInText(step.instruction);

        if (timerSec && timerSec > 0) {
          session.timers.set(`step_${idx}`, {
            id: `step_${idx}`,
            stepIndex: idx,
            totalSec: timerSec,
            remainingSec: timerSec,
            isRunning: false,
            intervalId: null,
            label: `Stap ${idx + 1} timer`,
            isFinished: false
          });
        }
      });

      const overlay = document.getElementById('cookingModeOverlay');
      if (overlay) {
        overlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
      }

      // Setup Header Info
      const thumbImg = document.getElementById('cookingRecipeThumb');
      const thumbPlaceholder = document.getElementById('cookingRecipeThumbPlaceholder');
      if (recipe.image_path) {
        if (thumbImg) {
          thumbImg.src = `/uploads/${recipe.image_path}`;
          thumbImg.classList.remove('hidden');
        }
        if (thumbPlaceholder) thumbPlaceholder.classList.add('hidden');
      } else {
        if (thumbImg) thumbImg.classList.add('hidden');
        if (thumbPlaceholder) thumbPlaceholder.classList.remove('hidden');
      }

      const titleEl = document.getElementById('cookingRecipeTitle');
      if (titleEl) titleEl.textContent = recipe.title;

      updateServingsDisplay();
      requestWakeLock();
      renderCookingStep(session.currentStepIndex);

      // Request browser notification permission silently if not prompted yet
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }

      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.error('Failed to start cooking mode:', err);
      App.showToast('Kon kookmodus niet starten.', 'error');
    }
  }

  // ── Close Cooking Session ──
  function closeCookingMode(force = false) {
    const hasRunningTimers = Array.from(session.timers.values()).some(t => t.isRunning);

    if (!force && hasRunningTimers) {
      if (!confirm('Er loopt nog een kookwekker. Weet je zeker dat je de kookmodus wilt afsluiten?')) {
        return;
      }
    }

    // Stop all timers
    session.timers.forEach(timer => {
      if (timer.intervalId) clearInterval(timer.intervalId);
    });

    releaseWakeLock();

    // Exit browser fullscreen if in fullscreen
    if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
      document.exitFullscreen().catch(() => {});
    }

    const overlay = document.getElementById('cookingModeOverlay');
    if (overlay) overlay.classList.add('hidden');
    document.body.style.overflow = '';

    // Close ingredients drawer
    toggleIngredientsDrawer(false);
  }

  // ── Render Step & Navigation ──
  function renderCookingStep(index) {
    if (!session.recipe || !session.recipe.steps) return;
    const totalSteps = session.recipe.steps.length;
    session.currentStepIndex = Math.max(0, Math.min(index, totalSteps - 1));
    const step = session.recipe.steps[session.currentStepIndex];

    // Hide completion screen, show main stage
    document.getElementById('cookingMainStage')?.classList.remove('hidden');
    document.getElementById('cookingCelebrationStage')?.classList.add('hidden');

    // Update Step Badge in Header
    const stepBadge = document.getElementById('cookingStepBadge');
    if (stepBadge) {
      stepBadge.textContent = `Stap ${session.currentStepIndex + 1} van ${totalSteps}`;
    }

    // Update Progress Fill
    const progressFill = document.getElementById('cookingProgressFill');
    if (progressFill) {
      const progressPercent = ((session.currentStepIndex + 1) / totalSteps) * 100;
      progressFill.style.width = `${progressPercent}%`;
    }

    // Update Step Stepper Pills
    const pillsContainer = document.getElementById('cookingStepPills');
    if (pillsContainer) {
      pillsContainer.innerHTML = session.recipe.steps.map((_, i) => {
        const isActive = i === session.currentStepIndex;
        const isCompleted = session.completedSteps.has(i);
        const hasTimer = session.timers.has(`step_${i}`);
        const timerObj = hasTimer ? session.timers.get(`step_${i}`) : null;
        const timerRunning = timerObj && timerObj.isRunning;

        let iconOrNum = `${i + 1}`;
        if (timerRunning) {
          iconOrNum = `<i data-lucide="timer" style="width:13px;height:13px;"></i>`;
        } else if (isCompleted && !isActive) {
          iconOrNum = `<i data-lucide="check" style="width:13px;height:13px;"></i>`;
        }

        return `
          <button type="button" class="cooking-step-pill ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}" 
            data-jump-step="${i}" title="Ga naar stap ${i + 1}" aria-label="Ga naar stap ${i + 1}">
            ${iconOrNum}
          </button>
        `;
      }).join('');

      // Auto-scroll active pill into view smoothly
      requestAnimationFrame(() => {
        const activePill = pillsContainer.querySelector('.cooking-step-pill.active');
        if (activePill) {
          activePill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      });
    }

    // Update Step Instruction & Header
    const stepTag = document.getElementById('cookingCurrentStepTag');
    if (stepTag) stepTag.textContent = `Stap ${session.currentStepIndex + 1}`;

    const instructionEl = document.getElementById('cookingStepInstruction');
    if (instructionEl) instructionEl.textContent = step.instruction;

    // Update Step Done Check Button
    const checkBtn = document.getElementById('cookingStepCheckBtn');
    if (checkBtn) {
      const isChecked = session.completedSteps.has(session.currentStepIndex);
      if (isChecked) {
        checkBtn.classList.add('checked');
        checkBtn.innerHTML = `<i data-lucide="check-circle-2"></i> <span>Voltooid</span>`;
      } else {
        checkBtn.classList.remove('checked');
        checkBtn.innerHTML = `<i data-lucide="circle"></i> <span>Markeer klaar</span>`;
      }
    }

    // Render Step Timers
    renderStepTimersUI();

    // Render Floating Active Timers Dock
    renderActiveTimersDock();

    // Update Navigation Prev/Next Buttons
    const prevBtn = document.getElementById('cookingPrevBtn');
    if (prevBtn) {
      prevBtn.disabled = session.currentStepIndex === 0;
      prevBtn.innerHTML = `<i data-lucide="arrow-left"></i> <span class="nav-btn-text">Vorige</span>`;
    }

    const nextBtn = document.getElementById('cookingNextBtn');
    if (nextBtn) {
      const isLastStep = session.currentStepIndex === totalSteps - 1;
      if (isLastStep) {
        nextBtn.className = 'btn-cooking-nav btn-cooking-next btn-cooking-finish';
        nextBtn.innerHTML = `<span class="nav-btn-text">Afronden &amp; Eten!</span>`;
      } else {
        nextBtn.className = 'btn-cooking-nav btn-cooking-next';
        nextBtn.innerHTML = `<span class="nav-btn-text">Volgende</span> <i data-lucide="arrow-right"></i>`;
      }
    }

    const counterEl = document.getElementById('cookingFooterCounter');
    if (counterEl) {
      counterEl.textContent = `${session.currentStepIndex + 1} / ${totalSteps}`;
    }

    if (window.lucide) lucide.createIcons();
  }

  // ── Render Step Timers Component ──
  function renderStepTimersUI() {
    const timersContainer = document.getElementById('cookingTimersContainer');
    if (!timersContainer) return;

    // Find all timers relevant to the current step (or custom timers attached)
    const stepKey = `step_${session.currentStepIndex}`;
    const stepTimer = session.timers.get(stepKey);

    const customTimersForStep = Array.from(session.timers.values()).filter(t => t.id.startsWith(`custom_${session.currentStepIndex}_`));

    const activeTimersList = [];
    if (stepTimer) activeTimersList.push(stepTimer);
    activeTimersList.push(...customTimersForStep);

    if (activeTimersList.length === 0) {
      // Step has no timers: show quick-add timer bar
      timersContainer.innerHTML = `
        <div class="cooking-custom-timer-bar" style="border-top: none; padding-top: 0;">
          <span class="cooking-custom-timer-label"><i data-lucide="timer" style="width:14px;height:14px;vertical-align:-2px;"></i> Kookwekker toevoegen voor deze stap:</span>
          <div class="cooking-custom-timer-presets">
            <button type="button" class="cooking-preset-chip" data-add-preset-timer="60">+ 1 min</button>
            <button type="button" class="cooking-preset-chip" data-add-preset-timer="180">+ 3 min</button>
            <button type="button" class="cooking-preset-chip" data-add-preset-timer="300">+ 5 min</button>
            <button type="button" class="cooking-preset-chip" data-add-preset-timer="600">+ 10 min</button>
            <button type="button" class="cooking-preset-chip" data-add-preset-timer="900">+ 15 min</button>
            <button type="button" class="cooking-preset-chip" data-add-custom-timer="true">+ Aangepast</button>
          </div>
        </div>
      `;
      timersContainer.classList.remove('hidden');
      if (window.lucide) lucide.createIcons();
      return;
    }

    timersContainer.classList.remove('hidden');

    let timersHtml = activeTimersList.map(timer => {
      const radius = 42;
      const circumference = 2 * Math.PI * radius; // ~263.89
      const progress = timer.totalSec > 0 ? (timer.remainingSec / timer.totalSec) : 0;
      const strokeOffset = circumference * (1 - progress);

      const isRunning = timer.isRunning;
      const isFinished = timer.isFinished || (timer.remainingSec <= 0 && !isRunning);

      return `
        <div class="cooking-timer-card ${isRunning ? 'running' : ''} ${isFinished ? 'finished' : ''}" data-timer-id="${timer.id}">
          <div class="cooking-timer-left">
            <div class="cooking-timer-dial-wrapper">
              <svg class="cooking-timer-svg" viewBox="0 0 100 100">
                <circle class="cooking-timer-circle-bg" cx="50" cy="50" r="${radius}" />
                <circle class="cooking-timer-circle-progress" cx="50" cy="50" r="${radius}" 
                  style="stroke-dasharray: ${circumference}; stroke-dashoffset: ${strokeOffset};" />
              </svg>
              <div class="cooking-timer-icon-center">
                <i data-lucide="${isFinished ? 'bell-ring' : (isRunning ? 'flame' : 'timer')}" style="width:26px;height:26px;"></i>
              </div>
            </div>
            <div class="cooking-timer-info">
              <span class="cooking-timer-digits">${App.formatTimerDisplay(timer.remainingSec)}</span>
              <span class="cooking-timer-label">${App.escapeHtml(timer.label)}</span>
            </div>
          </div>
          <div class="cooking-timer-actions">
            <button type="button" class="btn-timer-primary ${isRunning ? 'is-running' : ''}" data-timer-toggle="${timer.id}">
              <i data-lucide="${isRunning ? 'pause' : 'play'}"></i>
              <span>${isRunning ? 'Pauze' : (isFinished ? 'Herstart' : 'Start')}</span>
            </button>
            <div class="cooking-timer-adjust-group">
              <button type="button" class="btn-timer-secondary" data-timer-adjust="${timer.id}" data-adjust-delta="60" title="1 minuut toevoegen">
                +1 min
              </button>
              <button type="button" class="btn-timer-secondary" data-timer-adjust="${timer.id}" data-adjust-delta="300" title="5 minuten toevoegen">
                +5 min
              </button>
              <button type="button" class="btn-timer-secondary btn-icon-timer" data-timer-reset="${timer.id}" title="Reset timer" aria-label="Reset timer">
                <i data-lucide="rotate-ccw"></i>
              </button>
              ${timer.id.startsWith('custom_') ? `
                <button type="button" class="btn-timer-secondary btn-icon-timer btn-timer-del" data-timer-delete="${timer.id}" title="Verwijder timer" aria-label="Verwijder timer">
                  <i data-lucide="trash-2"></i>
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Add Preset Bar under the timer cards
    timersHtml += `
      <div class="cooking-custom-timer-bar">
        <span class="cooking-custom-timer-label">+ Extra timer toevoegen:</span>
        <div class="cooking-custom-timer-presets">
          <button type="button" class="cooking-preset-chip" data-add-preset-timer="60">+ 1 min</button>
          <button type="button" class="cooking-preset-chip" data-add-preset-timer="180">+ 3 min</button>
          <button type="button" class="cooking-preset-chip" data-add-preset-timer="300">+ 5 min</button>
          <button type="button" class="cooking-preset-chip" data-add-preset-timer="600">+ 10 min</button>
          <button type="button" class="cooking-preset-chip" data-add-custom-timer="true">+ Aangepast</button>
        </div>
      </div>
    `;

    timersContainer.innerHTML = timersHtml;
    if (window.lucide) lucide.createIcons();
  }

  // ── Timer Logic (Start, Pause, Reset, Adjust, Finished) ──
  function toggleTimer(timerId) {
    const timer = session.timers.get(timerId);
    if (!timer) return;

    if (timer.isRunning) {
      pauseTimer(timerId);
    } else {
      startTimer(timerId);
    }
  }

  function startTimer(timerId) {
    const timer = session.timers.get(timerId);
    if (!timer) return;

    if (timer.remainingSec <= 0) {
      timer.remainingSec = timer.totalSec;
      timer.isFinished = false;
    }

    timer.isRunning = true;
    timer.isFinished = false;

    if (timer.intervalId) clearInterval(timer.intervalId);

    timer.intervalId = setInterval(() => {
      if (timer.remainingSec > 0) {
        timer.remainingSec--;
        updateTimerDisplayEverywhere(timer);
      } else {
        onTimerFinished(timer);
      }
    }, 1000);

    renderStepTimersUI();
    renderActiveTimersDock();
  }

  function pauseTimer(timerId) {
    const timer = session.timers.get(timerId);
    if (!timer) return;

    timer.isRunning = false;
    if (timer.intervalId) {
      clearInterval(timer.intervalId);
      timer.intervalId = null;
    }

    renderStepTimersUI();
    renderActiveTimersDock();
  }

  function resetTimer(timerId) {
    const timer = session.timers.get(timerId);
    if (!timer) return;

    if (timer.intervalId) clearInterval(timer.intervalId);
    timer.isRunning = false;
    timer.remainingSec = timer.totalSec;
    timer.isFinished = false;

    renderStepTimersUI();
    renderActiveTimersDock();
  }

  function adjustTimer(timerId, deltaSec) {
    const timer = session.timers.get(timerId);
    if (!timer) return;

    timer.remainingSec = Math.max(0, timer.remainingSec + deltaSec);
    timer.totalSec = Math.max(timer.remainingSec, timer.totalSec + deltaSec);
    timer.isFinished = false;

    renderStepTimersUI();
    renderActiveTimersDock();
  }

  function deleteTimer(timerId) {
    const timer = session.timers.get(timerId);
    if (!timer) return;

    if (timer.intervalId) clearInterval(timer.intervalId);
    session.timers.delete(timerId);

    renderStepTimersUI();
    renderActiveTimersDock();
  }

  function onTimerFinished(timer) {
    if (timer.intervalId) {
      clearInterval(timer.intervalId);
      timer.intervalId = null;
    }
    timer.isRunning = false;
    timer.remainingSec = 0;
    timer.isFinished = true;

    // Play synthesis chime sound
    App.playTimerChime();

    // Show toast notification
    App.showToast(`⏱️ Kookwekker afgelopen: ${timer.label}!`, 'success');

    // Desktop / Mobile Browser Notification if allowed
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`⏱️ Kookwekker afgelopen!`, {
          body: `${timer.label} voor ${session.recipe.title} is klaar!`,
          icon: '/favicon-32x32.png'
        });
      } catch (e) {
        console.warn(e);
      }
    }

    renderStepTimersUI();
    renderActiveTimersDock();
  }

  function updateTimerDisplayEverywhere(timer) {
    // 1. Update on current card if visible
    const timerCard = document.querySelector(`.cooking-timer-card[data-timer-id="${timer.id}"]`);
    if (timerCard) {
      const digitsEl = timerCard.querySelector('.cooking-timer-digits');
      if (digitsEl) digitsEl.textContent = App.formatTimerDisplay(timer.remainingSec);

      const progressCircle = timerCard.querySelector('.cooking-timer-circle-progress');
      if (progressCircle) {
        const radius = 42;
        const circumference = 2 * Math.PI * radius;
        const progress = timer.totalSec > 0 ? (timer.remainingSec / timer.totalSec) : 0;
        const strokeOffset = circumference * (1 - progress);
        progressCircle.style.strokeDashoffset = `${strokeOffset}`;
      }
    }

    // 2. Update on floating dock if present
    const dockItem = document.querySelector(`.cooking-dock-pill[data-timer-id="${timer.id}"]`);
    if (dockItem) {
      const timeEl = dockItem.querySelector('.cooking-dock-time');
      if (timeEl) timeEl.textContent = App.formatTimerDisplay(timer.remainingSec);
    }
  }

  // ── Floating Active Timers Dock ──
  function renderActiveTimersDock() {
    const dockContainer = document.getElementById('cookingActiveTimersDock');
    if (!dockContainer) return;

    // Active timers from steps OTHER than current step (or running custom timers)
    const currentStepTimerKey = `step_${session.currentStepIndex}`;
    const backgroundRunningTimers = Array.from(session.timers.values()).filter(t => {
      return (t.isRunning || t.isFinished) && (t.stepIndex !== undefined && t.stepIndex !== session.currentStepIndex);
    });

    if (backgroundRunningTimers.length === 0) {
      dockContainer.innerHTML = '';
      dockContainer.classList.add('hidden');
      return;
    }

    dockContainer.classList.remove('hidden');
    dockContainer.innerHTML = backgroundRunningTimers.map(t => `
      <div class="cooking-dock-pill" data-timer-id="${t.id}">
        <div class="cooking-dock-info clickable" data-jump-step="${t.stepIndex}">
          <i data-lucide="timer" class="cooking-dock-icon" style="width:16px;height:16px;"></i>
          <span class="cooking-dock-label">${App.escapeHtml(t.label)}</span>
          <span class="cooking-dock-time">${App.formatTimerDisplay(t.remainingSec)}</span>
        </div>
        <div class="cooking-dock-actions">
          <button type="button" class="btn-dock-action" data-timer-toggle="${t.id}" title="${t.isRunning ? 'Pauzeer' : 'Start'}">
            <i data-lucide="${t.isRunning ? 'pause' : 'play'}" style="width:15px;height:15px;"></i>
          </button>
        </div>
      </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
  }

  // ── Ingredients Drawer & Servings ──
  function updateServingsDisplay() {
    const label = document.getElementById('cookingServingsLabel');
    if (label) label.textContent = session.servings;
    renderIngredientsDrawerContent();
  }

  function changeCookingServings(delta) {
    const newServings = Math.max(1, Math.min(50, session.servings + delta));
    if (newServings !== session.servings) {
      session.servings = newServings;
      updateServingsDisplay();
    }
  }

  function toggleIngredientsDrawer(open = null) {
    const drawer = document.getElementById('cookingIngredientsDrawer');
    const backdrop = document.getElementById('cookingDrawerBackdrop');
    const toggleBtn = document.getElementById('cookingIngredientsToggleBtn');

    if (open === null) {
      session.isIngredientsOpen = !session.isIngredientsOpen;
    } else {
      session.isIngredientsOpen = Boolean(open);
    }

    if (session.isIngredientsOpen) {
      drawer?.classList.add('open');
      backdrop?.classList.add('open');
      toggleBtn?.classList.add('active');
      renderIngredientsDrawerContent();
    } else {
      drawer?.classList.remove('open');
      backdrop?.classList.remove('open');
      toggleBtn?.classList.remove('active');
    }
  }

  function renderIngredientsDrawerContent() {
    const list = document.getElementById('cookingIngredientsList');
    if (!list || !session.recipe) return;

    const scaleFactor = session.baseServings > 0 ? (session.servings / session.baseServings) : 1;

    if (!session.recipe.ingredients || session.recipe.ingredients.length === 0) {
      list.innerHTML = '<li style="font-style:italic; color:var(--text-muted);">Geen ingrediënten ingevoerd.</li>';
      return;
    }

    list.innerHTML = session.recipe.ingredients.map((ing, idx) => {
      const isChecked = session.checkedIngredients.has(idx);
      let displayQty = '';
      if (typeof ing.quantity === 'number' && !isNaN(ing.quantity)) {
        displayQty = App.formatQuantity(ing.quantity * scaleFactor);
      } else if (ing.quantity) {
        displayQty = ing.quantity;
      }

      const unit = ing.unit ? ing.unit : '';
      const notes = ing.notes ? `(${ing.notes})` : '';
      const qtyUnit = (displayQty || unit) ? `<strong>${displayQty} ${unit}</strong> ` : '';

      return `
        <li class="cooking-drawer-item ${isChecked ? 'checked' : ''}" data-toggle-ingredient="${idx}">
          <input type="checkbox" class="cooking-drawer-checkbox" ${isChecked ? 'checked' : ''} tabindex="-1">
          <span class="cooking-drawer-text">${qtyUnit}${App.escapeHtml(ing.name)} ${App.escapeHtml(notes)}</span>
        </li>
      `;
    }).join('');
  }

  // ── Completion Celebration Screen ──
  function renderCompletionScreen() {
    document.getElementById('cookingMainStage')?.classList.add('hidden');
    const celebration = document.getElementById('cookingCelebrationStage');
    if (!celebration) return;

    celebration.classList.remove('hidden');

    // Launch celebratory confetti canvas
    launchConfetti();

    // Sound chime
    App.playTimerChime();

    if (window.lucide) lucide.createIcons();
  }

  function launchConfetti() {
    const canvas = document.getElementById('cookingConfettiCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#e07a5f', '#f4a261', '#81b29a', '#264653', '#e76f51', '#ffd166'];
    const particles = [];

    for (let i = 0; i < 110; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height / 2 + (Math.random() - 0.5) * 100,
        r: Math.random() * 6 + 3,
        dx: (Math.random() - 0.5) * 14,
        dy: (Math.random() - 0.8) * 16,
        color: colors[Math.floor(Math.random() * colors.length)],
        tilt: Math.floor(Math.random() * 10) - 10,
        tiltAngleInc: (Math.random() * 0.07) + 0.05,
        tiltAngle: 0
      });
    }

    let animationFrame;
    let frameCount = 0;

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frameCount++;

      particles.forEach(p => {
        p.tiltAngle += p.tiltAngleInc;
        p.y += (Math.cos(p.tiltAngle) + 1 + p.r / 2) / 2 + p.dy * 0.2;
        p.x += Math.sin(p.tiltAngle) * 2 + p.dx * 0.2;
        p.dy += 0.35; // gravity

        ctx.beginPath();
        ctx.lineWidth = p.r;
        ctx.strokeStyle = p.color;
        ctx.moveTo(p.x + p.tilt + p.r / 4, p.y);
        ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 4);
        ctx.stroke();
      });

      if (frameCount < 220) {
        animationFrame = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    draw();
  }

  // ── Toggle Fullscreen ──
  function toggleFullscreen() {
    const overlay = document.getElementById('cookingModeOverlay');
    if (!document.fullscreenElement) {
      if (overlay && overlay.requestFullscreen) {
        overlay.requestFullscreen().catch(() => {});
      } else if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }

  // ── Event Delegation & Setup ──
  const overlay = document.getElementById('cookingModeOverlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      // 1. Close cooking mode
      if (e.target.closest('#cookingCloseBtn') || e.target.closest('#cookingFinishReturnBtn')) {
        closeCookingMode();
        return;
      }

      // 2. Fullscreen toggle
      if (e.target.closest('#cookingFullscreenBtn')) {
        toggleFullscreen();
        return;
      }

      // 3. Wake Lock toggle
      if (e.target.closest('#cookingWakeLockBtn')) {
        if (session.wakeLock) {
          releaseWakeLock();
        } else {
          requestWakeLock();
        }
        return;
      }

      // 4. Ingredients drawer toggle
      if (e.target.closest('#cookingIngredientsToggleBtn') || e.target.closest('#cookingDrawerCloseBtn') || e.target.closest('#cookingDrawerBackdrop')) {
        toggleIngredientsDrawer();
        return;
      }

      // 5. Servings adjustments
      const decServingsBtn = e.target.closest('#cookingServingsDecBtn');
      if (decServingsBtn) {
        changeCookingServings(-1);
        return;
      }
      const incServingsBtn = e.target.closest('#cookingServingsIncBtn');
      if (incServingsBtn) {
        changeCookingServings(1);
        return;
      }

      // 6. Step pill jump
      const pill = e.target.closest('[data-jump-step]');
      if (pill) {
        const idx = parseInt(pill.getAttribute('data-jump-step'), 10);
        if (!isNaN(idx)) renderCookingStep(idx);
        return;
      }

      // 7. Navigation Prev / Next / Finish
      if (e.target.closest('#cookingPrevBtn')) {
        if (session.currentStepIndex > 0) renderCookingStep(session.currentStepIndex - 1);
        return;
      }
      if (e.target.closest('#cookingNextBtn')) {
        if (session.currentStepIndex < session.recipe.steps.length - 1) {
          // Auto mark step completed on progressing
          session.completedSteps.add(session.currentStepIndex);
          renderCookingStep(session.currentStepIndex + 1);
        } else {
          session.completedSteps.add(session.currentStepIndex);
          renderCompletionScreen();
        }
        return;
      }

      // 8. Step Check / Done Toggle
      if (e.target.closest('#cookingStepCheckBtn')) {
        const idx = session.currentStepIndex;
        if (session.completedSteps.has(idx)) {
          session.completedSteps.delete(idx);
        } else {
          session.completedSteps.add(idx);
        }
        renderCookingStep(idx);
        return;
      }

      // 9. Timer controls
      const toggleTimerBtn = e.target.closest('[data-timer-toggle]');
      if (toggleTimerBtn) {
        const id = toggleTimerBtn.getAttribute('data-timer-toggle');
        toggleTimer(id);
        return;
      }

      const adjustTimerBtn = e.target.closest('[data-timer-adjust]');
      if (adjustTimerBtn) {
        const id = adjustTimerBtn.getAttribute('data-timer-adjust');
        const delta = parseInt(adjustTimerBtn.getAttribute('data-adjust-delta'), 10) || 60;
        adjustTimer(id, delta);
        return;
      }

      const resetTimerBtn = e.target.closest('[data-timer-reset]');
      if (resetTimerBtn) {
        const id = resetTimerBtn.getAttribute('data-timer-reset');
        resetTimer(id);
        return;
      }

      const deleteTimerBtn = e.target.closest('[data-timer-delete]');
      if (deleteTimerBtn) {
        const id = deleteTimerBtn.getAttribute('data-timer-delete');
        deleteTimer(id);
        return;
      }

      // 10. Add Preset Timer
      const presetBtn = e.target.closest('[data-add-preset-timer]');
      if (presetBtn) {
        const sec = parseInt(presetBtn.getAttribute('data-add-preset-timer'), 10) || 300;
        const customId = `custom_${session.currentStepIndex}_${Date.now()}`;
        session.timers.set(customId, {
          id: customId,
          stepIndex: session.currentStepIndex,
          totalSec: sec,
          remainingSec: sec,
          isRunning: true,
          intervalId: null,
          label: `Timer (${Math.round(sec / 60)} min)`,
          isFinished: false
        });
        startTimer(customId);
        return;
      }

      // 11. Add Custom Timer Prompt
      const customTimerBtn = e.target.closest('[data-add-custom-timer]');
      if (customTimerBtn) {
        const inputMinutes = prompt('Hoeveel minuten wil je instellen voor de kookwekker?', '10');
        if (inputMinutes) {
          const min = parseFloat(inputMinutes.replace(',', '.'));
          if (!isNaN(min) && min > 0) {
            const sec = Math.round(min * 60);
            const customId = `custom_${session.currentStepIndex}_${Date.now()}`;
            session.timers.set(customId, {
              id: customId,
              stepIndex: session.currentStepIndex,
              totalSec: sec,
              remainingSec: sec,
              isRunning: true,
              intervalId: null,
              label: `Timer (${min} min)`,
              isFinished: false
            });
            startTimer(customId);
          }
        }
        return;
      }

      // 12. Toggle ingredient item in drawer
      const ingItem = e.target.closest('[data-toggle-ingredient]');
      if (ingItem) {
        const idx = parseInt(ingItem.getAttribute('data-toggle-ingredient'), 10);
        if (!isNaN(idx)) {
          if (session.checkedIngredients.has(idx)) {
            session.checkedIngredients.delete(idx);
          } else {
            session.checkedIngredients.add(idx);
          }
          renderIngredientsDrawerContent();
        }
        return;
      }
    });

    // Touch Swipe Gesture support for flipping steps on mobile
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    overlay.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
      }
    }, { passive: true });

    overlay.addEventListener('touchend', (e) => {
      if (session.isIngredientsOpen) return; // Don't swipe step if drawer is open
      // Don't trigger swipe if user interacted with interactive elements or pill bar
      if (e.target.closest('button, input, textarea, .cooking-step-pills, .cooking-servings-stepper, .cooking-custom-timer-presets, .cooking-active-timers-dock')) {
        return;
      }
      if (e.changedTouches && e.changedTouches[0]) {
        const diffX = e.changedTouches[0].clientX - touchStartX;
        const diffY = e.changedTouches[0].clientY - touchStartY;
        const duration = Date.now() - touchStartTime;

        // Intentional horizontal swipe (> 50px, predominantly horizontal, quick gesture < 600ms)
        if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY) * 1.3 && duration < 600) {
          if (diffX < 0) {
            // Swipe Left -> Next
            if (session.currentStepIndex < session.recipe.steps.length - 1) {
              session.completedSteps.add(session.currentStepIndex);
              renderCookingStep(session.currentStepIndex + 1);
            } else {
              session.completedSteps.add(session.currentStepIndex);
              renderCompletionScreen();
            }
          } else {
            // Swipe Right -> Prev
            if (session.currentStepIndex > 0) {
              renderCookingStep(session.currentStepIndex - 1);
            }
          }
        }
      }
    }, { passive: true });
  }

  // Keyboard Navigation handler
  window.addEventListener('keydown', (e) => {
    const overlay = document.getElementById('cookingModeOverlay');
    if (!overlay || overlay.classList.contains('hidden')) return;

    if (e.key === 'ArrowRight' || e.key === 'PageDown') {
      e.preventDefault();
      if (session.currentStepIndex < session.recipe.steps.length - 1) {
        session.completedSteps.add(session.currentStepIndex);
        renderCookingStep(session.currentStepIndex + 1);
      } else {
        renderCompletionScreen();
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      if (session.currentStepIndex > 0) {
        renderCookingStep(session.currentStepIndex - 1);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeCookingMode();
    } else if (e.key === ' ' && !e.target.matches('input, textarea, button')) {
      e.preventDefault();
      // Space toggles current step timer or advances step
      const stepKey = `step_${session.currentStepIndex}`;
      if (session.timers.has(stepKey)) {
        toggleTimer(stepKey);
      }
    }
  });

  // Expose on App
  App.startCookingMode = startCookingMode;
  App.closeCookingMode = closeCookingMode;

})(window.App);
