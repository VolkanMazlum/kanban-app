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
      await query(
        'INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4)',
        [u.email, u.name, hash, u.role]
      );
      console.log(`  ✔ Seeded user: ${u.email} (${u.role})`);
    }
  }
}

module.exports = { seedUsers };
