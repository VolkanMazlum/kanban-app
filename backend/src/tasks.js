const { taskSchema, taskUpdateSchema } = require("./validation");
const { z } = require("zod");

module.exports = (app, query) => {
  // ── Tasks ──────────────────────────────────────────────────────
  app.get("/api/tasks", async (req, res) => {
    try {
      const { assignee_id, status } = req.query;
      
      // YENİ MANTIK: tasks -> task_assignees -> employees şeklinde JOIN yapıyoruz
      // Ve topics ile phases için alt sorgular (subqueries) kullanıyoruz.
      let sql = `
      SELECT t.id, t.title, t.description, t.deadline, t.planned_start, t.planned_end, t.actual_start, t.actual_end, t.status, t.position, t.created_at, t.updated_at, t.estimated_hours,
            COALESCE(
              json_agg(json_build_object('id', e.id, 'name', e.name)) FILTER (WHERE e.id IS NOT NULL),
              '[]'
            ) AS assignees,
            (
              SELECT COALESCE(json_agg(tt.topic), '[]')
              FROM task_topics tt
              WHERE tt.task_id = t.id
            ) AS topics,
            (
              SELECT COALESCE(json_agg(json_build_object(
                'id', tp.id,
                'name', tp.name,
                'position', tp.position,
                'start_date', tp.start_date::TEXT,
                'end_date', tp.end_date::TEXT,
                'status', tp.status,
                'topic', tp.topic_source
              ) ORDER BY tp.position), '[]')
              FROM task_phases tp
              WHERE tp.task_id = t.id
            ) AS phases
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
        SELECT t.id, t.title, t.description, t.deadline, t.planned_start, t.planned_end, t.actual_start, t.actual_end, t.status, t.position, t.created_at, t.updated_at, t.estimated_hours,
               COALESCE(
                 json_agg(json_build_object('id', e.id, 'name', e.name)) FILTER (WHERE e.id IS NOT NULL),
                 '[]'
               ) AS assignees,
               (
                 SELECT COALESCE(json_agg(tt.topic), '[]')
                 FROM task_topics tt
                 WHERE tt.task_id = t.id
               ) AS topics,
               (
                 SELECT COALESCE(json_agg(json_build_object(
                   'id', tp.id,
                   'name', tp.name,
                   'position', tp.position,
                   'start_date', tp.start_date::TEXT,
                   'end_date', tp.end_date::TEXT,
                   'status', tp.status,
                   'topic',(SELECT pt.topic FROM phase_templates pt WHERE pt.name = tp.name LIMIT 1)
                 ) ORDER BY tp.position), '[]')
                 FROM task_phases tp
                 WHERE tp.task_id = t.id
               ) AS phases
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
    // topic yerine topics dizisi alındı
    const { title, description, topics, assignee_ids, deadline, status, position,
            planned_start, planned_end, actual_start, actual_end, estimated_hours } = req.body;
    
    try {
      const validatedData = taskSchema.parse({
        title, description, topics, deadline, planned_start, planned_end, actual_start, actual_end, status, position, assignee_ids, estimated_hours
      });
      
      const {
        title: validatedTitle, description: validatedDescription, topics: validatedTopics, deadline: validatedDeadline,
        planned_start: validatedPlannedStart, planned_end: validatedPlannedEnd, actual_start: validatedActualStart,
        actual_end: validatedActualEnd, status: validatedStatus, position: validatedPosition,
        assignee_ids: validatedAssigneeIds, estimated_hours: validatedEstimatedHours
      } = validatedData;
    
      try {
        await query("BEGIN");
        
        // 1. Görevi oluştur (topic sütunu yok!)
        const taskResult = await query(
          "INSERT INTO tasks (title, description, deadline, planned_start, planned_end, actual_start, actual_end, status, position, estimated_hours) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
          [validatedTitle, validatedDescription || "", validatedDeadline || null,
           validatedPlannedStart || null, validatedPlannedEnd || null, validatedActualStart || null, validatedActualEnd || null,
           validatedStatus, validatedPosition, validatedEstimatedHours || null]
        );
        const newTask = taskResult.rows[0];
        newTask.assignees = [];
        newTask.topics = [];
        
        // 2. Kişileri ara tabloya (task_assignees) kaydet
        if (validatedAssigneeIds && validatedAssigneeIds.length > 0) {
          await query(
            "INSERT INTO task_assignees (task_id, employee_id) SELECT $1, unnest($2::int[])",
            [newTask.id, validatedAssigneeIds]
          );
          const emps = await query("SELECT id, name FROM employees WHERE id = ANY($1)", [validatedAssigneeIds]);
          newTask.assignees = emps.rows;
        }

        // 3. YENİ: Kategorileri ara tabloya (task_topics) kaydet
        if (validatedTopics && validatedTopics.length > 0) {
          await query(
            "INSERT INTO task_topics (task_id, topic) SELECT $1, unnest($2::varchar[])",
            [newTask.id, validatedTopics]
          );
          newTask.topics = validatedTopics;
        }
        
        await query("COMMIT");
        res.status(201).json(newTask);
      } catch (err) {
        await query("ROLLBACK");
        console.error("POST /tasks Error:", err);
        res.status(500).json({ error: "Database error" });
      }
    } catch (validationError) {
      if (validationError.errors) {
        const errorMessage = validationError.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
        return res.status(400).json({ error: errorMessage });
      }
      return res.status(400).json({ error: validationError.message });
    }
  });

  app.put("/api/tasks/:id", async (req, res) => {
    const { id } = req.params;
    // topic yerine topics dizisi alındı
    const { title, description, topics, assignee_ids, deadline, status, position,
            planned_start, planned_end, actual_start, actual_end, estimated_hours } = req.body;
    
    try {
      const validatedData = taskUpdateSchema.parse({
        title, description, topics, deadline, planned_start, planned_end, actual_start, actual_end, status, position, assignee_ids, estimated_hours
      });
      
      const {
        title: validatedTitle, description: validatedDescription, topics: validatedTopics, deadline: validatedDeadline,
        planned_start: validatedPlannedStart, planned_end: validatedPlannedEnd, actual_start: validatedActualStart,
        actual_end: validatedActualEnd, status: validatedStatus, position: validatedPosition,
        assignee_ids: validatedAssigneeIds, estimated_hours: validatedEstimatedHours
      } = validatedData;
    
      try {
        await query("BEGIN");
        
        const existing = await query("SELECT * FROM tasks WHERE id = $1", [id]);
        if (!existing.rows.length) {
          await query("ROLLBACK");
          return res.status(404).json({ error: "Task not found" });
        }
        const t = existing.rows[0];
        
        // 1. Ana görevi güncelle (topic sütunu yok!)
        const taskResult = await query(
          "UPDATE tasks SET title=$1, description=$2, deadline=$3, planned_start=$4, planned_end=$5, actual_start=$6, actual_end=$7, status=$8, position=$9, estimated_hours=$10 WHERE id=$11 RETURNING *",
          [validatedTitle ?? t.title, validatedDescription ?? t.description,
           validatedDeadline !== undefined ? validatedDeadline : t.deadline,
           validatedPlannedStart !== undefined ? validatedPlannedStart : t.planned_start,
           validatedPlannedEnd !== undefined ? validatedPlannedEnd : t.planned_end,
           validatedActualStart !== undefined ? validatedActualStart : t.actual_start,
           validatedActualEnd !== undefined ? validatedActualEnd : t.actual_end,
           validatedStatus ?? t.status, validatedPosition !== undefined ? validatedPosition : t.position, validatedEstimatedHours || null, id]
        );
        const updatedTask = taskResult.rows[0];
        updatedTask.assignees = [];

        // 2. Atamaları güncelle
        if (validatedAssigneeIds !== undefined) {
          await query("DELETE FROM task_assignees WHERE task_id = $1", [id]);
          if (validatedAssigneeIds.length > 0) {
            await query("INSERT INTO task_assignees (task_id, employee_id) SELECT $1, unnest($2::int[])", [id, validatedAssigneeIds]);
            const emps = await query("SELECT id, name FROM employees WHERE id = ANY($1)", [validatedAssigneeIds]);
            updatedTask.assignees = emps.rows;
          }
        } else {
           const existingEmps = await query(`SELECT e.id, e.name FROM employees e JOIN task_assignees ta ON e.id = ta.employee_id WHERE ta.task_id = $1`, [id]);
           updatedTask.assignees = existingEmps.rows;
        }

        // 3. YENİ: Kategorileri (Topics) güncelle
        if (validatedTopics !== undefined) {
          await query("DELETE FROM task_topics WHERE task_id = $1", [id]);
          if (validatedTopics.length > 0) {
            await query("INSERT INTO task_topics (task_id, topic) SELECT $1, unnest($2::varchar[])", [id, validatedTopics]);
            updatedTask.topics = validatedTopics;
          } else {
            updatedTask.topics = [];
          }
        } else {
           const existingTopics = await query(`SELECT topic FROM task_topics WHERE task_id = $1`, [id]);
           updatedTask.topics = existingTopics.rows.map(row => row.topic);
        }

        await query("COMMIT");
        res.json(updatedTask);
      } catch (err) {
        await query("ROLLBACK");
        console.error("PUT /tasks Error:", err);
        res.status(500).json({ error: "Database error" });
      }
    } catch (validationError) {
      if (validationError.errors) {
        const errorMessage = validationError.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
        return res.status(400).json({ error: errorMessage });
      }
      return res.status(400).json({ error: validationError.message });
    }
  });

  app.patch("/api/tasks/:id/status", async (req, res) => {
    const { status } = req.body;
    try {
      const validatedData = z.object({
        status: z.enum(['new', 'process', 'blocked', 'done'])
      }).parse({ status });
      const validatedStatus = validatedData.status;
      
      try {
        let sql = "UPDATE tasks SET status=$1";
        const params = [validatedStatus];
        
        if (validatedStatus === 'process') {
          sql += ", actual_start=NOW() , actual_end=NULL";
        } else if (validatedStatus === 'done') {
          sql += ", actual_end=NOW()";
        } else if (validatedStatus === 'new') {
          sql += ", actual_end=NULL , actual_start=NULL, estimated_hours=NULL";
        } else if (validatedStatus === 'blocked') {
          sql += ", actual_end=NULL";
        }
        
        sql += " WHERE id=$" + (params.length + 1) + " RETURNING *";
        params.push(req.params.id);
        
        const result = await query(sql, params);
        if (!result.rows.length) return res.status(404).json({ error: "Task not found" });
        res.json(result.rows[0]);

        if (validatedStatus === 'done') {
          // İlgili phase'i de done yap
          await query(`
            UPDATE task_phases 
            SET status = 'done', end_date = CURRENT_DATE
            WHERE task_id = $1 AND status != 'done' AND start_date IS NOT NULL AND end_date IS NULL
          `, [req.params.id]);
        }
      } catch (err) { res.status(500).json({ error: "Database error" }); }
    } catch (validationError) {
      if (validationError.errors) {
        const errorMessage = validationError.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
        return res.status(400).json({ error: errorMessage });
      }
      return res.status(400).json({ error: validationError.message });
    }
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      // ON DELETE CASCADE sayesinde task_assignees ve task_topics otomatik silinir
      const result = await query("DELETE FROM tasks WHERE id=$1 RETURNING id", [req.params.id]);
      if (!result.rows.length) return res.status(404).json({ error: "Task not found" });
      res.json({ success: true, id: result.rows[0].id });
    } catch (err) { res.status(500).json({ error: "Database error" }); }
  });
};