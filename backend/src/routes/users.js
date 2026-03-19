const bcrypt = require('bcrypt');
const { authenticateHR } = require('../middleware/auth');
const { logAudit, getAuditContext } = require('../middleware/auditLog');

module.exports = (app, query) => {
  // GET /api/users — List all users (HR only)
  app.get('/api/users', authenticateHR, async (req, res) => {
    try {
      const result = await query(`
        SELECT 
          e.id AS id, 
          u.id AS user_id, 
          u.username, 
          e.name, 
          u.role, 
          e.is_active, 
          e.created_at, 
          e.position, 
          e.category,
          e.hr_details
        FROM employees e
        LEFT JOIN users u ON e.id = u.employee_id
        ORDER BY e.name ASC
      `);
      res.json(result.rows);
    } catch (err) {
      console.error('GET /users error:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // POST /api/users — Create a new user (HR only)
  app.post('/api/users', authenticateHR, async (req, res) => {
    const { username, name, password, role, position, category, hr_details } = req.body;

    if (!username || !name || !password) {
      return res.status(400).json({ error: 'Username, name, and password are required' });
    }

    const validRoles = ['standard', 'hr'];
    const userRole = validRoles.includes(role) ? role : 'standard';

    try {
      // Check if username already exists
      const exists = await query('SELECT id FROM users WHERE username = $1', [username]);
      if (exists.rows.length > 0) {
        return res.status(409).json({ error: 'A user with this username already exists' });
      }

      const trimmedName = name.trim();
      let empId;

      // Sync with employees table
      const empExists = await query('SELECT id FROM employees WHERE name = $1', [trimmedName]);
      if (empExists.rows.length > 0) {
        empId = empExists.rows[0].id;
        await query('UPDATE employees SET is_active = TRUE, position = COALESCE($2, position), category = COALESCE($3, category), hr_details = COALESCE($4, hr_details) WHERE id = $1', [empId, position || null, category || null, hr_details || null]);
      } else {
        const newEmp = await query('INSERT INTO employees (name, is_active, position, category, hr_details) VALUES ($1, TRUE, $2, $3, $4) RETURNING id', [trimmedName, position || '', category || 'internal', hr_details || '{}']);
        empId = newEmp.rows[0].id;
      }

      const hash = await bcrypt.hash(password, 10);
      const result = await query(
        'INSERT INTO users (username, name, password_hash, role, employee_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, name, role, is_active, employee_id, created_at',
        [username, name, hash, userRole, empId]
      );

      const newUser = result.rows[0];
      
      // Audit log: user created
      const ctx = getAuditContext(req);
      logAudit(query, { ...ctx, action: 'CREATE', entityType: 'user', entityId: newUser.id, details: { username: newUser.username, role: newUser.role } });

      res.status(201).json(newUser);
    } catch (err) {
      console.error('POST /users error:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // PATCH /api/users/:id — Update user (HR only)
  app.patch('/api/users/:id', authenticateHR, async (req, res) => {
    const { id } = req.params;
    const { name, role, is_active, password, position, category, hr_details } = req.body;

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

      if (updates.length === 0 && position === undefined && category === undefined && hr_details === undefined) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      updates.push(`updated_at = NOW()`);
      values.push(id);

      const result = await query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING id, username, name, role, is_active, employee_id`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Sync is_active status and position with employees table if they were updated
      const empId = result.rows[0].employee_id;
      if ((is_active !== undefined || position !== undefined || category !== undefined || hr_details !== undefined) && empId) {
        const empUpdates = [];
        const empValues = [];
        let eIdx = 1;
        if (is_active !== undefined) { empUpdates.push(`is_active = $${eIdx++}`); empValues.push(is_active); }
        if (position !== undefined) { empUpdates.push(`position = $${eIdx++}`); empValues.push(position); }
        if (category !== undefined) { empUpdates.push(`category = $${eIdx++}`); empValues.push(category); }
        if (hr_details !== undefined) { empUpdates.push(`hr_details = $${eIdx++}`); empValues.push(hr_details); }
        if (empUpdates.length > 0) {
          empValues.push(empId);
          await query(`UPDATE employees SET ${empUpdates.join(', ')} WHERE id = $${eIdx}`, empValues);
        }
      }

      const updatedUser = result.rows[0];

      // Audit log: user updated
      const ctx = getAuditContext(req);
      logAudit(query, { ...ctx, action: 'UPDATE', entityType: 'user', entityId: updatedUser.id, details: { username: updatedUser.username, role: updatedUser.role, is_active: updatedUser.is_active } });

      res.json(updatedUser);
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
