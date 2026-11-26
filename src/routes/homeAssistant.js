'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../db/database');
const { requireHomeAssistantAuth } = require('../middleware/auth');

const APP_TIMEZONE = process.env.TZ || 'Europe/Brussels';
const WEEKDAY_NAMES_NL = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];
const WEEKDAY_ALIASES = {
  maandag: 0, monday: 0,
  dinsdag: 1, tuesday: 1,
  woensdag: 2, wednesday: 2,
  donderdag: 3, thursday: 3,
  vrijdag: 4, friday: 4,
  zaterdag: 5, saturday: 5,
  zondag: 6, sunday: 6
};

router.use(requireHomeAssistantAuth);

/**
 * Return today's date (YYYY-MM-DD) in the configured timezone.
 */
function getTodayDateStr() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

/**
 * Format a UTC Date as YYYY-MM-DD.
 */
function formatUtcDate(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dt = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dt}`;
}

/**
 * Parse a strict YYYY-MM-DD string into a UTC Date, or null if invalid.
 */
function parseStrictDate(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return dt;
}

/**
 * Add calendar days to a YYYY-MM-DD string using UTC math to avoid DST issues.
 */
function addDays(dateStr, deltaDays) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return formatUtcDate(new Date(Date.UTC(y, m - 1, d + deltaDays)));
}

/**
 * Get the Monday (YYYY-MM-DD) of the week containing dateStr.
 */
function getMonday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = dt.getUTCDay(); // 0 = Sun, 1 = Mon, ...
  const diff = d - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  return formatUtcDate(new Date(Date.UTC(y, m - 1, diff)));
}

/**
 * Return all 7 days (Monday through Sunday) for a given Monday YYYY-MM-DD.
 */
function getWeekDates(mondayStr) {
  return WEEKDAY_NAMES_NL.map((dayName, idx) => ({
    date: addDays(mondayStr, idx),
    dayName
  }));
}

/**
 * Get Dutch weekday name for a YYYY-MM-DD date.
 */
function getDayName(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return WEEKDAY_NAMES_NL[dayOfWeek === 0 ? 6 : dayOfWeek - 1];
}

/**
 * Join items naturally in Dutch ("A", "A en B", "A, B en C").
 */
function joinDutch(items) {
  if (!Array.isArray(items) || items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} en ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} en ${items[items.length - 1]}`;
}

/**
 * Format numeric ingredient quantity cleanly.
 */
function formatQty(val) {
  if (typeof val !== 'number' || isNaN(val)) return '';
  return Number.isInteger(val) ? String(val) : val.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Fetch default admin user for write operations and default_servings fallback.
 */
function getDefaultUser() {
  const user = db.prepare(
    'SELECT id, default_servings FROM users ORDER BY is_admin DESC, created_at ASC LIMIT 1'
  ).get();
  return {
    id: user ? user.id : null,
    defaultServings: (user && user.default_servings) ? user.default_servings : 2
  };
}

/**
 * Parse selected_components JSON safely into [{ group_name, selected_option }] and option strings.
 */
function parseSelectedComponents(raw) {
  if (!raw) return { entries: [], names: [] };
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { entries: [], names: [] };
    }
  }
  if (!Array.isArray(parsed)) return { entries: [], names: [] };
  const names = [];
  for (const comp of parsed) {
    const opt = comp && (comp.selected_option || comp.option);
    if (typeof opt === 'string' && opt.trim()) {
      names.push(opt.trim());
    }
  }
  return { entries: parsed, names };
}

/**
 * Randomize sub-element options for a recipe if it defines recipe_sub_elements.
 */
function pickRandomSubElements(recipeId) {
  const subs = db.prepare(
    'SELECT id, name FROM recipe_sub_elements WHERE recipe_id = ? ORDER BY sort_order ASC, id ASC'
  ).all(recipeId);
  if (subs.length === 0) return null;

  const picked = [];
  for (const sub of subs) {
    const opts = db.prepare(
      'SELECT name FROM recipe_sub_element_options WHERE sub_element_id = ? ORDER BY sort_order ASC, id ASC'
    ).all(sub.id);
    if (opts.length > 0) {
      const randOpt = opts[Math.floor(Math.random() * opts.length)];
      picked.push({ group_name: sub.name, selected_option: randOpt.name });
    }
  }
  return picked.length > 0 ? JSON.stringify(picked) : null;
}

