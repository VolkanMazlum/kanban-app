const { Pool } = require("pg");
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

pool.connect()
  .then(client => { console.log(" PostgreSQL connected"); client.release(); })
  .catch(err => console.error(" PostgreSQL error:", err.message));

const query = (text, params) => pool.query(text, params);

module.exports = {
  pool,
  query
};
