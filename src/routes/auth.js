'use strict';

const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const path    = require('path');
const db      = require('../db/database');
const { v4: uuidv4 } = require('uuid');
const { hashPassword, verifyPassword, generateToken, requireAuth } = require('../middleware/auth');
const upload  = require('../middleware/upload');

const UPLOADS_DIR = process.env.UPLOADS_PATH || path.resolve(__dirname, '../../uploads');

function deleteAvatar(filename) {
  if (!filename) return;
  try {
    const absolutePath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  } catch (err) {
    console.error(`Failed to delete avatar: ${filename}`, err);
  }
}

// POST /api/auth/register
// Restricted to admin users
router.post('/register', requireAuth, (req, res) => {
  if (req.user.is_admin !== 1) {
    return res.status(403).json({ error: 'Alleen beheerders kunnen nieuwe accounts aanmaken.' });
  }

  const { username, password, is_admin } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Gebruikersnaam en wachtwoord zijn verplicht.' });
  }

  const trimmedUsername = username.trim().toLowerCase();
  if (trimmedUsername.length < 3) {
    return res.status(400).json({ error: 'Gebruikersnaam moet minimaal 3 tekens lang zijn.' });
  }

  if (password.length < 4) {
    return res.status(400).json({ error: 'Wachtwoord moet minimaal 4 tekens lang zijn.' });
  }

  const isAdminVal = is_admin ? 1 : 0;

  try {
    // Check if user already exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(trimmedUsername);
    if (existing) {
      return res.status(400).json({ error: 'Gebruikersnaam is al in gebruik.' });
    }

    const userId = uuidv4();
    const hashedPasswordStr = hashPassword(password);

    db.prepare('INSERT INTO users (id, username, password, is_admin) VALUES (?, ?, ?, ?)')
      .run(userId, trimmedUsername, hashedPasswordStr, isAdminVal);

    res.status(201).json({
      message: `Gebruiker "${trimmedUsername}" succesvol aangemaakt!`,
      user: { id: userId, username: trimmedUsername, is_admin: isAdminVal, avatar_path: null }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Er is een fout opgetreden bij het registreren.' });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Gebruikersnaam en wachtwoord zijn verplicht.' });
  }

  const trimmedUsername = username.trim().toLowerCase();

  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(trimmedUsername);
    if (!user) {
      return res.status(400).json({ error: 'Gebruikersnaam of wachtwoord is onjuist.' });
    }

    const isValid = verifyPassword(password, user.password);
    if (!isValid) {
      return res.status(400).json({ error: 'Gebruikersnaam of wachtwoord is onjuist.' });
    }

    const token = generateToken({ 
      id: user.id, 
      username: user.username, 
      is_admin: user.is_admin 
    });

    res.json({
      message: 'Inloggen succesvol!',
      token,
      user: { 
        id: user.id, 
        username: user.username, 
        is_admin: user.is_admin,
        avatar_path: user.avatar_path || null,
        default_servings: user.default_servings || 4
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Er is een fout opgetreden bij het inloggen.' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  try {
    const user = db.prepare('SELECT id, username, is_admin, avatar_path, default_servings FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Gebruiker niet gevonden.' });
    }
    if (!user.default_servings) user.default_servings = 4;
    res.json({ user });
  } catch (err) {
    console.error('Error in /me:', err);
    res.status(500).json({ error: 'Er is een fout opgetreden bij het ophalen van de gegevens.' });
  }
});

