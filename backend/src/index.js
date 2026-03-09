const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const {  authenticate, authenticateHR  } = require("./auth");
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 4000;
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");


const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150, 
  message: { error: "Too many requests, please try again later." }
});
app.set("trust proxy", true); 
app.use(helmet());
app.use(cors({ 
  origin: process.env.FRONTEND_URL,   
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "X-HR-Auth"]
}));

app.use(express.json({ limit: "50kb" }));
app.use(limiter);


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});



pool.connect()
  .then(client => { console.log(" PostgreSQL connected"); client.release(); })
  .catch(err => console.error(" PostgreSQL error:", err.message));

const query = (text, params) => pool.query(text, params);

// Health check endpoint (no authentication required)
app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

// Login endpoint (no authentication required)
app.post("/api/login", require('./login').login);

// Apply authentication middleware to all API routes
app.use('/api', (req, res, next) => {
  // Önce JWT kontrolü
  const token = req.headers['authorization']&& req.headers['authorization'].startsWith('Bearer ')
    ? req.headers['authorization'].substring(7)
    : null;
  
  if (token) {
  const decoded = require('./jwt').verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  req.user = decoded;
  return next();
 }
  
  // JWT yoksa eski authenticate middleware'e geç
  authenticate(req, res, next);
});
//app.use('/api/kpi', authenticateHR);

// Import and initialize route modules
require('./tasks')(app, query);
require('./employees')(app, query);
require('./kpi')(app, query);
require('./timeLogs')(app, query);
require('./phases')(app, query);
require("./settings")(app, query);
require("./costs")(app,query,authenticateHR);

app.listen(PORT, () => console.log(` TEKSER API running on http://localhost:${PORT}`));
app.get("/", (req, res) => res.send("Welcome to the TEKSER API!"));