/**
 * Resolve a Dutch/English relative date, weekday name, or ISO date string to YYYY-MM-DD + labelPrefix.
 */
function resolveDateQuery(query, todayStr) {
  if (!query || typeof query !== 'string') return null;
  const q = query.trim().toLowerCase();

  if (q === 'vandaag' || q === 'today') {
    return { date: todayStr, labelPrefix: 'Vandaag' };
  }
  if (q === 'morgen' || q === 'tomorrow') {
    return { date: addDays(todayStr, 1), labelPrefix: 'Morgen' };
  }
  if (q === 'overmorgen' || q === 'day_after_tomorrow') {
    return { date: addDays(todayStr, 2), labelPrefix: 'Overmorgen' };
  }
  if (q === 'gisteren' || q === 'yesterday') {
    return { date: addDays(todayStr, -1), labelPrefix: 'Gisteren' };
  }
  if (Object.prototype.hasOwnProperty.call(WEEKDAY_ALIASES, q)) {
    const mondayStr = getMonday(todayStr);
    const idx = WEEKDAY_ALIASES[q];
    const targetDate = addDays(mondayStr, idx);
    return { date: targetDate, labelPrefix: `Op ${WEEKDAY_NAMES_NL[idx].toLowerCase()}` };
  }
  if (parseStrictDate(q)) {
    const dayName = getDayName(q);
    return { date: q, labelPrefix: `Op ${dayName.toLowerCase()}` };
  }
  return null;
}

/**
 * Build natural empty-meal phrasing matching relative vs weekday prefixes.
 */
function formatEmptyPrefix(labelPrefix) {
  if (labelPrefix.startsWith('Op ')) {
    return `${labelPrefix} staat er`;
  }
  return `Er staat ${labelPrefix.toLowerCase()}`;
}

/**
 * Build full meal + speech payload for a specific date.
 */
