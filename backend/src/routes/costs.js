const { logAudit, getAuditContext } = require("../middleware/auditLog");
const { updateMonthlyOvertime } = require("../utils/overtime");

module.exports = (app, query, authenticate, authenticateHR) => {
  app.post("/api/work-hours", authenticate, async (req, res) => {
    const { employee_id, task_id, date, hours, note } = req.body;

    // Security check: Standard users can only log for themselves
    if (req.user.role !== 'hr' && parseInt(employee_id) !== req.user.employeeId) {
      return res.status(403).json({ error: "Access denied. You can only log hours for yourself." });
    }

    try {
      const result = await query(
        `INSERT INTO employee_work_hours (employee_id, task_id, date, hours, note)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (employee_id, task_id, date) DO UPDATE SET hours = $4, note = $5
         RETURNING *`,
        [employee_id, task_id, date, hours, note || null]
      );
      const savedLog = result.rows[0];
      const logDate = new Date(date);
      const year = logDate.getFullYear();
      const month = logDate.getMonth() + 1;

      // Recalculate monthly overtime automatically
      await updateMonthlyOvertime(query, employee_id, year, month);

      res.json(savedLog);
    } catch (err) {
      console.error("POST /api/work-hours error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  app.get("/api/work-hours/:employeeId", authenticate, async (req, res) => {
    const { year, month } = req.query;
    const requestedEmpId = parseInt(req.params.employeeId);

    // Security check: Standard users can only view their own hours
    if (req.user.role !== 'hr' && requestedEmpId !== req.user.employeeId) {
      return res.status(403).json({ error: "Access denied. You can only view your own hours." });
    }

    try {
      const result = await query(
        `SELECT * FROM employee_work_hours 
         WHERE employee_id = $1 AND EXTRACT(YEAR FROM date) = $2 AND EXTRACT(MONTH FROM date) = $3
         ORDER BY date`,
        [requestedEmpId, year, month]
      );
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Database error" }); }
  });

  // HR - Tüm çalışanların özeti (Yıla göre filtreli + 'hours' kullanılıyor + Tarih o yıla ait)
  app.get("/api/costs", authenticateHR, async (req, res) => {
    const isAllTime = req.query.year === 'all';
    const targetYear = isAllTime ? null : (parseInt(req.query.year) || new Date().getFullYear());

    try {
      const result = await query(`
        SELECT 
          e.id, e.name, e.category, e.hr_details,
          COALESCE(
            (SELECT ec.annual_gross FROM employee_costs ec WHERE ec.employee_id = e.id AND ($1::int IS NULL OR ec.valid_from <= MAKE_DATE($1::int, 12, 31)) ORDER BY ec.valid_from DESC LIMIT 1),
            (SELECT ec.annual_gross FROM employee_costs ec WHERE ec.employee_id = e.id ORDER BY ec.valid_from ASC LIMIT 1)
          ) AS current_annual_gross,
          COALESCE(
            (SELECT ec.valid_from::TEXT FROM employee_costs ec WHERE ec.employee_id = e.id AND ($1::int IS NULL OR ec.valid_from <= MAKE_DATE($1::int, 12, 31)) ORDER BY ec.valid_from DESC LIMIT 1),
            (SELECT ec.valid_from::TEXT FROM employee_costs ec WHERE ec.employee_id = e.id ORDER BY ec.valid_from ASC LIMIT 1)
          ) AS current_valid_from,
          COALESCE((SELECT SUM(wh.hours) FROM employee_work_hours wh WHERE wh.employee_id = e.id AND ($1::int IS NULL OR EXTRACT(YEAR FROM wh.date) = $1)), 0) AS logged_hours,
          COALESCE((SELECT SUM(hours) FROM employee_overtime_costs WHERE employee_id = e.id AND ($1::int IS NULL OR year = $1)), 0) AS overtime_hours,
          COALESCE((SELECT SUM(amount) FROM employee_extra_costs WHERE employee_id = e.id AND ($1::int IS NULL OR EXTRACT(YEAR FROM date) = $1)), 0) AS total_extra_costs,
          COALESCE((SELECT json_agg(json_build_object('id', ec.id, 'annual_gross', ec.annual_gross, 'valid_from', ec.valid_from::TEXT) ORDER BY ec.valid_from DESC) FROM employee_costs ec WHERE ec.employee_id = e.id), '[]') AS cost_history
        FROM employees e 
        WHERE e.is_active = TRUE
           OR EXISTS (SELECT 1 FROM employee_work_hours wh WHERE wh.employee_id = e.id AND ($1::int IS NULL OR EXTRACT(YEAR FROM wh.date) = $1))
        ORDER BY e.name
      `, [targetYear]);

      const THEORETICAL_HOURS_CONST = 2000;
      const employees = result.rows.map(e => {
        const gross = parseFloat(e.current_annual_gross);
        const loggedHours = parseFloat(e.logged_hours);
        const overtimeHours = parseFloat(e.overtime_hours);

        const hourlyRateBase = gross > 0 ? (gross / THEORETICAL_HOURS_CONST) : 0;
        const overtimeCost = overtimeHours * hourlyRateBase;

        const totalCost = gross + overtimeCost;
        const totalHours = loggedHours; // loggedHours already includes everything from the timesheet

        const dynamicRate = totalCost > 0 && totalHours > 0 ? (totalCost / totalHours).toFixed(2) : hourlyRateBase.toFixed(2);

        return {
          ...e,
          current_valid_from: e.current_valid_from, // Arayüz için o yıla ait geçerli tarih
          overtime_hours_this_year: overtimeHours,
          actual_hours_this_year: totalHours,
          hourly_rate_theoretical: hourlyRateBase.toFixed(2),
          hourly_rate_dynamic: dynamicRate,
        };
      });
      res.json(employees);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Database error" });
    }
  });

  app.post("/api/costs/:employeeId", authenticateHR, async (req, res) => {
    const { employeeId } = req.params;
    const { annual_gross, valid_from } = req.body;
    try {
      const result = await query(
        `INSERT INTO employee_costs (employee_id, annual_gross, valid_from) VALUES ($1, $2, $3) RETURNING *`,
        [employeeId, annual_gross, valid_from || new Date().toISOString().slice(0, 10)]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: "Database error" }); }
  });

  // Fazla mesaileri çekerken 'hours AS amount' yapıyoruz ki frontend sorunsuz okusun
  app.get("/api/costs/:employeeId/overtime", authenticateHR, async (req, res) => {
    const { employeeId } = req.params;
    const targetYear = parseInt(req.query.year) || new Date().getFullYear();
    try {
      const result = await query(`SELECT month, hours AS amount FROM employee_overtime_costs WHERE employee_id = $1 AND year = $2 ORDER BY month`, [employeeId, targetYear]);
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Database error" }); }
  });

  app.post("/api/costs/:employeeId/overtime", authenticateHR, async (req, res) => {
    const { employeeId } = req.params;
    const { year, month, amount, hours } = req.body;
    const valToSave = amount !== undefined ? amount : (hours || 0);
    try {
      const result = await query(
        `INSERT INTO employee_overtime_costs (employee_id, year, month, hours) VALUES ($1, $2, $3, $4)
         ON CONFLICT (employee_id, year, month) DO UPDATE SET hours = EXCLUDED.hours RETURNING *`,
        [employeeId, year, month, valToSave]
      );
      res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: "Database error" }); }
  });

  // --- EMPLOYEE EXTRA COSTS ---
  app.get("/api/costs/:employeeId/extra", authenticateHR, async (req, res) => {
    const { employeeId } = req.params;
    const { year } = req.query;
    try {
      const result = await query(
        `SELECT ec.*, t.title as task_title 
         FROM employee_extra_costs ec
         LEFT JOIN tasks t ON ec.task_id = t.id
         WHERE ec.employee_id = $1 AND ($2::int IS NULL OR EXTRACT(YEAR FROM ec.date) = $2)
         ORDER BY ec.date DESC`,
        [employeeId, (year && year !== 'all') ? parseInt(year) : null]
      );
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Database error" }); }
  });

  app.post("/api/costs/:employeeId/extra", authenticateHR, async (req, res) => {
    const { employeeId } = req.params;
    const { task_id, description, amount, date } = req.body;
    try {
      const result = await query(
        `INSERT INTO employee_extra_costs (employee_id, task_id, description, amount, date)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [employeeId, task_id, description, amount, date || new Date().toISOString().slice(0, 10)]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("POST /api/costs/extra error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  app.delete("/api/costs/extra/:id", authenticateHR, async (req, res) => {
    try {
      await query(`DELETE FROM employee_extra_costs WHERE id = $1`, [req.params.id]);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Database error" }); }
  });

  // --- PROJE / TASK FİNANSMANI (Yıl Aralıklarına Göre) ---
  app.get("/api/task-finances", authenticateHR, async (req, res) => {
    const isAllTime = req.query.year === 'all';
    const targetYear = isAllTime ? null : (parseInt(req.query.year) || new Date().getFullYear());
    const { startDate, endDate } = req.query;
    try {
      // 1. Calculate labor costs specifically for each task/date/employee
      // This matches the hours to the salary that was valid on the exact day the work was performed.
      const laborRes = await query(`
        SELECT 
          wh.task_id,
          SUM(wh.hours) as total_hours,
          SUM(
            CASE 
              WHEN e.category = 'internal' THEN
                wh.hours * COALESCE(
                  (SELECT ec.annual_gross 
                   FROM employee_costs ec 
                   WHERE ec.employee_id = wh.employee_id 
                     AND ec.valid_from <= wh.date 
                   ORDER BY ec.valid_from DESC 
                   LIMIT 1),
                  0
                ) / 2000.0
              ELSE 0
            END
          ) as internal_cost
        FROM employee_work_hours wh
        JOIN employees e ON wh.employee_id = e.id
        WHERE ($1::int IS NULL OR EXTRACT(YEAR FROM wh.date) = $1)
          AND ($2::date IS NULL OR wh.date >= $2::date)
          AND ($3::date IS NULL OR wh.date <= $3::date)
        GROUP BY wh.task_id
      `, [targetYear, startDate || null, endDate || null]);

      const taskCosts = {};
      laborRes.rows.forEach(row => {
        taskCosts[row.task_id] = {
          internal_cost: parseFloat(row.internal_cost) || 0,
          hours: parseFloat(row.total_hours) || 0
        };
      });

      // 5. Get Tasks (filtered by year)
      const tasksRes = await query(`
        SELECT 
          t.id, t.title, COALESCE(tr.revenue, 0) as revenue,
          c.id as comm_id, c.comm_number, c.name as comm_name
        FROM tasks t 
        LEFT JOIN task_revenues tr ON t.id = tr.task_id 
        LEFT JOIN commesse c ON t.id = c.task_id
        WHERE 
          $1::int IS NULL
          OR (c.comm_number LIKE RIGHT($1::text, 2) || '-%')
          OR EXISTS (
            SELECT 1 FROM employee_work_hours wh 
            WHERE wh.task_id = t.id AND EXTRACT(YEAR FROM wh.date) = $1
          )
          OR EXISTS (
            SELECT 1 FROM fatturato_realized fr
            JOIN fatturato_lines fl ON fr.fatturato_line_id = fl.id
            JOIN commessa_clients cc ON fl.commessa_client_id = cc.id
            WHERE cc.commessa_id = c.id AND EXTRACT(YEAR FROM fr.registration_date) = $1
          )
          OR EXISTS (
            SELECT 1 FROM employee_extra_costs eec
            WHERE eec.task_id = t.id AND EXTRACT(YEAR FROM eec.date) = $1
          )
        ORDER BY t.created_at DESC
      `, [targetYear]);

      const tasks = tasksRes.rows.map(t => ({
        ...t,
        internal_cost: taskCosts[t.id]?.internal_cost || 0,
        total_hours: taskCosts[t.id]?.hours || 0
      }));

      // For backward compatibility or extra details
      const hoursRes = await query(`
        SELECT task_id, employee_id, SUM(hours) as total_hours 
        FROM employee_work_hours 
        WHERE task_id IS NOT NULL AND ($1::int IS NULL OR EXTRACT(YEAR FROM date) = $1)
          AND ($2::date IS NULL OR date >= $2::date)
          AND ($3::date IS NULL OR date <= $3::date)
        GROUP BY task_id, employee_id
      `, [targetYear, startDate || null, endDate || null]);

      res.json({ tasks, task_hours: hoursRes.rows });
    } catch (err) {
      console.error("Task finances error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  app.post("/api/task-finances/:taskId", authenticateHR, async (req, res) => {
    const { taskId } = req.params;
    const { revenue } = req.body;
    try {
      const result = await query(
        `INSERT INTO task_revenues (task_id, revenue) VALUES ($1, $2) 
         ON CONFLICT (task_id) DO UPDATE SET revenue = EXCLUDED.revenue, updated_at = NOW() RETURNING *`,
        [taskId, revenue || 0]
      );
      res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: "Database error" }); }
  });
};
