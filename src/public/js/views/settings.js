'use strict';

// ── SETTINGS VIEW LOGIC (AVATAR & PASSWORD) ───────────────────────────────────
(function(App) {

  function renderSettingsView() {
    if (!App.state.user) return;
    const preview = document.getElementById('settingsAvatarPreview');
    const removeBtn = document.getElementById('removeAvatarBtn');

    if (App.state.user.avatar_path) {
      preview.innerHTML = `<img src="/uploads/${App.state.user.avatar_path}" alt="${App.escapeHtml(App.state.user.username)}">`;
      if (removeBtn) removeBtn.classList.remove('hidden');
    } else {
      const initial = App.state.user.username.charAt(0).toUpperCase();
      preview.textContent = initial;
      if (removeBtn) removeBtn.classList.add('hidden');
    }

    // Default servings input
    const defaultServingsInput = document.getElementById('settingsDefaultServingsInput');
    if (defaultServingsInput) {
      defaultServingsInput.value = App.state.user.default_servings || 4;
    }

    // Reset password form
    document.getElementById('changePasswordForm')?.reset();
  }

  // Stepper buttons for default servings
  document.getElementById('settingsServingsDecBtn')?.addEventListener('click', () => {
    const input = document.getElementById('settingsDefaultServingsInput');
    if (!input) return;
    const val = parseInt(input.value, 10) || 4;
    if (val > 1) {
      input.value = val - 1;
    }
  });

  document.getElementById('settingsServingsIncBtn')?.addEventListener('click', () => {
    const input = document.getElementById('settingsDefaultServingsInput');
    if (!input) return;
    const val = parseInt(input.value, 10) || 4;
    if (val < 50) {
      input.value = val + 1;
    }
  });

  // Save Default Servings form submit
  document.getElementById('defaultServingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('settingsDefaultServingsInput');
    const val = parseInt(input ? input.value : 4, 10);

    if (isNaN(val) || val < 1) {
      App.showToast('Voer een geldig aantal personen in (minimaal 1).', 'error');
      return;
    }

    try {
      const data = await App.apiFetch('/api/auth/settings', {
        method: 'PUT',
        body: JSON.stringify({ default_servings: val })
      });

      App.state.user = data.user;
      App.showToast('Standaard aantal personen opgeslagen!', 'success');
    } catch (err) {
      // Handled in apiFetch
    }
  });

  // Avatar upload preview
  document.getElementById('settingsAvatarInput')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const preview = document.getElementById('settingsAvatarPreview');
      preview.innerHTML = `<img src="${ev.target.result}" alt="Preview">`;
      const removeBtn = document.getElementById('removeAvatarBtn');
      if (removeBtn) removeBtn.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  });

  // Save Avatar form submit
  document.getElementById('avatarForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('settingsAvatarInput');
    const file = fileInput ? fileInput.files[0] : null;

    if (!file) {
      App.showToast('Kies eerst een fotobestand om op te slaan.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const data = await App.apiFetch('/api/auth/settings', {
        method: 'PUT',
        body: formData
      });

      App.state.user = data.user;
      App.updateHeaderUserDisplay();
      renderSettingsView();
      App.showToast('Profielfoto succesvol opgeslagen!', 'success');
    } catch (err) {
      // Handled in apiFetch
    }
  });

  // Remove Avatar button
  document.getElementById('removeAvatarBtn')?.addEventListener('click', async () => {
    const formData = new FormData();
    formData.append('remove_avatar', 'true');

    try {
      const data = await App.apiFetch('/api/auth/settings', {
        method: 'PUT',
        body: formData
      });

      App.state.user = data.user;
      const fileInput = document.getElementById('settingsAvatarInput');
      if (fileInput) fileInput.value = '';

      App.updateHeaderUserDisplay();
      renderSettingsView();
      App.showToast('Profielfoto verwijderd.', 'success');
    } catch (err) {
      // Handled in apiFetch
    }
  });

  // Change Password form submit
  document.getElementById('changePasswordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const current_password = document.getElementById('currentPassword').value;
    const new_password = document.getElementById('newPassword').value;
    const confirm_password = document.getElementById('confirmNewPassword').value;

    if (new_password !== confirm_password) {
      App.showToast('De nieuwe wachtwoorden komen niet overeen!', 'error');
      return;
    }

    if (new_password.length < 4) {
      App.showToast('Het nieuwe wachtwoord moet minimaal 4 tekens lang zijn.', 'error');
      return;
    }

    try {
      const data = await App.apiFetch('/api/auth/settings', {
        method: 'PUT',
        body: JSON.stringify({ current_password, new_password })
      });

      App.showToast('Wachtwoord succesvol gewijzigd!', 'success');
      e.target.reset();
    } catch (err) {
      // Handled in apiFetch
    }
  });

  App.renderSettingsView = renderSettingsView;

})(window.App);