function buildDayData(dateStr, labelPrefix, defaultServings) {
  const dayName = getDayName(dateStr);
  const entry = db.prepare(`
    SELECT
      m.id,
      m.planned_on,
      m.recipe_id,
      m.servings AS planned_servings,
      m.notes,
      m.skip_planning,
      m.is_locked,
      m.selected_components,
      r.title AS recipe_title,
      r.servings AS recipe_servings,
      r.prep_time,
      r.cook_time
    FROM meal_plan_entries m
    LEFT JOIN recipes r ON m.recipe_id = r.id
    WHERE m.planned_on = ? AND m.meal_type = 'dinner'
  `).get(dateStr);

  const notes = entry && typeof entry.notes === 'string' ? entry.notes.trim() : '';

  // Case 1: Planned recipe
  if (entry && entry.recipe_id && entry.skip_planning !== 1 && entry.recipe_title) {
    const { names: components } = parseSelectedComponents(entry.selected_components);
    const displayName = components.length > 0
      ? `${entry.recipe_title} met ${joinDutch(components)}`
      : entry.recipe_title;

    const dayServings = entry.planned_servings || entry.recipe_servings || defaultServings || 2;
    const baseServings = entry.recipe_servings || 4;
    const scaleFactor = baseServings > 0 ? (dayServings / baseServings) : 1;

    const rawIngredients = db.prepare(`
      SELECT ri.quantity, ri.unit, i.name
      FROM recipe_ingredients ri
      JOIN ingredients i ON ri.ingredient_id = i.id
      WHERE ri.recipe_id = ?
      ORDER BY ri.sort_order ASC
    `).all(entry.recipe_id);

    const ingredients = rawIngredients.map((ing) => {
      let qtyStr = '';
      if (typeof ing.quantity === 'number' && !isNaN(ing.quantity)) {
        qtyStr = formatQty(ing.quantity * scaleFactor);
      }
      const unitStr = ing.unit ? ing.unit.trim() : '';
      const prefix = [qtyStr, unitStr].filter(Boolean).join(' ');
      return prefix ? `${prefix} ${ing.name}` : ing.name;
    });

    for (const comp of components) {
      ingredients.push(comp);
    }

    const prepTime = typeof entry.prep_time === 'number' ? entry.prep_time : null;
    const cookTime = typeof entry.cook_time === 'number' ? entry.cook_time : null;
    const totalTime = (prepTime !== null || cookTime !== null)
      ? (prepTime || 0) + (cookTime || 0)
      : null;

    const stepsRow = db.prepare(
      'SELECT COUNT(*) AS count FROM recipe_steps WHERE recipe_id = ?'
    ).get(entry.recipe_id);
    const stepsCount = stepsRow ? stepsRow.count : 0;

    let speech = `${labelPrefix} eten we ${displayName}.`;
    if (notes) {
      speech += ` Notitie: ${notes}.`;
    }

    const ingredientsSpeech = ingredients.length > 0
      ? `Voor ${displayName} voor ${dayServings} personen heb je nodig: ${joinDutch(ingredients)}.`
      : `Er zijn geen ingrediënten ingevuld voor ${displayName}.`;

    let timeSpeech;
    if (prepTime !== null && cookTime !== null) {
      timeSpeech = `${displayName} duurt in totaal ${totalTime} minuten: ${prepTime} minuten voorbereiding en ${cookTime} minuten kooktijd.`;
    } else if (prepTime !== null) {
      timeSpeech = `De voorbereidingstijd voor ${displayName} is ${prepTime} minuten.`;
    } else if (cookTime !== null) {
      timeSpeech = `De kooktijd voor ${displayName} is ${cookTime} minuten.`;
    } else {
      timeSpeech = `Voor ${displayName} staat er geen bereidingstijd ingevuld.`;
    }

    return {
      date: dateStr,
      day_name: dayName,
      has_meal: true,
      is_custom_note: false,
      is_locked: entry.is_locked === 1,
      recipe_id: entry.recipe_id,
      title: entry.recipe_title,
      display_name: displayName,
      components,
      servings: dayServings,
      prep_time: prepTime,
      cook_time: cookTime,
      total_time: totalTime,
      steps_count: stepsCount,
      notes,
      ingredients,
      speech,
      ingredients_speech: ingredientsSpeech,
      time_speech: timeSpeech
    };
  }

  // Case 2: Custom note without recipe (e.g. leftovers / freezer meal)
  if (entry && !entry.recipe_id && notes) {
    return {
      date: dateStr,
      day_name: dayName,
      has_meal: true,
      is_custom_note: true,
      is_locked: false,
      recipe_id: null,
      title: notes,
      display_name: notes,
      components: [],
      servings: null,
      prep_time: null,
      cook_time: null,
      total_time: null,
      steps_count: 0,
      notes,
      ingredients: [],
      speech: `${labelPrefix} eten we ${notes}.`,
      ingredients_speech: `Voor ${notes} staan er geen ingrediënten in het receptenboekje.`,
      time_speech: `Voor ${notes} staat er geen bereidingstijd in het receptenboekje.`
    };
  }

  // Case 3: No meal planned
  const emptyPrefix = formatEmptyPrefix(labelPrefix);
  return {
    date: dateStr,
    day_name: dayName,
    has_meal: false,
    is_custom_note: false,
    is_locked: false,
    recipe_id: null,
    title: null,
    display_name: 'Geen maaltijd gepland',
    components: [],
    servings: null,
    prep_time: null,
    cook_time: null,
    total_time: null,
    steps_count: 0,
    notes: '',
    ingredients: [],
    speech: `${emptyPrefix} geen maaltijd gepland op het weekmenu.`,
    ingredients_speech: `${emptyPrefix} geen maaltijd gepland, dus je hebt geen ingrediënten nodig.`,
    time_speech: `${emptyPrefix} geen maaltijd gepland.`
  };
}

/**
 * Build week overview, remaining days speech, and next upcoming meal.
 */
