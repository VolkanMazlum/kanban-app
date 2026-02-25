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
        SELECT AVG(EXTRACT(EPOCH FROM (actual_end - actual_start)) / 86400) as avg_days
        FROM tasks WHERE status = 'done' AND actual_start IS NOT NULL AND actual_end IS NOT NULL
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

      // YENİ: Kategori (Topic) istatistiklerini hesaplama sorgusu
      // Artık "task_topics" ara tablosu ile "tasks" tablosunu JOIN yaparak sayıyoruz.
      const topicRes = await query(`
        SELECT tt.topic, 
               COUNT(t.id) as total, 
               SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done
        FROM task_topics tt
        JOIN tasks t ON tt.task_id = t.id
        GROUP BY tt.topic
      `);
      const by_topic = topicRes.rows.map(r => ({
        topic: r.topic, 
        total: parseInt(r.total, 10), 
        done: parseInt(r.done || 0, 10)
      }));

      // Çalışan (Employee) Performans Sorgusu
      const empRes = await query(`
        SELECT e.id, e.name,
               COUNT(t.id) as total_assigned,
               SUM(CASE WHEN t.status = 'new' THEN 1 ELSE 0 END) as new_count,
               SUM(CASE WHEN t.status = 'process' THEN 1 ELSE 0 END) as in_process,
               SUM(CASE WHEN t.status = 'blocked' THEN 1 ELSE 0 END) as blocked,
               SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done_count,
               AVG(EXTRACT(EPOCH FROM (t.actual_end - t.actual_start)) / 3600) as avg_completion_hours,
               COALESCE((
                SELECT SUM(
                  CASE
                    WHEN t2.estimated_hours IS NOT NULL AND t2.estimated_hours > 0 THEN 
                      CASE
                        WHEN (SELECT COUNT(*) FROM task_phases WHERE task_id = t2.id AND start_date IS NOT NULL AND end_date IS NOT NULL) > 0 THEN
                          t2.estimated_hours - COALESCE((
                            t2.estimated_hours * (
                              -- Pay: Sadece 'done' olan fazlarin toplam gün sayisi
                              (SELECT COALESCE(SUM(GREATEST(end_date - start_date, 1)), 0)::NUMERIC 
                               FROM task_phases WHERE task_id = t2.id AND status = 'done' AND start_date IS NOT NULL AND end_date IS NOT NULL)
                              / 
                              -- Payda: Tüm fazlarin toplam gün sayisi
                              NULLIF((SELECT SUM(GREATEST(end_date - start_date, 1)) 
                                      FROM task_phases WHERE task_id = t2.id AND start_date IS NOT NULL AND end_date IS NOT NULL), 0)
                            )
                          ), 0)
                        -- Görevin alt fazi yoksa, görev bitene kadar saatin tamamini al
                        ELSE t2.estimated_hours
                      END

                    WHEN (SELECT COUNT(*) FROM task_phases WHERE task_id = t2.id AND start_date IS NOT NULL AND end_date IS NOT NULL) > 0 THEN
                      (
                        SELECT COALESCE(SUM(GREATEST(end_date - start_date, 1)), 0) 
                        FROM task_phases 
                        WHERE task_id = t2.id AND status != 'done' AND start_date IS NOT NULL AND end_date IS NOT NULL
                      ) * 8
                    WHEN t2.planned_start IS NOT NULL AND t2.planned_end IS NOT NULL THEN
                      GREATEST((t2.planned_end::DATE - t2.planned_start::DATE), 1) * 8
                    ELSE 0
                  END
                )
                FROM tasks t2
                JOIN task_assignees ta2 ON ta2.task_id = t2.id
                WHERE ta2.employee_id = e.id
                AND t2.status != 'done'
              ), 0) AS estimated_workload_hours
        FROM employees e
        LEFT JOIN task_assignees ta ON e.id = ta.employee_id
        LEFT JOIN tasks t ON ta.task_id = t.id
        LEFT JOIN task_time_logs tl ON tl.employee_id = e.id AND tl.task_id = t.id
        LEFT JOIN (
          SELECT task_id, MAX(started_at) as actual_start, MAX(ended_at) as actual_end
          FROM task_time_logs
          GROUP BY task_id
        ) ttl ON ttl.task_id = t.id
        GROUP BY e.id, e.name
      `);
        const per_employee = empRes.rows.map(r => ({
        id: r.id, name: r.name,
        total_assigned: parseInt(r.total_assigned, 10),
        new_count: parseInt(r.new_count || 0, 10),
        in_process: parseInt(r.in_process || 0, 10),
        blocked: parseInt(r.blocked || 0, 10),
        done_count: parseInt(r.done_count || 0, 10),
        avg_completion_hours: parseFloat(r.avg_completion_hours || 0).toFixed(2),
        estimated_workload_hours: parseFloat(r.estimated_workload_hours || 0)
      }));

      const trend = [{ month: "Recent", completed: by_status.done }];

      res.json({ summary, by_status, by_topic, per_employee, trend });
    } catch (err) { 
      console.error("KPI Error:", err);
      res.status(500).json({ error: "Database error while fetching KPIs" }); 
    }
  });
};