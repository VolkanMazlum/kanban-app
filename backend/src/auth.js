const { verifyToken } = require('./jwt');
// dotenv is loaded in the main server file (backend/src/index.js), no need to load here again.

// Standard authentication middleware using JWT Bearer tokens
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'] || '';

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Bearer token missing.' });
  }

  const token = authHeader.replace('Bearer ', '');
  const decoded = verifyToken(token);
  
  if (decoded) {
    req.user = decoded; // { username, role }
    return next();
  }
  
  return res.status(401).json({ error: 'Invalid or expired token' });
};

// HR specific authentication middleware verifying the JWT role
const authenticateHR = (req, res, next) => {
  const authHeader = req.headers['authorization'] || '';

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'HR authentication required' });
  }

  const token = authHeader.replace('Bearer ', '');
  const decoded = verifyToken(token);

  if (decoded && decoded.role === 'hr') {
    req.user = decoded;
    return next();
  }

  return res.status(403).json({ error: 'HR access only' });
};

module.exports = { authenticate, authenticateHR };