function buildWeekSummary(todayStr, defaultServings) {
  const mondayStr = getMonday(todayStr);
  const weekDates = getWeekDates(mondayStr);
  const days = weekDates.map(({ date, dayName }) =>
    buildDayData(date, `Op ${dayName.toLowerCase()}`, defaultServings)
  );

  const plannedDays = days.filter(d => d.has_meal);
  const weekParts = plannedDays.map(d => `op ${d.day_name.toLowerCase()} ${d.display_name}`);
  const weekSpeech = plannedDays.length > 0
    ? `Op het weekmenu staan deze week: ${joinDutch(weekParts)}.`
    : 'Er staan deze week geen maaltijden gepland op het weekmenu.';

  const tomorrowStr = addDays(todayStr, 1);
  const remainingDays = days.filter(d => d.date >= todayStr && d.has_meal);
  const remainingParts = remainingDays.map((d) => {
    if (d.date === todayStr) return `vandaag ${d.display_name}`;
    if (d.date === tomorrowStr) return `morgen ${d.display_name}`;
    return `op ${d.day_name.toLowerCase()} ${d.display_name}`;
  });
  const remainingWeekSpeech = remainingParts.length > 0
    ? `Voor de rest van de week staat op het menu: ${joinDutch(remainingParts)}.`
    : 'Er staan voor de rest van deze week geen maaltijden meer gepland.';

  // Find next planned meal strictly after today (within next 14 days)
  let nextMeal = null;
  for (let offset = 1; offset <= 14; offset++) {
    const candidateDate = addDays(todayStr, offset);
    const label = offset === 1 ? 'Morgen' : (offset === 2 ? 'Overmorgen' : `Op ${getDayName(candidateDate).toLowerCase()}`);
    const dayData = buildDayData(candidateDate, label, defaultServings);
    if (dayData.has_meal) {
      nextMeal = {
        date: dayData.date,
        day_name: dayData.day_name,
        display_name: dayData.display_name,
        speech: dayData.speech
      };
      break;
    }
  }

  const recipesRow = db.prepare('SELECT COUNT(*) AS count FROM recipes').get();

  return {
    monday: mondayStr,
    planned_count: plannedDays.length,
    recipes_count: recipesRow ? recipesRow.count : 0,
    days,
    week_speech: weekSpeech,
    remaining_week_speech: remainingWeekSpeech,
    next_meal: nextMeal,
    next_meal_speech: nextMeal
      ? nextMeal.speech
      : 'Er staan de komende twee weken geen maaltijden gepland.'
  };
}

/**
 * Aggregate combined shopping list for a Monday-Sunday week.
 */
