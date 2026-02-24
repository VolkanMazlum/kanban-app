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
          `INSERT INTO task_phases (task_id, name, position, start_date, end_date, status)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            req.params.taskId,
            phase.name,
            phase.position ?? 0,
            phase.start_date || null,
            phase.end_date || null,
            phase.status || 'pending'
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
  app.patch("/api/tasks/:taskId/phases/:id", async (req, res) => {
    const { start_date, end_date, status } = req.body;
    try {
      const result = await query(
        `UPDATE task_phases 
         SET start_date = COALESCE($1, start_date),
             end_date   = COALESCE($2, end_date),
             status     = COALESCE($3, status)
         WHERE id = $4 AND task_id = $5 RETURNING *`,
        [start_date || null, end_date || null, status || null, req.params.id, req.params.taskId]
      );
      if (!result.rows.length) return res.status(404).json({ error: "Phase not found" });
      res.json(result.rows[0]);
    } catch (err) {
      console.error("PATCH /tasks/:taskId/phases/:id Error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });
};
