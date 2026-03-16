const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const { authenticate, authenticateHR } = require("./auth");
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 4000;
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

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
app.post('/api/login', authLimiter, require('./login').login);

require('./tasks')(app, query);
require('./employees')(app, query);
require('./kpi')(app, query);
require('./timeLogs')(app, query);
require('./phases')(app, query);
require("./settings")(app, query);
require("./costs")(app, query, authenticateHR);
require("./fatturato")(app, query, authenticateHR);

app.get("/", (req, res) => res.send("Welcome to the TEKSER API!"));

app.listen(PORT, () => console.log(` TEKSER API running on http://localhost:${PORT}`));