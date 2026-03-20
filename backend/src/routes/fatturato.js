const { logAudit, getAuditContext } = require("../middleware/auditLog");

module.exports = (app, query, authenticate, authenticateHR) => {

  app.get("/api/fatturato", authenticateHR, async (req, res) => {
    try {
      // 1. Tüm Ana İşleri Çek
      const year = req.query.year;
      const yearPrefix = (year && year !== 'all') ? String(year).slice(2) : null;
      const yearNum = (year && year !== 'all') ? parseInt(year) : null;

      const commRes = await query(`
        SELECT c.*, t.title AS task_title 
        FROM commesse c 
        LEFT JOIN tasks t ON c.task_id = t.id
        WHERE ($1::text IS NULL OR c.comm_number LIKE $1 || '-%' OR c.comm_number IS NULL
               OR EXISTS (
                 SELECT 1 FROM employee_work_hours wh 
                 WHERE wh.task_id = c.task_id AND EXTRACT(YEAR FROM wh.date) = $2
               )
               OR EXISTS (
                 SELECT 1 FROM fatturato_realized fr
                 JOIN fatturato_lines fl ON fr.fatturato_line_id = fl.id
                 JOIN commessa_clients cc ON fl.commessa_client_id = cc.id
                 WHERE cc.commessa_id = c.id AND EXTRACT(YEAR FROM fr.registration_date) = $2
               )
               OR EXISTS (
                 SELECT 1 FROM commessa_extra_costs cec
                 WHERE cec.commessa_id = c.id AND EXTRACT(YEAR FROM cec.date) = $2
               )
              )
        ORDER BY c.comm_number DESC
      `, [yearPrefix, yearNum]);

      // 2. Tüm Müşterileri Çek
      const cliRes = await query(`
        SELECT cc.*, cl.name AS client_name 
        FROM commessa_clients cc LEFT JOIN clients cl ON cc.client_id = cl.id 
        ORDER BY cc.n_cliente ASC
      `);

      // 3. Tüm Satırları Çek
      const linRes = await query(`SELECT * FROM fatturato_lines ORDER BY id ASC`);

      // 4. Tüm Ordini Çek (percentage schedules)
      const ordRes = await query(`SELECT * FROM fatturato_ordini ORDER BY id ASC`);

      // 5. Tüm Realized Çek (billing history)
      const realRes = await query(`SELECT * FROM fatturato_realized ORDER BY registration_date ASC, id ASC`);

      // 6. Tüm Proforma Çek
      const profRes = await query(`SELECT * FROM fatturato_proforma ORDER BY date ASC, id ASC`);

      // 7. Tüm Extra Costs Çek
      const extraRes = await query(`SELECT * FROM commessa_extra_costs ORDER BY date ASC`);

      // İç içe yerleştirme (Ordini/Realized -> Lines -> Clients -> Commessa)
      const ordByLine = {};
      ordRes.rows.forEach(o => {
        if (!ordByLine[o.fatturato_line_id]) ordByLine[o.fatturato_line_id] = [];
        ordByLine[o.fatturato_line_id].push(o);
      });

      const realByLine = {};
      realRes.rows.forEach(r => {
        if (!realByLine[r.fatturato_line_id]) realByLine[r.fatturato_line_id] = [];
        realByLine[r.fatturato_line_id].push(r);
      });

      const profByLine = {};
      profRes.rows.forEach(p => {
        if (!profByLine[p.fatturato_line_id]) profByLine[p.fatturato_line_id] = [];
        profByLine[p.fatturato_line_id].push(p);
      });

      const extraByComm = {};
      extraRes.rows.forEach(e => {
        if (!extraByComm[e.commessa_id]) extraByComm[e.commessa_id] = [];
        extraByComm[e.commessa_id].push(e);
      });

      const linesByCc = {};
      linRes.rows.forEach(l => {
        if (!linesByCc[l.commessa_client_id]) linesByCc[l.commessa_client_id] = [];
        linesByCc[l.commessa_client_id].push({ 
          ...l, 
          ordini: ordByLine[l.id] || [],
          realized: realByLine[l.id] || [],
          proforma_entries: profByLine[l.id] || []
        });
      });

      const clientsByComm = {};
      cliRes.rows.forEach(c => {
        if (!clientsByComm[c.commessa_id]) clientsByComm[c.commessa_id] = [];
        clientsByComm[c.commessa_id].push({ ...c, lines: linesByCc[c.id] || [] });
      });

      const nested = commRes.rows.map(comm => ({
        ...comm,
        clients: clientsByComm[comm.id] || [],
        extra_costs: extraByComm[comm.id] || []
      }));

      res.json(nested);
    } catch (err) {
      console.error("GET /fatturato error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  app.get("/api/fatturato/by-task", authenticateHR, async (req, res) => {
    try {
      const year = req.query.year;
      const yearPrefix = (year && year !== 'all') ? String(year).slice(2) : null;
      const yearNum = (year && year !== 'all') ? parseInt(year) : null;

      const result = await query(`
        WITH activity_years AS (
          SELECT id as commessa_id, task_id, (2000 + LEFT(comm_number, 2)::int) as year 
          FROM commesse WHERE comm_number IS NOT NULL
          UNION
          SELECT c.id, c.task_id, EXTRACT(YEAR FROM wh.date)::int as year
          FROM employee_work_hours wh JOIN commesse c ON wh.task_id = c.task_id
          UNION
          SELECT cc.commessa_id, c.task_id, EXTRACT(YEAR FROM fr.registration_date)::int as year
          FROM fatturato_realized fr JOIN fatturato_lines fl ON fr.fatturato_line_id = fl.id
          JOIN commessa_clients cc ON fl.commessa_client_id = cc.id JOIN commesse c ON cc.commessa_id = c.id
          UNION
          SELECT cec.commessa_id, c.task_id, EXTRACT(YEAR FROM cec.date)::int as year
          FROM commessa_extra_costs cec JOIN commesse c ON cec.commessa_id = c.id
        ),
        target_years AS (
          SELECT commessa_id, task_id, year FROM activity_years
          WHERE ($1::int IS NULL OR year = $1)
        ),
        yearly_realized AS (
          SELECT fl.commessa_client_id, EXTRACT(YEAR FROM fr.registration_date)::int as year, SUM(fr.amount) as amount_sum
          FROM fatturato_realized fr JOIN fatturato_lines fl ON fr.fatturato_line_id = fl.id GROUP BY 1, 2
        ),
        yearly_extras AS (
          SELECT cec.commessa_id, EXTRACT(YEAR FROM cec.date)::int as year, SUM(cec.amount) as amount_sum
          FROM commessa_extra_costs cec GROUP BY 1, 2
        ),
        yearly_scheduled AS (
          SELECT fl.commessa_client_id, EXTRACT(YEAR FROM fo.expected_date)::int as year, SUM(fl.valore_ordine * fo.percentage / 100) as scheduled_sum
          FROM fatturato_ordini fo JOIN fatturato_lines fl ON fo.fatturato_line_id = fl.id GROUP BY 1, 2
        ),
        lifetime_valore AS (
          SELECT fl.commessa_client_id, SUM(fl.valore_ordine) as life_valore
          FROM fatturato_lines fl GROUP BY 1
        )
        SELECT 
          ty.task_id,
          c.comm_number,
          RIGHT(ty.year::text, 2) as year_code,
          SUM(lv.life_valore)    AS total_valore_ordine,
          SUM(COALESCE(yr.amount_sum, 0)) AS total_fatturato,
          SUM(COALESCE(ys.scheduled_sum, 0)) AS total_scheduled_amount,
          SUM(COALESCE(ye.amount_sum, 0)) as total_extra_costs
        FROM target_years ty
        JOIN commesse c ON ty.commessa_id = c.id
        JOIN commessa_clients cc ON c.id = cc.commessa_id
        LEFT JOIN lifetime_valore lv ON cc.id = lv.commessa_client_id
        LEFT JOIN yearly_realized yr ON cc.id = yr.commessa_client_id AND yr.year = ty.year
        LEFT JOIN yearly_scheduled ys ON cc.id = ys.commessa_client_id AND ys.year = ty.year
        LEFT JOIN yearly_extras ye ON c.id = ye.commessa_id AND ye.year = ty.year
        GROUP BY ty.task_id, c.comm_number, ty.year, c.id
        ORDER BY ty.year DESC, c.id DESC
      `, [yearNum]);
      res.json(result.rows);
    } catch (err) {
      console.error("GET /fatturato/by-task error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  app.post("/api/fatturato", authenticateHR, async (req, res) => {
    const { task_id, comm_number, name, clients, extra_costs } = req.body;
    try {
      // Validation: Sum of percentages for any line must not exceed 100%
      if (clients && clients.length > 0) {
        for (const c of clients) {
          if (c.lines && c.lines.length > 0) {
            for (const l of c.lines) {
              const totalPct = (l.ordini || []).reduce((sum, o) => sum + (parseFloat(o.percentage) || 0), 0);
              if (totalPct > 100.01) {
                return res.status(400).json({ error: `Total percentage for activity "${l.attivita || 'unnamed'}" exceeds 100%` });
              }
            }
          }
        }
      }
      if (task_id) {
        const existing = await query("SELECT id FROM commesse WHERE task_id = $1", [task_id]);
        if (existing.rows.length > 0) {
          return res.status(400).json({ error: "This task is already linked to another commessa." });
        }
      }

      await query("BEGIN");

      const commRes = await query(`
        INSERT INTO commesse (task_id, comm_number, name) VALUES ($1, $2, $3) RETURNING id
      `, [task_id || null, comm_number || null, name || null]);
      const commId = commRes.rows[0].id;

      if (clients && clients.length > 0) {
        for (const c of clients) {
          const ccRes = await query(`
            INSERT INTO commessa_clients (commessa_id, client_id,  n_cliente, n_ordine, preventivo, ordine, n_ordine_zucchetti, voce_bilancio)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
          `, [commId, c.client_id || null, c.n_cliente || null, c.n_ordine || null, c.preventivo || null, c.ordine || null, c.n_ordine_zucchetti || null, c.voce_bilancio || null]);

          const ccId = ccRes.rows[0].id;

          if (c.lines && c.lines.length > 0) {
            for (const l of c.lines) {
              const flRes = await query(`
                INSERT INTO fatturato_lines (commessa_client_id, attivita, descrizione, valore_ordine, fatturato_amount, rimanente_probabile, proforma)
                VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
              `, [ccId, l.attivita || null, l.descrizione || null, parseFloat(l.valore_ordine) || 0, parseFloat(l.fatturato_amount) || 0, parseFloat(l.rimanente_probabile) || 0, parseFloat(l.proforma) || 0]);

              const lineId = flRes.rows[0].id;

              if (l.ordini && l.ordini.length > 0) {
                for (const o of l.ordini) {
                  await query(`
                    INSERT INTO fatturato_ordini (fatturato_line_id, label, percentage, expected_date, note)
                    VALUES ($1, $2, $3, $4, $5)
                  `, [lineId, o.label || null, parseFloat(o.percentage) || 0, o.expected_date || null, o.note || null]);
                }
              }

              if (l.realized && l.realized.length > 0) {
                for (const r of l.realized) {
                  await query(`
                    INSERT INTO fatturato_realized (fatturato_line_id, amount, registration_date, note)
                    VALUES ($1, $2, $3, $4)
                  `, [lineId, parseFloat(r.amount) || 0, r.registration_date || null, r.note || null]);
                }
              }

              if (l.proforma_entries && l.proforma_entries.length > 0) {
                for (const p of l.proforma_entries) {
                  await query(`
                    INSERT INTO fatturato_proforma (fatturato_line_id, amount, date, note)
                    VALUES ($1, $2, $3, $4)
                  `, [lineId, parseFloat(p.amount) || 0, p.date || null, p.note || null]);
                }
              }
            }
          }
        }
      }

      if (extra_costs && extra_costs.length > 0) {
        for (const ec of extra_costs) {
          await query(`
            INSERT INTO commessa_extra_costs (commessa_id, description, amount, date)
            VALUES ($1, $2, $3, $4)
          `, [commId, ec.description || '', parseFloat(ec.amount) || 0, ec.date || null]);
        }
      }

      await query("COMMIT");

      const ctx = getAuditContext(req);
      logAudit(query, { ...ctx, action: 'CREATE', entityType: 'commessa', entityId: commId, details: { comm_number, name } });
      res.status(201).json({ success: true });
    } catch (err) {
      await query("ROLLBACK");
      console.error("POST /fatturato error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  app.put("/api/fatturato/:id", authenticateHR, async (req, res) => {
    const { task_id, comm_number, name, clients, extra_costs } = req.body;
    const commId = req.params.id;
    try {
      // Validation: Sum of percentages for any line must not exceed 100%
      if (clients && clients.length > 0) {
        for (const c of clients) {
          if (c.lines && c.lines.length > 0) {
            for (const l of c.lines) {
              const totalPct = (l.ordini || []).reduce((sum, o) => sum + (parseFloat(o.percentage) || 0), 0);
              if (totalPct > 100.01) {
                return res.status(400).json({ error: `Total percentage for activity "${l.attivita || 'unnamed'}" exceeds 100%` });
              }
            }
          }
        }
      }

      if (task_id) {
        const existing = await query("SELECT id FROM commesse WHERE task_id = $1 AND id <> $2", [task_id, commId]);
        if (existing.rows.length > 0) {
          return res.status(400).json({ error: "This task is already linked to another commessa." });
        }
      }

      await query("BEGIN");
      await query(`UPDATE commesse SET task_id = $1, comm_number = $2, name = $3 WHERE id = $4`, [task_id || null, comm_number || null, name || null, commId]);

      await query(`DELETE FROM commessa_clients WHERE commessa_id = $1`, [commId]);

      if (clients && clients.length > 0) {
        for (const c of clients) {
          const ccRes = await query(`
            INSERT INTO commessa_clients (commessa_id, client_id,  n_cliente, n_ordine, preventivo, ordine, n_ordine_zucchetti, voce_bilancio)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
          `, [commId, c.client_id || null, c.n_cliente || null, c.n_ordine || null, c.preventivo || null, c.ordine || null, c.n_ordine_zucchetti || null, c.voce_bilancio || null]);

          const ccId = ccRes.rows[0].id;
          if (c.lines && c.lines.length > 0) {
            for (const l of c.lines) {
              const flRes = await query(`
                INSERT INTO fatturato_lines (commessa_client_id, attivita, descrizione, valore_ordine, fatturato_amount, rimanente_probabile, proforma)
                VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
              `, [ccId, l.attivita || null, l.descrizione || null, parseFloat(l.valore_ordine) || 0, parseFloat(l.fatturato_amount) || 0, parseFloat(l.rimanente_probabile) || 0, parseFloat(l.proforma) || 0]);

              const lineId = flRes.rows[0].id;
              if (l.ordini && l.ordini.length > 0) {
                for (const o of l.ordini) {
                  await query(`
                    INSERT INTO fatturato_ordini (fatturato_line_id, label, percentage, expected_date, note)
                    VALUES ($1, $2, $3, $4, $5)
                  `, [lineId, o.label || null, parseFloat(o.percentage) || 0, o.expected_date || null, o.note || null]);
                }
              }

              if (l.realized && l.realized.length > 0) {
                for (const r of l.realized) {
                  await query(`
                    INSERT INTO fatturato_realized (fatturato_line_id, amount, registration_date, note)
                    VALUES ($1, $2, $3, $4)
                  `, [lineId, parseFloat(r.amount) || 0, r.registration_date || null, r.note || null]);
                }
              }

              if (l.proforma_entries && l.proforma_entries.length > 0) {
                for (const p of l.proforma_entries) {
                  await query(`
                    INSERT INTO fatturato_proforma (fatturato_line_id, amount, date, note)
                    VALUES ($1, $2, $3, $4)
                  `, [lineId, parseFloat(p.amount) || 0, p.date || null, p.note || null]);
                }
              }
            }
          }
        }
      }

      await query(`DELETE FROM commessa_extra_costs WHERE commessa_id = $1`, [commId]);
      if (extra_costs && extra_costs.length > 0) {
        for (const ec of extra_costs) {
          await query(`
            INSERT INTO commessa_extra_costs (commessa_id, description, amount, date)
            VALUES ($1, $2, $3, $4)
          `, [commId, ec.description || '', parseFloat(ec.amount) || 0, ec.date || null]);
        }
      }

      await query("COMMIT");

      const ctx = getAuditContext(req);
      logAudit(query, { ...ctx, action: 'UPDATE', entityType: 'commessa', entityId: parseInt(commId), details: { comm_number, name } });
      res.json({ success: true });
    } catch (err) {
      await query("ROLLBACK");
      console.error("PUT /fatturato error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  app.delete("/api/fatturato/:id", authenticateHR, async (req, res) => {
    try {
      await query(`DELETE FROM commesse WHERE id = $1`, [req.params.id]);

      // Audit log: commessa deleted
      const ctx = getAuditContext(req);
      logAudit(query, { ...ctx, action: 'DELETE', entityType: 'commessa', entityId: parseInt(req.params.id) });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Database error" });
    }
  });

  // --- CLIENTS API BURADA ---
  // ─────────────────────────────────────────────
  // FATTURATO ORDINI  (percentage-based installments per attivita line)
  // ─────────────────────────────────────────────

  // GET all ordini for a specific fatturato_line
  app.get("/api/fatturato-lines/:lineId/ordini", authenticateHR, async (req, res) => {
    try {
      const { rows } = await query(
        `SELECT * FROM fatturato_ordini WHERE fatturato_line_id = $1 ORDER BY id ASC`,
        [req.params.lineId]
      );
      res.json(rows);
    } catch (err) {
      console.error("GET /fatturato-lines/:lineId/ordini error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // POST create a new ordine (percentage) for a fatturato_line
  app.post("/api/fatturato-lines/:lineId/ordini", authenticateHR, async (req, res) => {
    const { label, percentage, expected_date, note } = req.body;
    try {
      // Validation: Total percentage for the line must not exceed 100%
      const existingRes = await query(`SELECT SUM(percentage) as total FROM fatturato_ordini WHERE fatturato_line_id = $1`, [req.params.lineId]);
      const currentTotal = parseFloat(existingRes.rows[0].total || 0);
      const newPercentage = parseFloat(percentage) || 0;
      if (currentTotal + newPercentage > 100.01) {
        return res.status(400).json({ error: `Adding this installment would exceed 100% for this activity (current: ${currentTotal}%)` });
      }

      const { rows } = await query(
        `INSERT INTO fatturato_ordini (fatturato_line_id, label, percentage, expected_date, note)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [
          req.params.lineId,
          label || null,
          parseFloat(percentage) || 0,
          expected_date || null,
          note || null
        ]
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error("POST /fatturato-lines/:lineId/ordini error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // PUT update an existing ordine
  app.put("/api/fatturato-ordini/:id", authenticateHR, async (req, res) => {
    const { label, percentage, expected_date, note } = req.body;
    try {
      // Validation: Total percentage for the line must not exceed 100%
      const lineRes = await query(`SELECT fatturato_line_id FROM fatturato_ordini WHERE id = $1`, [req.params.id]);
      if (lineRes.rows.length === 0) return res.status(404).json({ error: "Not found" });
      const lineId = lineRes.rows[0].fatturato_line_id;

      const existingOtherRes = await query(`SELECT SUM(percentage) as total FROM fatturato_ordini WHERE fatturato_line_id = $1 AND id <> $2`, [lineId, req.params.id]);
      const otherTotal = parseFloat(existingOtherRes.rows[0].total || 0);
      const newPercentage = parseFloat(percentage) || 0;
      if (otherTotal + newPercentage > 100.01) {
        return res.status(400).json({ error: `Updating this installment would exceed 100% for this activity (others total: ${otherTotal}%)` });
      }

      const { rows } = await query(
        `UPDATE fatturato_ordini
         SET label = $1, percentage = $2, expected_date = $3, note = $4
         WHERE id = $5 RETURNING *`,
        [
          label || null,
          parseFloat(percentage) || 0,
          expected_date || null,
          note || null,
          req.params.id
        ]
      );
      if (rows.length === 0) return res.status(404).json({ error: "Not found" });
      res.json(rows[0]);
    } catch (err) {
      console.error("PUT /fatturato-ordini/:id error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // DELETE an ordine
  app.delete("/api/fatturato-ordini/:id", authenticateHR, async (req, res) => {
    try {
      await query(`DELETE FROM fatturato_ordini WHERE id = $1`, [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      console.error("DELETE /fatturato-ordini/:id error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // --- CLIENTS API BURADA ---
  app.get("/api/clients", authenticateHR, async (req, res) => {
    try { res.json((await query(`SELECT * FROM clients ORDER BY name ASC`)).rows); }
    catch (err) { res.status(500).json({ error: "Database error" }); }
  });

  app.get("/api/clients/:id", authenticateHR, async (req, res) => {
    try {
      const { rows } = await query(`SELECT * FROM clients WHERE id = $1`, [req.params.id]);
      if (rows.length === 0) return res.status(404).json({ error: "Client not found" });
      res.json(rows[0]);
    } catch (err) {
      res.status(500).json({ error: "Database error" });
    }
  });

  app.post("/api/clients", authenticateHR, async (req, res) => {
    const { 
      name, ragione_sociale, vat_number, codice_fiscale, codice_univoco, codice_ateco, codice_inarcassa,
      contact_email, phone, fax, address, localita, cap, province, stato,
      contabilita_prefix, contabilita_name, contabilita_email, contabilita_phone, notes 
    } = req.body;
    try { 
      const { rows } = await query(`
        INSERT INTO clients (
          name, ragione_sociale, vat_number, codice_fiscale, codice_univoco, codice_ateco, codice_inarcassa,
          contact_email, phone, fax, address, localita, cap, province, stato,
          contabilita_prefix, contabilita_name, contabilita_email, contabilita_phone, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) 
        RETURNING *`, 
        [
          name, ragione_sociale || null, vat_number || null, codice_fiscale || null, codice_univoco || null, codice_ateco || null, codice_inarcassa || null,
          contact_email || null, phone || null, fax || null, address || null, localita || null, cap || null, province || null, stato || null,
          contabilita_prefix || null, contabilita_name || null, contabilita_email || null, contabilita_phone || null, notes || null
        ]
      );
      const client = rows[0];
      const ctx = getAuditContext(req);
      logAudit(query, { ...ctx, action: 'CREATE', entityType: 'client', entityId: client.id, details: { name } });
      res.status(201).json(client); 
    }
    catch (err) { res.status(500).json({ error: "Database error" }); }
  });

  app.put("/api/clients/:id", authenticateHR, async (req, res) => {
    const { 
      name, ragione_sociale, vat_number, codice_fiscale, codice_univoco, codice_ateco, codice_inarcassa,
      contact_email, phone, fax, address, localita, cap, province, stato,
      contabilita_prefix, contabilita_name, contabilita_email, contabilita_phone, notes 
    } = req.body;
    try {
      const { rows } = await query(
        `UPDATE clients SET 
          name = $1, ragione_sociale = $2, vat_number = $3, codice_fiscale = $4, codice_univoco = $5, codice_ateco = $6, codice_inarcassa = $7,
          contact_email = $8, phone = $9, fax = $10, address = $11, localita = $12, cap = $13, province = $14, stato = $15,
          contabilita_prefix = $16, contabilita_name = $17, contabilita_email = $18, contabilita_phone = $19, notes = $20
         WHERE id = $21 RETURNING *`,
        [
          name, ragione_sociale || null, vat_number || null, codice_fiscale || null, codice_univoco || null, codice_ateco || null, codice_inarcassa || null,
          contact_email || null, phone || null, fax || null, address || null, localita || null, cap || null, province || null, stato || null,
          contabilita_prefix || null, contabilita_name || null, contabilita_email || null, contabilita_phone || null, notes || null,
          req.params.id
        ]
      );
      if (rows.length === 0) return res.status(404).json({ error: "Client not found" });
      
      const ctx = getAuditContext(req);
      logAudit(query, { ...ctx, action: 'UPDATE', entityType: 'client', entityId: parseInt(req.params.id), details: { name } });
      
      res.json(rows[0]);
    } catch (err) {
      res.status(500).json({ error: "Database error" });
    }
  });

  app.delete("/api/clients/:id", authenticateHR, async (req, res) => {
    try {
      await query(`DELETE FROM clients WHERE id = $1`, [req.params.id]);
      
      const ctx = getAuditContext(req);
      logAudit(query, { ...ctx, action: 'DELETE', entityType: 'client', entityId: parseInt(req.params.id) });
      
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Database error. Client might be linked to projects." });
    }
  });
};
