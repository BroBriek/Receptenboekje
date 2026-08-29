'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../db/database');
const { requireAuth } = require('../middleware/auth');

// GET /api/tags - Fetch all tags
router.get('/', (req, res) => {
  const query = req.query.q || '';
  try {
    let tags;
    if (query.trim()) {
      tags = db.prepare(`
        SELECT t.*, COUNT(rt.recipe_id) AS recipe_count 
        FROM tags t 
        LEFT JOIN recipe_tags rt ON t.id = rt.tag_id 
        WHERE t.name LIKE ? 
        GROUP BY t.id 
        ORDER BY t.name COLLATE NOCASE ASC
      `).all(`%${query}%`);
    } else {
      tags = db.prepare(`
        SELECT t.*, COUNT(rt.recipe_id) AS recipe_count 
        FROM tags t 
        LEFT JOIN recipe_tags rt ON t.id = rt.tag_id 
        GROUP BY t.id 
        ORDER BY t.name COLLATE NOCASE ASC
      `).all();
    }
    res.json(tags);
  } catch (err) {
    console.error('Error fetching tags:', err);
    res.status(500).json({ error: 'Er is een fout opgetreden bij het ophalen van de categorieën.' });
  }
});

// POST /api/tags - Create a new tag dynamically (case-insensitive check)
router.post('/', requireAuth, (req, res) => {
  const { name } = req.body;

  const raw = typeof name === 'string' ? name.trim() : '';
  if (!raw) {
    return res.status(400).json({ error: 'Tag naam is verplicht.' });
  }

  // Format: lowercase all characters, then capitalize the first letter
  const formattedName = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();

  try {
    // Check if tag already exists (case-insensitive)
    const existing = db.prepare('SELECT * FROM tags WHERE LOWER(name) = LOWER(?)').get(formattedName);
    if (existing) {
      return res.json({ id: existing.id, name: existing.name, already_exists: true });
    }

    const info = db.prepare('INSERT INTO tags (name) VALUES (?)').run(formattedName);
    res.status(201).json({ id: info.lastInsertRowid, name: formattedName, already_exists: false });
  } catch (err) {
    console.error('Error creating tag:', err);
    res.status(500).json({ error: 'Er is een fout opgetreden bij het aanmaken van de tag.' });
  }
});

// DELETE /api/tags/:id - Delete a tag (Admin only)
router.delete('/:id', requireAuth, (req, res) => {
  if (req.user.is_admin !== 1 && req.user.is_admin !== true) {
    return res.status(403).json({ error: 'Alleen beheerders kunnen tags verwijderen.' });
  }

  const tagId = parseInt(req.params.id, 10);
  if (isNaN(tagId)) {
    return res.status(400).json({ error: 'Ongeldig tag-ID.' });
  }

  try {
    const existing = db.prepare('SELECT * FROM tags WHERE id = ?').get(tagId);
    if (!existing) {
      return res.status(404).json({ error: 'Tag niet gevonden.' });
    }

    db.prepare('DELETE FROM recipe_tags WHERE tag_id = ?').run(tagId);
    db.prepare('DELETE FROM tags WHERE id = ?').run(tagId);

    res.json({ message: `Tag "${existing.name}" succesvol verwijderd.` });
  } catch (err) {
    console.error('Error deleting tag:', err);
    res.status(500).json({ error: 'Er is een fout opgetreden bij het verwijderen van de tag.' });
  }
});

module.exports = router;
