'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

// GET /api/ingredients
// Supports search query via `?q=...`
router.get('/', (req, res) => {
  const query = req.query.q || '';
  try {
    let results;
    if (query.trim()) {
      results = db.prepare(`
        SELECT i.*, COUNT(ri.id) AS recipe_count 
        FROM ingredients i 
        LEFT JOIN recipe_ingredients ri ON i.id = ri.ingredient_id 
        WHERE i.name LIKE ? 
        GROUP BY i.id 
        ORDER BY i.name COLLATE NOCASE ASC
      `).all(`%${query}%`);
    } else {
      results = db.prepare(`
        SELECT i.*, COUNT(ri.id) AS recipe_count 
        FROM ingredients i 
        LEFT JOIN recipe_ingredients ri ON i.id = ri.ingredient_id 
        GROUP BY i.id 
        ORDER BY i.name COLLATE NOCASE ASC
      `).all();
    }
    res.json(results);
  } catch (err) {
    console.error('Error fetching ingredients:', err);
    res.status(500).json({ error: 'Er is een fout opgetreden bij het ophalen van de ingrediënten.' });
  }
});

// POST /api/ingredients - Create a new ingredient dynamically (case-insensitive check)
const { requireAuth } = require('../middleware/auth');

router.post('/', requireAuth, (req, res) => {
  const { name } = req.body;

  const raw = typeof name === 'string' ? name.trim() : '';
  if (!raw) {
    return res.status(400).json({ error: 'Ingrediëntnaam is verplicht.' });
  }

  // Format: lowercase all characters, then capitalize the first letter
  const formattedName = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();

  try {
    const existing = db.prepare('SELECT * FROM ingredients WHERE LOWER(name) = LOWER(?)').get(formattedName);
    if (existing) {
      return res.json({ id: existing.id, name: existing.name, already_exists: true });
    }

    const info = db.prepare('INSERT INTO ingredients (name) VALUES (?)').run(formattedName);
    res.status(201).json({ id: info.lastInsertRowid, name: formattedName, already_exists: false });
  } catch (err) {
    console.error('Error creating ingredient:', err);
    res.status(500).json({ error: 'Er is een fout opgetreden bij het aanmaken van het ingrediënt.' });
  }
});

// DELETE /api/ingredients/:id - Delete an ingredient (Admin only)
router.delete('/:id', requireAuth, (req, res) => {
  if (req.user.is_admin !== 1 && req.user.is_admin !== true) {
    return res.status(403).json({ error: 'Alleen beheerders kunnen ingrediënten verwijderen.' });
  }

  const ingredientId = parseInt(req.params.id, 10);
  if (isNaN(ingredientId)) {
    return res.status(400).json({ error: 'Ongeldig ingrediënt-ID.' });
  }

  try {
    const existing = db.prepare('SELECT * FROM ingredients WHERE id = ?').get(ingredientId);
    if (!existing) {
      return res.status(404).json({ error: 'Ingrediënt niet gevonden.' });
    }

    db.prepare('DELETE FROM recipe_ingredients WHERE ingredient_id = ?').run(ingredientId);
    db.prepare('DELETE FROM ingredients WHERE id = ?').run(ingredientId);

    res.json({ message: `Ingrediënt "${existing.name}" succesvol verwijderd.` });
  } catch (err) {
    console.error('Error deleting ingredient:', err);
    res.status(500).json({ error: 'Er is een fout opgetreden bij het verwijderen van het ingrediënt.' });
  }
});

module.exports = router;
