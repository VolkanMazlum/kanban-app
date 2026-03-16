const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const { authenticate, authenticateHR } = require("./auth");
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 4000;
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const { seedUsers } = require("./seed");

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 450,
  message: { error: "Too many requests, please try again later." }
});

// true yerine 1 — sadece bir hop ötedeki proxy'ye (nginx) güven
app.set("trust proxy", 1);

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

// Seed default users on startup
seedUsers(query).then(() => console.log(" User seeding complete")).catch(err => console.error(" Seed error:", err.message));

// Health check endpoint (no authentication required)
app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

// Apply X-Internal-Auth check to all API routes
app.use('/api', (req, res, next) => {
  if (req.headers['x-internal-auth'] !== process.env.INTERNAL_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// Import and configure rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per `window`
  message: { error: "Too many login attempts, please try again later." }
});

// Import and initialize route modules
// login.js now exports a factory function that takes `query`
app.post('/api/login', authLimiter, require('./login').login(query));

require('./tasks')(app, query, authenticate);
require('./employees')(app, query, authenticate);
require('./kpi')(app, query, authenticate);
require('./timeLogs')(app, query, authenticate);
require('./phases')(app, query, authenticate);
require("./settings")(app, query, authenticate);
require("./costs")(app, query, authenticate, authenticateHR);
require("./fatturato")(app, query, authenticate, authenticateHR);
require("./users")(app, query, authenticateHR);

app.get("/", (req, res) => res.send("Welcome to the TEKSER API!"));

app.listen(PORT, () => console.log(` TEKSER API running on http://localhost:${PORT}`));