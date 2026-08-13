'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../db/database');
const { requireAuth } = require('../middleware/auth');

// Helper to get Monday of a given date (YYYY-MM-DD)
function getMonday(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const dayOfWeek = d.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(year, month - 1, diff);
  
  const yyyy = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, '0');
  const dd = String(monday.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Helper to get all 7 dates of a week starting from Monday (YYYY-MM-DD)
function getWeekDates(mondayStr) {
  const [year, month, day] = mondayStr.split('-').map(Number);
  const dates = [];
  const dayNames = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];
  for (let i = 0; i < 7; i++) {
    const d = new Date(year, month - 1, day + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dt = String(d.getDate()).padStart(2, '0');
    dates.push({
      date: `${y}-${m}-${dt}`,
      dayName: dayNames[i]
    });
  }
  return dates;
}

// Helper to shuffle an array
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// GET /api/meal-plan - Fetch week plan (shared across all users)
// Query param: `start_date` (any date in the week, YYYY-MM-DD. Defaults to today)
router.get('/', requireAuth, (req, res) => {
  let dateStr = req.query.start_date;

  if (!dateStr) {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    dateStr = `${y}-${m}-${d}`;
  }

  try {
    const monday = getMonday(dateStr);
    const weekDates = getWeekDates(monday);

    const plan = weekDates.map(({ date, dayName }) => {
      // Find database entry in shared meal_plan_entries
      const entry = db.prepare(`
        SELECT m.*, r.title AS recipe_title, r.image_path AS recipe_image, r.servings AS recipe_servings, u.username AS updated_by
        FROM meal_plan_entries m
        LEFT JOIN recipes r ON m.recipe_id = r.id
        LEFT JOIN users u ON m.user_id = u.id
        WHERE m.planned_on = ? AND m.meal_type = 'dinner'
      `).get(date);

      return {
        date,
        dayName,
        entry: entry || {
          id: null,
          recipe_id: null,
          recipe_title: null,
          recipe_image: null,
          recipe_servings: null,
          servings: null,
          notes: '',
          skip_planning: 0
        }
      };
    });

    res.json({
      monday,
      plan
    });
  } catch (err) {
    console.error('Error fetching meal plan:', err);
    res.status(500).json({ error: 'Er is een fout opgetreden bij het ophalen van de planning.' });
  }
});

// GET /api/meal-plan/shopping-list - Fetch ingredients shopping list for the week menu with scaled servings
router.get('/shopping-list', requireAuth, (req, res) => {
  let dateStr = req.query.start_date;

  if (!dateStr) {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    dateStr = `${y}-${m}-${d}`;
  }

  try {
    const monday = getMonday(dateStr);
    const weekDates = getWeekDates(monday);
    const sunday = weekDates[6].date;

    const currentUser = db.prepare('SELECT default_servings FROM users WHERE id = ?').get(req.user.id);
    const userDefaultServings = (currentUser && currentUser.default_servings) ? currentUser.default_servings : 4;

    // Get all meal plan entries with recipes for this week
    const entries = db.prepare(`
      SELECT m.planned_on, m.recipe_id, m.servings AS planned_servings, r.title AS recipe_title, r.servings AS recipe_servings
      FROM meal_plan_entries m
      JOIN recipes r ON m.recipe_id = r.id
      WHERE m.planned_on >= ? AND m.planned_on <= ? AND m.meal_type = 'dinner' AND m.skip_planning = 0
      ORDER BY m.planned_on ASC
    `).all(monday, sunday);

    // Map by date for easy lookup per day
    const entriesByDate = {};
    entries.forEach(e => {
      entriesByDate[e.planned_on] = e;
    });

    const ingredientMap = new Map();
    const byDay = [];
    let totalRecipes = 0;

    for (const { date, dayName } of weekDates) {
      const entry = entriesByDate[date];
      if (!entry) {
        byDay.push({
          date,
          dayName,
          recipeTitle: null,
          recipeId: null,
          servings: null,
          baseServings: null,
          ingredients: []
        });
        continue;
      }

      totalRecipes++;
      const dayServings = entry.planned_servings || entry.recipe_servings || userDefaultServings || 4;
      const baseServings = entry.recipe_servings || 4;
      const scaleFactor = (baseServings > 0) ? (dayServings / baseServings) : 1;

      const rawIngredients = db.prepare(`
        SELECT ri.quantity, ri.unit, ri.notes, i.name
        FROM recipe_ingredients ri
        JOIN ingredients i ON ri.ingredient_id = i.id
        WHERE ri.recipe_id = ?
        ORDER BY ri.sort_order ASC
      `).all(entry.recipe_id);

      const scaledIngredients = rawIngredients.map(ing => {
        let scaledQty = ing.quantity;
        if (typeof ing.quantity === 'number' && !isNaN(ing.quantity)) {
          scaledQty = ing.quantity * scaleFactor;
        }
        return {
          name: ing.name,
          quantity: scaledQty,
          unit: ing.unit || '',
          notes: ing.notes || ''
        };
      });

      byDay.push({
        date,
        dayName,
        recipeTitle: entry.recipe_title,
        recipeId: entry.recipe_id,
        servings: dayServings,
        baseServings: baseServings,
        ingredients: scaledIngredients
      });

      // Aggregate for combined shopping list
      for (const ing of scaledIngredients) {
        const rawName = ing.name.trim();
        const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
        const normName = rawName.toLowerCase();
        const unit = (ing.unit || '').trim().toLowerCase();
        const key = `${normName}::${unit}`;

        if (!ingredientMap.has(key)) {
          ingredientMap.set(key, {
            name: displayName,
            numericTotal: 0,
            hasNumeric: false,
            hasNull: false,
            unit: ing.unit || '',
            recipes: new Set(),
            notes: new Set()
          });
        }

        const item = ingredientMap.get(key);
        item.recipes.add(`${entry.recipe_title} (${dayServings}p)`);
        if (ing.notes && ing.notes.trim()) item.notes.add(ing.notes.trim());

        if (typeof ing.quantity === 'number' && !isNaN(ing.quantity)) {
          item.numericTotal += ing.quantity;
          item.hasNumeric = true;
        } else {
          item.hasNull = true;
        }
      }
    }

    // Format combined list
    const combined = Array.from(ingredientMap.values()).map(item => {
      let displayQuantity = '';
      if (item.hasNumeric) {
        const qtyFormatted = Number.isInteger(item.numericTotal)
          ? item.numericTotal.toString()
          : item.numericTotal.toFixed(2).replace(/\.?0+$/, '');

        displayQuantity = item.unit ? `${qtyFormatted} ${item.unit}` : `${qtyFormatted}`;
        if (item.hasNull) {
          displayQuantity += ' (+ extra naar smaak)';
        }
      } else if (item.unit) {
        displayQuantity = item.unit;
      }

      return {
        name: item.name,
        quantity: item.hasNumeric ? item.numericTotal : null,
        unit: item.unit,
        displayQuantity,
        displayText: displayQuantity ? `${displayQuantity} ${item.name}` : item.name,
        recipes: Array.from(item.recipes),
        notes: Array.from(item.notes)
      };
    });

    combined.sort((a, b) => a.name.localeCompare(b.name, 'nl'));

    res.json({
      monday,
      sunday,
      totalRecipes,
      combined,
      byDay
    });
  } catch (err) {
    console.error('Error fetching shopping list:', err);
    res.status(500).json({ error: 'Er is een fout opgetreden bij het ophalen van de boodschappenlijst.' });
  }
});

// GET /api/meal-plan/unplanned-dishes - Fetch recipes sorted by longest time since last planned (or never planned)
router.get('/unplanned-dishes', requireAuth, (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 12;

    const dishes = db.prepare(`
      SELECT 
        r.id,
        r.title,
        r.description,
        r.servings,
        r.prep_time,
        r.cook_time,
        r.image_path,
        MAX(m.planned_on) AS last_planned_date
      FROM recipes r
      LEFT JOIN meal_plan_entries m ON r.id = m.recipe_id AND m.skip_planning = 0
      WHERE (r.exclude_from_menu IS NULL OR r.exclude_from_menu = 0)
      GROUP BY r.id
      ORDER BY 
        CASE WHEN MAX(m.planned_on) IS NULL THEN 0 ELSE 1 END,
        MAX(m.planned_on) ASC,
        r.title ASC
      LIMIT ?
    `).all(limit);

    res.json({ dishes });
  } catch (err) {
    console.error('Error fetching unplanned dishes:', err);
    res.status(500).json({ error: 'Er is een fout opgetreden bij het ophalen van de gerechten.' });
  }
});

