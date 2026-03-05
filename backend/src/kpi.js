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
      const working_employees_res = await query(`
        SELECT COUNT(DISTINCT employee_id) as count 
        FROM (
          SELECT employee_id 
          FROM task_assignees 
          WHERE task_id IN (SELECT id FROM tasks WHERE status != 'done')
          
          UNION
          
          SELECT pa.employee_id 
          FROM phase_assignees pa
          JOIN task_phases tp ON pa.phase_id = tp.id
          JOIN tasks t ON tp.task_id = t.id
          WHERE t.status != 'done' AND tp.status != 'done'
        ) as combined_assignees
      `);
      const totalEmployeesCountRes = await query(`SELECT COUNT(*) as count FROM employees`);
      const summary = {
        total: totalTasks,
        working_employees_res: `${working_employees_res.rows[0].count} / ${totalEmployeesCountRes.rows[0].count}`,
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
               AVG(EXTRACT(EPOCH FROM (t.actual_end - t.actual_start)) / 3600) as avg_completion_hours
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
      }));

      const trend = [{ month: "Recent", completed: by_status.done }];

      res.json({ summary, by_status, by_topic, per_employee, trend });
    } catch (err) { 
      console.error("KPI Error:", err);
      res.status(500).json({ error: "Database error while fetching KPIs" }); 
    }
  });


  app.get("/api/kpi/workload-monthly", async (req, res) => {
  try {
    const year  = parseInt(req.query.year)  || new Date().getFullYear();
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;

    const monthStart = `${year}-${String(month).padStart(2,'0')}-01`;
    const monthEnd   = new Date(year, month, 0).toISOString().slice(0,10);

    const result = await query(`
      SELECT 
        e.id,
        e.name,
        -- Aylık saat: önce phase_assignee_monthly_hours'a bak, yoksa eski hesaplamayı kullan
        COALESCE((
          SELECT SUM(
            CASE
              WHEN tp.status = 'done' THEN 0
              -- Yeni sistem: monthly_hours tablosunda kayıt varsa onu kullan
              WHEN EXISTS (
                SELECT 1 FROM phase_assignee_monthly_hours pamh2
                WHERE pamh2.phase_id = tp.id AND pamh2.employee_id = e.id
              ) THEN COALESCE((
                SELECT pamh.hours
                FROM phase_assignee_monthly_hours pamh
                WHERE pamh.phase_id = tp.id 
                AND pamh.employee_id = e.id
                AND pamh.year = $3
                AND pamh.month = $4
              ), 0)
              -- Eski sistem: estimated_hours varsa prorate et
              WHEN pa.estimated_hours IS NOT NULL AND pa.estimated_hours > 0 THEN
                GREATEST((LEAST(tp.end_date, $2::DATE) - GREATEST(tp.start_date, $1::DATE)), 0)
                * (pa.estimated_hours / GREATEST((tp.end_date - tp.start_date), 1)::NUMERIC)
              -- Fallback: 8h/gün
              ELSE
                GREATEST(
                  (LEAST(tp.end_date, $2::DATE) - GREATEST(tp.start_date, $1::DATE)), 0
                ) * 8
            END
          )
          FROM task_phases tp
          JOIN phase_assignees pa ON pa.phase_id = tp.id
          WHERE pa.employee_id = e.id
          AND tp.start_date IS NOT NULL
          AND tp.end_date IS NOT NULL
          AND tp.start_date <= $2::DATE
          AND tp.end_date >= $1::DATE
        ), 0) AS phase_hours,

        -- Phase listesi (monthly_hours da dahil)
        COALESCE((
          SELECT json_agg(json_build_object(
            'phase_id', tp.id,
            'phase_name', tp.name,
            'topic', tp.topic_source,
            'start_date', tp.start_date::TEXT,
            'end_date', tp.end_date::TEXT,
            'status', tp.status,
            'estimated_hours', pa.estimated_hours,
            'task_title', t.title,
            'monthly_hours_this_month', COALESCE((
              SELECT pamh.hours
              FROM phase_assignee_monthly_hours pamh
              WHERE pamh.phase_id = tp.id
              AND pamh.employee_id = e.id
              AND pamh.year = $3
              AND pamh.month = $4
            ), null)
          ) ORDER BY tp.start_date)
          FROM task_phases tp
          JOIN phase_assignees pa ON pa.phase_id = tp.id
          JOIN tasks t ON t.id = tp.task_id
          WHERE pa.employee_id = e.id
          AND tp.start_date IS NOT NULL
          AND tp.end_date IS NOT NULL
          AND tp.start_date <= $2::DATE
          AND tp.end_date >= $1::DATE
        ), '[]') AS phases

      FROM employees e
      ORDER BY e.name
    `, [monthStart, monthEnd, year, month]);

    res.json({
      year, month, monthStart, monthEnd,
      employees: result.rows
    });
  } catch (err) {
    console.error("Workload monthly error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

};