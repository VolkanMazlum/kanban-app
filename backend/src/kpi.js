module.exports = (app, query) => {
  // ── KPIs ──────────────────────────────────────────────────────
  app.get("/api/kpi", async (req, res) => {
    try {
      const statusRes = await query("SELECT status, COUNT(*) as count FROM tasks GROUP BY status");
      const by_status = { new: 0, process: 0, blocked: 0, done: 0 };
      let totalTasks = 0;
      statusRes.rows.forEach(r => {
        by_status[r.status] = parseInt(r.count, 10);
        totalTasks += parseInt(r.count, 10);
      });

      const overdueRes = await query("SELECT COUNT(*) as count FROM tasks WHERE deadline < CURRENT_DATE AND status != 'done'");
      const overdue = parseInt(overdueRes.rows[0].count, 10);
      

      const avg_days_to_complete = await query(`
        SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400) as avg_days
        FROM tasks WHERE status = 'done'
      `);
      const completed_month_avg  = await query(`
        SELECT COUNT(*) as count FROM tasks 
        WHERE status = 'done' AND EXTRACT(MONTH FROM updated_at) = EXTRACT(MONTH FROM CURRENT_DATE)
      `);
      const summary = {
        total: totalTasks,
        completed_month: totalTasks > 0 ? `${((completed_month_avg.rows[0].count / totalTasks) * 100).toFixed(2)}%` : "0%",// Yüzde olarak tamamlanma oranı
        overdue: overdue,
        avg_days_to_complete: parseFloat(avg_days_to_complete.rows[0].avg_days || 0).toFixed(2)
      };

      const topicRes = await query(`
        SELECT topic, COUNT(*) as total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done
        FROM tasks WHERE topic IS NOT NULL GROUP BY topic
      `);
      const by_topic = topicRes.rows.map(r => ({
        topic: r.topic, total: parseInt(r.total, 10), done: parseInt(r.done || 0, 10)
      }));

      // YENİ KPI SORGUSU: employees -> task_assignees -> tasks
      const empRes = await query(`
        SELECT e.id, e.name, 
               COUNT(t.id) as total_assigned,
               SUM(CASE WHEN t.status = 'new' THEN 1 ELSE 0 END) as new_count,
               SUM(CASE WHEN t.status = 'process' THEN 1 ELSE 0 END) as in_process,
               SUM(CASE WHEN t.status = 'blocked' THEN 1 ELSE 0 END) as blocked,
               SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done_count
        FROM employees e
        LEFT JOIN task_assignees ta ON e.id = ta.employee_id
        LEFT JOIN tasks t ON ta.task_id = t.id
        GROUP BY e.id, e.name
      `);
      const per_employee = empRes.rows.map(r => ({
        id: r.id, name: r.name,
        total_assigned: parseInt(r.total_assigned, 10),
        new_count: parseInt(r.new_count || 0, 10),
        in_process: parseInt(r.in_process || 0, 10),
        blocked: parseInt(r.blocked || 0, 10),
        done_count: parseInt(r.done_count || 0, 10)
      }));

      const trend = [{ month: "Recent", completed: by_status.done }];

      res.json({ summary, by_status, by_topic, per_employee, trend });
    } catch (err) { 
      console.error("KPI Error:", err);
      res.status(500).json({ error: "Database error while fetching KPIs" }); 
    }
  });
};