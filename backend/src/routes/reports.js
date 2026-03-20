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
 * HR Only
 */
router.get('/tasks', authenticateHR, async (req, res) => {
  try {
    const result = await query(`
      SELECT t.id as task_id, t.title as task_title, t.status as task_status, t.label as task_type, 
             t.estimated_hours as task_total_hours, t.planned_start, t.planned_end, t.deadline,
             tp.name as phase_name, tp.status as phase_status, tp.estimated_hours as phase_total_hours,
             tp.start_date as phase_start, tp.end_date as phase_end,
             pa.estimated_hours as individual_hours,
             e.name as employee_name
      FROM tasks t
      LEFT JOIN task_phases tp ON t.id = tp.task_id
      LEFT JOIN phase_assignees pa ON tp.id = pa.phase_id
      LEFT JOIN employees e ON pa.employee_id = e.id
      WHERE t.status IN ('process', 'done')
      AND (tp.id IS NULL OR tp.status IN ('active', 'done'))
      ORDER BY t.created_at DESC, tp.id ASC, e.name ASC
    `);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Tabellone Task');

    sheet.columns = [
      { header: 'ID Task', key: 'task_id', width: 10 },
      { header: 'Titolo Task', key: 'task_title', width: 25 },
      { header: 'Collaboratore', key: 'employee_name', width: 20 },
      { header: 'Ore Previste (Indiv.)', key: 'individual_hours', width: 15 },
      { header: 'Nome Fase', key: 'phase_name', width: 25 },
      { header: 'Stato Fase', key: 'phase_status', width: 15 },
      { header: 'Ore Totali Fase', key: 'phase_total_hours', width: 15 },
      { header: 'Inizio Fase', key: 'phase_start', width: 15 },
      { header: 'Fine Fase', key: 'phase_end', width: 15 },
      { header: 'Ore Totali Task', key: 'task_total_hours', width: 15 },
      { header: 'Stato Task', key: 'task_status', width: 15 },
      { header: 'Scadenza Task', key: 'deadline', width: 15 },
    ];

    // Format headers
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };

    result.rows.forEach(t => {
      sheet.addRow({
        ...t,
        task_total_hours: t.task_total_hours ? Number(t.task_total_hours) : 0,
        phase_total_hours: t.phase_total_hours ? Number(t.phase_total_hours) : 0,
        individual_hours: t.individual_hours ? Number(t.individual_hours) : 0,
        phase_start: t.phase_start ? t.phase_start.toISOString().split('T')[0] : '-',
        phase_end: t.phase_end ? t.phase_end.toISOString().split('T')[0] : '-',
        planned_start: t.planned_start ? t.planned_start.toISOString().split('T')[0] : '',
        planned_end: t.planned_end ? t.planned_end.toISOString().split('T')[0] : '',
        deadline: t.deadline ? t.deadline.toISOString().split('T')[0] : '',
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
        fl.valore_ordine,
        fl.fatturato_amount as total_billed,
        fl.rimanente_probabile as remainder,
        fl.proforma
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
    const sheet = workbook.addWorksheet('Registro Pagamenti');

    sheet.columns = [
      { header: 'Data', key: 'registration_date', width: 15 },
      { header: 'Commessa (Task)', key: 'task_title', width: 30 },
      { header: 'Cliente', key: 'client_name', width: 25 },
      { header: 'Attività', key: 'line_description', width: 25 },
      { header: 'Pagamento (€)', key: 'amount', width: 15 },
      { header: 'Valore Ordine (€)', key: 'valore_ordine', width: 18 },
      { header: 'Totale Fatturato (€)', key: 'total_billed', width: 18 },
      { header: 'Rimanente Probabile (€)', key: 'remainder', width: 18 },
      { header: 'Proforma (€)', key: 'proforma', width: 15 },
      { header: '% su Ordine', key: 'percentage', width: 12 },
      { header: 'Note', key: 'notes', width: 40 },
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
        amount: Number(amount),
        valore_ordine: Number(r.valore_ordine || 0),
        total_billed: Number(r.total_billed || 0),
        remainder: Number(r.remainder || 0),
        proforma: Number(r.proforma || 0),
        percentage: pct,
        notes: r.note
      });
    });

    // Add total row (spanning numeric columns correctly)
    const totalRow = sheet.addRow(['TOTALE', '', '', '', Number(total)]);
    totalRow.font = { bold: true };

    // SHEET 2: CONTRACT DETAILS (Now filtered by year if provided)
    const sheet2 = workbook.addWorksheet('Dettagli Contrattuali');
    sheet2.columns = [
      { header: 'N. Commessa', key: 'comm_number', width: 12 },
      { header: 'Nome Progetto', key: 'comm_name', width: 25 },
      { header: 'Cliente', key: 'client_name', width: 25 },
      { header: 'N. Cliente', key: 'n_cliente', width: 15 },
      { header: 'Rif. Ordine', key: 'n_ordine', width: 20 },
      { header: 'Attività', key: 'attivita', width: 25 },
      { header: 'Valore Ordine (€)', key: 'valore_ordine', width: 18 },
      { header: 'Totale Fatturato (€)', key: 'fatturato_amount', width: 18 },
      { header: 'Rim. Probabile (€)', key: 'rimanente_probabile', width: 18 },
      { header: 'Proforma (€)', key: 'proforma', width: 15 },
      { header: 'Note', key: 'note', width: 30 },
    ];
    sheet2.getRow(1).font = { bold: true };
    sheet2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };

    const yearSuffix = (year && year !== 'all') ? year.toString().slice(-2) : null;

    const ordersRes = await query(`
      SELECT 
        c.comm_number, c.name as comm_name,
        cl.name as client_name,
        cc.n_cliente, cc.n_ordine,
        fl.attivita, fl.valore_ordine, fl.fatturato_amount, fl.rimanente_probabile, fl.proforma, fl.note
      FROM commesse c
      JOIN commessa_clients cc ON c.id = cc.commessa_id
      LEFT JOIN clients cl ON cc.client_id = cl.id
      JOIN fatturato_lines fl ON cc.id = fl.commessa_client_id
      LEFT JOIN tasks t ON c.task_id = t.id
      WHERE $1 = 'all' 
         OR (c.comm_number LIKE $2 || '-%' AND (
           EXISTS (SELECT 1 FROM fatturato_realized fr WHERE fr.fatturato_line_id = fl.id AND EXTRACT(YEAR FROM fr.registration_date) = $1::int)
           OR EXISTS (SELECT 1 FROM employee_work_hours wh WHERE wh.task_id = t.id AND EXTRACT(YEAR FROM wh.date) = $1::int)
         ))
      ORDER BY c.comm_number ASC, cc.n_cliente ASC, fl.id ASC
    `, [year || 'all', yearSuffix]);

    ordersRes.rows.forEach(r => {
      sheet2.addRow({
        ...r,
        valore_ordine: Number(r.valore_ordine || 0),
        fatturato_amount: Number(r.fatturato_amount || 0),
        rimanente_probabile: Number(r.rimanente_probabile || 0),
        proforma: Number(r.proforma || 0)
      });
    });

    // --- ADDED: SHEET 3: REDDITIVITÀ PROGETTI (Revenue vs Cost) ---
    const sheet3 = workbook.addWorksheet('Redditività Progetti');
    sheet3.columns = [
      { header: 'Anno', key: 'year', width: 10 },
      { header: 'N. Commessa', key: 'comm_number', width: 15 },
      { header: 'Nome Progetto', key: 'name', width: 30 },
      { header: 'Ricavi (€)', key: 'total_rev', width: 18 },
      { header: 'Costo Lavoro (Int)', key: 'total_cost', width: 18 },
      { header: 'Utile Lordo (€)', key: 'profit', width: 18 },
      { header: 'Margine (%)', key: 'margin', width: 12 },
    ];
    sheet3.getRow(1).font = { bold: true };
    sheet3.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };

    // 1. Get Revenue Breakdown by Year/Commessa
    const revenueDetails = await query(`
      SELECT 
        LEFT(c.comm_number, 2) as year_prefix,
        c.id as comm_id,
        SUM(fr.amount) as amount
      FROM fatturato_realized fr
      JOIN fatturato_lines fl ON fr.fatturato_line_id = fl.id
      JOIN commessa_clients cc ON fl.commessa_client_id = cc.id
      JOIN commesse c ON cc.commessa_id = c.id
      GROUP BY year_prefix, c.id
    `);

    // 2. Comprehensive Labor & Employee Cost Logic
    // We need: total hours per month, hours per month/project, and EVERY employee's gross.
    const allEmployeesCost = await query(`
      SELECT e.id, e.name, e.category, e.hr_details, ec.annual_gross, 
             EXTRACT(YEAR FROM ec.valid_from)::int as start_year,
             EXTRACT(MONTH FROM ec.valid_from)::int as start_month
      FROM employees e
      JOIN employee_costs ec ON e.id = ec.employee_id
    `);

    const laborSplit = await query(`
      SELECT 
        LEFT(c.comm_number, 2) as year_prefix,
        EXTRACT(MONTH FROM wh.date)::int as month,
        c.id as comm_id,
        wh.employee_id,
        SUM(wh.hours) as project_hours
      FROM employee_work_hours wh
      JOIN tasks t ON wh.task_id = t.id
      JOIN commesse c ON t.id = c.task_id
      GROUP BY year_prefix, month, c.id, wh.employee_id
    `);

    const employeeMonthlyTotals = await query(`
      SELECT employee_id, EXTRACT(YEAR FROM date)::int as year, EXTRACT(MONTH FROM date)::int as month, SUM(hours) as total_hours
      FROM employee_work_hours
      GROUP BY employee_id, year, month
    `);

    // 3. Structured Data Processing
    const yearlyMap = {}; 
    
    // Discover all available years from commessa prefixes
    const prefixes = new Set([
      ...revenueDetails.rows.map(r => r.year_prefix),
      ...laborSplit.rows.map(l => l.year_prefix)
    ]);
    const availableYears = Array.from(prefixes)
      .filter(p => p && !isNaN(parseInt(p)))
      .map(p => 2000 + parseInt(p))
      .sort((a,b) => b-a);

    const targetYears = (year && year !== 'all') ? [parseInt(year)] : availableYears;
    
    const commsResult = await query(`SELECT id, comm_number, name FROM commesse`);
    const commInfo = {};
    commsResult.rows.forEach(c => commInfo[c.id] = c);
    
    targetYears.forEach(y => {
      yearlyMap[y] = { projects: {}, totalCompanyLabor: 0, revenue: 0, directLaborAttr: 0, totalConsultantCost: 0 };
    });

    revenueDetails.rows.forEach(r => {
      const fullYear = 2000 + parseInt(r.year_prefix);
      if (yearlyMap[fullYear]) {
        yearlyMap[fullYear].revenue += parseFloat(r.amount);
        if (!yearlyMap[fullYear].projects[r.comm_id]) yearlyMap[fullYear].projects[r.comm_id] = { rev: 0, cost: 0, consultant_cost: 0 };
        yearlyMap[fullYear].projects[r.comm_id].rev += parseFloat(r.amount);
      }
    });

    // A. Fill Revenue
    revenueDetails.rows.forEach(r => {
      if (yearlyMap[r.year]) {
        if (!yearlyMap[r.year].projects[r.comm_id]) yearlyMap[r.year].projects[r.comm_id] = { rev: 0, cost: 0, consultant_cost: 0 };
        yearlyMap[r.year].projects[r.comm_id].rev += parseFloat(r.amount);
        yearlyMap[r.year].revenue += parseFloat(r.amount);
      }
    });

    // B. Calculate Total Potential Company Cost for each year
    // We'll iterate months 1-12 for each target year
    for (const y of targetYears) {
      for (let m = 1; m <= 12; m++) {
        allEmployeesCost.rows.forEach(emp => {
          // Find the latest annual_gross for this employee valid at (y-m-28)
          const allForEmp = allEmployeesCost.rows.filter(c => c.id === emp.id);
          const validCosts = allForEmp
            .filter(c => (c.start_year < y) || (c.start_year === y && c.start_month <= m))
            .sort((a,b) => (b.start_year - a.start_year) || (b.start_month - a.start_month));
          
          let currentGross = 0;
          if (validCosts.length > 0) {
            currentGross = parseFloat(validCosts[0].annual_gross);
          } else if (allForEmp.length > 0) {
            // Fallback: Use the earliest available cost record if none exist for the period
            const earliest = [...allForEmp].sort((a,b) => (a.start_year - b.start_year) || (a.start_month - b.start_month))[0];
            currentGross = parseFloat(earliest.annual_gross);
          }

          if (currentGross > 0) {
              const workedInYear = employeeMonthlyTotals.rows.some(et => et.employee_id === emp.id && et.year === y);
              const monthLog = employeeMonthlyTotals.rows.find(et => et.employee_id === emp.id && et.year === y && et.month === m);
              if (emp.category === 'consultant') {
                // If we haven't processed this consultant for year 'y' yet, check eligibility for the WHOLE year
                if (m === 1) { // We only need to do this once per consultant per year
                  const hr = emp.hr_details || {};
                  const startStr = hr.inizio_lavoro;
                  const endStr = hr.scadenza_contratto;
                  let isEligibleForYear = true;

                  const startYear = startStr ? new Date(startStr).getFullYear() : -Infinity;
                  const endYear = endStr ? new Date(endStr).getFullYear() : Infinity;

                  if (y < startYear || y > endYear) {
                    isEligibleForYear = false;
                  }

                  if (isEligibleForYear) {
                    // For consultants, we add the full annual gross once per year 
                    // (since the user said "it is given once, just add it to that year if they worked in it")
                    yearlyMap[y].totalConsultantCost += currentGross;
                  }
                }
              } else if (monthLog) {
                yearlyMap[y].totalCompanyLabor += (parseFloat(monthLog.total_hours) * currentGross / 2000);
              }
          }
        });
      }
    }

    laborSplit.rows.forEach(l => {
      const fullYear = 2000 + parseInt(l.year_prefix);
      if (yearlyMap[fullYear]) {
        if (!yearlyMap[fullYear].projects[l.comm_id]) yearlyMap[fullYear].projects[l.comm_id] = { rev: 0, cost: 0, consultant_cost: 0 };
        
        // Find employee cost (Theoretical for this bucket year)
        const emp = allEmployeesCost.rows.find(e => e.id === l.employee_id);
        const validCosts = allEmployeesCost.rows
          .filter(c => c.id === l.employee_id)
          .filter(c => (c.start_year < fullYear) || (c.start_year === fullYear && c.start_month <= l.month))
          .sort((a,b) => (b.start_year - a.start_year) || (b.start_month - a.start_month));
        
        if (validCosts.length > 0 && emp) {
          const gross = parseFloat(validCosts[0].annual_gross);
          const projectHours = parseFloat(l.project_hours);
          
          if (emp.category === 'internal') {
            const cost = projectHours * (gross / 2000);
            yearlyMap[fullYear].projects[l.comm_id].cost += cost;
            yearlyMap[fullYear].directLaborAttr += cost;
          }
        }
      }
    });

    // 4. Render Sheet
    for (const y of targetYears) {
      const ySuffix = y.toString().slice(-2);
      sheet3.addRow([`--- ANNO ${y} ---`]).font = { bold: true };
      
      const projects = yearlyMap[y].projects;
      const sortedIds = Object.keys(projects).sort((a,b) => (commInfo[a]?.comm_number || '').localeCompare(commInfo[b]?.comm_number || ''));

      sortedIds.forEach(cid => {
        const info = commInfo[cid];
        if (!info || !info.comm_number.startsWith(ySuffix + '-')) return;
        
        const p = projects[cid];
        const profit = p.rev - p.cost;
        const margin = p.rev > 0 ? (profit / p.rev * 100).toFixed(1) + '%' : '-';

        sheet3.addRow({
          year: y,
          comm_number: info.comm_number,
          name: info.name,
          total_rev: Number(p.rev.toFixed(2)),
          total_cost: Number(p.cost.toFixed(2)),
          profit: Number(profit.toFixed(2)),
          margin: margin
        });
      });

      // Overall calculations for the year
      const settingsRes = await query(`SELECT key, value FROM settings WHERE key LIKE 'gc_%_' || $1`, [y]);
      const overheadGC = settingsRes.rows.reduce((sum, r) => sum + (parseFloat(r.value) || 0), 0);
      
      const grossProfit = yearlyMap[y].revenue - yearlyMap[y].directLaborAttr;
      const netProfit = grossProfit - yearlyMap[y].totalConsultantCost - overheadGC; // Include consultant cost here

      sheet3.addRow([]);
      
      const sub1 = sheet3.addRow({ name: `TOTALE RICAVI ${y}`, total_rev: Number(yearlyMap[y].revenue.toFixed(2)) });
      sub1.font = { bold: true };
      
      const sub2 = sheet3.addRow({ name: `TOTALE COSTO LAVORO DIRETTO ${y}`, total_rev: Number(yearlyMap[y].directLaborAttr.toFixed(2)) });
      sub2.font = { bold: true };

      const sub3 = sheet3.addRow({ name: `UTILE LORDO PROGETTI ${y}`, total_rev: Number(grossProfit.toFixed(2)) });
      sub3.font = { bold: true, color: { argb: 'FF059669' } };

      const sub5 = sheet3.addRow({ name: `COSTO CONSULENTI ${y}`, total_rev: Number(yearlyMap[y].totalConsultantCost.toFixed(2)) });
      sub5.font = { italic: true, color: { argb: 'FFFF0000' } };

      const sub6 = sheet3.addRow({ name: `SPESE GENERALI (GC) ${y}`, total_rev: Number(overheadGC.toFixed(2)) });
      sub6.font = { italic: true };

      const sub7 = sheet3.addRow({ name: `UTILE NETTO TOTALE ${y}`, total_rev: Number(netProfit.toFixed(2)) });
      sub7.font = { bold: true, size: 12, color: { argb: 'FF2563EB' } };
      
      sheet3.addRow([]);
    }

    await sendWorkbook(res, workbook, `Rapporto_Finanziario_Completo_${year || 'Tutti'}_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (err) {
    console.error('Export finances error:', err);
    res.status(500).json({ error: 'Errore durante l\'esportazione dei dati finanziari' });
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
      WHERE (e.is_active = TRUE OR pamh.employee_id IS NOT NULL)
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
    const sheet1 = workbook.addWorksheet(`Carico Lavoro ${targetYear}`);
    const columns1 = [{ header: 'Collaboratore', key: 'name', width: 25 }, { header: 'Posizione', key: 'position', width: 20 }];
    MONTH_NAMES.forEach((m, i) => columns1.push({ header: m, key: `m${i+1}`, width: 10 }));
    columns1.push({ header: 'TOTALE', key: 'total', width: 12 });
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
    const sheet2 = workbook.addWorksheet(`Andamento Finanziario ${targetYear}`);
    const columns2 = [{ header: 'Metrica', key: 'metric', width: 30 }];
    MONTH_NAMES.forEach((m, i) => columns2.push({ header: m, key: `m${i+1}`, width: 12 }));
    columns2.push({ header: 'TOTALE ANNUO', key: 'total', width: 15 });
    sheet2.columns = columns2;
    sheet2.getRow(1).font = { bold: true };
    sheet2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };

    const trends = {
      revenue: { metric: '🟢 Ricavi (Incassati)', total: 0 },
      internal_labor: { metric: '🔴 Costo Lavoro Interno', total: 0 },
      consultant_labor: { metric: '🔴 Costo Consulenti', total: 0 },
      overhead: { metric: '🔘 Spese Generali', total: 0 },
      profit: { metric: '💰 UTILE NETTO', total: 0 }
    };
    for(let i=1; i<=12; i++) {
      trends.revenue[`m${i}`] = 0; trends.internal_labor[`m${i}`] = 0; trends.consultant_labor[`m${i}`] = 0;
      trends.overhead[`m${i}`] = monthlyOverheadValue; trends.overhead.total += monthlyOverheadValue;
    }
    revenueRes.rows.forEach(r => {
      trends.revenue[`m${parseInt(r.month)}`] = parseFloat(r.total);
      trends.revenue.total += parseFloat(r.total);
    });
    laborRes.rows.forEach(r => {
      const cost = calculateMonthlyLaborCost({ hours: r.hours, annual_gross: r.annual_gross, category: r.category });
      if (r.category === 'consultant') {
        trends.consultant_labor[`m${parseInt(r.month)}`] += cost;
        trends.consultant_labor.total += cost;
      } else {
        trends.internal_labor[`m${parseInt(r.month)}`] += cost;
        trends.internal_labor.total += cost;
      }
    });
    for(let i=1; i<=12; i++) {
      const m = `m${i}`;
      trends.profit[m] = trends.revenue[m] - trends.internal_labor[m] - trends.consultant_labor[m] - trends.overhead[m];
      trends.profit.total += trends.profit[m];
    }
    sheet2.addRow(trends.revenue);
    sheet2.addRow(trends.internal_labor);
    sheet2.addRow(trends.consultant_labor);
    sheet2.addRow(trends.overhead);
    const profRow = sheet2.addRow(trends.profit);
    profRow.font = { bold: true };

    // --- SHEET 3: REVENUE DETAILS ---
    const sheet3 = workbook.addWorksheet(`Dettaglio Ricavi ${targetYear}`);
    sheet3.columns = [
      { header: 'Mese', key: 'month_name', width: 12 },
      { header: 'Commessa (Task)', key: 'task_title', width: 30 },
      { header: 'Cliente', key: 'client_name', width: 25 },
      { header: 'Attività', key: 'line_description', width: 25 },
      { header: 'Importo (€)', key: 'amount', width: 15 },
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
    const sheet4 = workbook.addWorksheet(`Dettaglio Costo Lavoro ${targetYear}`);
    sheet4.columns = [
      { header: 'Mese', key: 'month_name', width: 12 },
      { header: 'Collaboratore', key: 'name', width: 25 },
      { header: 'Categoria', key: 'category', width: 15 },
      { header: 'Ore', key: 'hours', width: 10 },
      { header: 'Costo (€)', key: 'cost', width: 15 },
    ];
    sheet4.getRow(1).font = { bold: true };
    sheet4.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };

    laborRes.rows.sort((a,b) => a.month - b.month || a.name.localeCompare(b.name)).forEach(r => {
      const hours = Number(r.hours || 0);
      const cost = calculateMonthlyLaborCost({ hours, annual_gross: Number(r.annual_gross || 0), category: r.category });
      sheet4.addRow({ 
        month_name: MONTH_NAMES[parseInt(r.month)-1], 
        name: r.name, 
        category: r.category, 
        hours: hours, 
        cost: Math.round(cost) 
      });
    });

    await sendWorkbook(res, workbook, `Full_KPI_Dashboard_${targetYear}.xlsx`);
  } catch (err) {
    console.error('Export workload error:', err);
    res.status(500).json({ error: 'Failed to export workload' });
  }
});

/**
 * EXPORT EMPLOYEES (Extended HR Data)
 * HR Only
 */
router.get('/employees', authenticateHR, async (req, res) => {
  try {
    const result = await query(`
      SELECT e.*, u.username, u.role
      FROM employees e
      LEFT JOIN users u ON e.id = u.employee_id
      ORDER BY e.name ASC
    `);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Anagrafica HR');

    // 1. Fixed Base Columns
    const cols = [
      { header: 'Nome e Cognome', key: 'name', width: 25 },
      { header: 'Username', key: 'username', width: 25 },
      { header: 'Ruolo', key: 'role', width: 12 },
      { header: 'Posizione', key: 'position', width: 20 },
      { header: 'Categoria', key: 'category', width: 15 },
      { header: 'Stato', key: 'is_active', width: 12 },
      // Personal
      { header: 'Sesso', key: 'sesso', width: 8 },
      { header: 'Data Nascita', key: 'data_nascita', width: 15 },
      { header: 'Luogo Nascita', key: 'luogo_nascita', width: 20 },
      { header: 'Età', key: 'eta', width: 8 },
      { header: 'Residenza', key: 'residenza', width: 25 },
      { header: 'Codice Fiscale', key: 'cf', width: 20 },
      // Pro / Inquadramento
      { header: 'Inizio Lavoro', key: 'inizio_lavoro', width: 15 },
      { header: 'Anni Exp', key: 'anni_exp', width: 10 },
      { header: 'Qualifica', key: 'qualifica', width: 20 },
      { header: 'Ordine', key: 'ordine', width: 15 },
      { header: 'Data Abilitazione', key: 'data_abilitazione', width: 15 },
      { header: 'Posizione (Inq.)', key: 'posizione_inq', width: 20 },
      { header: 'Assunzione', key: 'assunzione', width: 15 },
      { header: 'Livello', key: 'livello', width: 12 },
      { header: 'Contratto', key: 'contratto', width: 20 },
      { header: 'Scadenza Contratto', key: 'scadenza_contratto', width: 15 },
      { header: 'Team', key: 'team', width: 15 },
      { header: 'Disciplina', key: 'disciplina', width: 15 },
      { header: 'Presenza (%)', key: 'presenza', width: 12 },
      { header: 'Smart Working', key: 'smart_working', width: 15 },
      // Finance
      { header: 'RAL (€)', key: 'ral', width: 12 },
      { header: 'Lordo Azienda', key: 'lordo_azienda', width: 15 },
      { header: 'Una Tantum', key: 'una_tantum', width: 15 },
      { header: 'Auto', key: 'auto', width: 15 },
      { header: 'Carta Carburante', key: 'carburante', width: 15 },
      { header: 'Welfare', key: 'welfare', width: 15 },
      { header: 'Buoni Pasto', key: 'buoni_pasto', width: 15 },
      { header: 'Totale Annuo Lordo', key: 'totale_annuo', width: 18 },
      // Safety
      { header: 'Corsi Sicurezza', key: 'corsi_sic', width: 25 },
      { header: 'Scadenza Corsi', key: 'scadenza_corsi', width: 15 },
      { header: 'Visita Medica', key: 'visita_medica', width: 25 },
      { header: 'Scadenza Visita', key: 'scadenza_visita', width: 15 },
    ];

    // 2. Discover Training Years only (Languages are now fixed list too)
    const trainingYears = new Set();
    const fixedLangs = ["Italiano", "Inglese", "Francese", "Spagnolo", "Tedesco", "Portoghese", "Arabo", "Russo", "Turco", "Persiano"];
    
    result.rows.forEach(r => {
      const hr = r.hr_details || {};
      Object.keys(hr).forEach(k => {
        if (k.startsWith('form_')) trainingYears.add(k.replace('form_', ''));
      });
    });

    const sortedYears = Array.from(trainingYears).sort();

    // Add Languages to cols
    fixedLangs.forEach(l => {
      cols.push({ header: `Lingua: ${l}`, key: `lang_${l}`, width: 15 });
    });

    // Add Training to cols
    sortedYears.forEach(y => {
      cols.push({ header: `Formazione ${y}`, key: `form_${y}`, width: 25 });
    });

    sheet.columns = cols;
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };

    result.rows.forEach(r => {
      const hr = r.hr_details || {};
      const rowData = {
        name: r.name,
        username: r.username,
        role: r.role,
        position: r.position,
        category: r.category,
        is_active: r.is_active ? 'Active' : 'Disabled',
        ...hr,
        ral: hr.ral ? Number(hr.ral) : 0,
        lordo_azienda: hr.lordo_azienda ? Number(hr.lordo_azienda) : 0,
        totale_annuo: hr.totale_annuo ? Number(hr.totale_annuo) : 0,
        presenza: hr.presenza ? Number(hr.presenza) : 0,
      };
      
      sheet.addRow(rowData);
    });

    await sendWorkbook(res, workbook, `Employee_HR_Data_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (err) {
    console.error('Export employees error:', err);
    res.status(500).json({ error: 'Failed to export employee data' });
  }
});

