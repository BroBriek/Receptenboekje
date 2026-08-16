'use strict';

const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const path    = require('path');
const db      = require('../db/database');
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

const UPLOADS_DIR = process.env.UPLOADS_PATH || path.resolve(__dirname, '../../uploads');

// Helper to delete an image file (never deletes stock library images)
function deleteImage(filename) {
  if (!filename) return;
  if (filename.startsWith('stock/') || filename.startsWith('stock\\')) return;
  try {
    const absolutePath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  } catch (err) {
    console.error(`Failed to delete image: ${filename}`, err);
  }
}

// GET /api/recipes - List recipes with search, tags, and ingredients filters (shared cookbook)
router.get('/', requireAuth, (req, res) => {
  const { q, tags, ingredients, match_mode } = req.query;

  try {
    let sql = `
      SELECT r.*, u.username AS author, u.avatar_path AS author_avatar 
      FROM recipes r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (q && q.trim()) {
      sql += ' AND (r.title LIKE ? OR r.description LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }

    if (tags) {
      const tagIds = tags.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
      if (tagIds.length > 0) {
        sql += ` AND r.id IN (
          SELECT recipe_id FROM recipe_tags 
          WHERE tag_id IN (${tagIds.map(() => '?').join(',')})
        )`;
        params.push(...tagIds);
      }
    }

    let ingredientIds = [];
    if (ingredients) {
      ingredientIds = ingredients.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
      if (ingredientIds.length > 0) {
        if (match_mode === 'all') {
          sql += ` AND r.id IN (
            SELECT recipe_id FROM recipe_ingredients 
            WHERE ingredient_id IN (${ingredientIds.map(() => '?').join(',')})
            GROUP BY recipe_id
            HAVING COUNT(DISTINCT ingredient_id) = ?
          )`;
          params.push(...ingredientIds, ingredientIds.length);
        } else {
          // Default: match any of the selected ingredients
          sql += ` AND r.id IN (
            SELECT recipe_id FROM recipe_ingredients 
            WHERE ingredient_id IN (${ingredientIds.map(() => '?').join(',')})
          )`;
          params.push(...ingredientIds);
        }
      }
    }

    if (ingredientIds.length > 0 && match_mode !== 'all') {
      // Sort recipes by highest number of matching selected ingredients first, then newest
      sql += ` ORDER BY (
        SELECT COUNT(DISTINCT ri.ingredient_id) 
        FROM recipe_ingredients ri 
        WHERE ri.recipe_id = r.id AND ri.ingredient_id IN (${ingredientIds.map(() => '?').join(',')})
      ) DESC, r.created_at DESC`;
      params.push(...ingredientIds);
    } else {
      sql += ' ORDER BY r.created_at DESC';
    }

    const recipes = db.prepare(sql).all(...params);

    // Fetch tags and ingredients for each recipe
    for (const recipe of recipes) {
      recipe.tags = db.prepare(`
        SELECT t.id, t.name 
        FROM tags t
        JOIN recipe_tags rt ON rt.tag_id = t.id
        WHERE rt.recipe_id = ?
        ORDER BY t.name ASC
      `).all(recipe.id);

      recipe.ingredients = db.prepare(`
        SELECT ri.id, i.id AS ingredient_id, i.name, ri.quantity, ri.unit, ri.notes
        FROM recipe_ingredients ri
        JOIN ingredients i ON ri.ingredient_id = i.id
        WHERE ri.recipe_id = ?
        ORDER BY ri.sort_order ASC
      `).all(recipe.id);
    }

    res.json(recipes);
  } catch (err) {
    console.error('Error fetching recipes:', err);
    res.status(500).json({ error: 'Fout bij het ophalen van recepten.' });
  }
});

// GET /api/recipes/stock-images - List preset stock food images with labels and categories
router.get('/stock-images', requireAuth, (_req, res) => {
  try {
    const manifestPath = path.join(UPLOADS_DIR, 'stock', 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      const data = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      return res.json(data);
    }
    return res.json([]);
  } catch (err) {
    console.error('Error reading stock images manifest:', err);
    res.status(500).json({ error: 'Fout bij het ophalen van stock afbeeldingen.' });
  }
});

// GET /api/recipes/:id - Get detailed recipe
router.get('/:id', requireAuth, (req, res) => {
  const recipeId = req.params.id;

  try {
    const recipe = db.prepare(`
      SELECT r.*, u.username AS author, u.avatar_path AS author_avatar 
      FROM recipes r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.id = ?
    `).get(recipeId);

    if (!recipe) {
      return res.status(404).json({ error: 'Recept niet gevonden.' });
    }

    // Get tags
    recipe.tags = db.prepare(`
      SELECT t.id, t.name 
      FROM tags t
      JOIN recipe_tags rt ON rt.tag_id = t.id
      WHERE rt.recipe_id = ?
      ORDER BY t.name ASC
    `).all(recipeId);

    // Get ingredients
    recipe.ingredients = db.prepare(`
      SELECT ri.id, i.name, ri.quantity, ri.unit, ri.notes
      FROM recipe_ingredients ri
      JOIN ingredients i ON ri.ingredient_id = i.id
      WHERE ri.recipe_id = ?
      ORDER BY ri.sort_order ASC
    `).all(recipeId);

    // Get steps
    recipe.steps = db.prepare(`
      SELECT step_number, instruction, image_path
      FROM recipe_steps
      WHERE recipe_id = ?
      ORDER BY step_number ASC
    `).all(recipeId);

    res.json(recipe);
  } catch (err) {
    console.error('Error fetching recipe details:', err);
    res.status(500).json({ error: 'Fout bij het ophalen van de receptdetails.' });
  }
});

// POST /api/recipes - Create recipe
router.post('/', requireAuth, upload.single('image'), (req, res) => {
  const userId = req.user.id;
  const recipeId = uuidv4();

  const { title, description, servings, prep_time, cook_time, exclude_from_menu } = req.body;
  const isExcludedFromMenu = (exclude_from_menu === '1' || exclude_from_menu === 'true' || exclude_from_menu === true || exclude_from_menu === 1) ? 1 : 0;

  if (!title || !title.trim()) {
    // Clean up uploaded image if title is missing
    if (req.file) deleteImage(req.file.filename);
    return res.status(400).json({ error: 'Titel van het recept is verplicht.' });
  }

  // Parse arrays/objects
  let tags = [];
  let ingredients = [];
  let steps = [];

  try {
    if (req.body.tags) {
      tags = typeof req.body.tags === 'string' ? JSON.parse(req.body.tags) : req.body.tags;
    }
    if (req.body.ingredients) {
      ingredients = typeof req.body.ingredients === 'string' ? JSON.parse(req.body.ingredients) : req.body.ingredients;
    }
    if (req.body.steps) {
      steps = typeof req.body.steps === 'string' ? JSON.parse(req.body.steps) : req.body.steps;
    }
  } catch (e) {
    console.error('Error parsing nested JSON data:', e);
    if (req.file) deleteImage(req.file.filename);
    return res.status(400).json({ error: 'Ongeldig JSON-formaat voor tags, ingrediënten of stappen.' });
  }

  const imagePath = req.file ? req.file.filename : (req.body.stock_image || null);

  const insertTransaction = db.transaction(() => {
    // 1. Insert core recipe
    db.prepare(`
      INSERT INTO recipes (id, user_id, title, description, servings, prep_time, cook_time, image_path, exclude_from_menu)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      recipeId,
      userId,
      title.trim(),
      description ? description.trim() : null,
      servings ? parseInt(servings, 10) : null,
      prep_time ? parseInt(prep_time, 10) : null,
      cook_time ? parseInt(cook_time, 10) : null,
      imagePath,
      isExcludedFromMenu
    );

    // 2. Handle tags (supports IDs, strings, objects with case-insensitive check)
    if (tags && tags.length > 0) {
      const insertTagLink = db.prepare('INSERT OR IGNORE INTO recipe_tags (recipe_id, tag_id) VALUES (?, ?)');
      const getTagByLower = db.prepare('SELECT id FROM tags WHERE LOWER(name) = LOWER(?)');
      const insertTag = db.prepare('INSERT INTO tags (name) VALUES (?)');

      for (const tagItem of tags) {
        let tagId = null;
        if (typeof tagItem === 'number' || (typeof tagItem === 'string' && /^\d+$/.test(tagItem.trim()))) {
          tagId = parseInt(tagItem, 10);
        } else if (typeof tagItem === 'string' && tagItem.trim()) {
          const nameClean = tagItem.trim();
          const existing = getTagByLower.get(nameClean);
          if (existing) {
            tagId = existing.id;
          } else {
            const info = insertTag.run(nameClean);
            tagId = info.lastInsertRowid;
          }
        } else if (tagItem && tagItem.id) {
          tagId = tagItem.id;
        }

        if (tagId) {
          insertTagLink.run(recipeId, tagId);
        }
      }
    }

    // 3. Handle ingredients
    if (ingredients && ingredients.length > 0) {
      const getIngredient = db.prepare('SELECT id FROM ingredients WHERE name = ?');
      const insertIngredient = db.prepare('INSERT INTO ingredients (name) VALUES (?)');
      const insertRecipeIngredient = db.prepare(`
        INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, notes, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      ingredients.forEach((ing, index) => {
        if (!ing.name || !ing.name.trim()) return;
        const nameClean = ing.name.trim().toLowerCase();

        let ingredientRow = getIngredient.get(nameClean);
        let ingredientId;

        if (ingredientRow) {
          ingredientId = ingredientRow.id;
        } else {
          const info = insertIngredient.run(nameClean);
          ingredientId = info.lastInsertRowid;
        }

        insertRecipeIngredient.run(
          recipeId,
          ingredientId,
          ing.quantity ? parseFloat(ing.quantity) : null,
          ing.unit ? ing.unit.trim() : null,
          ing.notes ? ing.notes.trim() : null,
          index
        );
      });
    }

    // 4. Handle steps
    if (steps && steps.length > 0) {
      const insertStep = db.prepare(`
        INSERT INTO recipe_steps (recipe_id, step_number, instruction)
        VALUES (?, ?, ?)
      `);
      steps.forEach((step, index) => {
        if (!step.instruction || !step.instruction.trim()) return;
        insertStep.run(recipeId, index + 1, step.instruction.trim());
      });
    }
  });

  try {
    insertTransaction();
    res.status(201).json({ message: 'Recept succesvol toegevoegd!', id: recipeId });
  } catch (err) {
    console.error('Database transaction error:', err);
    if (req.file) deleteImage(req.file.filename);
    res.status(500).json({ error: 'Er is een fout opgetreden bij het opslaan van het recept.' });
  }
});

// PUT /api/recipes/:id - Update recipe
router.put('/:id', requireAuth, upload.single('image'), (req, res) => {
  const userId = req.user.id;
  const recipeId = req.params.id;

  const { title, description, servings, prep_time, cook_time, remove_image, exclude_from_menu } = req.body;
  const isExcludedFromMenu = (exclude_from_menu === '1' || exclude_from_menu === 'true' || exclude_from_menu === true || exclude_from_menu === 1) ? 1 : 0;

  if (!title || !title.trim()) {
    if (req.file) deleteImage(req.file.filename);
    return res.status(400).json({ error: 'Titel van het recept is verplicht.' });
  }

  // Get current recipe to manage images
  const currentRecipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(recipeId);
  if (!currentRecipe) {
    if (req.file) deleteImage(req.file.filename);
    return res.status(404).json({ error: 'Recept niet gevonden.' });
  }

  let tags = [];
  let ingredients = [];
  let steps = [];

  try {
    if (req.body.tags) {
      tags = typeof req.body.tags === 'string' ? JSON.parse(req.body.tags) : req.body.tags;
    }
    if (req.body.ingredients) {
      ingredients = typeof req.body.ingredients === 'string' ? JSON.parse(req.body.ingredients) : req.body.ingredients;
    }
    if (req.body.steps) {
      steps = typeof req.body.steps === 'string' ? JSON.parse(req.body.steps) : req.body.steps;
    }
  } catch (e) {
    console.error('Error parsing nested JSON data:', e);
    if (req.file) deleteImage(req.file.filename);
    return res.status(400).json({ error: 'Ongeldig JSON-formaat voor tags, ingrediënten of stappen.' });
  }

  // Handle image path logic
  let newImagePath = currentRecipe.image_path;
  let imageToDelete = null;

  if (req.file) {
    // New image uploaded, replace the old one
    newImagePath = req.file.filename;
    imageToDelete = currentRecipe.image_path;
  } else if (req.body.stock_image) {
    // Stock image selected from library
    newImagePath = req.body.stock_image;
    imageToDelete = currentRecipe.image_path;
  } else if (remove_image === 'true' || remove_image === true) {
    // Image explicitly removed
    newImagePath = null;
    imageToDelete = currentRecipe.image_path;
  }

  const updateTransaction = db.transaction(() => {
    // 1. Update core recipe
    db.prepare(`
      UPDATE recipes 
      SET title = ?, description = ?, servings = ?, prep_time = ?, cook_time = ?, image_path = ?, exclude_from_menu = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      title.trim(),
      description ? description.trim() : null,
      servings ? parseInt(servings, 10) : null,
      prep_time ? parseInt(prep_time, 10) : null,
      cook_time ? parseInt(cook_time, 10) : null,
      newImagePath,
      isExcludedFromMenu,
      recipeId
    );

    // 2. Clear old links & steps
    db.prepare('DELETE FROM recipe_tags WHERE recipe_id = ?').run(recipeId);
    db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?').run(recipeId);
    db.prepare('DELETE FROM recipe_steps WHERE recipe_id = ?').run(recipeId);

    // 3. Re-insert tags (supports IDs, strings, objects with case-insensitive check)
    if (tags && tags.length > 0) {
      const insertTagLink = db.prepare('INSERT OR IGNORE INTO recipe_tags (recipe_id, tag_id) VALUES (?, ?)');
      const getTagByLower = db.prepare('SELECT id FROM tags WHERE LOWER(name) = LOWER(?)');
      const insertTag = db.prepare('INSERT INTO tags (name) VALUES (?)');

      for (const tagItem of tags) {
        let tagId = null;
        if (typeof tagItem === 'number' || (typeof tagItem === 'string' && /^\d+$/.test(tagItem.trim()))) {
          tagId = parseInt(tagItem, 10);
        } else if (typeof tagItem === 'string' && tagItem.trim()) {
          const nameClean = tagItem.trim();
          const existing = getTagByLower.get(nameClean);
          if (existing) {
            tagId = existing.id;
          } else {
            const info = insertTag.run(nameClean);
            tagId = info.lastInsertRowid;
          }
        } else if (tagItem && tagItem.id) {
          tagId = tagItem.id;
        }

        if (tagId) {
          insertTagLink.run(recipeId, tagId);
        }
      }
    }

    // 4. Re-insert ingredients
    if (ingredients && ingredients.length > 0) {
      const getIngredient = db.prepare('SELECT id FROM ingredients WHERE name = ?');
      const insertIngredient = db.prepare('INSERT INTO ingredients (name) VALUES (?)');
      const insertRecipeIngredient = db.prepare(`
        INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, notes, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      ingredients.forEach((ing, index) => {
        if (!ing.name || !ing.name.trim()) return;
        const nameClean = ing.name.trim().toLowerCase();

        let ingredientRow = getIngredient.get(nameClean);
        let ingredientId;

        if (ingredientRow) {
          ingredientId = ingredientRow.id;
        } else {
          const info = insertIngredient.run(nameClean);
          ingredientId = info.lastInsertRowid;
        }

        insertRecipeIngredient.run(
          recipeId,
          ingredientId,
          ing.quantity ? parseFloat(ing.quantity) : null,
          ing.unit ? ing.unit.trim() : null,
          ing.notes ? ing.notes.trim() : null,
          index
        );
      });
    }

    // 5. Re-insert steps
    if (steps && steps.length > 0) {
      const insertStep = db.prepare(`
        INSERT INTO recipe_steps (recipe_id, step_number, instruction)
        VALUES (?, ?, ?)
      `);
      steps.forEach((step, index) => {
        if (!step.instruction || !step.instruction.trim()) return;
        insertStep.run(recipeId, index + 1, step.instruction.trim());
      });
    }
  });

  try {
    updateTransaction();
    if (imageToDelete) deleteImage(imageToDelete);
    res.json({ message: 'Recept succesvol bijgewerkt!' });
  } catch (err) {
    console.error('Database update transaction error:', err);
    if (req.file) deleteImage(req.file.filename);
    res.status(500).json({ error: 'Er is een fout opgetreden bij het bijwerken van het recept.' });
  }
});

// DELETE /api/recipes/:id - Delete recipe
router.delete('/:id', requireAuth, (req, res) => {
  const recipeId = req.params.id;

  try {
    const recipe = db.prepare('SELECT image_path FROM recipes WHERE id = ?').get(recipeId);
    if (!recipe) {
      return res.status(404).json({ error: 'Recept niet gevonden.' });
    }

    // Delete from DB (on delete cascade cleans up recipe_tags, recipe_ingredients, recipe_steps, meal_plan_entries references)
    db.prepare('DELETE FROM recipes WHERE id = ?').run(recipeId);

    // Delete image if it exists
    if (recipe.image_path) {
      deleteImage(recipe.image_path);
    }

    res.json({ message: 'Recept succesvol verwijderd!' });
  } catch (err) {
    console.error('Delete recipe error:', err);
    res.status(500).json({ error: 'Er is een fout opgetreden bij het verwijderen van het recept.' });
  }
});

module.exports = router;
