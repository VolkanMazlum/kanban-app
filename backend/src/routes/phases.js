module.exports = (app, query, authenticate) => {

  app.get("/api/phase-templates", async (req, res) => {
    try {
      const result = await query("SELECT * FROM phase_templates ORDER BY topic, position");
      const grouped = {};
      result.rows.forEach(r => {
        if (!grouped[r.topic]) grouped[r.topic] = [];
        grouped[r.topic].push(r);
      });
      res.json(grouped);
    } catch (err) { res.status(500).json({ error: "Database error" }); }
  });

  app.get("/api/tasks/:taskId/phases", async (req, res) => {
  try {
    const result = await query(`
      SELECT tp.*,
        COALESCE((
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
              WHERE pamh.phase_id = tp.id AND pamh.employee_id = pa.employee_id
            ), '[]')
          ))
          FROM phase_assignees pa
          JOIN employees e ON e.id = pa.employee_id
          WHERE pa.phase_id = tp.id AND e.is_active = TRUE
        ), '[]') AS assignee_hours,
        COALESCE((
          SELECT array_agg(pa.employee_id)
          FROM phase_assignees pa
          JOIN employees e ON e.id = pa.employee_id
          WHERE pa.phase_id = tp.id AND e.is_active = TRUE
        ), '{}') AS assignee_ids
      FROM task_phases tp
      WHERE tp.task_id = $1
      ORDER BY tp.position
    `, [req.params.taskId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: "Database error" }); }
});
  app.post("/api/tasks/:taskId/phases", authenticate, async (req, res) => {
    const { taskId } = req.params;
    const { phases } = req.body;
    try {
      // await query("BEGIN");
      await query("DELETE FROM task_phases WHERE task_id = $1", [taskId]);
      if (phases && phases.length > 0) {
        for (const ph of phases) {
          // Calculate total estimated hours from assignee hours
          const totalEstimatedHours = (ph.assignee_hours || []).reduce((sum, assignee) => sum + (parseFloat(assignee.estimated_hours) || 0), 0);
          
          const result = await query(
            `INSERT INTO task_phases (task_id, name, position, start_date, note, end_date, status, topic_source, estimated_hours)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
            [
              taskId, ph.name, ph.position ?? 0,
              ph.start_date || null, ph.note || null,
              ph.end_date || null,
              ph.status || "pending", ph.topic_source || null,
              totalEstimatedHours || null
            ]
          );
          const phaseId = result.rows[0].id;
          if (ph.assignee_ids && ph.assignee_ids.length > 0) {
            await query(
              "INSERT INTO phase_assignees (phase_id, employee_id) SELECT $1, unnest($2::int[])",
              [phaseId, ph.assignee_ids]
            );
          }
          if (ph.assignee_hours && ph.assignee_hours.length > 0) {
            for (const a of ph.assignee_hours) {
              await query(
                `INSERT INTO phase_assignees (phase_id, employee_id, estimated_hours) 
                VALUES ($1, $2, $3)
                ON CONFLICT (phase_id, employee_id) 
                DO UPDATE SET estimated_hours = EXCLUDED.estimated_hours`,
                [phaseId, a.id, a.estimated_hours || null]
              );
              if (a.monthly_hours && a.monthly_hours.length > 0) {
                for (const mh of a.monthly_hours) {
                  await query(
                    `INSERT INTO phase_assignee_monthly_hours (phase_id, employee_id, year, month, hours)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (phase_id, employee_id, year, month) DO UPDATE SET hours = $5`,
                    [phaseId, a.id, mh.year, mh.month, mh.hours]
                  );
                }
              }
            }
          }
        }
      }
      // await query("COMMIT");
      res.status(201).json({ success: true });
    } catch (err) {
      // await query("ROLLBACK");
      console.error("POST /phases error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  app.patch("/api/phases/:id", authenticate, async (req, res) => {
    const { id } = req.params;
    const { status, start_date, end_date, estimated_hours, assignee_ids } = req.body;
    try {
      // await query("BEGIN");
      let finalEndDate = end_date;
      if (status === "done" && !end_date) {
        finalEndDate = new Date().toISOString().slice(0, 10);
      }
      const result = await query(
        `UPDATE task_phases 
         SET status = COALESCE($1, status),
             start_date = COALESCE($2, start_date),
             end_date = COALESCE($3, end_date),
             estimated_hours = COALESCE($4, estimated_hours)
         WHERE id = $5 RETURNING *`,
        [status || null, start_date || null, finalEndDate || null, estimated_hours || null, id]
      );
      if (!result.rows.length) {
        // await query("ROLLBACK");
        return res.status(404).json({ error: "Phase not found" });
      }
      if (assignee_ids !== undefined) {
        await query("DELETE FROM phase_assignees WHERE phase_id = $1", [id]);
        if (assignee_ids.length > 0) {
          await query(
            "INSERT INTO phase_assignees (phase_id, employee_id) SELECT $1, unnest($2::int[])",
            [id, assignee_ids]
          );
        }
      }
      // await query("COMMIT");
      res.json(result.rows[0]);
    } catch (err) {
      // await query("ROLLBACK");
      res.status(500).json({ error: "Database error" });
    }
  });

  // Aylık saatleri kaydet
app.post("/api/phases/:phaseId/monthly-hours", authenticate, async (req, res) => {
  const { phaseId } = req.params;
  const { employee_id, year, month, hours } = req.body;
  try {
    const result = await query(
      `INSERT INTO phase_assignee_monthly_hours (phase_id, employee_id, year, month, hours)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (phase_id, employee_id, year, month) DO UPDATE SET hours = $5
       RETURNING *`,
      [phaseId, employee_id, year, month, hours]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

// Aylık saatleri getir
app.get("/api/phases/:phaseId/monthly-hours", async (req, res) => {
  const { phaseId } = req.params;
  try {
    const result = await query(
      `SELECT * FROM phase_assignee_monthly_hours WHERE phase_id = $1 ORDER BY year, month`,
      [phaseId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

};
