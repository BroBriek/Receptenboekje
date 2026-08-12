'use strict';

/**
 * database.js
 * Opens (or creates) the SQLite database and exports the singleton connection.
 * Uses better-sqlite3 for synchronous, high-performance access.
 */

const path    = require('path');
const fs      = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH 
  ? path.resolve(process.env.DB_PATH) 
  : path.resolve(__dirname, '../../data/receptenboekje.db');

// Ensure the directory exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(DB_PATH, {
  // verbose: console.log   // Uncomment to log every SQL statement during development
});

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
// Enforce foreign-key constraints
db.pragma('foreign_keys = ON');

console.log(`SQLite database connected: ${DB_PATH}`);

module.exports = db;