// GET /api/meal-plan/month - Fetch all meal plan entries for a given month (YYYY-MM)
router.get('/month', requireAuth, (req, res) => {
  try {
    const today = new Date();
    const year = parseInt(req.query.year, 10) || today.getFullYear();
    const month = parseInt(req.query.month, 10) || (today.getMonth() + 1);

    const mStr = String(month).padStart(2, '0');
    const startDate = `${year}-${mStr}-01`;
    
    const lastDayNum = new Date(year, month, 0).getDate();
    const endDate = `${year}-${mStr}-${String(lastDayNum).padStart(2, '0')}`;

    const entries = db.prepare(`
      SELECT 
        m.planned_on,
        m.recipe_id,
        m.notes,
        m.skip_planning,
        r.title AS recipe_title,
        r.image_path AS recipe_image
      FROM meal_plan_entries m
      LEFT JOIN recipes r ON m.recipe_id = r.id
      WHERE m.planned_on >= ? AND m.planned_on <= ? AND m.meal_type = 'dinner'
    `).all(startDate, endDate);

    const entriesByDate = {};
    for (const entry of entries) {
      entriesByDate[entry.planned_on] = entry;
    }

    res.json({
      year,
      month,
      startDate,
      endDate,
      totalDaysInMonth: lastDayNum,
      entries: entriesByDate
    });
  } catch (err) {
    console.error('Error fetching month meal plan:', err);
    res.status(500).json({ error: 'Er is een fout opgetreden bij het ophalen van het maandoverzicht.' });
  }
});

