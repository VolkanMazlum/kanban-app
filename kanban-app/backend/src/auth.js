const auth = require('basic-auth');
require('dotenv').config();

// Simple authentication middleware
const authenticate = (req, res, next) => {
  // Get credentials from the request
  const credentials = auth(req);
  
  // Check if credentials are provided
  if (!credentials) {
    res.set('WWW-Authenticate', 'Basic realm="Tekser Kanban"');
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  
  // Use environment variables for credentials
  const validUsername = process.env.AUTH_USERNAME || 'admin';
  const validPassword = process.env.AUTH_PASSWORD || 'password';
  
  // Check if credentials are valid
  if (credentials.name === validUsername && credentials.pass === validPassword) {
    // Authentication successful
    next();
  } else {
    // Authentication failed
    res.set('WWW-Authenticate', 'Basic realm="Tekser Kanban"');
    res.status(401).json({ error: 'Invalid credentials' });
  }
};

module.exports = { authenticate };