function buildWeekShoppingList(mondayStr, defaultServings) {
  const sundayStr = addDays(mondayStr, 6);
  const entries = db.prepare(`
    SELECT
      m.planned_on,
      m.recipe_id,
      m.servings AS planned_servings,
      m.selected_components,
      r.title AS recipe_title,
      r.servings AS recipe_servings
    FROM meal_plan_entries m
    JOIN recipes r ON m.recipe_id = r.id
    WHERE m.planned_on >= ? AND m.planned_on <= ? AND m.meal_type = 'dinner' AND m.skip_planning = 0
    ORDER BY m.planned_on ASC
  `).all(mondayStr, sundayStr);

  const ingredientMap = new Map();

  for (const entry of entries) {
    const dayServings = entry.planned_servings || entry.recipe_servings || defaultServings || 2;
    const baseServings = entry.recipe_servings || 4;
    const scaleFactor = baseServings > 0 ? (dayServings / baseServings) : 1;

    const rawIngredients = db.prepare(`
      SELECT ri.quantity, ri.unit, i.name
      FROM recipe_ingredients ri
      JOIN ingredients i ON ri.ingredient_id = i.id
      WHERE ri.recipe_id = ?
      ORDER BY ri.sort_order ASC
    `).all(entry.recipe_id);

    const combinedIngredients = rawIngredients.map((ing) => ({
      name: ing.name,
      quantity: (typeof ing.quantity === 'number' && !isNaN(ing.quantity))
        ? ing.quantity * scaleFactor
        : null,
      unit: ing.unit || ''
    }));

    const { names: compNames } = parseSelectedComponents(entry.selected_components);
    for (const compName of compNames) {
      combinedIngredients.push({ name: compName, quantity: null, unit: '' });
    }

    for (const ing of combinedIngredients) {
      const rawName = ing.name.trim();
      const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
      const unit = (ing.unit || '').trim();
      const key = `${rawName.toLowerCase()}::${unit.toLowerCase()}`;

      if (!ingredientMap.has(key)) {
        ingredientMap.set(key, {
          name: displayName,
          numericTotal: 0,
          hasNumeric: false,
          hasNull: false,
          unit,
          recipes: new Set()
        });
      }

      const item = ingredientMap.get(key);
      item.recipes.add(entry.recipe_title);
      if (typeof ing.quantity === 'number' && !isNaN(ing.quantity)) {
        item.numericTotal += ing.quantity;
        item.hasNumeric = true;
      } else {
        item.hasNull = true;
      }
    }
  }

  const items = Array.from(ingredientMap.values())
    .map((item) => {
      let displayQuantity = '';
      if (item.hasNumeric) {
        const qtyStr = formatQty(item.numericTotal);
        displayQuantity = item.unit ? `${qtyStr} ${item.unit}` : qtyStr;
        if (item.hasNull) displayQuantity += ' (+ extra naar smaak)';
      } else if (item.unit) {
        displayQuantity = item.unit;
      }

      return {
        name: item.name,
        display_text: displayQuantity ? `${displayQuantity} ${item.name}` : item.name,
        recipes: Array.from(item.recipes)
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'nl'));

  let speech;
  if (items.length === 0) {
    speech = 'De boodschappenlijst voor deze week is leeg.';
  } else if (items.length <= 15) {
    speech = `Op de boodschappenlijst voor deze week staan ${items.length} producten: ${joinDutch(items.map(i => i.display_text))}.`;
  } else {
    const first15 = items.slice(0, 15).map(i => i.display_text);
    const remainingCount = items.length - 15;
    speech = `Op de boodschappenlijst voor deze week staan ${items.length} producten. De eerste vijftien zijn: ${first15.join(', ')}, en nog ${remainingCount} andere producten in het receptenboekje.`;
  }

  return {
    total_items: items.length,
    total_recipes: entries.length,
    items,
    speech
  };
}

// GET /api/home-assistant/summary
router.get('/summary', (_req, res) => {
  try {
    const { defaultServings } = getDefaultUser();
    const todayStr = getTodayDateStr();
    const tomorrowStr = addDays(todayStr, 1);
    const dayAfterStr = addDays(todayStr, 2);

    const today = buildDayData(todayStr, 'Vandaag', defaultServings);
    const tomorrow = buildDayData(tomorrowStr, 'Morgen', defaultServings);
    const dayAfterTomorrow = buildDayData(dayAfterStr, 'Overmorgen', defaultServings);
    const weekSummary = buildWeekSummary(todayStr, defaultServings);
    const shoppingList = buildWeekShoppingList(weekSummary.monday, defaultServings);

    res.json({
      updated_at: new Date().toISOString(),
      date: todayStr,
      today,
      tomorrow,
      day_after_tomorrow: dayAfterTomorrow,
      week_summary: weekSummary,
      shopping_list: shoppingList
    });
  } catch (err) {
    console.error('Home Assistant summary error:', err);
    res.status(500).json({ error: 'Er is een fout opgetreden bij het ophalen van de samenvatting.' });
  }
});

// GET /api/home-assistant/day/:query
router.get('/day/:query', (req, res) => {
  try {
    const todayStr = getTodayDateStr();
    const resolved = resolveDateQuery(req.params.query, todayStr);
    if (!resolved) {
      return res.status(400).json({ error: 'Ongeldige dag of datum.' });
    }
    const { defaultServings } = getDefaultUser();
    res.json(buildDayData(resolved.date, resolved.labelPrefix, defaultServings));
  } catch (err) {
    console.error('Home Assistant day lookup error:', err);
    res.status(500).json({ error: 'Er is een fout opgetreden bij het ophalen van de dag.' });
  }
});

// GET /api/home-assistant/random-recipe
router.get('/random-recipe', (req, res) => {
  try {
    const tagQuery = typeof req.query.tag === 'string' ? req.query.tag.trim() : '';
    let sql = 'SELECT r.id, r.title, r.prep_time, r.cook_time, r.servings FROM recipes r WHERE (r.exclude_from_menu IS NULL OR r.exclude_from_menu = 0)';
    const params = [];

    if (tagQuery) {
      sql += ` AND r.id IN (
        SELECT rt.recipe_id
        FROM recipe_tags rt
        JOIN tags t ON t.id = rt.tag_id
        WHERE LOWER(t.name) = LOWER(?)
      )`;
      params.push(tagQuery);
    }

    const candidates = db.prepare(sql).all(...params);
    if (candidates.length === 0) {
      const speech = tagQuery
        ? `Ik heb geen recepten gevonden met het label ${tagQuery}.`
        : 'Er staan nog geen recepten in het receptenboekje.';
      return res.json({ id: null, title: null, speech });
    }

    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    const prepTime = typeof picked.prep_time === 'number' ? picked.prep_time : null;
    const cookTime = typeof picked.cook_time === 'number' ? picked.cook_time : null;
    const totalTime = (prepTime !== null || cookTime !== null) ? (prepTime || 0) + (cookTime || 0) : null;

    let speech = `Wat dacht je van ${picked.title}?`;
    if (totalTime !== null && totalTime > 0) {
      speech += ` De totale bereidingstijd is ongeveer ${totalTime} minuten.`;
    }

    res.json({
      id: picked.id,
      title: picked.title,
      prep_time: prepTime,
      cook_time: cookTime,
      total_time: totalTime,
      servings: picked.servings,
      speech
    });
  } catch (err) {
    console.error('Home Assistant random recipe error:', err);
    res.status(500).json({ error: 'Er is een fout opgetreden bij het kiezen van een recept.' });
  }
});

// POST /api/home-assistant/reroll-day
router.post('/reroll-day', (req, res) => {
  try {
    const todayStr = getTodayDateStr();
    const rawDate = (req.body && req.body.date) ? String(req.body.date) : 'today';
    const resolved = resolveDateQuery(rawDate, todayStr);
    if (!resolved) {
      return res.status(400).json({ error: 'Ongeldige dag of datum.' });
    }

    const { id: userId, defaultServings } = getDefaultUser();
    const mondayStr = getMonday(resolved.date);
    const sundayStr = addDays(mondayStr, 6);

    const currentEntry = db.prepare(
      "SELECT recipe_id FROM meal_plan_entries WHERE planned_on = ? AND meal_type = 'dinner'"
    ).get(resolved.date);
    const currentRecipeId = currentEntry ? currentEntry.recipe_id : null;

    const weekUsedRows = db.prepare(`
      SELECT recipe_id
      FROM meal_plan_entries
      WHERE planned_on >= ? AND planned_on <= ? AND meal_type = 'dinner' AND skip_planning = 0 AND recipe_id IS NOT NULL
    `).all(mondayStr, sundayStr);
    const usedIds = new Set(weekUsedRows.map(r => r.recipe_id));

    const allEligible = db.prepare(
      'SELECT id FROM recipes WHERE (exclude_from_menu IS NULL OR exclude_from_menu = 0)'
    ).all().map(r => r.id);

    if (allEligible.length === 0) {
      return res.status(400).json({ error: 'Geen geschikte recepten beschikbaar.', speech: 'Er zijn geen geschikte recepten om te kiezen.' });
    }

    let pool = allEligible.filter(id => !usedIds.has(id) && id !== currentRecipeId);
    if (pool.length === 0) {
      pool = allEligible.filter(id => id !== currentRecipeId);
    }
    if (pool.length === 0) {
      pool = allEligible;
    }

    const selectedRecipeId = pool[Math.floor(Math.random() * pool.length)];
    const selectedComponentsJson = pickRandomSubElements(selectedRecipeId);

    db.prepare(`
      INSERT INTO meal_plan_entries (user_id, planned_on, recipe_id, servings, notes, skip_planning, is_locked, meal_type, selected_components)
      VALUES (?, ?, ?, ?, '', 0, 0, 'dinner', ?)
      ON CONFLICT(planned_on, meal_type) DO UPDATE SET
        user_id = excluded.user_id,
        recipe_id = excluded.recipe_id,
        servings = excluded.servings,
        notes = '',
        skip_planning = 0,
        is_locked = 0,
        selected_components = excluded.selected_components
    `).run(userId, resolved.date, selectedRecipeId, defaultServings, selectedComponentsJson);

    const dayData = buildDayData(resolved.date, resolved.labelPrefix, defaultServings);
    const labelLower = resolved.labelPrefix.startsWith('Op ')
      ? resolved.labelPrefix.toLowerCase()
      : `voor ${resolved.labelPrefix.toLowerCase()}`;

    res.json({
      ...dayData,
      speech: `Ik heb het gerecht ${labelLower} veranderd naar ${dayData.display_name}.`
    });
  } catch (err) {
    console.error('Home Assistant reroll day error:', err);
    res.status(500).json({ error: 'Er is een fout opgetreden bij het kiezen van een ander gerecht.' });
  }
});

// POST /api/home-assistant/generate-week
router.post('/generate-week', (req, res) => {
  try {
    const todayStr = getTodayDateStr();
    const nextWeek = Boolean(req.body && req.body.next_week);
    const baseDate = nextWeek ? addDays(todayStr, 7) : todayStr;
    const mondayStr = getMonday(baseDate);
    const weekDates = getWeekDates(mondayStr);
    const sundayStr = weekDates[6].date;

    const { id: userId, defaultServings } = getDefaultUser();
    const recipePool = db.prepare(
      'SELECT id FROM recipes WHERE (exclude_from_menu IS NULL OR exclude_from_menu = 0)'
    ).all().map(r => r.id);

    if (recipePool.length === 0) {
      return res.status(400).json({ error: 'Geen geschikte recepten beschikbaar.', speech: 'Er zijn geen geschikte recepten om een weekmenu te maken.' });
    }

    const generateTx = db.transaction(() => {
      const lockedRows = db.prepare(`
        SELECT planned_on, recipe_id
        FROM meal_plan_entries
        WHERE planned_on >= ? AND planned_on <= ?
          AND meal_type = 'dinner'
          AND is_locked = 1
          AND skip_planning = 0
          AND recipe_id IS NOT NULL
      `).all(mondayStr, sundayStr);

      const lockedSet = new Set();
      const usedInWeek = new Set();
      for (const row of lockedRows) {
        lockedSet.add(row.planned_on);
        usedInWeek.add(row.recipe_id);
      }

      for (const { date } of weekDates) {
        if (lockedSet.has(date)) continue;

        let candidates = recipePool.filter(id => !usedInWeek.has(id));
        if (candidates.length === 0) {
          candidates = [...recipePool];
        }

        const selectedRecipeId = candidates[Math.floor(Math.random() * candidates.length)];
        usedInWeek.add(selectedRecipeId);
        const selectedComponentsJson = pickRandomSubElements(selectedRecipeId);

        db.prepare(`
          INSERT INTO meal_plan_entries (user_id, planned_on, recipe_id, servings, notes, skip_planning, is_locked, meal_type, selected_components)
          VALUES (?, ?, ?, ?, '', 0, 0, 'dinner', ?)
          ON CONFLICT(planned_on, meal_type) DO UPDATE SET
            user_id = excluded.user_id,
            recipe_id = excluded.recipe_id,
            servings = excluded.servings,
            skip_planning = 0,
            is_locked = 0,
            selected_components = excluded.selected_components
        `).run(userId, date, selectedRecipeId, defaultServings, selectedComponentsJson);
      }
    });

    generateTx();

    const summary = buildWeekSummary(baseDate, defaultServings);
    const weekLabel = nextWeek ? 'voor volgende week' : 'voor deze week';
    res.json({
      monday: mondayStr,
      week_speech: summary.week_speech,
      speech: `Ik heb een nieuw weekmenu ${weekLabel} samengesteld. ${summary.week_speech}`
    });
  } catch (err) {
    console.error('Home Assistant generate week error:', err);
    res.status(500).json({ error: 'Er is een fout opgetreden bij het genereren van het weekmenu.' });
  }
});

// POST /api/home-assistant/lock-day
router.post('/lock-day', (req, res) => {
  try {
    const todayStr = getTodayDateStr();
    const rawDate = (req.body && req.body.date) ? String(req.body.date) : 'today';
    const resolved = resolveDateQuery(rawDate, todayStr);
    if (!resolved) {
      return res.status(400).json({ error: 'Ongeldige dag of datum.' });
    }

    const existing = db.prepare(`
      SELECT id, recipe_id, skip_planning, is_locked
      FROM meal_plan_entries
      WHERE planned_on = ? AND meal_type = 'dinner'
    `).get(resolved.date);

    if (!existing || !existing.recipe_id || existing.skip_planning === 1) {
      return res.status(404).json({
        error: 'Geen geplande maaltijd gevonden voor deze dag.',
        speech: `${formatEmptyPrefix(resolved.labelPrefix)} geen gerecht gepland om te vergrendelen.`
      });
    }

    const wantLocked = (req.body && typeof req.body.is_locked === 'boolean')
      ? (req.body.is_locked ? 1 : 0)
      : 1;

    db.prepare('UPDATE meal_plan_entries SET is_locked = ? WHERE id = ?').run(wantLocked, existing.id);

    const { defaultServings } = getDefaultUser();
    const dayData = buildDayData(resolved.date, resolved.labelPrefix, defaultServings);
    res.json({
      planned_on: resolved.date,
      is_locked: wantLocked === 1,
      speech: wantLocked === 1
        ? `Ik heb ${dayData.display_name} vastgezet.`
        : `Ik heb ${dayData.display_name} ontgrendeld.`
    });
  } catch (err) {
    console.error('Home Assistant lock day error:', err);
    res.status(500).json({ error: 'Er is een fout opgetreden bij het vergrendelen.' });
  }
});

// POST /api/home-assistant/skip-day
router.post('/skip-day', (req, res) => {
  try {
    const todayStr = getTodayDateStr();
    const rawDate = (req.body && req.body.date) ? String(req.body.date) : 'today';
    const resolved = resolveDateQuery(rawDate, todayStr);
    if (!resolved) {
      return res.status(400).json({ error: 'Ongeldige dag of datum.' });
    }

    const notes = (req.body && typeof req.body.notes === 'string') ? req.body.notes.trim() : '';
    const { id: userId } = getDefaultUser();

    db.prepare(`
      INSERT INTO meal_plan_entries (user_id, planned_on, recipe_id, servings, notes, skip_planning, is_locked, meal_type, selected_components)
      VALUES (?, ?, NULL, NULL, ?, 1, 0, 'dinner', NULL)
      ON CONFLICT(planned_on, meal_type) DO UPDATE SET
        user_id = excluded.user_id,
        recipe_id = NULL,
        servings = NULL,
        notes = excluded.notes,
        skip_planning = 1,
        is_locked = 0,
        selected_components = NULL
    `).run(userId, resolved.date, notes);

    const speech = notes
      ? `${resolved.labelPrefix} staat nu genoteerd als ${notes}.`
      : `Ik heb het avondeten ${resolved.labelPrefix.startsWith('Op ') ? resolved.labelPrefix.toLowerCase() : 'voor ' + resolved.labelPrefix.toLowerCase()} overgeslagen.`;

    res.json({
      planned_on: resolved.date,
      speech
    });
  } catch (err) {
    console.error('Home Assistant skip day error:', err);
    res.status(500).json({ error: 'Er is een fout opgetreden bij het overslaan van de dag.' });
  }
});

module.exports = router;
