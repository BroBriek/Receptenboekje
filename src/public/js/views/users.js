'use strict';

// ── USER MANAGEMENT FUNCTIONS (ADMIN ONLY) ────────────────────────────────────
(function(App) {

  async function loadUsers() {
    if (!App.state.user || (App.state.user.is_admin != 1 && App.state.user.is_admin !== true)) return;
    try {
      const users = await App.apiFetch('/api/auth/users');
      const list = document.getElementById('adminUsersList');
      if (list) {
        list.innerHTML = '';
        
        users.forEach(user => {
          const li = document.createElement('li');
          const isSelf = user.id === App.state.user.id;
          const roleText = (user.is_admin == 1 || user.is_admin === true) ? 'Beheerder' : 'Gebruiker';
          
          li.innerHTML = `
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <div style="width:28px;height:28px;border-radius:50%;background:var(--secondary);color:white;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;overflow:hidden;">
                ${user.avatar_path ? `<img src="/uploads/${user.avatar_path}" style="width:100%;height:100%;object-fit:cover;">` : user.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <strong>${App.escapeHtml(user.username)}</strong>
                <span style="font-size:0.75rem; color:var(--text-muted); margin-left:0.5rem; background:var(--white); border: 1px solid var(--border); padding:0.1rem 0.4rem; border-radius:var(--radius-pill);">${roleText}</span>
              </div>
            </div>
            ${!isSelf ? `
              <button type="button" class="btn-icon" style="color:var(--danger)" data-delete-user="${user.id}" title="Verwijder gebruiker">
                <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
              </button>
            ` : '<span style="font-size:0.75rem; color:var(--text-muted); font-style:italic;">Jij</span>'}
          `;
          list.appendChild(li);
        });
      }
      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.error('Error in loadUsers:', err);
    }
  }

  document.getElementById('adminUsersList')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-delete-user]');
    if (btn) {
      const userId = btn.getAttribute('data-delete-user');
      if (userId) deleteUser(userId);
    }
  });

  async function deleteUser(userId) {
    if (!confirm('Weet je zeker dat je deze gebruiker wilt verwijderen? Dit verwijdert ook alle recepten van deze gebruiker.')) {
      return;
    }
    try {
      const response = await App.apiFetch(`/api/auth/users/${userId}`, {
        method: 'DELETE'
      });
      App.showToast(response.message, 'success');
      loadUsers();
    } catch (err) {
      // Handled in apiFetch
    }
  }

  document.getElementById('adminCreateUserForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('adminNewUsername').value.trim();
    const password = document.getElementById('adminNewPassword').value;
    const is_admin = document.getElementById('adminNewIsAdmin').checked;

    try {
      const response = await App.apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password, is_admin })
      });
      App.showToast(response.message, 'success');
      e.target.reset();
      loadUsers();
    } catch (err) {
      // Handled in apiFetch
    }
  });

  App.loadUsers = loadUsers;

})(window.App);
