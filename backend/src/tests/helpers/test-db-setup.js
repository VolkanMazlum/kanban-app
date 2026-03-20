const { query, pool } = require('../../config/db');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

/**
 * AUTOMATED TEST DB SETUP
 * 1. Ensures kanbandb_test exists
 * 2. Initializes schema if needed
 * 3. Truncates and seeds for every test suite
 */

async function ensureTestDbExists() {
  if (process.env.NODE_ENV !== 'test') return;

  const adminConfig = {
    connectionString: process.env.DATABASE_URL_TEST.replace('/kanbandb_test', '/postgres')
  };
  
  const client = new Client(adminConfig);
  try {
    await client.connect();
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname = 'kanbandb_test'");
    if (res.rowCount === 0) {
      console.log(" [SETUP] Creating kanbandb_test...");
      await client.query("CREATE DATABASE kanbandb_test");
    }
  } catch (err) {
    console.error(" [SETUP] Error checking/creating DB:", err.message);
  } finally {
    await client.end();
  }

  // Now check if tables exist
  await checkAndInitSchema();
}

async function checkAndInitSchema() {
  const testClient = new Client({ connectionString: process.env.DATABASE_URL_TEST });
  try {
    await testClient.connect();
    const tableRes = await testClient.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'users'");
    if (tableRes.rowCount === 0) {
      console.log(" [SETUP] Schema missing in kanbandb_test. Initializing...");
      const initSqlPath = path.join(__dirname, '../../../db/init.sql');
      const initSql = fs.readFileSync(initSqlPath, 'utf8');
      await testClient.query(initSql);
      console.log(" [SETUP] Schema initialized.");
    }
  } catch (err) {
    console.error(" [SETUP] Schema check/init failed:", err.message);
  } finally {
    await testClient.end();
  }
}

async function truncateTables() {
  const tables = [
    'audit_logs', 'fatturato_realized', 'fatturato_ordini', 'fatturato_lines', 
    'commessa_clients', 'commesse', 'employee_work_hours', 
    'employee_costs', 'task_phases', 'task_assignees', 'tasks', 'employees', 'clients', 'users', 'settings'
  ];
  await query("BEGIN");
  try {
    for (const table of tables) {
      await query(`TRUNCATE TABLE ${table} CASCADE`);
      // Reset sequence
      try {
        await query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), 1, false)`);
      } catch (e) {
        // Some tables might not have 'id' or a sequence, ignore
      }
    }
    await query("COMMIT");
    console.log(" [INFO] Test database truncated and sequences reset.");
  } catch (err) {
    await query("ROLLBACK");
    throw err;
  }
}

async function seedBaseData() {
  try {
    // 1. Seed Employee first
    const empRes = await query(`
      INSERT INTO employees (name, category, is_active)
      VALUES ('Admin', 'internal', true)
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `);
    const adminEmpId = empRes.rows[0].id;

    // 2. Seed User linked to Employee
    await query(`
      INSERT INTO users (username, name, password_hash, role, employee_id)
      VALUES ('admin@example.com', 'Admin', '$2b$10$YourMakedHashHere...', 'hr', $1)
      ON CONFLICT (username) DO NOTHING
    `, [adminEmpId]);

    // 3. Seed a Client
    await query(`
      INSERT INTO clients (name, vat_number)
      VALUES ('Default Test Client', 'IT12345678901')
      ON CONFLICT DO NOTHING
    `);

    console.log(" [INFO] Base data seeded.");
  } catch (err) {
    console.error(" Seeding error:", err.message);
  }
}

async function resetTestDb() {
  await ensureTestDbExists();
  await truncateTables();
  await seedBaseData();
  
  // Reset sequences
  const tables = ['users', 'clients', 'employees', 'tasks', 'commesse', 'fatturato_lines'];
  for (const table of tables) {
     try {
       await query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), 1, false)`);
     } catch(e) {}
  }
}

module.exports = {
  resetTestDb,
  truncateTables,
  seedBaseData,
  ensureTestDbExists,
  query,
  pool
};
