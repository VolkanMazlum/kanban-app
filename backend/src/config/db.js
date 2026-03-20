const { Pool } = require("pg");
require('dotenv').config();

const connectionString = process.env.NODE_ENV === 'test' 
  ? process.env.DATABASE_URL_TEST 
  : process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
  } : false,
});

pool.connect()
  .then(client => { console.log(" PostgreSQL connected"); client.release(); })
  .catch(err => console.error(" PostgreSQL error:", err.message));

const query = (text, params) => pool.query(text, params);

module.exports = {
  pool,
  query
};
