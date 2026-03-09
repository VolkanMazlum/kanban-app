const { verifyToken } = require('./jwt');

const jwtMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.replace('Bearer ', '');
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  req.user = decoded;
  next();
};

module.exports = { jwtMiddleware };