// POST /api/meal-plan/save - Save or update manual day in shared plan
router.post('/save', requireAuth, (req, res) => {
  const userId = req.user.id;
  const { planned_on, recipe_id, notes, skip_planning, servings } = req.body;

  if (!planned_on) {
    return res.status(400).json({ error: 'Datum (planned_on) is verplicht.' });
  }

  try {
    let parsedServings = null;
    if (servings !== undefined && servings !== null && servings !== '') {
      const s = parseInt(servings, 10);
      if (!isNaN(s) && s > 0) {
        parsedServings = s;
      }
    }

    // If recipe_id is provided, verify it exists
    if (recipe_id) {
      const recipe = db.prepare('SELECT id, servings FROM recipes WHERE id = ?').get(recipe_id);
      if (!recipe) {
        return res.status(400).json({ error: 'Geselecteerd recept is ongeldig.' });
      }
      if (!parsedServings) {
        const user = db.prepare('SELECT default_servings FROM users WHERE id = ?').get(userId);
        parsedServings = (user && user.default_servings) ? user.default_servings : (recipe.servings || 4);
      }
    }

    db.prepare(`
      INSERT INTO meal_plan_entries (user_id, planned_on, recipe_id, servings, notes, skip_planning, meal_type)
      VALUES (?, ?, ?, ?, ?, ?, 'dinner')
      ON CONFLICT(planned_on, meal_type) DO UPDATE SET
        user_id = excluded.user_id,
        recipe_id = excluded.recipe_id,
        servings = excluded.servings,
        notes = excluded.notes,
        skip_planning = excluded.skip_planning
    `).run(
      userId,
      planned_on,
      recipe_id || null,
      parsedServings || null,
      notes !== undefined ? notes.trim() : '',
      skip_planning ? 1 : 0
    );

    res.json({ message: 'Planning succesvol opgeslagen!' });
  } catch (err) {
    console.error('Error saving meal plan day:', err);
    res.status(500).json({ error: 'Er is een fout opgetreden bij het opslaan.' });
  }
});

