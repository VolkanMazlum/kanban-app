module.exports = (app, query) => {

  // Tüm phase template'lerini getir
  app.get("/api/phase-templates", async (req, res) => {
    try {
      const result = await query(
        "SELECT * FROM phase_templates ORDER BY topic, position"
      );
      // Topic'e göre grupla
      const grouped = {};
      result.rows.forEach(r => {
        if (!grouped[r.topic]) grouped[r.topic] = [];
        grouped[r.topic].push({ id: r.id, name: r.name, position: r.position });
      });
      res.json(grouped);
    } catch (err) {
      console.error("GET /phase-templates Error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // Task'ın phase'lerini getir
  app.get("/api/tasks/:taskId/phases", async (req, res) => {
    try {
      const result = await query(
        "SELECT * FROM task_phases WHERE task_id = $1 ORDER BY position",
        [req.params.taskId]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("GET /tasks/:taskId/phases Error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // Task'ın phase'lerini toplu kaydet (upsert)
  app.post("/api/tasks/:taskId/phases", async (req, res) => {
    const { phases } = req.body; // [{ name, position, start_date, end_date, status }]
    if (!Array.isArray(phases)) {
      return res.status(400).json({ error: "phases must be an array" });
    }
    try {
      await query("BEGIN");
      // Önce mevcut phase'leri sil
      await query("DELETE FROM task_phases WHERE task_id = $1", [req.params.taskId]);
      // Yenilerini ekle
      for (const phase of phases) {
        await query(
          `INSERT INTO task_phases (task_id, name, position, note, start_date, end_date, status, topic_source)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            req.params.taskId,
            phase.name,
            phase.position ?? 0,
            phase.note || null,
            phase.start_date || null,
            phase.end_date || null,
            phase.status || 'pending',
            phase.topic_source || null
          ]
        );
      }
      await query("COMMIT");
      const result = await query(
        "SELECT * FROM task_phases WHERE task_id = $1 ORDER BY position",
        [req.params.taskId]
      );
      res.status(201).json(result.rows);
    } catch (err) {
      await query("ROLLBACK");
      console.error("POST /tasks/:taskId/phases Error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // Tek phase güncelle
  app.patch("/api/phases/:id", async (req, res) => {
    const { id } = req.params;
    const { status, start_date, end_date } = req.body;
    try {
      let finalEndDate = end_date;
      if (status === "done" && !end_date) {
        finalEndDate = new Date().toISOString().slice(0, 10);
      }
      const result = await query(
        `UPDATE task_phases 
        SET status = COALESCE($1, status),
            start_date = COALESCE($2, start_date),
            end_date = COALESCE($3, end_date)
        WHERE id = $4 RETURNING *`,
        [status || null, start_date || null, finalEndDate || null, id]
      );
      if (!result.rows.length) return res.status(404).json({ error: "Phase not found" });
      res.json(result.rows[0]);
    } catch (err) {
      console.error("PATCH /phases error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });
};
