const { employeeSchema } = require("../middleware/validation");

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
      const validatedData = employeeSchema.parse({ name, position: req.body.position });
      const { name: validatedName, position } = validatedData;
      
      try {
        const result = await query("INSERT INTO employees (name, position) VALUES ($1, $2) RETURNING *", [validatedName, position]);
        res.status(201).json(result.rows[0]);
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
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Database error" }); }
  });
};
