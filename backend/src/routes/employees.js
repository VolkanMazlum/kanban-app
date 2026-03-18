const { employeeSchema } = require("../middleware/validation");
const { logAudit, getAuditContext } = require("../middleware/auditLog");

module.exports = (app, query, authenticate, authenticateHR) => {
  app.get("/api/employees", authenticate, async (req, res) => {
    try {
      const result = await query("SELECT * FROM employees WHERE is_active = TRUE ORDER BY name ASC");
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Database error" }); }
  });

  app.post("/api/employees", authenticateHR, async (req, res) => {
    const { name } = req.body;

    // Validate input using Zod schema
    try {
      const validatedData = employeeSchema.parse({ name, position: req.body.position, category: req.body.category });
      const { name: validatedName, position, category } = validatedData;

      try {
        const result = await query("INSERT INTO employees (name, position, category) VALUES ($1, $2, $3) RETURNING *", [validatedName, position, category]);
        const newEmp = result.rows[0];
        
        // Audit log: employee created
        const ctx = getAuditContext(req);
        logAudit(query, { ...ctx, action: 'CREATE', entityType: 'employee', entityId: newEmp.id, details: { name: newEmp.name } });
        
        res.status(201).json(newEmp);
      } catch (err) { res.status(500).json({ error: "Database error" }); }
    } catch (validationError) {
      // Handle validation errors
      if (validationError.errors) {
        const errorMessage = validationError.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
        return res.status(400).json({ error: errorMessage });
      }
      return res.status(400).json({ error: validationError.message });
    }
  });

  app.delete("/api/employees/:id", authenticateHR, async (req, res) => {
    try {
      // ON DELETE CASCADE sayesinde çalışanı silince ara tablodaki atamaları da otomatik silinecek
      await query("UPDATE employees SET is_active = FALSE WHERE id = $1", [req.params.id]);

      // Audit log: employee deactivated (logical delete)
      const ctx = getAuditContext(req);
      logAudit(query, { ...ctx, action: 'DELETE', entityType: 'employee', entityId: parseInt(req.params.id) });

      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Database error" }); }
  });
};
