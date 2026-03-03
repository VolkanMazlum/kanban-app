const auth = require('basic-auth');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
// dotenv is loaded in the main server file (backend/src/index.js), no need to load here again.

// Authentication middleware with timing‑safe username comparison and optional bcrypt password verification.
const authenticate = (req, res, next) => {
  const credentials = auth(req);
  if (!credentials) {
    res.set('WWW-Authenticate', 'Basic realm="Tekser Kanban"');
    return res.status(401).json({ error: 'Authentication required' });
  }

  const validUsername = process.env.AUTH_USERNAME;
  const storedPassword = process.env.AUTH_PASSWORD_HASH || process.env.AUTH_PASSWORD; // Prefer bcrypt hash, fallback to plaintext (not recommended)

  // Timing‑safe username comparison
  const usernameMatch = crypto.timingSafeEqual(
    Buffer.from(credentials.name || ''),
    Buffer.from(validUsername || '')
  );
  if (!usernameMatch) {
    res.set('WWW-Authenticate', 'Basic realm="Tekser Kanban"');
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // If stored password looks like a bcrypt hash, verify using bcrypt.
  if (storedPassword && storedPassword.startsWith('$2')) {
    bcrypt.compare(credentials.pass, storedPassword, (err, result) => {
      if (err || !result) {
        console.warn('[SECURITY WARNING] Bcrypt password verification failed.');
        res.set('WWW-Authenticate', 'Basic realm="Tekser Kanban"');
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      return next();
    });
  } else {
    // Plaintext fallback – log a warning.
    if (credentials.pass !== storedPassword) {
      console.warn('[SECURITY WARNING] Plaintext password authentication in use. Consider storing a bcrypt hash in AUTH_PASSWORD_HASH.');
      res.set('WWW-Authenticate', 'Basic realm="Tekser Kanban"');
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    // Password matches (or none set), proceed.
    return next();
  }
};

module.exports = { authenticate };