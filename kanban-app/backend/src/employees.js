const { employeeSchema } = require("./validation");

module.exports = (app, query) => {
  app.get("/api/employees", async (req, res) => {
    try {
      const result = await query("SELECT * FROM employees ORDER BY name ASC");
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Database error" }); }
  });

  app.post("/api/employees", async (req, res) => {
    const { name } = req.body;
    
    // Validate input using Zod schema
    try {
      const validatedData = employeeSchema.parse({ name });
      const validatedName = validatedData.name;
      
      try {
        const result = await query("INSERT INTO employees (name) VALUES ($1) RETURNING *", [validatedName]);
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

  app.delete("/api/employees/:id", async (req, res) => {
    try {
      // ON DELETE CASCADE sayesinde çalışanı silince ara tablodaki atamaları da otomatik silinecek
      await query("DELETE FROM employees WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Database error" }); }
  });
};
