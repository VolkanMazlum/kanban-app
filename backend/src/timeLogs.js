const { z } = require('zod');

// Validation schema for time log creation
const timeLogSchema = z.object({
  task_id: z.number().int().positive("Task ID is required"),
  employee_id: z.number().int().positive("Employee ID is required"),
  started_at: z.string().datetime().optional(),
  ended_at: z.string().datetime().nullable().optional(),
  note: z.string().optional()
});

module.exports = (app, query) => {
  // Get all time logs
  app.get("/api/time-logs", async (req, res) => {
    try {
      const sql = `
        SELECT ttl.*, t.title as task_title, e.name as employee_name
        FROM task_time_logs ttl
        JOIN tasks t ON ttl.task_id = t.id
        JOIN employees e ON ttl.employee_id = e.id
        ORDER BY ttl.started_at DESC
      `;
      const result = await query(sql);
      res.json(result.rows);
    } catch (err) { 
      console.error("GET /time-logs Error:", err);
      res.status(500).json({ error: "Database error" }); 
    }
  });

  // Get time logs for a specific task
  app.get("/api/tasks/:taskId/time-logs", async (req, res) => {
    try {
      const sql = `
        SELECT ttl.*, e.name as employee_name
        FROM task_time_logs ttl
        JOIN employees e ON ttl.employee_id = e.id
        WHERE ttl.task_id = $1
        ORDER BY ttl.started_at DESC
      `;
      const result = await query(sql, [req.params.taskId]);
      res.json(result.rows);
    } catch (err) { 
      console.error("GET /tasks/:taskId/time-logs Error:", err);
      res.status(500).json({ error: "Database error" }); 
    }
  });

  // Get time logs for a specific employee
  app.get("/api/employees/:employeeId/time-logs", async (req, res) => {
    try {
      const sql = `
        SELECT ttl.*, t.title as task_title
        FROM task_time_logs ttl
        JOIN tasks t ON ttl.task_id = t.id
        WHERE ttl.employee_id = $1
        ORDER BY ttl.started_at DESC
      `;
      const result = await query(sql, [req.params.employeeId]);
      res.json(result.rows);
    } catch (err) { 
      console.error("GET /employees/:employeeId/time-logs Error:", err);
      res.status(500).json({ error: "Database error" }); 
    }
  });

  // Start a new time log (started_at will be set to now)
  app.post("/api/time-logs/start", async (req, res) => {
    const { task_id, employee_id, note } = req.body;
    
    // Validate input
    try {
      const validatedData = timeLogSchema.parse({
        task_id,
        employee_id,
        note,
        started_at: new Date().toISOString()
      });
      
      const { task_id: taskId, employee_id: empId, note: noteText, started_at: startedAt } = validatedData;
      
      try {
        const result = await query(
          "INSERT INTO task_time_logs (task_id, employee_id, started_at, note) VALUES ($1,$2,$3,$4) RETURNING *",
          [taskId, empId, startedAt, noteText || ""]
        );
        res.status(201).json(result.rows[0]);
      } catch (err) { 
        console.error("POST /time-logs/start Error:", err);
        res.status(500).json({ error: "Database error" }); 
      }
    } catch (validationError) {
      // Handle validation errors
      if (validationError.errors) {
        const errorMessage = validationError.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
        return res.status(400).json({ error: errorMessage });
      }
      return res.status(400).json({ error: validationError.message });
    }
  });

  // Stop a time log (set ended_at to now)
  app.patch("/api/time-logs/:id/stop", async (req, res) => {
    try {
      const result = await query(
        "UPDATE task_time_logs SET ended_at=NOW() WHERE id=$1 AND ended_at IS NULL RETURNING *",
        [req.params.id]
      );
      if (!result.rows.length) return res.status(404).json({ error: "Active time log not found" });
      res.json(result.rows[0]);
    } catch (err) { 
      console.error("PATCH /time-logs/:id/stop Error:", err);
      res.status(500).json({ error: "Database error" }); 
    }
  });

  // Create a complete time log (with both started_at and ended_at)
  app.post("/api/time-logs", async (req, res) => {
    const { task_id, employee_id, started_at, ended_at, note } = req.body;
    
    // Validate input
    try {
      const validatedData = timeLogSchema.parse({
        task_id,
        employee_id,
        started_at,
        ended_at,
        note
      });
      
      const { task_id: taskId, employee_id: empId, started_at: startedAt, ended_at: endedAt, note: noteText } = validatedData;
      
      try {
        const result = await query(
          "INSERT INTO task_time_logs (task_id, employee_id, started_at, ended_at, note) VALUES ($1,$2,$3,$4,$5) RETURNING *",
          [taskId, empId, startedAt, endedAt, noteText || ""]
        );
        res.status(201).json(result.rows[0]);
      } catch (err) { 
        console.error("POST /time-logs Error:", err);
        res.status(500).json({ error: "Database error" }); 
      }
    } catch (validationError) {
      // Handle validation errors
      if (validationError.errors) {
        const errorMessage = validationError.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
        return res.status(400).json({ error: errorMessage });
      }
      return res.status(400).json({ error: validationError.message });
    }
  });

  // Update a time log
  app.put("/api/time-logs/:id", async (req, res) => {
    const { task_id, employee_id, started_at, ended_at, note } = req.body;
    
    // Validate input
    try {
      const validatedData = timeLogSchema.partial().parse({
        task_id,
        employee_id,
        started_at,
        ended_at,
        note
      });
      
      const { task_id: taskId, employee_id: empId, started_at: startedAt, ended_at: endedAt, note: noteText } = validatedData;
      
      try {
        // Build dynamic update query
        let sql = "UPDATE task_time_logs SET ";
        const params = [];
        let paramIndex = 1;
        
        if (taskId !== undefined) {
          sql += `task_id=$${paramIndex}, `;
          params.push(taskId);
          paramIndex++;
        }
        
        if (empId !== undefined) {
          sql += `employee_id=$${paramIndex}, `;
          params.push(empId);
          paramIndex++;
        }
        
        if (startedAt !== undefined) {
          sql += `started_at=$${paramIndex}, `;
          params.push(startedAt);
          paramIndex++;
        }
        
        if (endedAt !== undefined) {
          sql += `ended_at=$${paramIndex}, `;
          params.push(endedAt);
          paramIndex++;
        }
        
        if (noteText !== undefined) {
          sql += `note=$${paramIndex}, `;
          params.push(noteText);
          paramIndex++;
        }
        
        // Remove trailing comma and space
        sql = sql.slice(0, -2);
        sql += ` WHERE id=$${paramIndex} RETURNING *`;
        params.push(req.params.id);
        
        const result = await query(sql, params);
        if (!result.rows.length) return res.status(404).json({ error: "Time log not found" });
        res.json(result.rows[0]);
      } catch (err) { 
        console.error("PUT /time-logs/:id Error:", err);
        res.status(500).json({ error: "Database error" }); 
      }
    } catch (validationError) {
      // Handle validation errors
      if (validationError.errors) {
        const errorMessage = validationError.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
        return res.status(400).json({ error: errorMessage });
      }
      return res.status(400).json({ error: validationError.message });
    }
  });

  // Delete a time log
  app.delete("/api/time-logs/:id", async (req, res) => {
    try {
      const result = await query("DELETE FROM task_time_logs WHERE id=$1 RETURNING id", [req.params.id]);
      if (!result.rows.length) return res.status(404).json({ error: "Time log not found" });
      res.json({ success: true, id: result.rows[0].id });
    } catch (err) { 
      console.error("DELETE /time-logs/:id Error:", err);
      res.status(500).json({ error: "Database error" }); 
    }
  });
};