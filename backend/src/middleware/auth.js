const { verifyToken } = require('./jwt');

// Standard authentication middleware using JWT Bearer tokens
const authenticate = (req, res, next) => {
  let token = "";
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.replace('Bearer ', '');
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  // NOTE: req.query.token intentionally removed — tokens in URLs appear in
  // server logs, browser history, and Referer headers (security risk).
 
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Token missing.' });
  }
  const decoded = verifyToken(token);
  
  if (decoded) {
    req.user = decoded; // { userId, email, name, role }
    return next();
  }
  
  return res.status(401).json({ error: 'Invalid or expired token' });
};
 
// HR specific authentication middleware verifying the JWT role
const authenticateHR = (req, res, next) => {
  let token = "";
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.replace('Bearer ', '');
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  // NOTE: req.query.token intentionally removed — see authenticate above.
 
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Token missing.' });
  }
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
