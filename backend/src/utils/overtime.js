/**
 * Calculates and updates monthly overtime for a specific employee.
 * Rules:
 * - Weekend (Sat=6, Sun=0): all hours are overtime
 * - Weekday: hours > 8 are overtime
 */
async function updateMonthlyOvertime(query, employeeId, year, month) {
  try {
    // 1. Calculate daily totals and then sum up the overtimes
    const calcResult = await query(`
      SELECT SUM(daily_overtime) as total_overtime
      FROM (
        SELECT 
          date,
          SUM(hours) as daily_total,
          CASE 
            WHEN EXTRACT(DOW FROM date) IN (5, 6) THEN SUM(hours)
            ELSE GREATEST(0, SUM(hours) - 8)
          END as daily_overtime
        FROM employee_work_hours
        WHERE employee_id = $1 
          AND EXTRACT(YEAR FROM date) = $2 
          AND EXTRACT(MONTH FROM date) = $3
        GROUP BY date
      ) sub
    `, [employeeId, year, month]);

    const totalOvertime = parseFloat(calcResult.rows[0].total_overtime) || 0;

    // 2. Upsert into employee_overtime_costs
    await query(`
      INSERT INTO employee_overtime_costs (employee_id, year, month, hours)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (employee_id, year, month) 
      DO UPDATE SET hours = EXCLUDED.hours
    `, [employeeId, year, month, totalOvertime]);

    return totalOvertime;
  } catch (err) {
    console.error("updateMonthlyOvertime error:", err);
    throw err;
  }
}

module.exports = {
  updateMonthlyOvertime
};
