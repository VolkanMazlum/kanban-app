const { taskSchema, taskUpdateSchema } = require("./validation");
const { z } = require("zod");

module.exports = (app, query) => {
  // ── Tasks ──────────────────────────────────────────────────────
  app.get("/api/tasks", async (req, res) => {
    try {
      const { assignee_id, status } = req.query;
      
      // YENİ MANTIK: tasks -> task_assignees -> employees şeklinde JOIN yapıyoruz
      let sql = `
        SELECT t.id, t.title, t.description, t.topic, t.deadline, t.status, t.position, t.created_at, t.updated_at,
               COALESCE(
                 json_agg(json_build_object('id', e.id, 'name', e.name)) FILTER (WHERE e.id IS NOT NULL),
                 '[]'
               ) AS assignees
        FROM tasks t
        LEFT JOIN task_assignees ta ON t.id = ta.task_id
        LEFT JOIN employees e ON ta.employee_id = e.id
        WHERE 1=1
      `;
      const params = [];
      
      if (assignee_id) { 
        params.push(assignee_id); 
        // Sadece belirli bir çalışanın görevlerini getirmek için EXISTS alt sorgusu
        sql += ` AND EXISTS (SELECT 1 FROM task_assignees sub_ta WHERE sub_ta.task_id = t.id AND sub_ta.employee_id = $${params.length})`; 
      }
      
      if (status) { 
        params.push(status); 
        sql += ` AND t.status = $${params.length}`; 
      }
      
      sql += " GROUP BY t.id ORDER BY t.status, t.position ASC, t.created_at ASC";
      const result = await query(sql, params);
      res.json(result.rows);
    } catch (err) { 
      console.error("GET /tasks Error:", err);
      res.status(500).json({ error: "Database error" }); 
    }
  });

  app.get("/api/tasks/:id", async (req, res) => {
    try {
      const sql = `
        SELECT t.*, 
               COALESCE(
                 json_agg(json_build_object('id', e.id, 'name', e.name)) FILTER (WHERE e.id IS NOT NULL),
                 '[]'
               ) AS assignees
        FROM tasks t 
        LEFT JOIN task_assignees ta ON t.id = ta.task_id
        LEFT JOIN employees e ON ta.employee_id = e.id
        WHERE t.id = $1
        GROUP BY t.id
      `;
      const result = await query(sql, [req.params.id]);
      if (!result.rows.length) return res.status(404).json({ error: "Task not found" });
      res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: "Database error" }); }
  });

  app.post("/api/tasks", async (req, res) => {
    const { title, description, topic, assignee_ids, deadline, status, position } = req.body;
    
    // Validate input using Zod schema
    try {
      const validatedData = taskSchema.parse({
        title,
        description,
        topic,
        deadline,
        status,
        position,
        assignee_ids
      });
      
      // Use validated data
      const {
        title: validatedTitle,
        description: validatedDescription,
        topic: validatedTopic,
        deadline: validatedDeadline,
        status: validatedStatus,
        position: validatedPosition,
        assignee_ids: validatedAssigneeIds
      } = validatedData;
    
      try {
        // TRANSACTION BAŞLANGICI: Ya hepsi kaydedilir, ya da hiçbiri (Hata durumunda)
        await query("BEGIN");
        
        // 1. Görevi oluştur (artık assignee_ids veritabanı sütununda yok)
        const taskResult = await query(
          "INSERT INTO tasks (title, description, topic, deadline, status, position) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
          [validatedTitle, validatedDescription || "", validatedTopic || null, validatedDeadline || null, validatedStatus, validatedPosition]
        );
        const newTask = taskResult.rows[0];
        newTask.assignees = [];
        
        // 2. Kişileri ara tabloya (task_assignees) kaydet
        if (validatedAssigneeIds && validatedAssigneeIds.length > 0) {
          await query(
            "INSERT INTO task_assignees (task_id, employee_id) SELECT $1, unnest($2::int[])",
            [newTask.id, validatedAssigneeIds]
          );
          const emps = await query(
            "SELECT id, name FROM employees WHERE id = ANY($1)",
            [validatedAssigneeIds]
          );
          newTask.assignees = emps.rows;
        }
        
        await query("COMMIT");
        res.status(201).json(newTask);
      } catch (err) {
        await query("ROLLBACK");
        console.error("POST /tasks Error:", err);
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

  app.put("/api/tasks/:id", async (req, res) => {
    const { id } = req.params;
    const { title, description, topic, assignee_ids, deadline, status, position } = req.body;
    
    // Validate input using Zod schema
    try {
      const validatedData = taskUpdateSchema.parse({
        title,
        description,
        topic,
        deadline,
        status,
        position,
        assignee_ids
      });
      
      // Use validated data
      const {
        title: validatedTitle,
        description: validatedDescription,
        topic: validatedTopic,
        deadline: validatedDeadline,
        status: validatedStatus,
        position: validatedPosition,
        assignee_ids: validatedAssigneeIds
      } = validatedData;
    
      try {
        await query("BEGIN");
        
        const existing = await query("SELECT * FROM tasks WHERE id = $1", [id]);
        if (!existing.rows.length) {
          await query("ROLLBACK");
          return res.status(404).json({ error: "Task not found" });
        }
        const t = existing.rows[0];
        
        // 1. Ana görevi güncelle
        const taskResult = await query(
          "UPDATE tasks SET title=$1, description=$2, topic=$3, deadline=$4, status=$5, position=$6 WHERE id=$7 RETURNING *",
          [validatedTitle ?? t.title, validatedDescription ?? t.description, validatedTopic ?? t.topic,
           validatedDeadline !== undefined ? validatedDeadline : t.deadline,
           validatedStatus ?? t.status, validatedPosition !== undefined ? validatedPosition : t.position, id]
        );
        const updatedTask = taskResult.rows[0];
        updatedTask.assignees = [];

        // 2. Atamaları güncelle (Eğer frontend assignee_ids dizisi gönderdiyse)
        if (validatedAssigneeIds !== undefined) {
          await query("DELETE FROM task_assignees WHERE task_id = $1", [id]);
          
          if (validatedAssigneeIds.length > 0) {
            // for loop yerine unnest
            await query(
              "INSERT INTO task_assignees (task_id, employee_id) SELECT $1, unnest($2::int[])",
              [id, validatedAssigneeIds]
            );
            const emps = await query(
              "SELECT id, name FROM employees WHERE id = ANY($1)",
              [validatedAssigneeIds]
            );
            updatedTask.assignees = emps.rows;
          }
        }else {
           // Frontend assignee göndermediyse (örneğin sadece status değiştiyse), mevcut assigneeleri getir
           const existingEmps = await query(`
             SELECT e.id, e.name FROM employees e
             JOIN task_assignees ta ON e.id = ta.employee_id
             WHERE ta.task_id = $1
           `, [id]);
           updatedTask.assignees = existingEmps.rows;
        }

        await query("COMMIT");
        res.json(updatedTask);
      } catch (err) {
        await query("ROLLBACK");
        console.error("PUT /tasks Error:", err);
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

  app.patch("/api/tasks/:id/status", async (req, res) => {
    const { status } = req.body;
    
    // Validate status using Zod
    try {
      const validatedData = z.object({
        status: z.enum(['new', 'process', 'blocked', 'done'])
      }).parse({ status });
      
      const validatedStatus = validatedData.status;
      
      try {
        const result = await query("UPDATE tasks SET status=$1 WHERE id=$2 RETURNING *", [validatedStatus, req.params.id]);
        if (!result.rows.length) return res.status(404).json({ error: "Task not found" });
        res.json(result.rows[0]);
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

  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      // ON DELETE CASCADE sayesinde task silinince ara tablodaki kayıtlar otomatik silinir
      const result = await query("DELETE FROM tasks WHERE id=$1 RETURNING id", [req.params.id]);
      if (!result.rows.length) return res.status(404).json({ error: "Task not found" });
      res.json({ success: true, id: result.rows[0].id });
    } catch (err) { res.status(500).json({ error: "Database error" }); }
  });
};
