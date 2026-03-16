const { verifyToken } = require('./jwt');

// Standard authentication middleware using JWT Bearer tokens
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'] || '';

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Bearer token missing.' });
  }

  const token = authHeader.replace('Bearer ', '');
  const decoded = verifyToken(token);
  
  if (decoded) {
    req.user = decoded; // { userId, email, name, role }
    return next();
  }
  
  return res.status(401).json({ error: 'Invalid or expired token' });
};

// HR specific authentication middleware verifying the JWT role
const authenticateHR = (req, res, next) => {
  const authHeader = req.headers['authorization'] || '';

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Bearer token missing.' });
  }

  const token = authHeader.replace('Bearer ', '');
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  if (decoded.role === 'hr') {
    req.user = decoded;
    return next();
  }

  return res.status(403).json({ error: 'HR access only' });
};

module.exports = { authenticate, authenticateHR };
