const auth = require('basic-auth');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { generateToken } = require('./jwt'); // JWT fonksiyonlarını içe aktar
// dotenv is loaded in the main server file (backend/src/index.js), no need to load here again.

// Authentication middleware with timing‑safe username comparison and optional bcrypt password verification.
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'] || '';

  // JWT Bearer token kontrolü
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
      return next();
    }
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Basic Auth fallback
  const credentials = auth(req);
  if (!credentials) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const validUsername = process.env.AUTH_USERNAME;
  const storedPassword = process.env.AUTH_PASSWORD_HASH || process.env.AUTH_PASSWORD;

  const usernameMatch = credentials.name.length === validUsername.length &&
    crypto.timingSafeEqual(Buffer.from(credentials.name), Buffer.from(validUsername));

  if (!usernameMatch) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (storedPassword && storedPassword.startsWith('$2')) {
    bcrypt.compare(credentials.pass, storedPassword, (err, result) => {
      if (err || !result) return res.status(401).json({ error: 'Invalid credentials' });
      return next();
    });
  } else {
    if (credentials.pass !== storedPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    return next();
  }
};


const authenticateHR = (req, res, next) => {
  const hrAuth = req.headers['x-hr-auth'];
  if (!hrAuth) {
    return res.status(401).json({ error: 'HR authentication required' });
  }
  const decoded = Buffer.from(hrAuth, 'base64').toString('utf8');
  const [username, password] = decoded.split(':');
  if (username === 'hr' && password === process.env.HR_PASSWORD) {
    return next();
  }
  return res.status(403).json({ error: 'HR access only' });
};

module.exports = { authenticate, authenticateHR };