const { taskSchema, taskUpdateSchema } = require("../middleware/validation");
const { z } = require("zod");
const { logAudit, getAuditContext } = require("../middleware/auditLog");

module.exports = (app, query, authenticate) => {
  // ── Tasks ──────────────────────────────────────────────────────
  app.get("/api/tasks", authenticate, async (req, res) => {
    try {
      const { assignee_id, status } = req.query;
      
      let sql = `
      SELECT t.id, t.title, t.description, t.deadline, t.planned_start, t.planned_end, t.actual_start, t.actual_end, t.status, t.position, t.created_at, t.updated_at, t.estimated_hours, t.label,
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
                'topic', tp.topic_source,
                'note', tp.note,
                'estimated_hours', tp.estimated_hours,
                'assignee_hours', COALESCE((
                  SELECT json_agg(json_build_object('id', e.id, 'name', e.name, 'estimated_hours', pa.estimated_hours))
                  FROM phase_assignees pa
                  JOIN employees e ON e.id = pa.employee_id
                  WHERE pa.phase_id = tp.id and e.is_active = TRUE
                ), '[]')
              ) ORDER BY tp.position), '[]')
              FROM task_phases tp
              WHERE tp.task_id = t.id
            ) AS phases,
            (
              SELECT json_build_object(
                'id', c.id,
                'comm_number', c.comm_number,
                'name', c.name,
                'clients', COALESCE((
                  SELECT json_agg(json_build_object(
                    'client_id', cc.client_id,
                    'n_cliente', cc.n_cliente,
                    'client_name', cl.name,
                    'lines', COALESCE((
                      SELECT json_agg(json_build_object(
                        'attivita', fl.attivita,
                        'valore_ordine', fl.valore_ordine,
                        'fatturato_amount', fl.fatturato_amount
                      ))
                      FROM fatturato_lines fl WHERE fl.commessa_client_id = cc.id
                    ), '[]'::json)
                  ))
                  FROM commessa_clients cc
                  LEFT JOIN clients cl ON cc.client_id = cl.id
                  WHERE cc.commessa_id = c.id
                ), '[]'::json)
              )
              FROM commesse c
              WHERE c.task_id = t.id
              LIMIT 1
            ) AS commessa
      FROM tasks t
      LEFT JOIN task_assignees ta ON t.id = ta.task_id
      LEFT JOIN employees e ON ta.employee_id = e.id
      WHERE 1=1
    `;
      const params = [];
      
      if (assignee_id) { 
        params.push(assignee_id); 
        sql += ` AND EXISTS (SELECT 1 FROM task_assignees sub_ta WHERE sub_ta.task_id = t.id AND sub_ta.employee_id = $${params.length})`; 
      }
      
      if (status) { 
        params.push(status); 
        sql += ` AND t.status = $${params.length}`; 
      }
      
      sql += " GROUP BY t.id ORDER BY t.status, t.position ASC, t.created_at ASC";
      const result = await query(sql, params);
      
      // Security: Strip sensitive commessa data for non-HR users
      const tasks = result.rows.map(t => {
        if (req.user.role !== 'hr') {
          const { commessa, ...stripped } = t;
          return stripped;
        }
        return t;
      });
      
      res.json(tasks);
    } catch (err) { 
      console.error("GET /tasks Error:", err);
      res.status(500).json({ error: "Database error" }); 
    }
  });

  app.get("/api/tasks/:id", authenticate, async (req, res) => {
    try {
      const sql = `
        SELECT t.id, t.title, t.description, t.deadline, t.planned_start, t.planned_end, t.actual_start, t.actual_end, t.status, t.position, t.created_at, t.updated_at, t.estimated_hours, t.label,
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
                   'topic', tp.topic_source,
                   'note', tp.note,
                   'estimated_hours', tp.estimated_hours,
                   'assignee_hours', COALESCE((
                      SELECT json_agg(json_build_object(
                        'id', e.id, 
                        'name', e.name,
                        'estimated_hours', pa.estimated_hours,
                        'monthly_hours', COALESCE((
                          SELECT json_agg(json_build_object(
                            'year', pamh.year,
                            'month', pamh.month,
                            'hours', pamh.hours
                          ) ORDER BY pamh.year, pamh.month)
                          FROM phase_assignee_monthly_hours pamh
                          WHERE pamh.phase_id = tp.id AND pamh.employee_id = pa.employee_id AND e.is_active = TRUE
                        ), '[]')
                      ))
                      FROM phase_assignees pa
                      JOIN employees e ON e.id = pa.employee_id
                      WHERE pa.phase_id = tp.id
                    ), '[]')
                 FROM task_phases tp
                 WHERE tp.task_id = t.id
               ) AS phases,
               (
                 SELECT json_build_object(
                   'id', c.id,
                   'comm_number', c.comm_number,
                   'name', c.name,
                   'clients', COALESCE((
                     SELECT json_agg(json_build_object(
                       'client_id', cc.client_id,
                       'n_cliente', cc.n_cliente,
                       'client_name', cl.name,
                       'lines', COALESCE((
                         SELECT json_agg(json_build_object(
                           'attivita', fl.attivita,
                           'valore_ordine', fl.valore_ordine,
                           'fatturato_amount', fl.fatturato_amount
                         ))
                         FROM fatturato_lines fl WHERE fl.commessa_client_id = cc.id
                       ), '[]'::json)
                     ))
                     FROM commessa_clients cc
                     LEFT JOIN clients cl ON cc.client_id = cl.id
                     WHERE cc.commessa_id = c.id
                   ), '[]'::json)
                 )
                 FROM commesse c
                 WHERE c.task_id = t.id
                 LIMIT 1
               ) AS commessa
        FROM tasks t 
        LEFT JOIN task_assignees ta ON t.id = ta.task_id
        LEFT JOIN employees e ON ta.employee_id = e.id
        WHERE t.id = $1
        GROUP BY t.id
      `;
      const result = await query(sql, [req.params.id]);
      if (!result.rows.length) return res.status(404).json({ error: "Task not found" });
      
      const task = result.rows[0];
      
      // Security: Strip sensitive commessa data for non-HR users
      if (req.user.role !== 'hr') {
        delete task.commessa;
      }
      
      res.json(task);
    } catch (err) { res.status(500).json({ error: "Database error" }); }
  });

  app.post("/api/tasks", authenticate, async (req, res) => {
    const { title, description, label, topics, assignee_ids, deadline, status, position,
            planned_start, planned_end, actual_start, actual_end, estimated_hours, phases } = req.body;
    
    try {
      const validatedData = taskSchema.parse({
        title, description, label, topics, deadline, planned_start, planned_end, actual_start, actual_end, status, position, assignee_ids, estimated_hours
      });
      
      const {
        title: validatedTitle, description: validatedDescription, topics: validatedTopics, deadline: validatedDeadline,
        planned_start: validatedPlannedStart, planned_end: validatedPlannedEnd, actual_start: validatedActualStart,
        actual_end: validatedActualEnd, status: validatedStatus, position: validatedPosition,
        assignee_ids: validatedAssigneeIds, estimated_hours: validatedEstimatedHours, label: validatedLabel
      } = validatedData;
    
      try {
        // await query("BEGIN");
        
        // 1. Create main task 
        const taskResult = await query(
          "INSERT INTO tasks (title, description, label, deadline, planned_start, planned_end, actual_start, actual_end, status, position, estimated_hours) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *",
          [validatedTitle, validatedDescription || "", validatedLabel || null, validatedDeadline || null,
           validatedPlannedStart || null, validatedPlannedEnd || null, validatedActualStart || null, validatedActualEnd || null,
           validatedStatus, validatedPosition, validatedEstimatedHours || null]
        );
        const newTask = taskResult.rows[0];
        newTask.assignees = [];
        newTask.topics = [];
        newTask.phases = [];

        // Audit log: task created
        const ctx = getAuditContext(req);
        logAudit(query, { ...ctx, action: 'CREATE', entityType: 'task', entityId: newTask.id, details: { title: newTask.title } });
        
        // 2. Save assignees
        if (validatedAssigneeIds && validatedAssigneeIds.length > 0) {
          await query(
            "INSERT INTO task_assignees (task_id, employee_id) SELECT $1, unnest($2::int[])",
            [newTask.id, validatedAssigneeIds]
          );
          const emps = await query("SELECT id, name FROM employees WHERE id = ANY($1)", [validatedAssigneeIds]);
          newTask.assignees = emps.rows;
        }

        // 3. Save topics
        if (validatedTopics && validatedTopics.length > 0) {
          await query(
            "INSERT INTO task_topics (task_id, topic) SELECT $1, unnest($2::varchar[])",
            [newTask.id, validatedTopics]
          );
          newTask.topics = validatedTopics;
        }

        // 4. Save Phases AND their Assignees
        if (phases && phases.length > 0) {
          for (let i = 0; i < phases.length; i++) {
            const ph = phases[i];
            
            // Insert Phase and get its ID
            const phaseResult = await query(
              "INSERT INTO task_phases (task_id, name, position, start_date, end_date, status, topic_source, note, estimated_hours) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id",
              [
                newTask.id, 
                ph.name, 
                i, 
                ph.start_date || null, 
                ph.end_date || null, 
                ph.status || 'pending', 
                ph.topic_source || null, 
                ph.note || null,
                ph.estimated_hours || null
              ]
            );
            
            const newPhaseId = phaseResult.rows[0].id;

            // Insert Phase Assignees & Hours
            if (ph.assignee_hours && ph.assignee_hours.length > 0) {
              for (const ah of ph.assignee_hours) {
                await query(
                  "INSERT INTO phase_assignees (phase_id, employee_id, estimated_hours) VALUES ($1, $2, $3)",
                  [newPhaseId, ah.id, ah.estimated_hours || null]
                );
              }
            }
          }
          newTask.phases = phases;
        }
        
        // await query("COMMIT");
        res.status(201).json(newTask);
      } catch (err) {
        // await query("ROLLBACK");
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

  app.put("/api/tasks/:id", authenticate, async (req, res) => {
    const { id } = req.params;
    const { title, description, label, topics, assignee_ids, deadline, status, position,
            planned_start, planned_end, actual_start, actual_end, estimated_hours, phases } = req.body;
    
    try {
      const validatedData = taskUpdateSchema.parse({
        title, description, label, topics, deadline, planned_start, planned_end, actual_start, actual_end, status, position, assignee_ids, estimated_hours
      });
      
      const {
        title: validatedTitle, description: validatedDescription, label: validatedLabel, topics: validatedTopics, deadline: validatedDeadline,
        planned_start: validatedPlannedStart, planned_end: validatedPlannedEnd, actual_start: validatedActualStart,
        actual_end: validatedActualEnd, status: validatedStatus, position: validatedPosition,
        assignee_ids: validatedAssigneeIds, estimated_hours: validatedEstimatedHours
      } = validatedData;
    
      try {
        // await query("BEGIN");
        
        const existing = await query("SELECT * FROM tasks WHERE id = $1", [id]);
        if (!existing.rows.length) {
          // await query("ROLLBACK");
          return res.status(404).json({ error: "Task not found" });
        }
        const t = existing.rows[0];
        
        // 1. Update main task
        const taskResult = await query(
          "UPDATE tasks SET title=$1, description=$2, label=$3, deadline=$4, planned_start=$5, planned_end=$6, actual_start=$7, actual_end=$8, status=$9, position=$10, estimated_hours=$11 WHERE id=$12 RETURNING *",
          [validatedTitle ?? t.title, validatedDescription ?? t.description,
           validatedLabel ?? t.label,
           validatedDeadline !== undefined ? validatedDeadline : t.deadline,
           validatedPlannedStart !== undefined ? validatedPlannedStart : t.planned_start,
           validatedPlannedEnd !== undefined ? validatedPlannedEnd : t.planned_end,
           validatedActualStart !== undefined ? validatedActualStart : t.actual_start,
           validatedActualEnd !== undefined ? validatedActualEnd : t.actual_end,
           validatedStatus ?? t.status, validatedPosition !== undefined ? validatedPosition : t.position, validatedEstimatedHours || null, id]
        );
        const updatedTask = taskResult.rows[0];
        updatedTask.assignees = [];

        // Audit log: task updated
        const ctx = getAuditContext(req);
        logAudit(query, { ...ctx, action: 'UPDATE', entityType: 'task', entityId: updatedTask.id, details: { title: updatedTask.title } });

        // 2. Update Assignees
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

        // 3. Update Topics
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

        // 4. Update Phases (Delete old, insert new)
        if (phases !== undefined) {
          await query("DELETE FROM task_phases WHERE task_id = $1", [id]); 
          
          if (phases.length > 0) {
            for (let i = 0; i < phases.length; i++) {
              const ph = phases[i];
              
              const phaseResult = await query(
                "INSERT INTO task_phases (task_id, name, position, start_date, end_date, status, topic_source, note, estimated_hours) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id",
                [
                  id, 
                  ph.name, 
                  i, 
                  ph.start_date || null, 
                  ph.end_date || null, 
                  ph.status || 'pending', 
                  ph.topic_source || ph.topic || null, 
                  ph.note || null,
                  ph.estimated_hours || null
                ]
              );
              
              const newPhaseId = phaseResult.rows[0].id;

              if (ph.assignee_hours && ph.assignee_hours.length > 0) {
                for (const ah of ph.assignee_hours) {
                  await query(
                    "INSERT INTO phase_assignees (phase_id, employee_id, estimated_hours) VALUES ($1, $2, $3)",
                    [newPhaseId, ah.id, ah.estimated_hours || null]
                  );
                }
              }
            }
          }
        }

        // await query("COMMIT");
        res.json(updatedTask);
      } catch (err) {
        // await query("ROLLBACK");
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

  app.patch("/api/tasks/:id/status", authenticate, async (req, res) => {
    const { status } = req.body;
    try {
      const validatedData = z.object({
        status: z.enum(['new', 'process', 'blocked', 'done'])
      }).parse({ status });
      const validatedStatus = validatedData.status;
      
      try {
        const existing = await query("SELECT status, actual_start FROM tasks WHERE id = $1", [req.params.id]);
        if (!existing.rows.length) return res.status(404).json({ error: "Task not found" });
        const hasActualStart = existing.rows[0].actual_start;
        let sql = "UPDATE tasks SET status=$1";
        const params = [validatedStatus];
        
        if (validatedStatus === 'process') {
          sql += ", actual_end=NULL";
          if (!hasActualStart) {
            const earliestPhase = await query(`
              SELECT MIN(start_date) as earliest 
              FROM task_phases 
              WHERE task_id = $1 AND start_date IS NOT NULL
            `, [req.params.id]);
            
            const earliest = earliestPhase.rows[0]?.earliest;
            if (earliest) {
              params.push(earliest);
              sql += `, actual_start=$${params.length}`;
            } else {
              sql += ", actual_start=NOW()";
            }
          }
        }
         else if (validatedStatus === 'new') {
          sql += ", actual_end=NULL , actual_start=NULL, estimated_hours=NULL";
        } else if (validatedStatus === 'blocked') {
          sql += ", actual_end=NULL";
        }
        
        sql += " WHERE id=$" + (params.length + 1) + " RETURNING *";
        params.push(req.params.id);
        
        const result = await query(sql, params);
        if (!result.rows.length) return res.status(404).json({ error: "Task not found" });

        if (validatedStatus === 'done') {
          await query(`
            UPDATE task_phases 
            SET status = 'done'
            WHERE task_id = $1 AND status != 'done' 
          `, [req.params.id]);
        }
        else if (validatedStatus === 'process') {
          await query(`
            UPDATE task_phases 
            SET status = 'pending'
            WHERE task_id = $1 
          `, [req.params.id]);
        }

        // Audit log: status changed
        const ctx = getAuditContext(req);
        logAudit(query, { ...ctx, action: 'STATUS_CHANGE', entityType: 'task', entityId: parseInt(req.params.id), details: { newStatus: validatedStatus } });
        
        res.json(result.rows[0]);

      } catch (err) { res.status(500).json({ error: "Database error" }); }
    } catch (validationError) {
      if (validationError.errors) {
        const errorMessage = validationError.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
        return res.status(400).json({ error: errorMessage });
      }
      return res.status(400).json({ error: validationError.message });
    }
  });

  app.delete("/api/tasks/:id", authenticate, async (req, res) => {
    try {
      const result = await query("DELETE FROM tasks WHERE id=$1 RETURNING id, title", [req.params.id]);
      if (!result.rows.length) return res.status(404).json({ error: "Task not found" });

      // Audit log: task deleted
      const ctx = getAuditContext(req);
      logAudit(query, { ...ctx, action: 'DELETE', entityType: 'task', entityId: result.rows[0].id, details: { title: result.rows[0].title } });

      res.json({ success: true, id: result.rows[0].id });
    } catch (err) { res.status(500).json({ error: "Database error" }); }
  });
};
