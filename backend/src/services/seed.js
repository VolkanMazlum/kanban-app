const bcrypt = require('bcrypt');

/**
 * Seeds default users into the database if they don't exist yet.
 * Called once at server startup.
 */
async function seedUsers(query) {
  const defaultUsers = [
    { email: 'admin', name: 'Admin', password: 'admin123', role: 'hr' },
    { email: 'user', name: 'Standard User', password: 'user123', role: 'standard' },
  ];

  for (const u of defaultUsers) {
    const exists = await query('SELECT id FROM users WHERE email = $1', [u.email]);
    if (exists.rows.length === 0) {
      const hash = await bcrypt.hash(u.password, 10);
      const userRes = await query(
        'INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
        [u.email, u.name, hash, u.role]
      );
      console.log(`  ✔ Seeded user: ${u.email}`);
    }
  }
  
  // New: Sync ALL existing users to employees table (Self-healing) & Link employee_id
  console.log("  ⚙  Checking all users for employee sync...");
  const allUsers = await query('SELECT id, name, is_active FROM users');
  for (const user of allUsers.rows) {
    const trimmedName = user.name.trim();
    let empId;
    
    const empExists = await query('SELECT id FROM employees WHERE name = $1', [trimmedName]);
    if (empExists.rows.length === 0) {
      const newEmp = await query('INSERT INTO employees (name, is_active) VALUES ($1, $2) RETURNING id', [trimmedName, user.is_active]);
      empId = newEmp.rows[0].id;
      console.log(`  ✔ Repaired sync for user: ${trimmedName}`);
    } else {
      empId = empExists.rows[0].id;
      // Sync status even if exists
      await query('UPDATE employees SET is_active = $1 WHERE id = $2', [user.is_active, empId]);
    }
    
    // BACKFILL: Link user to employee
    await query('UPDATE users SET employee_id = $1 WHERE id = $2', [empId, user.id]);
  }
}

module.exports = { seedUsers };