/**
 * EXPORT CLIENTS
 * HR Only
 */
router.get('/clients', authenticateHR, async (req, res) => {
  try {
    const result = await query(`SELECT * FROM clients ORDER BY name ASC`);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Lista Clienti');

    sheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Nome Cliente', key: 'name', width: 25 },
      { header: 'Ragione Sociale', key: 'ragione_sociale', width: 30 },
      { header: 'P. IVA', key: 'vat_number', width: 20 },
      { header: 'Codice Fiscale', key: 'codice_fiscale', width: 20 },
      { header: 'Codice SDI', key: 'codice_univoco', width: 15 },
      { header: 'ATECO', key: 'codice_ateco', width: 15 },
      { header: 'Inarcassa', key: 'codice_inarcassa', width: 15 },
      { header: 'Email Contatto', key: 'contact_email', width: 25 },
      { header: 'Telefono', key: 'phone', width: 15 },
      { header: 'Fax', key: 'fax', width: 15 },
      { header: 'Indirizzo', key: 'address', width: 30 },
      { header: 'Località', key: 'localita', width: 20 },
      { header: 'CAP', key: 'cap', width: 10 },
      { header: 'Provincia', key: 'province', width: 15 },
      { header: 'Stato', key: 'stato', width: 15 },
      { header: 'Contabilità (Rif)', key: 'contabilita_name', width: 25 },
      { header: 'Contabilità (Email)', key: 'contabilita_email', width: 25 },
      { header: 'Contabilità (Tel)', key: 'contabilita_phone', width: 15 },
      { header: 'Note', key: 'notes', width: 30 },
      { header: 'Creato il', key: 'created_at', width: 20 }
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };

    const rows = result.rows.map(r => ({
      ...r,
      valore_ordine: Number(r.valore_ordine || 0),
      fatturato_amount: Number(r.fatturato_amount || 0),
      rimanente: Number(r.rimanente || 0),
      labor_cost: Number(r.labor_cost || 0),
      margin: Number(r.margin || 0)
    }));

    rows.forEach(r => sheet.addRow({
        ...r,
        created_at: r.created_at ? r.created_at.toISOString() : ''
      }));

    await sendWorkbook(res, workbook, `Clients_List_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (err) {
    console.error('Export clients error:', err);
    res.status(500).json({ error: 'Failed to export client data' });
  }
});

module.exports = router;
