'use strict';

const crypto = require('crypto');

const JWT_SECRET = process.env.SESSION_SECRET || 'receptenboekje-secret-key-12345';

/**
 * Hash a password using pbkdf2 with a random salt.
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a stored hash.
 */
function verifyPassword(password, stored) {
  try {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const testHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === testHash;
  } catch (e) {
    return false;
  }
}

/**
 * Generate a JWT token.
 * @param {object} payload - Token payload (id, username, is_admin)
 * @param {boolean} [stayLoggedIn=false] - Whether user requested to stay logged in
 */
function generateToken(payload, stayLoggedIn = false) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  
  // 30 days if stayLoggedIn, 24 hours if session-based
  const durationInSeconds = stayLoggedIn ? (30 * 24 * 60 * 60) : (24 * 60 * 60);
  const exp = Math.floor(Date.now() / 1000) + durationInSeconds;
  const body = Buffer.from(JSON.stringify({
    ...payload,
    stay_logged_in: !!stayLoggedIn,
    exp
  })).toString('base64url');
  
  const signature = crypto.createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
    
  return `${header}.${body}.${signature}`;
}

/**
 * Parse cookies from Cookie header reliably.
 */
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx < 0) continue;
    const key = pair.substring(0, idx).trim();
    const val = pair.substring(idx + 1).trim();
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(val);
    } catch {
      cookies[key] = val;
    }
  }
  return cookies;
}

/**
 * Set authentication cookie with proper security and persistence flags.
 */
function setTokenCookie(res, req, token, stayLoggedIn = false) {
  const isHttps = req ? (req.secure || req.headers['x-forwarded-proto'] === 'https') : false;
  const options = {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: !!isHttps
  };

  if (stayLoggedIn) {
    // 30 days in milliseconds
    options.maxAge = 30 * 24 * 60 * 60 * 1000;
  }

  res.cookie('token', token, options);
}

/**
 * Clear authentication cookie.
 */
function clearTokenCookie(res, req) {
  const isHttps = req ? (req.secure || req.headers['x-forwarded-proto'] === 'https') : false;
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: !!isHttps
  });
}

/**
 * Verify a JWT token.
 */
function verifyToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [header, body, signature] = parts;
    const expectedSignature = crypto.createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');
      
    if (signature !== expectedSignature) return null;
    
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    
    return payload;
  } catch (e) {
    return null;
  }
}

/**
 * Express middleware to require authentication.
 */
function requireAuth(req, res, next) {
  let token = null;

  // 1. Try Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // 2. Try cookie if no header
  if (!token && req.headers.cookie) {
    const cookies = parseCookies(req.headers.cookie);
    token = cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Niet geautoriseerd. Log in om door te gaan.' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Sessie verlopen of ongeldig token. Log opnieuw in.' });
  }

  req.token = token;
  req.user = {
    id: payload.id,
    username: payload.username,
    is_admin: payload.is_admin ? 1 : 0,
    stay_logged_in: !!payload.stay_logged_in,
    exp: payload.exp
  };
  
  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  setTokenCookie,
  clearTokenCookie,
  parseCookies,
  requireAuth
};
