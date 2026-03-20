const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function testUserSync() {
  const client = new Client({ connectionString: process.env.DATABASE_URL_TEST });
  await client.connect();

  try {
    console.log("--- Testing User Sync ---");

    // 1. Find a user to test with
    const userRes = await client.query('SELECT u.id, u.username, u.name, u.employee_id, e.name as emp_name FROM users u JOIN employees e ON u.employee_id = e.id LIMIT 1');
    if (userRes.rows.length === 0) {
      console.log("No users found to test.");
      return;
    }

    const testUser = userRes.rows[0];
    console.log(`Original: User ID=${testUser.id}, Username=${testUser.username}, Name=${testUser.name}, Emp Name=${testUser.emp_name}`);

    // 2. Simulate the update (like the API does)
    const newName = "Test Name Sync " + Date.now();
    const newUsername = "testuser" + Date.now();

    console.log(`Updating to: Name=${newName}, Username=${newUsername}`);

    // Update User
    await client.query('UPDATE users SET name = $1, username = $2, updated_at = NOW() WHERE id = $3', [newName, newUsername, testUser.id]);

    // Sync Employee (The part we fixed)
    await client.query('UPDATE employees SET name = $1 WHERE id = $2', [newName, testUser.employee_id]);

    // 3. Verify
    const verifyRes = await client.query('SELECT u.username, u.name, e.name as emp_name FROM users u JOIN employees e ON u.employee_id = e.id WHERE u.id = $1', [testUser.id]);
    const updated = verifyRes.rows[0];

    console.log(`Result: Username=${updated.username}, Name=${updated.name}, Emp Name=${updated.emp_name}`);

    if (updated.name === newName && updated.emp_name === newName && updated.username === newUsername) {
      console.log("✅ SUCCESS: User and Employee tables are in sync.");
    } else {
      console.log("❌ FAILURE: Sync failed.");
    }

    // 4. Revert (optional, but good practice)
    await client.query('UPDATE users SET name = $1, username = $2 WHERE id = $3', [testUser.name, testUser.username, testUser.id]);
    await client.query('UPDATE employees SET name = $1 WHERE id = $2', [testUser.emp_name, testUser.employee_id]);
    console.log("Reverted changes.");

  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    await client.end();
  }
}

testUserSync();
