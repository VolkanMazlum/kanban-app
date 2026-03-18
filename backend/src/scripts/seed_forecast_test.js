const { Pool } = require("pg");
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

async function seed() {
  const client = await pool.connect();
  try {
    console.log("Starting forecast test seed...");

    // 1. Ensure we have a task
    const taskRes = await client.query(`
      INSERT INTO tasks (title, status, planned_start, planned_end) 
      VALUES ('Forecast Test Project', 'process', '2026-01-01', '2026-12-31')
      ON CONFLICT DO NOTHING
      RETURNING id
    `);
    const taskId = taskRes.rows[0]?.id || (await client.query("SELECT id FROM tasks LIMIT 1")).rows[0].id;

    // 2. Ensure we have a commessa
    const commRes = await client.query(`
      INSERT INTO commesse (task_id, name, comm_number)
      VALUES ($1, 'Forecast Test Commessa', '26-TEST')
      ON CONFLICT (comm_number) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [taskId]);
    const commId = commRes.rows[0].id;

    // 3. Ensure we have a client
    const cliRes = await client.query(`
      INSERT INTO clients (name) VALUES ('Test Client')
      ON CONFLICT DO NOTHING RETURNING id
    `);
    const clientId = cliRes.rows[0]?.id || (await client.query("SELECT id FROM clients LIMIT 1")).rows[0].id;

    // 4. Commessa Client
    const ccRes = await client.query(`
      INSERT INTO commessa_clients (commessa_id, client_id, n_cliente)
      VALUES ($1, $2, '00')
      RETURNING id
    `, [commId, clientId]);
    const ccId = ccRes.rows[0].id;

    // 5. Insert 3 lines with different updated_at (Registration Dates)
    console.log("Inserting test lines with custom registration dates...");
    
    // Line 1: February 2026
    await client.query(`
      INSERT INTO fatturato_lines (commessa_client_id, attivita, valore_ordine, fatturato_amount, updated_at)
      VALUES ($1, 'Activity Feb (Registered)', 10000, 5000, '2026-02-15 10:00:00')
    `, [ccId]);

    // Line 2: March 2026
    await client.query(`
      INSERT INTO fatturato_lines (commessa_client_id, attivita, valore_ordine, fatturato_amount, updated_at)
      VALUES ($1, 'Activity Mar (Registered)', 10000, 7500, '2026-03-10 14:30:00')
    `, [ccId]);

    // Line 3: April 2026
    await client.query(`
      INSERT INTO fatturato_lines (commessa_client_id, attivita, valore_ordine, fatturato_amount, updated_at)
      VALUES ($1, 'Activity Apr (Registered)', 10000, 12000, '2026-04-05 09:15:00')
    `, [ccId]);

    console.log("Seed complete! You should now see these in Feb, Mar, and Apr 2026 in the KPI dashboard.");
  } catch (err) {
    console.error("Seed failed:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
