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
        proforma: Number(r.proforma || 0),
        percentage: pct,
        notes: r.note
      });
    });

    // Add total row (spanning numeric columns correctly)
    const totalRow = sheet.addRow(['TOTALE', '', '', '', Number(total)]);
    totalRow.font = { bold: true };

    // SHEET 2: CONTRACT DETAILS (Including SAL and Obiettivi)
    const sheet2 = workbook.addWorksheet('Dettagli Contrattuali');

    const salMonths = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

    const baseCols = [
      { header: 'N. Commessa', key: 'comm_number', width: 15 },
      { header: 'Nome Progetto', key: 'comm_name', width: 30 },
      { header: 'N. Cliente', key: 'n_cliente', width: 10 },
      { header: 'Cliente', key: 'client_name', width: 25 },
      { header: 'Rif. Ordine', key: 'n_ordine', width: 20 },
      { header: 'Attività', key: 'attivita', width: 30 },
      { header: 'Fatturazione', key: 'fatturazione', width: 40 },
      { header: 'Valore Ordine (€)', key: 'valore_ordine', width: 18 },
      { header: 'Totale Fatturato (€)', key: 'fatturato_amount', width: 18 },
      { header: 'Rimanente (€)', key: 'residuo', width: 18 },
      { header: 'Proforma (€)', key: 'proforma', width: 15 },
      { header: 'Costi Extra (€)', key: 'extra_costs', width: 15 },
      { header: 'Voce a Bilancio', key: 'voce_bilancio', width: 20 },
      { header: 'SAL Valore Totale (€)', key: 'sal_total', width: 20 },
    ];

    // Add SAL Columns
    salMonths.forEach((m, i) => {
      baseCols.push({ header: `${m} SAL (€)`, key: `sal_${i + 1}`, width: 15 });
    });

    // Add Obiettivi Columns
    ['Q1', 'Q2', 'Q3'].forEach(p => {
      baseCols.push({ header: `Obiettivi ${p} - Ordinante`, key: `obj_ord_${p}`, width: 20 });
      baseCols.push({ header: `Obiettivi ${p} - Acquisizioni`, key: `obj_acq_${p}`, width: 20 });
    });

    baseCols.push({ header: 'Note Progetto', key: 'comm_notes', width: 30 });
    baseCols.push({ header: 'Note Linea', key: 'note', width: 30 });
    sheet2.columns = baseCols;
    sheet2.getRow(1).font = { bold: true };
    sheet2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };

    const yearSuffix = (year && year !== 'all') ? year.toString().slice(-2) : null;
    const yearNum = (year && year !== 'all') ? parseInt(year) : new Date().getFullYear();

    const ordersRes = await query(`
      SELECT 
        c.id as comm_id, c.comm_number, c.name as comm_name, c.notes as comm_notes,
        cl.name as client_name,
        cc.n_cliente, cc.n_ordine,
        fl.id as line_id, fl.attivita, fl.valore_ordine, fl.fatturato_amount, fl.proforma, fl.note, fl.voce_bilancio,
        (SELECT STRING_AGG(label || ': ' || (percentage::float)::text || '%', ', ') FROM fatturato_ordini WHERE fatturato_line_id = fl.id) as fatturazione,
        COALESCE((SELECT SUM(amount) FROM employee_extra_costs WHERE task_id = c.task_id AND ($1 = 'all' OR EXTRACT(YEAR FROM date) = $1::int)), 0) as extra_costs
      FROM commesse c
      JOIN commessa_clients cc ON c.id = cc.commessa_id
      LEFT JOIN clients cl ON cc.client_id = cl.id
      JOIN fatturato_lines fl ON cc.id = fl.commessa_client_id
      LEFT JOIN tasks t ON c.task_id = t.id
      WHERE $1 = 'all' 
         OR c.comm_number LIKE $2 || '-%'
         OR EXISTS (SELECT 1 FROM fatturato_realized fr WHERE fr.fatturato_line_id = fl.id AND EXTRACT(YEAR FROM fr.registration_date) = $1::int)
         OR EXISTS (SELECT 1 FROM employee_work_hours wh WHERE wh.task_id = t.id AND EXTRACT(YEAR FROM wh.date) = $1::int)
         OR EXISTS (SELECT 1 FROM employee_extra_costs eec WHERE eec.task_id = c.task_id AND EXTRACT(YEAR FROM eec.date) = $1::int)
      ORDER BY c.comm_number ASC, cc.n_cliente ASC, fl.id ASC
    `, [year || 'all', yearSuffix]);

    // Fetch SAL (Total across all years for that line if 'all', otherwise filtered)
    const salRes = await query(
      (year && year !== 'all') ? `SELECT * FROM fatturato_sal WHERE year = $1` : `SELECT * FROM fatturato_sal`,
      (year && year !== 'all') ? [yearNum] : []
    );
    const salByLine = {};
    const salTotalByLine = {};
    salRes.rows.forEach(s => {
      const lid = s.fatturato_line_id;
      if (!salByLine[lid]) salByLine[lid] = {};
      const val = Number(s.value || 0);
      const signedVal = s.status === 'sbloccato' ? -val : val;

      if (!year || year === 'all' || Number(s.year) === Number(yearNum)) {
        salByLine[lid][s.month] = signedVal;
      }
      salTotalByLine[lid] = (salTotalByLine[lid] || 0) + signedVal;
    });

    // Fetch ALL Obiettivi
    const objRes = await query(
      (year && year !== 'all') ? `SELECT * FROM fatturato_obiettivi WHERE year = $1` : `SELECT * FROM fatturato_obiettivi`,
      (year && year !== 'all') ? [yearNum] : []
    );
    const objByLine = {};
    objRes.rows.forEach(o => {
      const lid = o.fatturato_line_id;
      if (!objByLine[lid]) objByLine[lid] = {};

      // For targets in the columns, we prefer the selected year or current year.
      // But we can aggregate for the row data if needed (the ledger sums them).
      if (!year || year === 'all' || Number(o.year) === Number(yearNum)) {
        objByLine[lid][o.period] = o;
      } else if (!objByLine[lid][o.period]) {
        // Fallback or aggregate
        objByLine[lid][o.period] = o;
      }
    });

    // Individual Project Sheets
    let currentSheet = null;
    let commTotalVal = 0;
    let commTotalFatt = 0;
    let commTotalProf = 0;
    let lastComm = null;

    const setupDetailSheet = (commNum, commName) => {
      const sheetName = `DET - ${commNum}`.slice(0, 31);
      const ws = workbook.addWorksheet(sheetName);
      ws.columns = baseCols; // Reuse the same columns

      const titleRow = ws.insertRow(1, { comm_number: `COMMESSA: ${commNum} - ${commName || ''}` });
      titleRow.font = { bold: true, size: 14 };
      titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
      ws.mergeCells(1, 1, 1, baseCols.length);

      ws.getRow(2).font = { bold: true };
      ws.getRow(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
      return ws;
    };

    ordersRes.rows.forEach((r, idx) => {
      const valOrd = Number(r.valore_ordine || 0);
      const valFatt = Number(r.fatturato_amount || 0);
      const valProf = Number(r.proforma || 0);

      const rowData = {
        ...r,
        valore_ordine: valOrd,
        fatturato_amount: valFatt,
        residuo: valOrd - valFatt - valProf,
        proforma: valProf
      };

      const lineSal = salByLine[r.line_id] || {};
      for (let i = 1; i <= 12; i++) {
        rowData[`sal_${i}`] = lineSal[i] ? Number(lineSal[i]) : 0;
      }
      rowData['sal_total'] = salTotalByLine[r.line_id] || 0;

      const lineObjAt = objByLine[r.line_id] || {};
      ['Q1', 'Q2', 'Q3'].forEach(p => {
        // The ledger shows SUM of targets for the line. Let's match if year is 'all'
        if (year === 'all') {
          const allTargetsForLine = objRes.rows.filter(o => o.fatturato_line_id === r.line_id && o.period === p);
          rowData[`obj_ord_${p}`] = allTargetsForLine.reduce((sum, o) => sum + Number(o.ordinante_val || 0), 0);
          rowData[`obj_acq_${p}`] = allTargetsForLine.reduce((sum, o) => sum + Number(o.acquisizioni_val || 0), 0);
        } else {
          rowData[`obj_ord_${p}`] = lineObjAt[p] ? Number(lineObjAt[p].ordinante_val) : 0;
          rowData[`obj_acq_${p}`] = lineObjAt[p] ? Number(lineObjAt[p].acquisizioni_val) : 0;
        }
      });

      // Add to Master Sheet
      sheet2.addRow(rowData);

      // Add to Individual Sheet
      if (lastComm !== r.comm_number) {
        if (currentSheet) {
          const subRow = currentSheet.addRow({ attivita: 'TOTALE COMMESSA', valore_ordine: commTotalVal, fatturato_amount: commTotalFatt, proforma: commTotalProf, residuo: commTotalVal - commTotalFatt });
          subRow.font = { bold: true };
          subRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        }
        currentSheet = setupDetailSheet(r.comm_number, r.comm_name);
        lastComm = r.comm_number;
        commTotalVal = 0; commTotalFatt = 0; commTotalProf = 0;
      }

      commTotalVal += valOrd;
      commTotalFatt += valFatt;
      commTotalProf += valProf;
      currentSheet.addRow(rowData);

      if (idx === ordersRes.rows.length - 1 && currentSheet) {
        const subRow = currentSheet.addRow({ attivita: 'TOTALE COMMESSA', valore_ordine: commTotalVal, fatturato_amount: commTotalFatt, proforma: commTotalProf, residuo: commTotalVal - commTotalFatt - commTotalProf });
        subRow.font = { bold: true };
        subRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      }
    });

    // --- ADDED: SHEET 3: REDDITIVITÀ PROGETTI (Revenue vs Cost) ---
    const sheet3 = workbook.addWorksheet('Redditività Progetti');
    sheet3.columns = [
      { header: 'Anno', key: 'year', width: 10 },
      { header: 'N. Commessa', key: 'comm_number', width: 15 },
      { header: 'Nome Progetto', key: 'name', width: 30 },
      { header: 'Ricavi (€)', key: 'total_rev', width: 18 },
      { header: 'Costo Lavoro (Int)', key: 'total_cost', width: 18 },
      { header: 'Costi Extra (€)', key: 'extra_costs', width: 18 },
      { header: 'Utile Lordo (€)', key: 'profit', width: 18 },
      { header: 'Margine (%)', key: 'margin', width: 12 },
    ];
    sheet3.getRow(1).font = { bold: true };
    sheet3.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };

    // 1. Get Revenue Breakdown by Year/Commessa (Using transaction dates)
    const revenueDetails = await query(`
      SELECT 
        EXTRACT(YEAR FROM fr.registration_date)::int as full_year,
        c.id as comm_id,
        SUM(fr.amount) as amount
      FROM fatturato_realized fr
      JOIN fatturato_lines fl ON fr.fatturato_line_id = fl.id
      JOIN commessa_clients cc ON fl.commessa_client_id = cc.id
      JOIN commesse c ON cc.commessa_id = c.id
      GROUP BY full_year, c.id
    `);

    const proformaDetails = await query(`
      SELECT 
        EXTRACT(YEAR FROM fp.date)::int as full_year,
        c.id as comm_id,
        SUM(fp.amount) as amount
      FROM fatturato_proforma fp
      JOIN fatturato_lines fl ON fp.fatturato_line_id = fl.id
      JOIN commessa_clients cc ON fl.commessa_client_id = cc.id
      JOIN commesse c ON cc.commessa_id = c.id
      GROUP BY full_year, c.id
    `);

    const extraCostsPerYear = await query(`
      SELECT 
        EXTRACT(YEAR FROM eec.date)::int as full_year,
        c.id as comm_id,
        SUM(eec.amount) as extra_costs
      FROM employee_extra_costs eec
      JOIN commesse c ON eec.task_id = c.task_id
      GROUP BY full_year, comm_id
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
        EXTRACT(YEAR FROM wh.date)::int as full_year,
        EXTRACT(MONTH FROM wh.date)::int as month,
        c.id as comm_id,
        wh.employee_id,
        SUM(wh.hours) as project_hours
      FROM employee_work_hours wh
      JOIN tasks t ON wh.task_id = t.id
      JOIN commesse c ON t.id = c.task_id
      GROUP BY full_year, month, c.id, wh.employee_id
    `);

    const employeeMonthlyTotals = await query(`
      SELECT employee_id, EXTRACT(YEAR FROM date)::int as year, EXTRACT(MONTH FROM date)::int as month, SUM(hours) as total_hours
      FROM employee_work_hours
      GROUP BY employee_id, year, month
    `);

    // 3. Structured Data Processing
    const yearlyMap = {};

    // Discover all available years from transactions
    const foundYears = new Set([
      ...revenueDetails.rows.map(r => r.full_year),
      ...laborSplit.rows.map(l => l.full_year),
      ...extraCostsPerYear.rows.map(e => e.full_year),
      new Date().getFullYear() // Always include current year as fallback
    ]);
    const availableYears = Array.from(foundYears)
      .filter(y => y !== null)
      .sort((a, b) => b - a);

    const targetYears = (year && year !== 'all') ? [parseInt(year)] : availableYears;

    const commsResult = await query(`SELECT id, comm_number, name FROM commesse`);
    const commInfo = {};
    commsResult.rows.forEach(c => commInfo[c.id] = c);

    targetYears.forEach(y => {
      yearlyMap[y] = { projects: {}, totalCompanyLabor: 0, revenue: 0, directLaborAttr: 0, totalConsultantCost: 0, totalExtraCosts: 0 };
    });

    revenueDetails.rows.forEach(r => {
      const fullYear = r.full_year;
      if (yearlyMap[fullYear]) {
        yearlyMap[fullYear].revenue += parseFloat(r.amount);
        if (!yearlyMap[fullYear].projects[r.comm_id]) yearlyMap[fullYear].projects[r.comm_id] = { rev: 0, cost: 0, consultant_cost: 0, extra: 0 };
        yearlyMap[fullYear].projects[r.comm_id].rev += parseFloat(r.amount);
      }
    });

    proformaDetails.rows.forEach(p => {
      const fullYear = p.full_year;
      if (yearlyMap[fullYear]) {
        yearlyMap[fullYear].revenue += parseFloat(p.amount);
        if (!yearlyMap[fullYear].projects[p.comm_id]) yearlyMap[fullYear].projects[p.comm_id] = { rev: 0, cost: 0, consultant_cost: 0, extra: 0 };
        yearlyMap[fullYear].projects[p.comm_id].rev += parseFloat(p.amount);
      }
    });

    extraCostsPerYear.rows.forEach(e => {
      const fullYear = e.full_year;
      if (yearlyMap[fullYear]) {
        yearlyMap[fullYear].totalExtraCosts += parseFloat(e.extra_costs);
        if (!yearlyMap[fullYear].projects[e.comm_id]) yearlyMap[fullYear].projects[e.comm_id] = { rev: 0, cost: 0, consultant_cost: 0, extra: 0 };
        yearlyMap[fullYear].projects[e.comm_id].extra += parseFloat(e.extra_costs);
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
            .sort((a, b) => (b.start_year - a.start_year) || (b.start_month - a.start_month));

          let currentGross = 0;
          if (validCosts.length > 0) {
            currentGross = parseFloat(validCosts[0].annual_gross);
          } else if (allForEmp.length > 0) {
            // Fallback: Use the earliest available cost record if none exist for the period
            const earliest = [...allForEmp].sort((a, b) => (a.start_year - b.start_year) || (a.start_month - b.start_month))[0];
            currentGross = parseFloat(earliest.annual_gross);
          }

          if (currentGross > 0) {
            const workedInYear = employeeMonthlyTotals.rows.some(et => et.employee_id === emp.id && et.year === y);
            const monthLog = employeeMonthlyTotals.rows.find(et => et.employee_id === emp.id && et.year === y && et.month === m);
            if (emp.category === 'consultant') {
              const hr = emp.hr_details || {};
              const startStr = hr.inizio_lavoro;
              const endStr = hr.scadenza_contratto;
              
              let isEligibleForMonth = true;
              if (startStr || endStr) {
                const monthStartObj = new Date(y, m - 1, 1);
                const monthEndObj = new Date(y, m, 0);
                if (startStr && new Date(startStr) > monthEndObj) isEligibleForMonth = false;
                if (endStr && new Date(endStr) < monthStartObj) isEligibleForMonth = false;
              } else {
                // Fallback: only if worked in year or is currently active
                if (!workedInYear && !emp.is_active) isEligibleForMonth = false;
              }

              if (isEligibleForMonth) {
                // Distributed monthly cost
                yearlyMap[y].totalConsultantCost += (currentGross / 12.0);
              }
            } else if (monthLog) {
              yearlyMap[y].totalCompanyLabor += (parseFloat(monthLog.total_hours) * currentGross / 2000);
            }
          }
        });
      }
    }

    laborSplit.rows.forEach(l => {
      const fullYear = l.full_year;
      if (yearlyMap[fullYear]) {
        if (!yearlyMap[fullYear].projects[l.comm_id]) yearlyMap[fullYear].projects[l.comm_id] = { rev: 0, cost: 0, consultant_cost: 0, extra: 0 };

        // Find employee cost (Theoretical for this bucket year)
        const emp = allEmployeesCost.rows.find(e => e.id === l.employee_id);
        const validCosts = allEmployeesCost.rows
          .filter(c => c.id === l.employee_id)
          .filter(c => (c.start_year < fullYear) || (c.start_year === fullYear && c.start_month <= l.month))
          .sort((a, b) => (b.start_year - a.start_year) || (b.start_month - a.start_month));

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
      const sortedIds = Object.keys(projects).sort((a, b) => (commInfo[a]?.comm_number || '').localeCompare(commInfo[b]?.comm_number || ''));

      sortedIds.forEach(cid => {
        const info = commInfo[cid];
        if (!info) return;

        const p = projects[cid];
        const profit = p.rev - p.cost - (p.extra || 0);
        const margin = p.rev > 0 ? (profit / p.rev * 100).toFixed(1) + '%' : '-';

        sheet3.addRow({
          year: y,
          comm_number: info.comm_number,
          name: info.name,
          total_rev: Number(p.rev.toFixed(2)),
          total_cost: Number(p.cost.toFixed(2)),
          extra_costs: Number((p.extra || 0).toFixed(2)),
          profit: Number(profit.toFixed(2)),
          margin: margin
        });
      });

      // Overall calculations for the year
      const settingsRes = await query(`SELECT key, value FROM settings WHERE key LIKE 'gc_%_' || $1`, [y]);
      const overheadGC = settingsRes.rows.reduce((sum, r) => sum + (parseFloat(r.value) || 0), 0);

      const grossProfit = yearlyMap[y].revenue - yearlyMap[y].directLaborAttr;
      const netProfit = grossProfit - yearlyMap[y].totalConsultantCost - overheadGC - yearlyMap[y].totalExtraCosts; // Include consultant cost and extra costs here

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

      const subExtra = sheet3.addRow({ name: `TOTALE COSTI EXTRA (COMMESSA) ${y}`, total_rev: Number(yearlyMap[y].totalExtraCosts.toFixed(2)) });
      subExtra.font = { italic: true, color: { argb: 'FFFF0000' } };

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

    // 3. Get Labor Costs (Fetch all potentially relevant employees)
    const laborRes = await query(`
      SELECT e.id, e.name, e.category, e.hr_details, e.is_active,
             (SELECT json_agg(json_build_object('annual_gross', ec.annual_gross, 'valid_from', ec.valid_from)) 
              FROM employee_costs ec WHERE ec.employee_id = e.id) as cost_history
      FROM employees e
      WHERE e.is_active = TRUE 
         OR EXISTS (SELECT 1 FROM employee_work_hours wh WHERE wh.employee_id = e.id AND EXTRACT(YEAR FROM wh.date) = $1)
         OR (e.category = 'consultant' AND (e.hr_details->>'inizio_lavoro') IS NOT NULL)
    `, [targetYear]);

    const actualHoursRes = await query(`
      SELECT employee_id, EXTRACT(MONTH FROM date) as month, SUM(hours) as hours
      FROM employee_work_hours
      WHERE EXTRACT(YEAR FROM date) = $1
      GROUP BY employee_id, month
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
    MONTH_NAMES.forEach((m, i) => columns1.push({ header: m, key: `m${i + 1}`, width: 10 }));
    columns1.push({ header: 'TOTALE', key: 'total', width: 12 });
    sheet1.columns = columns1;
    sheet1.getRow(1).font = { bold: true };
    sheet1.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };

    const empMap = {};
    workloadRes.rows.forEach(r => {
      if (!empMap[r.employee_id]) {
        empMap[r.employee_id] = { name: r.name, position: r.position, total: 0 };
        for (let i = 1; i <= 12; i++) empMap[r.employee_id][`m${i}`] = 0;
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
    MONTH_NAMES.forEach((m, i) => columns2.push({ header: m, key: `m${i + 1}`, width: 12 }));
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
    for (let i = 1; i <= 12; i++) {
      trends.revenue[`m${i}`] = 0; 
      trends.internal_labor[`m${i}`] = 0; 
      trends.consultant_labor[`m${i}`] = 0;
      trends.overhead[`m${i}`] = monthlyOverheadValue; 
      trends.overhead.total += monthlyOverheadValue;
      trends.profit[`m${i}`] = 0;
      trends.profit.total = 0;
    }

    revenueRes.rows.forEach(r => {
      const mIdx = parseInt(r.month);
      trends.revenue[`m${mIdx}`] = parseFloat(r.total);
      trends.revenue.total += parseFloat(r.total);
    });

    // Map of month -> employee_id -> hours
    const hoursMapByMonth = {}; 
    actualHoursRes.rows.forEach(h => {
      const m = parseInt(h.month);
      if (!hoursMapByMonth[m]) hoursMapByMonth[m] = {};
      hoursMapByMonth[m][h.employee_id] = parseFloat(h.hours);
    });

    const getGrossForPeriod = (history, year, month) => {
      if (!history || history.length === 0) return 0;
      const target = new Date(year, month - 1, 28);
      const sorted = history.filter(h => new Date(h.valid_from) <= target)
                           .sort((a,b) => new Date(b.valid_from) - new Date(a.valid_from));
      if (sorted.length > 0) return parseFloat(sorted[0].annual_gross);
      // Fallback: earliest
      return parseFloat(history.sort((a,b)=>new Date(a.valid_from)-new Date(b.valid_from))[0].annual_gross);
    };

    const laborRowsForDetails = [];
    for (let m = 1; m <= 12; m++) {
      laborRes.rows.forEach(emp => {
        const hr = emp.hr_details || {};
        const hours = (hoursMapByMonth[m] && hoursMapByMonth[m][emp.id]) || 0;
        const annual_gross = getGrossForPeriod(emp.cost_history, targetYear, m);
        
        let shouldInclude = false;
        if (emp.category === 'consultant') {
          const mStart = new Date(targetYear, m-1, 1);
          const mEnd = new Date(targetYear, m, 0);
          if (hr.inizio_lavoro || hr.scadenza_contratto) {
            if ((!hr.inizio_lavoro || new Date(hr.inizio_lavoro) <= mEnd) && 
                (!hr.scadenza_contratto || new Date(hr.scadenza_contratto) >= mStart)) {
              shouldInclude = true;
            }
          } else if (emp.is_active || hours > 0) {
            shouldInclude = true;
          }
        } else if (emp.is_active || hours > 0) {
          shouldInclude = true;
        }

        if (shouldInclude) {
          const cost = calculateMonthlyLaborCost({ hours, annual_gross, category: emp.category });
          if (cost > 0 || hours > 0) {
            laborRowsForDetails.push({ month: m, name: emp.name, category: emp.category, hours, cost });
            
            if (emp.category === 'consultant') {
              trends.consultant_labor[`m${m}`] += cost;
              trends.consultant_labor.total += cost;
            } else {
              trends.internal_labor[`m${m}`] += cost;
              trends.internal_labor.total += cost;
            }
          }
        }
      });

      const mKey = `m${m}`;
      trends.profit[mKey] = trends.revenue[mKey] - trends.internal_labor[mKey] - trends.consultant_labor[mKey] - trends.overhead[mKey];
      trends.profit.total += trends.profit[mKey];
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

    laborRowsForDetails.sort((a, b) => a.month - b.month || a.name.localeCompare(b.name)).forEach(r => {
      sheet4.addRow({
        month_name: MONTH_NAMES[r.month - 1],
        name: r.name,
        category: r.category,
        hours: r.hours,
        cost: Math.round(r.cost)
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
    const clientsResult = await query(`SELECT * FROM clients ORDER BY name ASC`);
    const allLinesRes = await query(`
      SELECT 
        cc.client_id,
        c.comm_number, c.name as comm_name,
        fl.attivita, fl.valore_ordine, fl.fatturato_amount, fl.proforma
      FROM commessa_clients cc
      JOIN commesse c ON cc.commessa_id = c.id
      JOIN fatturato_lines fl ON cc.id = fl.commessa_client_id
      ORDER BY cc.client_id, c.comm_number ASC
    `);

    const linesByClient = {};
    allLinesRes.rows.forEach(l => {
      if (!linesByClient[l.client_id]) linesByClient[l.client_id] = [];
      linesByClient[l.client_id].push(l);
    });

    const workbook = new ExcelJS.Workbook();
    const mainSheet = workbook.addWorksheet('Lista Clienti');

    const clientCols = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Nome Cliente', key: 'name', width: 25 },
      { header: 'Ragione Sociale', key: 'ragione_sociale', width: 30 },
      { header: 'Valore Totale (€)', key: 'total_val', width: 18 },
      { header: 'Totale Fatturato (€)', key: 'total_fatt', width: 18 },
      { header: 'Totale Proforma (€)', key: 'total_prof', width: 18 },
      { header: 'Residuo (€)', key: 'total_res', width: 18 },
      { header: 'P. IVA', key: 'vat_number', width: 20 },
      { header: 'Codice Fiscale', key: 'codice_fiscale', width: 20 },
      { header: 'Codice SDI', key: 'codice_univoco', width: 15 },
      { header: 'Codice ATECO', key: 'codice_ateco', width: 15 },
      { header: 'Codice Inarcassa', key: 'codice_inarcassa', width: 15 },
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
      { header: 'Note', key: 'notes', width: 30 }
    ];

    mainSheet.columns = clientCols;
    mainSheet.getRow(1).font = { bold: true };
    mainSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };

    const detailCols = [
      { header: 'N. Commessa', key: 'comm_number', width: 15 },
      { header: 'Nome Progetto', key: 'comm_name', width: 30 },
      { header: 'Attività', key: 'attivita', width: 30 },
      { header: 'Valore Ordine (€)', key: 'valore_ordine', width: 18 },
      { header: 'Totale Fatturato (€)', key: 'fatturato_amount', width: 18 },
      { header: 'Proforma (€)', key: 'proforma', width: 15 },
      { header: 'Rimanente (€)', key: 'residuo', width: 18 },
    ];

    clientsResult.rows.forEach(client => {
      const cLines = linesByClient[client.id] || [];
      const tVal = cLines.reduce((sum, l) => sum + Number(l.valore_ordine || 0), 0);
      const tFatt = cLines.reduce((sum, l) => sum + Number(l.fatturato_amount || 0), 0);
      const tProf = cLines.reduce((sum, l) => sum + Number(l.proforma || 0), 0);

      // Add to Main Sheet
      mainSheet.addRow({
        ...client,
        total_val: tVal,
        total_fatt: tFatt,
        total_prof: tProf,
        total_res: tVal - tFatt - tProf
      });

      // Create Individual Sheet
      const sheetName = client.name.replace(/[\[\]\*\?\/\\]/g, '').slice(0, 31);
      const ws = workbook.addWorksheet(sheetName);
      
      // Header Client UI - Detailed Profile
      ws.addRow([`DATI CLIENTE: ${client.name} (ID: ${client.id})`]).font = { bold: true, size: 14 };
      ws.addRow([`Ragione Sociale: ${client.ragione_sociale || '-'} | P.IVA: ${client.vat_number || '-'} | CF: ${client.codice_fiscale || '-'} | SDI: ${client.codice_univoco || '-'}`]);
      ws.addRow([`ATECO: ${client.codice_ateco || '-'} | Inarcassa: ${client.codice_inarcassa || '-'}`]);
      ws.addRow([`Email: ${client.contact_email || '-'} | Tel: ${client.phone || '-'} | Fax: ${client.fax || '-'}`]);
      ws.addRow([`Indirizzo: ${client.address || '-'}, ${client.localita || '-'} (${client.cap || '-'}) - ${client.province || '-'}, ${client.stato || '-'}`]);
      ws.addRow([`Rif. Contabilità: ${client.contabilita_name || '-'} | Email: ${client.contabilita_email || '-'} | Tel: ${client.contabilita_phone || '-'}`]);
      ws.addRow([`Note: ${client.notes || '-'}`]);
      ws.addRow([]);

      ws.columns = detailCols;
      ws.getRow(9).font = { bold: true };
      ws.getRow(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };

      cLines.forEach(l => {
        const vO = Number(l.valore_ordine || 0);
        const vF = Number(l.fatturato_amount || 0);
        const vP = Number(l.proforma || 0);
        ws.addRow({
          ...l,
          valore_ordine: vO,
          fatturato_amount: vF,
          proforma: vP,
          residuo: vO - vF - vP
        });
      });

      if (cLines.length > 0) {
        const subRow = ws.addRow({
          attivita: 'TOTALE CLIENTE',
          valore_ordine: tVal,
          fatturato_amount: tFatt,
          proforma: tProf,
          residuo: tVal - tFatt - tProf
        });
        subRow.font = { bold: true };
        subRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      }
    });

    await sendWorkbook(res, workbook, `Clients_Detailed_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (err) {
    console.error('Export clients error:', err);
    res.status(500).json({ error: 'Errore durante l\'esportazione dei dati clienti' });
  }
});

/**
 * EXPORT LABOR TIMESHEET (Detailed Daily Grid)
 * HR Only
 */
router.get('/timesheet-labor', authenticateHR, async (req, res) => {
  const { year } = req.query;
  const targetYear = parseInt(year) || new Date().getFullYear();

  try {
    // 1. Get Employees
    const empRes = await query(`
      SELECT id, name, category 
      FROM employees 
      WHERE is_active = TRUE 
         OR EXISTS (SELECT 1 FROM employee_work_hours wh WHERE wh.employee_id = employees.id AND EXTRACT(YEAR FROM wh.date) = $1)
      ORDER BY name
    `, [targetYear]);

    // 2. Get Work Hours for the year
    const hoursRes = await query(`
      SELECT employee_id, date, hours
      FROM employee_work_hours
      WHERE EXTRACT(YEAR FROM date) = $1
    `, [targetYear]);

    // 3. Get Employee Costs (to find RAL for the year)
    // We get the most recent cost record that started before or during the end of the target year
    const costsRes = await query(`
      SELECT DISTINCT ON (employee_id) employee_id, annual_gross, valid_from
      FROM employee_costs
      WHERE valid_from <= MAKE_DATE($1, 12, 31)
      ORDER BY employee_id, valid_from DESC
    `, [targetYear]);

    const workbook = new ExcelJS.Workbook();
    const MONTH_NAMES = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

    empRes.rows.forEach(emp => {
      const sheetName = emp.name.replace(/[\[\]\*\?\/\\]/g, '').slice(0, 31);
      const sheet = workbook.addWorksheet(sheetName);

      // Setup Columns: Month, Day 1...Day 31, Total
      const columns = [{ header: 'Mese', key: 'month', width: 15 }];
      for (let d = 1; d <= 31; d++) {
        columns.push({ header: d.toString(), key: `d${d}`, width: 6 });
      }
      columns.push({ header: 'TOTALE', key: 'total', width: 12 });
      sheet.columns = columns;

      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };

      // Filter hours for this employee
      const empHours = hoursRes.rows.filter(h => h.employee_id === emp.id);
      const hoursByMonth = Array.from({ length: 12 }, () => ({}));
      let annualTotal = 0;

      empHours.forEach(h => {
        const d = new Date(h.date);
        const mIdx = d.getMonth();
        const day = d.getDate();
        const val = parseFloat(h.hours) || 0;
        hoursByMonth[mIdx][`d${day}`] = val;
        hoursByMonth[mIdx].total = (hoursByMonth[mIdx].total || 0) + val;
        annualTotal += val;
      });

      // Add Rows
      MONTH_NAMES.forEach((mName, mIdx) => {
        sheet.addRow({
          month: mName,
          ...hoursByMonth[mIdx],
          total: hoursByMonth[mIdx].total || 0
        });
      });

      // Footer: Summary
      sheet.addRow([]);
      
      // Get RAL for this employee for this year
      const empCost = costsRes.rows.find(c => c.employee_id === emp.id);
      const annualGross = empCost ? parseFloat(empCost.annual_gross) : 0;
      const rateTheory = annualGross / 2000;
      const rateDynamic = annualTotal > 0 ? (annualGross / annualTotal) : 0;

      const summaryStartRow = sheet.rowCount + 1;
      sheet.addRow(['RIEPILOGO ANNUALE']).font = { bold: true, size: 12 };
      
      sheet.addRow(['Totale Ore Lavorate:', annualTotal]);
      sheet.addRow(['RAL (Lordo Annuo):', annualGross]);
      sheet.addRow(['Rate Theory (Gross/2000):', Number(rateTheory.toFixed(2))]);
      sheet.addRow(['Rate Dynamic (Gross/Actual):', Number(rateDynamic.toFixed(2))]);

      // Styling footer labels
      for (let i = 1; i <= 5; i++) {
        const row = sheet.getRow(summaryStartRow + i - 1);
        row.getCell(1).font = { bold: true };
        if (i > 1) {
          row.getCell(2).alignment = { horizontal: 'left' };
        }
      }
    });

    await sendWorkbook(res, workbook, `Timesheet_Labor_${targetYear}_Detailed.xlsx`);
  } catch (err) {
    console.error('Export timesheet labor error:', err);
    res.status(500).json({ error: 'Failed to export timesheet labor' });
  }
});

module.exports = router;
