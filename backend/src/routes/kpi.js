module.exports = (app, query, authenticate) => {
  // ── KPIs ──────────────────────────────────────────────────────
  app.get("/api/kpi", authenticate, async (req, res) => {
    try {
      const year = parseInt(req.query.year) || new Date().getFullYear();
      const month = parseInt(req.query.month) || new Date().getMonth() + 1;
      const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
      const monthEnd = new Date(year, month, 0).toISOString().slice(0, 10);

      // 1. Status distribution for the selected month (tasks active/updated in that month)
      const statusRes = await query(`
        SELECT status, COUNT(*) as count 
        FROM tasks 
        WHERE (planned_start <= $2 AND planned_end >= $1)
           OR (updated_at::date >= $1 AND updated_at::date <= $2)
        GROUP BY status
      `, [monthStart, monthEnd]);
      const by_status = { new: 0, process: 0, blocked: 0, done: 0 };
      let monthTotalTasks = 0;
      statusRes.rows.forEach(r => {
        by_status[r.status] = parseInt(r.count, 10);
        monthTotalTasks += parseInt(r.count, 10);
      });

      // 2. Overdue tasks
      const overdueRes = await query(`
        SELECT COUNT(*) as count FROM tasks 
        WHERE deadline < CURRENT_DATE AND status != 'done'
      `);
      const overdue = parseInt(overdueRes.rows[0].count, 10);

      // 3. Completed in selected month
      const completedMonthRes = await query(`
        SELECT COUNT(*) as count FROM tasks 
        WHERE status = 'done' 
        AND updated_at::date >= $1 AND updated_at::date <= $2
      `, [monthStart, monthEnd]);
      const completedMonthCount = parseInt(completedMonthRes.rows[0].count, 10);

      // 4. Monthly Billed Revenue (from lines) + Scheduled Revenue (from installments)
      const billedRes = await query(`
        SELECT fl.id, fl.attivita, fl.fatturato_amount, c.name as commessa_name,
               COALESCE(fl.invoice_date, fl.updated_at, (SELECT end_date FROM task_phases WHERE task_id = t.id AND LOWER(name) = LOWER(fl.attivita) LIMIT 1), t.planned_end) as date
        FROM fatturato_lines fl
        JOIN commessa_clients cc ON fl.commessa_client_id = cc.id
        JOIN commesse c ON cc.commessa_id = c.id
        LEFT JOIN tasks t ON c.task_id = t.id
        WHERE (EXTRACT(YEAR FROM COALESCE(fl.invoice_date, fl.updated_at, (SELECT end_date FROM task_phases WHERE task_id = t.id AND LOWER(name) = LOWER(fl.attivita) LIMIT 1), t.planned_end)) = $1
          AND EXTRACT(MONTH FROM COALESCE(fl.invoice_date, fl.updated_at, (SELECT end_date FROM task_phases WHERE task_id = t.id AND LOWER(name) = LOWER(fl.attivita) LIMIT 1), t.planned_end)) = $2)
          AND (fl.fatturato_amount > 0 OR fl.invoice_date IS NOT NULL)
      `, [year, month]);

      const monthlyRevenue = billedRes.rows.reduce((sum, r) => sum + parseFloat(r.fatturato_amount || 0), 0);


        // 4a. Actual Revenue Details for Forecast History
        const forecast = [];
        for (let i = 0; i < 4; i++) {
          const fDate = new Date(year, month - 1 + i, 1);
  
          const fBilled = await query(`
            SELECT fl.attivita, c.name as commessa_name, SUM(fl.fatturato_amount) as amount
            FROM fatturato_lines fl
            JOIN commessa_clients cc ON fl.commessa_client_id = cc.id
            JOIN commesse c ON cc.commessa_id = c.id
            LEFT JOIN tasks t ON c.task_id = t.id
            WHERE (EXTRACT(YEAR FROM COALESCE(fl.invoice_date, fl.updated_at, (SELECT end_date FROM task_phases WHERE task_id = t.id AND LOWER(name) = LOWER(fl.attivita) LIMIT 1), t.planned_end)) = $1
              AND EXTRACT(MONTH FROM COALESCE(fl.invoice_date, fl.updated_at, (SELECT end_date FROM task_phases WHERE task_id = t.id AND LOWER(name) = LOWER(fl.attivita) LIMIT 1), t.planned_end)) = $2)
              AND (fl.fatturato_amount > 0 OR fl.invoice_date IS NOT NULL)
            GROUP BY fl.attivita, c.name
          `, [fDate.getFullYear(), fDate.getMonth() + 1]);
  
          const details = fBilled.rows.map(r => ({
            name: r.commessa_name ? `${r.commessa_name}: ${r.attivita}` : (r.attivita || "Unnamed Activity"),
            amount: parseFloat(r.amount || 0)
          })).sort((a, b) => b.amount - a.amount);
  
          forecast.push({
            month: fDate.toLocaleString('en-US', { month: 'short' }),
            total: details.reduce((sum, d) => sum + d.amount, 0),
            details
          });
        }

      // 4b. Monthly Labor Costs
      const laborRes = await query(`
        SELECT e.id, e.name, e.category, COALESCE(wh_sum.hours, 0) as hours,
               (SELECT ec.annual_gross FROM employee_costs ec WHERE ec.employee_id = e.id AND ec.valid_from <= $3 ORDER BY ec.valid_from DESC LIMIT 1) as annual_gross
        FROM employees e
        LEFT JOIN (
          SELECT employee_id, SUM(hours) as hours
          FROM employee_work_hours
          WHERE EXTRACT(YEAR FROM date) = $1 AND EXTRACT(MONTH FROM date) = $2
          GROUP BY employee_id
        ) wh_sum ON e.id = wh_sum.employee_id
        WHERE e.is_active = TRUE
          AND (wh_sum.hours > 0 OR e.category = 'consultant')
      `, [year, month, monthEnd]);

      const labor_details = laborRes.rows.map(r => {
        const hours = parseFloat(r.hours || 0);
        const gross = parseFloat(r.annual_gross || 0);
        let cost = 0;
        if (r.category === 'consultant') {
          cost = gross / 12;
        } else {
          cost = hours * (gross / 2000);
        }
        return { name: r.name, hours, cost };
      }).filter(l => l.cost > 0 || l.hours > 0);

      const totalLaborCost = labor_details.reduce((sum, l) => sum + l.cost, 0);

      // 4c. Monthly Overhead (General Costs)
      const settingsRes = await query(`SELECT key, value FROM settings WHERE key LIKE 'gc_%_' || $1`, [year]);
      const yearlyOverhead = settingsRes.rows.reduce((sum, r) => sum + (parseFloat(r.value) || 0), 0);
      const monthlyOverhead = yearlyOverhead / 12;

      // 5. Monthly Phase Completion
      const phaseCompRes = await query(`
        SELECT COUNT(*) as completed_phases
        FROM task_phases
        WHERE status = 'done'
        AND end_date >= $1 AND end_date <= $2
      `, [monthStart, monthEnd]);
      const completedPhases = phaseCompRes.rows[0].completed_phases || 0;

      // 5. Active Team Size (Active members on task/phases in that month)
      const teamRes = await query(`
        SELECT COUNT(DISTINCT employee_id) as active_count
        FROM (
          SELECT ta.employee_id FROM task_assignees ta 
          JOIN tasks t ON ta.task_id = t.id
          WHERE t.planned_start <= $2 AND t.planned_end >= $1
          UNION
          SELECT pa.employee_id FROM phase_assignees pa
          JOIN task_phases tp ON pa.phase_id = tp.id
          WHERE tp.start_date <= $2 AND tp.end_date >= $1
        ) as active_emp
        JOIN employees e ON active_emp.employee_id = e.id
        WHERE e.is_active = TRUE
      `, [monthStart, monthEnd]);

      const totalEmpRes = await query("SELECT COUNT(*) as count FROM employees WHERE is_active = TRUE");

      // 6. Trend: Rolling 6 months completions
      const trendRes = await query(`
        SELECT 
          to_char(updated_at, 'Mon YYYY') as month,
          COUNT(*) as completed,
          MIN(updated_at) as sort_date
        FROM tasks
        WHERE status = 'done'
        AND updated_at >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY to_char(updated_at, 'Mon YYYY')
        ORDER BY sort_date ASC
      `);

      const summary = {
        total: monthTotalTasks,
        working_employees_res: `${teamRes.rows[0].active_count} / ${totalEmpRes.rows[0].count}`,
        completed_month: monthTotalTasks > 0 ? `${((completedMonthCount / monthTotalTasks) * 100).toFixed(1)}%` : "0%",
        overdue,
        monthly_revenue: monthlyRevenue,
        completed_count: completedMonthCount,
        completed_phases: completedPhases,
        forecast,
        labor_costs: labor_details,
        total_labor_cost: totalLaborCost,
        monthly_overhead: monthlyOverhead,
        realized_details: billedRes.rows
      };

      res.json({
        summary,
        by_status,
        trend: trendRes.rows,
        monthLabel: new Date(year, month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
      });
    } catch (err) {
      console.error("KPI Error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  app.get("/api/kpi/workload-monthly", authenticate, async (req, res) => {
    try {
      const year = parseInt(req.query.year) || new Date().getFullYear();
      const month = parseInt(req.query.month) || new Date().getMonth() + 1;

      const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
      const monthEnd = new Date(year, month, 0).toISOString().slice(0, 10);

      // YENİ: Aylık iş yükü tablosunda silinmiş (is_active = FALSE) çalışanları göstermiyoruz
      const result = await query(`
        SELECT 
          e.id,
          e.name,
          COALESCE((
            SELECT SUM(
              CASE
                WHEN tp.status = 'done' THEN 0
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
                WHEN pa.estimated_hours IS NOT NULL AND pa.estimated_hours > 0 THEN
                  GREATEST((LEAST(tp.end_date, $2::DATE) - GREATEST(tp.start_date, $1::DATE)), 0)
                  * (pa.estimated_hours / GREATEST((tp.end_date - tp.start_date), 1)::NUMERIC)
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
        WHERE e.is_active = TRUE
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
