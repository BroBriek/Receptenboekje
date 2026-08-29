'use strict';

/**
 * migrate.js
 * Runs all schema migrations in order.
 * Safe to run repeatedly.
 */

require('dotenv').config();
const crypto = require('crypto');
const db = require('./database');

// Simple pbkdf2 password hashing helper for seeding
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

const migrations = [
  {
    name: '001_initial_schema',
    up: () => {
      // Enable foreign keys
      db.exec('PRAGMA foreign_keys = ON;');

      db.exec(`
        -- Track applied migrations
        CREATE TABLE IF NOT EXISTS migrations (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          name       TEXT    NOT NULL UNIQUE,
          applied_at TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        -- ── Users ─────────────────────────────────────────────────────────────
        CREATE TABLE IF NOT EXISTS users (
          id         TEXT    PRIMARY KEY,          -- UUID
          username   TEXT    NOT NULL UNIQUE,
          password   TEXT    NOT NULL,             -- Hashed
          is_admin   INTEGER NOT NULL DEFAULT 0,   -- 1 = admin, 0 = regular
          created_at TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        -- ── Recipes ──────────────────────────────────────────────────────────
        CREATE TABLE IF NOT EXISTS recipes (
          id          TEXT    PRIMARY KEY,          -- UUID
          user_id     TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title       TEXT    NOT NULL,
          description TEXT,
          servings    INTEGER,
          prep_time   INTEGER,                      -- minutes
          cook_time   INTEGER,                      -- minutes
          image_path        TEXT,                         -- relative path under /uploads
          exclude_from_menu INTEGER NOT NULL DEFAULT 0,   -- 1 = excluded from automated week menu
          created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
          updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        -- ── Tags ─────────────────────────────────────────────────────────────
        CREATE TABLE IF NOT EXISTS tags (
          id   INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT    NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS recipe_tags (
          recipe_id TEXT    NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
          tag_id    INTEGER NOT NULL REFERENCES tags(id)    ON DELETE CASCADE,
          PRIMARY KEY (recipe_id, tag_id)
        );

        -- ── Ingredients ──────────────────────────────────────────────────────
        CREATE TABLE IF NOT EXISTS ingredients (
          id   INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT    NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS recipe_ingredients (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          recipe_id     TEXT    NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
          ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
          quantity      REAL,
          unit          TEXT,
          notes         TEXT,
          sort_order    INTEGER NOT NULL DEFAULT 0
        );

        -- ── Steps ────────────────────────────────────────────────────────────
        CREATE TABLE IF NOT EXISTS recipe_steps (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          recipe_id   TEXT    NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
          step_number INTEGER NOT NULL,
          instruction TEXT    NOT NULL,
          image_path  TEXT,
          UNIQUE (recipe_id, step_number)
        );

        -- ── Meal plan ────────────────────────────────────────────────────────
        CREATE TABLE IF NOT EXISTS meal_plan_entries (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id       TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          recipe_id     TEXT    REFERENCES recipes(id) ON DELETE SET NULL, -- Nullable!
          planned_on    TEXT    NOT NULL,             -- ISO date YYYY-MM-DD
          meal_type     TEXT    NOT NULL DEFAULT 'dinner', -- breakfast | lunch | dinner | snack
          servings      INTEGER,
          notes         TEXT,
          skip_planning INTEGER DEFAULT 0,            -- 1 = skipped / do not plan
          created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
          UNIQUE (user_id, planned_on, meal_type)
        );
      `);

      // Seed default Dutch tags if they don't exist
      const defaultTags = [
        'Vegetarisch',
        'Veganistisch',
        'Snel & Makkelijk',
        'Pasta',
        'Rijst',
        'Hollands',
        'Soep',
        'Salade',
        'Ovengerecht',
        'Vlees',
        'Vis',
        'Kip',
        'Bakken',
        'Kinderen',
        'Mexicaans',
        'Italiaans',
        'Aziatisch'
      ];

      const stmt = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
      for (const tag of defaultTags) {
        stmt.run(tag);
      }

      // Seed default admin user if no users exist
      const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
      if (userCount === 0) {
        const adminId = crypto.randomUUID ? crypto.randomUUID() : 'admin-uuid-12345';
        const adminPasswordHash = hashPassword('admin');
        db.prepare('INSERT INTO users (id, username, password, is_admin) VALUES (?, ?, ?, 1)')
          .run(adminId, 'admin', adminPasswordHash);
        console.log(' Default admin user created (username: admin, password: admin)');
      }
    },
  },
  {
    name: '002_shared_meal_plan_and_user_avatar',
    up: () => {
      // 1. Add avatar_path to users table if it doesn't exist
      const userTableInfo = db.prepare("PRAGMA table_info('users')").all();
      const hasAvatarCol = userTableInfo.some(col => col.name === 'avatar_path');
      if (!hasAvatarCol) {
        db.exec('ALTER TABLE users ADD COLUMN avatar_path TEXT;');
      }

      // 2. Recreate meal_plan_entries to be shared across all users (UNIQUE on planned_on, meal_type)
      db.exec(`
        CREATE TABLE IF NOT EXISTS meal_plan_entries_shared (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id       TEXT    REFERENCES users(id) ON DELETE SET NULL,
          recipe_id     TEXT    REFERENCES recipes(id) ON DELETE SET NULL,
          planned_on    TEXT    NOT NULL,
          meal_type     TEXT    NOT NULL DEFAULT 'dinner',
          servings      INTEGER,
          notes         TEXT,
          skip_planning INTEGER DEFAULT 0,
          created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
          UNIQUE (planned_on, meal_type)
        );

        INSERT OR IGNORE INTO meal_plan_entries_shared (id, user_id, recipe_id, planned_on, meal_type, servings, notes, skip_planning, created_at)
        SELECT id, user_id, recipe_id, planned_on, meal_type, servings, notes, skip_planning, created_at
        FROM meal_plan_entries;

        DROP TABLE meal_plan_entries;
        ALTER TABLE meal_plan_entries_shared RENAME TO meal_plan_entries;
      `);
    },
  },
  {
    name: '003_recipe_exclude_from_menu',
    up: () => {
      const recipeTableInfo = db.prepare("PRAGMA table_info('recipes')").all();
      const hasExcludeCol = recipeTableInfo.some(col => col.name === 'exclude_from_menu');
      if (!hasExcludeCol) {
        db.exec('ALTER TABLE recipes ADD COLUMN exclude_from_menu INTEGER NOT NULL DEFAULT 0;');
      }
    },
  },
  {
    name: '004_user_default_servings',
    up: () => {
      const userTableInfo = db.prepare("PRAGMA table_info('users')").all();
      const hasDefaultServingsCol = userTableInfo.some(col => col.name === 'default_servings');
      if (!hasDefaultServingsCol) {
        db.exec('ALTER TABLE users ADD COLUMN default_servings INTEGER NOT NULL DEFAULT 4;');
      }
    },
  },
  {
    name: '005_standardize_ingredient_and_tag_casing',
    up: () => {
      function formatItemName(str) {
        if (!str || typeof str !== 'string') return '';
        const trimmed = str.trim();
        if (!trimmed) return '';
        return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
      }

      // 1. Unify ingredients
      const allIngredients = db.prepare('SELECT id, name FROM ingredients').all();
      const ingGroups = new Map();

      for (const ing of allIngredients) {
        const formatted = formatItemName(ing.name);
        const lowerKey = formatted.toLowerCase();
        if (!ingGroups.has(lowerKey)) {
          ingGroups.set(lowerKey, { formatted, items: [] });
        }
        ingGroups.get(lowerKey).items.push(ing);
      }

      for (const { formatted, items } of ingGroups.values()) {
        const canonical = items[0];
        // Handle duplicate rows first
        for (let i = 1; i < items.length; i++) {
          const duplicate = items[i];
          db.prepare('UPDATE recipe_ingredients SET ingredient_id = ? WHERE ingredient_id = ?').run(canonical.id, duplicate.id);
          db.prepare('DELETE FROM ingredients WHERE id = ?').run(duplicate.id);
        }
        // Update canonical row with standardized format
        db.prepare('UPDATE ingredients SET name = ? WHERE id = ?').run(formatted, canonical.id);
      }

      // 2. Unify tags
      const allTags = db.prepare('SELECT id, name FROM tags').all();
      const tagGroups = new Map();

      for (const tag of allTags) {
        const formatted = formatItemName(tag.name);
        const lowerKey = formatted.toLowerCase();
        if (!tagGroups.has(lowerKey)) {
          tagGroups.set(lowerKey, { formatted, items: [] });
        }
        tagGroups.get(lowerKey).items.push(tag);
      }

      for (const { formatted, items } of tagGroups.values()) {
        const canonical = items[0];
        for (let i = 1; i < items.length; i++) {
          const duplicate = items[i];
          db.prepare('UPDATE OR IGNORE recipe_tags SET tag_id = ? WHERE tag_id = ?').run(canonical.id, duplicate.id);
          db.prepare('DELETE FROM recipe_tags WHERE tag_id = ?').run(duplicate.id);
          db.prepare('DELETE FROM tags WHERE id = ?').run(duplicate.id);
        }
        db.prepare('UPDATE tags SET name = ? WHERE id = ?').run(formatted, canonical.id);
      }
    },
  },
  {
    name: '006_default_admin_user',
    up: () => {
      const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
      if (!existingAdmin) {
        const adminId = crypto.randomUUID ? crypto.randomUUID() : 'admin-uuid-12345';
        const adminPasswordHash = hashPassword('admin');
        db.prepare('INSERT INTO users (id, username, password, is_admin) VALUES (?, ?, ?, 1)')
          .run(adminId, 'admin', adminPasswordHash);
        console.log(' Default admin user created (username: admin, password: admin)');
      }
    },
  },
  {
    name: '007_recipe_step_timers',
    up: () => {
      const stepTableInfo = db.prepare("PRAGMA table_info('recipe_steps')").all();
      const hasTimerCol = stepTableInfo.some(col => col.name === 'timer_seconds');
      if (!hasTimerCol) {
        db.exec('ALTER TABLE recipe_steps ADD COLUMN timer_seconds INTEGER DEFAULT NULL;');
      }

      function detectTimerInText(text) {
        if (!text || typeof text !== 'string') return null;
        const minMatch = text.match(/(?:(\d+)\s*(?:-|tot|à)\s*)?(\d+(?:[.,]\d+)?)\s*(?:minuten|minuut|min\b|mins\b)/i);
        if (minMatch) {
          const minutes = parseFloat(minMatch[2].replace(',', '.'));
          if (!isNaN(minutes) && minutes > 0) return Math.round(minutes * 60);
        }
        const secMatch = text.match(/(?:(\d+)\s*(?:-|tot|à)\s*)?(\d+)\s*(?:seconden|seconde|sec\b)/i);
        if (secMatch) {
          const seconds = parseInt(secMatch[2], 10);
          if (!isNaN(seconds) && seconds > 0) return seconds;
        }
        const hrMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:uur|uren|hour|hours)/i);
        if (hrMatch) {
          const hours = parseFloat(hrMatch[1].replace(',', '.'));
          if (!isNaN(hours) && hours > 0) return Math.round(hours * 3600);
        }
        return null;
      }

      const steps = db.prepare('SELECT id, instruction FROM recipe_steps WHERE timer_seconds IS NULL').all();
      const updateStmt = db.prepare('UPDATE recipe_steps SET timer_seconds = ? WHERE id = ?');
      for (const step of steps) {
        const t = detectTimerInText(step.instruction);
        if (t) {
          updateStmt.run(t, step.id);
        }
      }
    },
  },
];

// Ensure the migrations table exists before querying it
db.exec(`
  CREATE TABLE IF NOT EXISTS migrations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL UNIQUE,
    applied_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

const applied = new Set(
  db.prepare('SELECT name FROM migrations').all().map(r => r.name)
);

let ran = 0;
for (const migration of migrations) {
  if (applied.has(migration.name)) {
    console.log(`   ${migration.name} (already applied)`);
    continue;
  }

  console.log(`  Running ${migration.name}…`);
  const runMigration = db.transaction(() => {
    migration.up();
    db.prepare('INSERT INTO migrations (name) VALUES (?)').run(migration.name);
  });
  runMigration();
  console.log(`  ${migration.name} done`);
  ran++;
}

console.log(`\nMigrations complete. ${ran} new migration(s) applied.\n`);
process.exit(0);
