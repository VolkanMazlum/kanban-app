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

app.use(cors({ 
  origin: process.env.FRONTEND_URL,   
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowHeaders: ["Content-Type", "Authorization", "X-HR-Auth"]
 })); 
app.set("trust proxy", 1); 
app.use(express.json({ limit: "50kb" }));
app.use(limiter);
app.use(helmet());

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

// Apply authentication middleware to all API routes
app.use('/api', authenticate);
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