const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
require('dotenv').config();

// 1. Config & Bootstrap
const { query, pool } = require("./config/db");
const { seedUsers } = require("./services/seed");
const { authenticate, authenticateHR } = require("./middleware/auth");
const reportRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 4000;

// 2. Middlewares
const REQUIRED_ENV = ["JWT_SECRET", "INTERNAL_SECRET", "FRONTEND_URL"];
const missingEnv = REQUIRED_ENV.filter(k => !process.env[k]);
if (missingEnv.length > 0) {
  console.error(`FATAL: Missing required environment variables: ${missingEnv.join(", ")}`);
  process.exit(1);
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, //450,
  message: { error: "Too many requests, please try again later." }
});

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "X-HR-Auth"]
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());
app.use(limiter);

// Auth Limiter for Login
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts, please try again later." }
});

// Internal Secret Guard (Hardened)
app.use('/api', (req, res, next) => {
  const secret = process.env.INTERNAL_SECRET;
  const header = req.headers['x-internal-auth'];

  if (!secret || header !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// 3. Routes & Logic
// Seed default users on startup
if (process.env.NODE_ENV !== 'test') {
  seedUsers(query)
    .then(() => console.log(" User seeding complete"))
    .catch(err => console.error(" Seed error:", err.message));
}

app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

// Route Modules
app.post('/api/login', authLimiter, require('./routes/login').login(query));

require('./routes/tasks')(app, query, pool, authenticate);
require('./routes/employees')(app, query, authenticate, authenticateHR);
require('./routes/kpi')(app, query, authenticate);
require('./routes/timeLogs')(app, query, authenticate);
require('./routes/phases')(app, query, pool, authenticate);
require("./routes/settings")(app, query, authenticate);
require("./routes/costs")(app, query, authenticate, authenticateHR);
require("./routes/fatturato")(app, query, pool, authenticate, authenticateHR);
require("./routes/users")(app, query, authenticateHR);
require("./routes/offerte")(app, query, pool, authenticate, authenticateHR);
require("./routes/ai")(app, query, authenticate, authenticateHR);

// Reports
app.use('/api/reports', authenticate, reportRoutes);

app.post('/api/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'None'
  });
  res.json({ success: true });
});

app.get("/", (req, res) => res.send("Welcome to the TEKSER API!"));

if (require.main === module && process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(` TEKSER API running on http://localhost:${PORT}`));
}

module.exports = app;