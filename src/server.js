'use strict';

const path = require('path');
const fs   = require('fs');

require('dotenv').config();

// ── Ensure data & upload dirs exist at startup ────────────────────────────────
const DB_DIR      = path.dirname(process.env.DB_PATH      || path.resolve(__dirname, '../data/receptenboekje.db'));
const UPLOADS_DIR = process.env.UPLOADS_PATH || path.resolve(__dirname, '../uploads');

[DB_DIR, UPLOADS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ── Express app ───────────────────────────────────────────────────────────────
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');

const app = express();

// Security & logging middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://unpkg.com", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "https:", "'unsafe-inline'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: null
    }
  },
  hsts: false
}));
app.use(cors());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static uploads (images served directly)
app.use('/uploads', express.static(UPLOADS_DIR));

// Static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/recipes', require('./routes/recipes'));
app.use('/api/tags', require('./routes/tags'));
app.use('/api/ingredients', require('./routes/ingredients'));
app.use('/api/meal-plan', require('./routes/mealPlan'));

// Fallback for SPA routing: serve index.html for any other requests
app.get('*all', (req, res, next) => {
  // If it's an API request that 404ed, let it pass to 404 handler
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Niet gevonden' });
});

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Receptenboekje running on http://localhost:${PORT} (${process.env.NODE_ENV || 'development'})`);
});

module.exports = app;
