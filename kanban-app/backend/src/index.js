const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const { authenticate } = require("./auth");

const app = express();
const PORT = process.env.PORT || 4000;

//app.use(cors({ origin: "*" }));
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" })); // Sadece frontend'in çalıştığı portu izin veriyoruz
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

pool.connect()
  .then(client => { console.log("✅ PostgreSQL connected"); client.release(); })
  .catch(err => console.error("❌ PostgreSQL error:", err.message));

const query = (text, params) => pool.query(text, params);

// Health check endpoint (no authentication required)
app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

// Apply authentication middleware to all API routes
app.use('/api', authenticate);

// Import and initialize route modules
require('./tasks')(app, query);
require('./employees')(app, query);
require('./kpi')(app, query);

app.listen(PORT, () => console.log(`🚀 TEKSER API running on http://localhost:${PORT}`));