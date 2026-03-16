const bcrypt = require('bcrypt');
const { authenticateHR } = require('./auth');

module.exports = (app, query) => {
  // GET /api/users — List all users (HR only)
  app.get('/api/users', authenticateHR, async (req, res) => {
    try {
      const result = await query(
        'SELECT id, email, name, role, is_active, created_at FROM users ORDER BY created_at ASC'
      );
      res.json(result.rows);
    } catch (err) {
      console.error('GET /users error:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // POST /api/users — Create a new user (HR only)
  app.post('/api/users', authenticateHR, async (req, res) => {
    const { email, name, password, role } = req.body;

    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Email, name, and password are required' });
    }

    const validRoles = ['standard', 'hr'];
    const userRole = validRoles.includes(role) ? role : 'standard';

    try {
      // Check if email already exists
      const exists = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (exists.rows.length > 0) {
        return res.status(409).json({ error: 'A user with this email already exists' });
      }

      const hash = await bcrypt.hash(password, 10);
      
      // Use a transaction if possible, but for now simple sequential
      const result = await query(
        'INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role, is_active, created_at',
        [email, name, hash, userRole]
      );

      const trimmedName = name.trim();
      // Sync with employees table: Check if exists first (safer than ON CONFLICT if UNIQUE constraint is missing)
      const empExists = await query('SELECT id FROM employees WHERE name = $1', [trimmedName]);
      if (empExists.rows.length > 0) {
        await query('UPDATE employees SET is_active = TRUE WHERE name = $1', [trimmedName]);
      } else {
        await query('INSERT INTO employees (name, is_active) VALUES ($1, TRUE)', [trimmedName]);
      }

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('POST /users error:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // PATCH /api/users/:id — Update user (HR only)
  app.patch('/api/users/:id', authenticateHR, async (req, res) => {
    const { id } = req.params;
    const { name, role, is_active, password } = req.body;

    try {
      const updates = [];
      const values = [];
      let paramIdx = 1;

      if (name !== undefined) { updates.push(`name = $${paramIdx++}`); values.push(name); }
      if (role !== undefined && ['standard', 'hr'].includes(role)) { updates.push(`role = $${paramIdx++}`); values.push(role); }
      if (is_active !== undefined) { updates.push(`is_active = $${paramIdx++}`); values.push(is_active); }
      if (password) {
        const hash = await bcrypt.hash(password, 10);
        updates.push(`password_hash = $${paramIdx++}`);
        values.push(hash);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      updates.push(`updated_at = NOW()`);
      values.push(id);

      const result = await query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING id, email, name, role, is_active`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Sync is_active status with employees table if it was updated
      if (is_active !== undefined) {
        const userName = result.rows[0].name;
        await query('UPDATE employees SET is_active = $1 WHERE name = $2', [is_active, userName]);
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error('PATCH /users error:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // GET /api/audit-logs — Recent audit logs (HR only)
  app.get('/api/audit-logs', authenticateHR, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 100, 500);
      const result = await query(
        'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1',
        [limit]
      );
      res.json(result.rows);
    } catch (err) {
      console.error('GET /audit-logs error:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });
};
