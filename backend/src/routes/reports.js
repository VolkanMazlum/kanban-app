const express = require('express');
const ExcelJS = require('exceljs');
const { query } = require('../config/db');
const { authenticateHR } = require('../middleware/auth');

const router = express.Router();

/**
 * Helper to setup workbook and send response
 */
async function sendWorkbook(res, workbook, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}

/**
 * EXPORT TASKS
 * Visible to all authenticated users
 */
router.get('/tasks', async (req, res) => {
  try {
    const result = await query(`
      SELECT t.*, 
             e.name as employee_name,
             array_agg(ta.employee_id) as assignee_ids
      FROM tasks t
      LEFT JOIN task_assignees ta ON t.id = ta.task_id
      LEFT JOIN employees e ON ta.employee_id = e.id
      GROUP BY t.id, e.name
      ORDER BY t.created_at DESC
    `);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Tasks Board');

    sheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Title', key: 'title', width: 30 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Type', key: 'label', width: 20 },
      { header: 'Estimated Hours', key: 'estimated_hours', width: 15 },
      { header: 'Planned Start', key: 'planned_start', width: 15 },
      { header: 'Planned End', key: 'planned_end', width: 15 },
      { header: 'Deadline', key: 'deadline', width: 15 },
      { header: 'Created At', key: 'created_at', width: 20 },
    ];

    // Format headers
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };

    result.rows.forEach(t => {
      sheet.addRow({
        ...t,
        planned_start: t.planned_start ? t.planned_start.toISOString().split('T')[0] : '',
        planned_end: t.planned_end ? t.planned_end.toISOString().split('T')[0] : '',
        deadline: t.deadline ? t.deadline.toISOString().split('T')[0] : '',
        created_at: t.created_at ? t.created_at.toISOString() : ''
      });
    });

    await sendWorkbook(res, workbook, `Tasks_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (err) {
    console.error('Export tasks error:', err);
    res.status(500).json({ error: 'Failed to export tasks' });
  }
});

/**
 * EXPORT FINANCES
 * HR Only
 */
router.get('/finances', authenticateHR, async (req, res) => {
  const { year } = req.query;
  try {
    const result = await query(`
      SELECT 
        fr.id,
        fr.amount,
        fr.registration_date,
        fr.note,
        t.title as task_title,
        cl.name as client_name,
        fl.attivita as line_description,
        fl.valore_ordine
      FROM fatturato_realized fr
      JOIN fatturato_lines fl ON fr.fatturato_line_id = fl.id
      JOIN commessa_clients cc ON fl.commessa_client_id = cc.id
      LEFT JOIN clients cl ON cc.client_id = cl.id
      JOIN commesse c ON cc.commessa_id = c.id
      LEFT JOIN tasks t ON c.task_id = t.id
      WHERE $1 = 'all' OR EXTRACT(YEAR FROM fr.registration_date) = $1::int
      ORDER BY fr.registration_date DESC
    `, [year || 'all']);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Financial Report');

    sheet.columns = [
      { header: 'Date', key: 'registration_date', width: 15 },
      { header: 'Commessa (Task)', key: 'task_title', width: 30 },
      { header: 'Client', key: 'client_name', width: 25 },
      { header: 'Activity', key: 'line_description', width: 25 },
      { header: 'Amount (€)', key: 'amount', width: 15 },
      { header: '% of Activity', key: 'percentage', width: 15 },
      { header: 'Notes', key: 'notes', width: 40 },
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };

    let total = 0;
    result.rows.forEach(r => {
      const amount = parseFloat(r.amount) || 0;
      const totalVal = parseFloat(r.valore_ordine) || 0;
      const pct = totalVal > 0 ? ((amount / totalVal) * 100).toFixed(1) + '%' : '-';
      
      total += amount;
      sheet.addRow({
        ...r,
        registration_date: r.registration_date ? r.registration_date.toISOString().split('T')[0] : '',
        amount: amount,
        percentage: pct
      });
    });

    // Add total row
    const totalRow = sheet.addRow(['TOTAL', '', '', '', total, '', '']);
    totalRow.font = { bold: true };

    await sendWorkbook(res, workbook, `Finance_Report_${year || 'all'}.xlsx`);
  } catch (err) {
    console.error('Export finances error:', err);
    res.status(500).json({ error: 'Failed to export finances' });
  }
});

/**
 * EXPORT WORKLOAD
 * HR Only
 */
router.get('/workload', authenticateHR, async (req, res) => {
  const { year } = req.query;
  const targetYear = parseInt(year) || new Date().getFullYear();
  const { calculateMonthlyLaborCost } = require('../utils/finance');
  
  try {
    // 1. Get Workload Data
    const workloadRes = await query(`
      SELECT e.id as employee_id, e.name, e.position, pamh.month, SUM(pamh.hours) as monthly_total
      FROM employees e
      LEFT JOIN phase_assignee_monthly_hours pamh ON e.id = pamh.employee_id AND pamh.year = $1
      WHERE e.is_active = true
      GROUP BY e.id, e.name, e.position, pamh.month
      ORDER BY e.name, pamh.month
    `, [targetYear]);

    // 2. Get Revenue Data (Fatturato Taken)
    const revenueRes = await query(`
      SELECT EXTRACT(MONTH FROM registration_date) as month, SUM(amount) as total
      FROM fatturato_realized
      WHERE EXTRACT(YEAR FROM registration_date) = $1
      GROUP BY month
    `, [targetYear]);

    // 3. Get Labor Costs
    const laborRes = await query(`
      SELECT e.id, e.name, e.category, wh.month, wh.hours,
             (SELECT ec.annual_gross FROM employee_costs ec WHERE ec.employee_id = e.id AND ec.valid_from <= ($1 || '-' || LPAD(wh.month::text,2,'0') || '-28')::date ORDER BY ec.valid_from DESC LIMIT 1) as annual_gross
      FROM employees e
      JOIN (
        SELECT employee_id, EXTRACT(MONTH FROM date) as month, SUM(hours) as hours
        FROM employee_work_hours
        WHERE EXTRACT(YEAR FROM date) = $1
        GROUP BY employee_id, month
      ) wh ON e.id = wh.employee_id
    `, [targetYear]);

    // 4. Get Overhead
    const settingsRes = await query(`SELECT key, value FROM settings WHERE key LIKE 'gc_%_' || $1`, [targetYear]);
    const yearlyOverhead = settingsRes.rows.reduce((sum, r) => sum + (parseFloat(r.value) || 0), 0);
    const monthlyOverheadValue = yearlyOverhead / 12;

    const workbook = new ExcelJS.Workbook();
    const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // --- SHEET 1: WORKLOAD MATRIX ---
    const sheet1 = workbook.addWorksheet(`Workload ${targetYear}`);
    const columns1 = [{ header: 'Employee', key: 'name', width: 25 }, { header: 'Position', key: 'position', width: 20 }];
    MONTH_NAMES.forEach((m, i) => columns1.push({ header: m, key: `m${i+1}`, width: 10 }));
    columns1.push({ header: 'TOTAL', key: 'total', width: 12 });
    sheet1.columns = columns1;
    sheet1.getRow(1).font = { bold: true };
    sheet1.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };

    const empMap = {};
    workloadRes.rows.forEach(r => {
      if (!empMap[r.employee_id]) {
        empMap[r.employee_id] = { name: r.name, position: r.position, total: 0 };
        for(let i=1; i<=12; i++) empMap[r.employee_id][`m${i}`] = 0;
      }
      if (r.month) {
        const val = parseFloat(r.monthly_total) || 0;
        empMap[r.employee_id][`m${r.month}`] = val;
        empMap[r.employee_id].total += val;
      }
    });
    Object.values(empMap).forEach(emp => sheet1.addRow(emp));
    sheet1.getColumn('total').font = { bold: true };

    // --- SHEET 2: KPI TRENDS ---
    const sheet2 = workbook.addWorksheet(`Financial Trends ${targetYear}`);
    const columns2 = [{ header: 'Metric', key: 'metric', width: 30 }];
    MONTH_NAMES.forEach((m, i) => columns2.push({ header: m, key: `m${i+1}`, width: 12 }));
    columns2.push({ header: 'YEAR TOTAL', key: 'total', width: 15 });
    sheet2.columns = columns2;
    sheet2.getRow(1).font = { bold: true };
    sheet2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };

    const trends = {
      revenue: { metric: '🟢 Income (Taken)', total: 0 },
      labor: { metric: '🔴 Labor Cost', total: 0 },
      overhead: { metric: '🔘 Overhead', total: 0 },
      profit: { metric: '💰 NET PROFIT', total: 0 }
    };
    for(let i=1; i<=12; i++) {
      trends.revenue[`m${i}`] = 0; trends.labor[`m${i}`] = 0;
      trends.overhead[`m${i}`] = monthlyOverheadValue; trends.overhead.total += monthlyOverheadValue;
    }
    revenueRes.rows.forEach(r => {
      trends.revenue[`m${parseInt(r.month)}`] = parseFloat(r.total);
      trends.revenue.total += parseFloat(r.total);
    });
    laborRes.rows.forEach(r => {
      const cost = calculateMonthlyLaborCost({ hours: r.hours, annual_gross: r.annual_gross, category: r.category });
      trends.labor[`m${parseInt(r.month)}`] += cost;
      trends.labor.total += cost;
    });
    for(let i=1; i<=12; i++) {
      const m = `m${i}`;
      trends.profit[m] = trends.revenue[m] - trends.labor[m] - trends.overhead[m];
      trends.profit.total += trends.profit[m];
    }
    sheet2.addRow(trends.revenue);
    sheet2.addRow(trends.labor);
    sheet2.addRow(trends.overhead);
    const profRow = sheet2.addRow(trends.profit);
    profRow.font = { bold: true };

    // --- SHEET 3: REVENUE DETAILS ---
    const sheet3 = workbook.addWorksheet(`Revenue Details ${targetYear}`);
    sheet3.columns = [
      { header: 'Month', key: 'month_name', width: 12 },
      { header: 'Commessa (Task)', key: 'task_title', width: 30 },
      { header: 'Client', key: 'client_name', width: 25 },
      { header: 'Activity', key: 'line_description', width: 25 },
      { header: 'Amount (€)', key: 'amount', width: 15 },
    ];
    sheet3.getRow(1).font = { bold: true };
    sheet3.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };

    const revDetailsRes = await query(`
      SELECT EXTRACT(MONTH FROM fr.registration_date) as month, t.title as task_title, cl.name as client_name, fl.attivita as line_description, fr.amount
      FROM fatturato_realized fr
      JOIN fatturato_lines fl ON fr.fatturato_line_id = fl.id
      JOIN commessa_clients cc ON fl.commessa_client_id = cc.id
      LEFT JOIN clients cl ON cc.client_id = cl.id
      JOIN commesse c ON cc.commessa_id = c.id
      LEFT JOIN tasks t ON c.task_id = t.id
      WHERE EXTRACT(YEAR FROM fr.registration_date) = $1
      ORDER BY month, task_title
    `, [targetYear]);

    revDetailsRes.rows.forEach(r => {
      sheet3.addRow({ ...r, month_name: MONTH_NAMES[parseInt(r.month) - 1], amount: parseFloat(r.amount) });
    });

    // --- SHEET 4: LABOR DETAILS ---
    const sheet4 = workbook.addWorksheet(`Labor Details ${targetYear}`);
    sheet4.columns = [
      { header: 'Month', key: 'month_name', width: 12 },
      { header: 'Employee', key: 'name', width: 25 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Hours', key: 'hours', width: 10 },
      { header: 'Cost (€)', key: 'cost', width: 15 },
    ];
    sheet4.getRow(1).font = { bold: true };
    sheet4.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };

    laborRes.rows.sort((a,b) => a.month - b.month || a.name.localeCompare(b.name)).forEach(r => {
      const cost = calculateMonthlyLaborCost({ hours: r.hours, annual_gross: r.annual_gross, category: r.category });
      sheet4.addRow({ month_name: MONTH_NAMES[parseInt(r.month)-1], name: r.name, category: r.category, hours: parseFloat(r.hours), cost: Math.round(cost) });
    });

    await sendWorkbook(res, workbook, `Full_KPI_Dashboard_${targetYear}.xlsx`);
  } catch (err) {
    console.error('Export workload error:', err);
    res.status(500).json({ error: 'Failed to export workload' });
  }
});

module.exports = router;