// POST /api/meal-plan/generate - Generate shared week plan with settings without duplicates
router.post('/generate', requireAuth, (req, res) => {
  const userId = req.user.id;
  const { start_date, excluded_days, tag_ids, locked_dates } = req.body;

  if (!start_date) {
    return res.status(400).json({ error: 'Startdatum (start_date) is verplicht.' });
  }

  try {
    const monday = getMonday(start_date);
    const weekDates = getWeekDates(monday);

    const lockedSet = new Set(locked_dates || []);
    const excludedSet = new Set(excluded_days || []);

    const currentUser = db.prepare('SELECT default_servings FROM users WHERE id = ?').get(userId);
    const defaultServings = (currentUser && currentUser.default_servings) ? currentUser.default_servings : 4;

    // 1. Get recipes pool from shared cookbook (excluding recipes marked as not for week menu)
    let recipesSql = 'SELECT id FROM recipes WHERE (exclude_from_menu IS NULL OR exclude_from_menu = 0)';
    const recipesParams = [];

    if (tag_ids && tag_ids.length > 0) {
      recipesSql += ` AND id IN (
        SELECT recipe_id FROM recipe_tags 
        WHERE tag_id IN (${tag_ids.map(() => '?').join(',')})
      )`;
      recipesParams.push(...tag_ids);
    }

    let recipePool = db.prepare(recipesSql).all(...recipesParams).map(r => r.id);
    let fallbackUsed = false;

    // Fallback: if tag filter yields no recipes, get all eligible recipes instead
    if (recipePool.length === 0) {
      recipePool = db.prepare('SELECT id FROM recipes WHERE (exclude_from_menu IS NULL OR exclude_from_menu = 0)').all().map(r => r.id);
      fallbackUsed = true;
    }

    // 2. Track recipes already locked for this week so we don't pick duplicate recipes
    const usedRecipeIdsInWeek = new Set();

    for (const { date } of weekDates) {
      if (lockedSet.has(date)) {
        const existingLocked = db.prepare(`
          SELECT recipe_id FROM meal_plan_entries 
          WHERE planned_on = ? AND meal_type = 'dinner'
        `).get(date);
        if (existingLocked && existingLocked.recipe_id) {
          usedRecipeIdsInWeek.add(existingLocked.recipe_id);
        }
      }
    }

    const generateTransaction = db.transaction(() => {
      for (const { date } of weekDates) {
        // Skip locked days - leave untouched
        if (lockedSet.has(date)) {
          continue;
        }

        // If day is excluded (do not plan)
        if (excludedSet.has(date)) {
          db.prepare(`
            INSERT INTO meal_plan_entries (user_id, planned_on, recipe_id, servings, notes, skip_planning, meal_type)
            VALUES (?, ?, NULL, NULL, '', 1, 'dinner')
            ON CONFLICT(planned_on, meal_type) DO UPDATE SET
              user_id = excluded.user_id,
              recipe_id = NULL,
              servings = NULL,
              skip_planning = 1
          `).run(userId, date);
          continue;
        }

        // Select a unique recipe from the candidate pool
        let availableCandidates = recipePool.filter(id => !usedRecipeIdsInWeek.has(id));

        // If no unused recipes are left (e.g. very few recipes in database), recycle from full pool
        if (availableCandidates.length === 0 && recipePool.length > 0) {
          availableCandidates = [...recipePool];
        }

        let selectedRecipeId = null;
        if (availableCandidates.length > 0) {
          const randomIndex = Math.floor(Math.random() * availableCandidates.length);
          selectedRecipeId = availableCandidates[randomIndex];
          usedRecipeIdsInWeek.add(selectedRecipeId);
        }

        db.prepare(`
          INSERT INTO meal_plan_entries (user_id, planned_on, recipe_id, servings, notes, skip_planning, meal_type)
          VALUES (?, ?, ?, ?, '', 0, 'dinner')
          ON CONFLICT(planned_on, meal_type) DO UPDATE SET
            user_id = excluded.user_id,
            recipe_id = excluded.recipe_id,
            servings = excluded.servings,
            skip_planning = 0
        `).run(userId, date, selectedRecipeId, selectedRecipeId ? defaultServings : null);
      }
    });

    generateTransaction();

    res.json({
      message: 'Weekmenu succesvol samengesteld!',
      warning: fallbackUsed && tag_ids && tag_ids.length > 0 
        ? 'Geen recepten gevonden met de geselecteerde filters. Alle recepten zijn gebruikt.' 
        : null
    });
  } catch (err) {
    console.error('Error generating week menu:', err);
    res.status(500).json({ error: 'Er is een fout opgetreden bij het genereren van het weekmenu.' });
  }
});

// DELETE /api/meal-plan/entry/:date - Delete/clear meal plan entry for a given date in shared plan
router.delete('/entry/:date', requireAuth, (req, res) => {
  const { date } = req.params;

  if (!date) {
    return res.status(400).json({ error: 'Datum is verplicht.' });
  }

  try {
    db.prepare(`
      DELETE FROM meal_plan_entries 
      WHERE planned_on = ? AND meal_type = 'dinner'
    `).run(date);

    res.json({ message: 'Maaltijd van deze dag verwijderd!' });
  } catch (err) {
    console.error('Error deleting meal plan entry:', err);
    res.status(500).json({ error: 'Er is een fout opgetreden bij het verwijderen.' });
  }
});

module.exports = router;
