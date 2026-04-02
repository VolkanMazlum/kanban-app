const { calculateMonthlyLaborCost } = require("../utils/finance");

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

      // 4. Monthly Billed Revenue (from REALIZED entries)
      const billedRes = await query(`
        SELECT fr.id, fl.attivita, fr.amount as fatturato_amount, c.name as commessa_name,
               fr.registration_date as date
        FROM fatturato_realized fr
        JOIN fatturato_lines fl ON fr.fatturato_line_id = fl.id
        JOIN commessa_clients cc ON fl.commessa_client_id = cc.id
        JOIN commesse c ON cc.commessa_id = c.id
        LEFT JOIN tasks t ON c.task_id = t.id
        WHERE EXTRACT(YEAR FROM fr.registration_date) = $1
          AND EXTRACT(MONTH FROM fr.registration_date) = $2
      `, [year, month]);

      const monthlyRevenue = billedRes.rows.reduce((sum, r) => sum + parseFloat(r.fatturato_amount || 0), 0);


        // 4a. Actual Revenue Details for Forecast History (5 months centered)
        const forecast = [];
        for (let i = -2; i <= 2; i++) {
          const fDate = new Date(year, month - 1 + i, 1);
  
          const fBilled = await query(`
            SELECT fl.attivita, c.name as commessa_name, SUM(fr.amount) as amount
            FROM fatturato_realized fr
            JOIN fatturato_lines fl ON fr.fatturato_line_id = fl.id
            JOIN commessa_clients cc ON fl.commessa_client_id = cc.id
            JOIN commesse c ON cc.commessa_id = c.id
            LEFT JOIN tasks t ON c.task_id = t.id
            WHERE EXTRACT(YEAR FROM fr.registration_date) = $1
              AND EXTRACT(MONTH FROM fr.registration_date) = $2
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
        SELECT e.id, e.name, e.category, e.hr_details, COALESCE(wh_sum.hours, 0) as hours,
               COALESCE(
                 (SELECT ec.annual_gross FROM employee_costs ec WHERE ec.employee_id = e.id AND ec.valid_from <= $3 ORDER BY ec.valid_from DESC LIMIT 1),
                 (SELECT ec.annual_gross FROM employee_costs ec WHERE ec.employee_id = e.id ORDER BY ec.valid_from ASC LIMIT 1)
               ) as annual_gross
        FROM employees e
        LEFT JOIN (
          SELECT employee_id, SUM(hours) as hours
          FROM employee_work_hours
          WHERE EXTRACT(YEAR FROM date) = $1 AND EXTRACT(MONTH FROM date) = $2
          GROUP BY employee_id
        ) wh_sum ON e.id = wh_sum.employee_id
        WHERE (e.is_active = TRUE 
           OR EXISTS (SELECT 1 FROM employee_work_hours wh WHERE wh.employee_id = e.id AND EXTRACT(YEAR FROM wh.date) = $1)
           OR (e.category = 'consultant' AND (e.hr_details->>'inizio_lavoro') IS NOT NULL))
      `, [year, month, monthEnd]);
 
      const internal_labor = [];
      const consultant_labor = [];
 
      laborRes.rows.forEach(r => {
        // Consultant year-eligibility check
        if (r.category === 'consultant') {
          const hr = r.hr_details || {};
          const startStr = hr.inizio_lavoro;
          const endStr = hr.scadenza_contratto;
          
          if (!startStr && !endStr) {
            // If no contract dates, fall back to is_active or having hours
            if (!r.is_active && hours <= 0) return;
          } else {
            const monthStartObj = new Date(year, month - 1, 1);
            const monthEndObj = new Date(year, month, 0);

            if (startStr && new Date(startStr) > monthEndObj) return;
            if (endStr && new Date(endStr) < monthStartObj) return;
          }
        }
 
        const hours = parseFloat(r.hours || 0);
        const cost = calculateMonthlyLaborCost({
          hours,
          annual_gross: r.annual_gross,
          category: r.category
        });
        if (cost > 0 || hours > 0) {
          const item = { name: r.name, hours, cost, category: r.category };
          if (r.category === 'consultant') consultant_labor.push(item);
          else internal_labor.push(item);
        }
      });

      const totalInternalLabor = internal_labor.reduce((sum, l) => sum + l.cost, 0);
      const totalConsultantLabor = consultant_labor.reduce((sum, l) => sum + l.cost, 0);

      // 4c. Monthly Overhead (General Costs)
      const settingsRes = await query(`SELECT key, value FROM settings WHERE key LIKE 'gc_%_' || $1`, [year]);
      const yearlyOverhead = settingsRes.rows.reduce((sum, r) => sum + (parseFloat(r.value) || 0), 0);
      const monthlyOverhead = yearlyOverhead / 12;

      // 5. Monthly Proforma (Pending payments)
      // 5. Monthly Proforma (Pending payments) - Detailed Breakdown
      const proformaRes = await query(`
        SELECT fp.amount, c.name as commessa_name, fl.attivita
        FROM fatturato_proforma fp
        JOIN fatturato_lines fl ON fp.fatturato_line_id = fl.id
        JOIN commessa_clients cc ON fl.commessa_client_id = cc.id
        JOIN commesse c ON cc.commessa_id = c.id
        WHERE fp.date >= $1 AND fp.date <= $2
      `, [monthStart, monthEnd]);

      const proformaDetails = proformaRes.rows.map(r => ({
        name: `${r.commessa_name}: ${r.attivita}`,
        amount: parseFloat(r.amount || 0)
      })).sort((a, b) => b.amount - a.amount);

      const totalProforma = proformaDetails.reduce((sum, p) => sum + p.amount, 0);

      // 5b. Extra Costs for the month
      const extraCostsRes = await query(`
        SELECT SUM(amount) as total_extra
        FROM employee_extra_costs
        WHERE date >= $1 AND date <= $2
      `, [monthStart, monthEnd]);
      const totalExtraCosts = parseFloat(extraCostsRes.rows[0].total_extra || 0);

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
        WHERE (e.is_active = TRUE OR active_emp.employee_id IS NOT NULL)
      `, [monthStart, monthEnd]);

      const totalEmpRes = await query("SELECT COUNT(*) as count FROM employees WHERE is_active = TRUE");

      // 6. Cost Trend: 5 months centered
      const costTrend = [];
      for (let i = -2; i <= 2; i++) {
        const d = new Date(year, month - 1 + i, 1);
        const ty = d.getFullYear();
        const tm = d.getMonth() + 1;
        const tmStart = `${ty}-${String(tm).padStart(2, '0')}-01`;
        const tmEnd = new Date(ty, tm, 0).toISOString().slice(0, 10);

        // Labor
        const lRes = await query(`
          SELECT e.category, e.hr_details, COALESCE(wh_sum.hours, 0) as hours,
                 COALESCE(
                   (SELECT ec.annual_gross FROM employee_costs ec WHERE ec.employee_id = e.id AND ec.valid_from <= $3 ORDER BY ec.valid_from DESC LIMIT 1),
                   (SELECT ec.annual_gross FROM employee_costs ec WHERE ec.employee_id = e.id ORDER BY ec.valid_from ASC LIMIT 1)
                 ) as annual_gross
          FROM employees e
          LEFT JOIN (
            SELECT employee_id, SUM(hours) as hours
            FROM employee_work_hours
            WHERE EXTRACT(YEAR FROM date) = $1 AND EXTRACT(MONTH FROM date) = $2
            GROUP BY employee_id
          ) wh_sum ON e.id = wh_sum.employee_id
          WHERE (e.is_active = TRUE 
             OR EXISTS (SELECT 1 FROM employee_work_hours wh WHERE wh.employee_id = e.id AND EXTRACT(YEAR FROM wh.date) = $1)
             OR (e.category = 'consultant' AND (e.hr_details->>'inizio_lavoro') IS NOT NULL))
        `, [ty, tm, tmEnd]);

        const mLabor = lRes.rows.reduce((sum, r) => {
            if (r.category === 'consultant') {
              const hr = r.hr_details || {};
              const startStr = hr.inizio_lavoro;
              const endStr = hr.scadenza_contratto;
              
              if (!startStr && !endStr) {
                if (!r.is_active && r.hours <= 0) return sum;
              } else {
                const monthStartObj = new Date(ty, tm - 1, 1);
                const monthEndObj = new Date(ty, tm, 0);

                if (startStr && new Date(startStr) > monthEndObj) return sum;
                if (endStr && new Date(endStr) < monthStartObj) return sum;
              }
            }

          return sum + calculateMonthlyLaborCost({
            hours: r.hours,
            annual_gross: r.annual_gross,
            category: r.category
          });
        }, 0);

        // Overhead
        const sRes = await query(`SELECT value FROM settings WHERE key LIKE 'gc_%_' || $1`, [ty]);
        const yOver = sRes.rows.reduce((sum, r) => sum + (parseFloat(r.value) || 0), 0);
        const mOver = yOver / 12;

        // Extra Costs
        const eRes = await query(`
          SELECT SUM(amount) as total
          FROM employee_extra_costs
          WHERE date >= $1 AND date <= $2
        `, [tmStart, tmEnd]);
        const mExtra = parseFloat(eRes.rows[0].total || 0);

        costTrend.push({
          month: d.toLocaleString('en-US', { month: 'short' }),
          labor: Math.round(mLabor),
          overhead: Math.round(mOver),
          extraCosts: Math.round(mExtra),
          total: Math.round(mLabor + mOver + mExtra)
        });
      }

      // 7. Proforma Trend: 5 months centered
      const proformaTrend = [];
      for (let i = -2; i <= 2; i++) {
        const d = new Date(year, month - 1 + i, 1);
        const ty = d.getFullYear();
        const tm = d.getMonth() + 1;
        const tmStart = `${ty}-${String(tm).padStart(2, '0')}-01`;
        const tmEnd = new Date(ty, tm, 0).toISOString().slice(0, 10);

        const pRes = await query(`
          SELECT SUM(amount) as total 
          FROM fatturato_proforma 
          WHERE date >= $1 AND date <= $2
        `, [tmStart, tmEnd]);

        proformaTrend.push({
          month: d.toLocaleString('en-US', { month: 'short' }),
          total: Math.round(parseFloat(pRes.rows[0].total || 0))
        });
      }

      // 8. SAL Trend: 5 months centered
      const salTrend = [];
      for (let i = -2; i <= 2; i++) {
        const d = new Date(year, month - 1 + i, 1);
        const ty = d.getFullYear();
        const tm = d.getMonth() + 1;
        
        const sRes = await query(`
          SELECT status, SUM(value) as total
          FROM fatturato_sal
          WHERE year = $1 AND month = $2
          GROUP BY status
        `, [ty, tm]);

        let inProgress = 0;
        let sbloccato = 0;
        sRes.rows.forEach(r => {
          if (r.status === 'in_progress') inProgress = parseFloat(r.total || 0);
          else if (r.status === 'sbloccato') sbloccato = parseFloat(r.total || 0);
        });

        salTrend.push({
          month: d.toLocaleString('en-US', { month: 'short' }),
          year: ty,
          in_progress: inProgress,
          sbloccato: sbloccato,
          net: inProgress - sbloccato
        });
      }

      const summary = {
        total: monthTotalTasks,
        working_employees_res: `${teamRes.rows[0].active_count} / ${totalEmpRes.rows[0].count}`,
        completed_month: monthTotalTasks > 0 ? `${((completedMonthCount / monthTotalTasks) * 100).toFixed(1)}%` : "0%",
        overdue,
        monthly_revenue: monthlyRevenue,
        total_proforma: totalProforma,
        proforma_details: proformaDetails,
        total_extra_costs: totalExtraCosts,
        completed_count: completedMonthCount,
        forecast,
        labor_costs: internal_labor,
        consultant_costs: consultant_labor,
        total_labor_cost: totalInternalLabor,
        total_consultant_labor: totalConsultantLabor,
        monthly_overhead: monthlyOverhead,
        realized_details: billedRes.rows,
        sal_trend: salTrend
      };

      res.json({
        summary,
        by_status,
        trend: costTrend,
        proforma_trend: proformaTrend,
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