// PUT /api/auth/settings - Update password, default servings and profile picture (avatar)
router.put('/settings', requireAuth, upload.single('avatar'), (req, res) => {
  const userId = req.user.id;
  const { current_password, new_password, remove_avatar, default_servings } = req.body;

  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      if (req.file) deleteAvatar(req.file.filename);
      return res.status(404).json({ error: 'Gebruiker niet gevonden.' });
    }

    // 1. Password change logic
    if (new_password) {
      if (!current_password) {
        if (req.file) deleteAvatar(req.file.filename);
        return res.status(400).json({ error: 'Huidig wachtwoord is verplicht om je wachtwoord te wijzigen.' });
      }

      const isValid = verifyPassword(current_password, user.password);
      if (!isValid) {
        if (req.file) deleteAvatar(req.file.filename);
        return res.status(400).json({ error: 'Huidig wachtwoord is onjuist.' });
      }

      if (new_password.length < 4) {
        if (req.file) deleteAvatar(req.file.filename);
        return res.status(400).json({ error: 'Nieuw wachtwoord moet minimaal 4 tekens lang zijn.' });
      }

      const newHashed = hashPassword(new_password);
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newHashed, userId);
    }

    // 2. Default servings update logic
    if (default_servings !== undefined && default_servings !== null && default_servings !== '') {
      const parsedServings = parseInt(default_servings, 10);
      if (!isNaN(parsedServings) && parsedServings > 0 && parsedServings <= 100) {
        db.prepare('UPDATE users SET default_servings = ? WHERE id = ?').run(parsedServings, userId);
      }
    }

    // 3. Avatar update logic
    let updatedAvatarPath = user.avatar_path;
    let oldAvatarToDelete = null;

    if (req.file) {
      updatedAvatarPath = req.file.filename;
      oldAvatarToDelete = user.avatar_path;
      db.prepare('UPDATE users SET avatar_path = ? WHERE id = ?').run(updatedAvatarPath, userId);
    } else if (remove_avatar === 'true' || remove_avatar === true) {
      updatedAvatarPath = null;
      oldAvatarToDelete = user.avatar_path;
      db.prepare('UPDATE users SET avatar_path = NULL WHERE id = ?').run(userId);
    }

    if (oldAvatarToDelete && oldAvatarToDelete !== updatedAvatarPath) {
      deleteAvatar(oldAvatarToDelete);
    }

    const updatedUser = db.prepare('SELECT id, username, is_admin, avatar_path, default_servings FROM users WHERE id = ?').get(userId);
    if (!updatedUser.default_servings) updatedUser.default_servings = 4;

    res.json({
      message: 'Instellingen succesvol bijgewerkt!',
      user: updatedUser
    });
  } catch (err) {
    console.error('Settings update error:', err);
    if (req.file) deleteAvatar(req.file.filename);
    res.status(500).json({ error: 'Er is een fout opgetreden bij het bijwerken van de instellingen.' });
  }
});

// GET /api/auth/users
// Restricted to admin users
router.get('/users', requireAuth, (req, res) => {
  if (req.user.is_admin !== 1) {
    return res.status(403).json({ error: 'Alleen beheerders hebben toegang tot de gebruikerslijst.' });
  }

  try {
    const users = db.prepare('SELECT id, username, is_admin, avatar_path, created_at FROM users ORDER BY username ASC').all();
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Er is een fout opgetreden bij het ophalen van de gebruikers.' });
  }
});

// DELETE /api/auth/users/:id
// Restricted to admin users (cannot delete self)
router.delete('/users/:id', requireAuth, (req, res) => {
  if (req.user.is_admin !== 1) {
    return res.status(403).json({ error: 'Alleen beheerders kunnen accounts verwijderen.' });
  }

  const targetUserId = req.params.id;

  if (targetUserId === req.user.id) {
    return res.status(400).json({ error: 'Je kunt je eigen admin-account niet verwijderen!' });
  }

  try {
    const targetUser = db.prepare('SELECT avatar_path FROM users WHERE id = ?').get(targetUserId);
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(targetUserId);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Gebruiker niet gevonden.' });
    }

    if (targetUser && targetUser.avatar_path) {
      deleteAvatar(targetUser.avatar_path);
    }

    res.json({ message: 'Gebruiker succesvol verwijderd.' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Er is een fout opgetreden bij het verwijderen van de gebruiker.' });
  }
});

module.exports = router;
