const { logAudit, getAuditContext } = require("../middleware/auditLog");

module.exports = (app, query, authenticate, authenticateHR) => {

  app.get("/api/fatturato", authenticateHR, async (req, res) => {
    try {
      // 1. Tüm Ana İşleri Çek
      const year = req.query.year;
      const yearPrefix = (year && year !== 'all') ? String(year).slice(2) : null; // "2025" → "25"

      const commRes = await query(`
        SELECT c.*, t.title AS task_title 
        FROM commesse c LEFT JOIN tasks t ON c.task_id = t.id
        WHERE ($1::text IS NULL OR c.comm_number LIKE $1 || '-%' OR c.comm_number IS NULL)
        ORDER BY c.comm_number DESC
      `, [yearPrefix]);
      
      // 2. Tüm Müşterileri Çek
      const cliRes = await query(`
        SELECT cc.*, cl.name AS client_name 
        FROM commessa_clients cc LEFT JOIN clients cl ON cc.client_id = cl.id 
        ORDER BY cc.n_cliente ASC
      `);

      // 3. Tüm Satırları Çek
      const linRes = await query(`SELECT * FROM fatturato_lines ORDER BY id ASC`);

      // İç içe yerleştirme (Lines -> Clients -> Commessa)
      const linesByCc = {};
      linRes.rows.forEach(l => {
        if (!linesByCc[l.commessa_client_id]) linesByCc[l.commessa_client_id] = [];
        linesByCc[l.commessa_client_id].push(l);
      });

      const clientsByComm = {};
      cliRes.rows.forEach(c => {
        if (!clientsByComm[c.commessa_id]) clientsByComm[c.commessa_id] = [];
        clientsByComm[c.commessa_id].push({ ...c, lines: linesByCc[c.id] || [] });
      });

      const nested = commRes.rows.map(comm => ({
        ...comm,
        clients: clientsByComm[comm.id] || []
      }));

      res.json(nested);
    } catch (err) {
      console.error("GET /fatturato error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  app.get("/api/fatturato/by-task", authenticateHR, async (req, res) => {
    try {
      const result = await query(`
        SELECT 
          c.task_id,
          SUM(fl.valore_ordine)    AS total_valore_ordine,
          SUM(fl.fatturato_amount) AS total_fatturato
        FROM commesse c
        JOIN commessa_clients cc ON c.id = cc.commessa_id
        JOIN fatturato_lines fl ON cc.id = fl.commessa_client_id
        WHERE c.task_id IS NOT NULL
        GROUP BY c.task_id
      `);
      res.json(result.rows);
    } catch (err) {
      console.error("GET /fatturato/by-task error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  app.post("/api/fatturato", authenticateHR, async (req, res) => {
    const { task_id, comm_number, name,  clients } = req.body;
    try {
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
          `, [commId, c.client_id || null, c.n_cliente|| null, c.n_ordine || null, c.preventivo || null, c.ordine || null, c.n_ordine_zucchetti || null, c.voce_bilancio || null]);
          
          const ccId = ccRes.rows[0].id;
          
          if (c.lines && c.lines.length > 0) {
            for (const l of c.lines) {
              await query(`
                INSERT INTO fatturato_lines (commessa_client_id, attivita, descrizione, valore_ordine, fatturato_amount, rimanente_probabile, proforma)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
              `, [ccId, l.attivita || null, l.descrizione || null, parseFloat(l.valore_ordine)||0, parseFloat(l.fatturato_amount)||0, parseFloat(l.rimanente_probabile)||0, parseFloat(l.proforma)||0]);
            }
          }
        }
      }
      await query("COMMIT");

      // Audit log: commessa created
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
    const { task_id, comm_number, name, clients } = req.body;
    const commId = req.params.id;
    try {
      await query("BEGIN");
      await query(`UPDATE commesse SET task_id = $1, comm_number = $2, name = $3 WHERE id = $4`, [task_id || null, comm_number || null, name || null, commId]);
      
      // Temizle ve yeniden yaz (En güvenlisi)
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
              await query(`
                INSERT INTO fatturato_lines (commessa_client_id, attivita, descrizione, valore_ordine, fatturato_amount, rimanente_probabile, proforma)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
              `, [ccId, l.attivita || null, l.descrizione || null, parseFloat(l.valore_ordine)||0, parseFloat(l.fatturato_amount)||0, parseFloat(l.rimanente_probabile)||0, parseFloat(l.proforma)||0]);
            }
          }
        }
      }
      await query("COMMIT");

      // Audit log: commessa updated
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
  app.get("/api/clients", authenticateHR, async (req, res) => {
    try { res.json((await query(`SELECT * FROM clients ORDER BY name ASC`)).rows); } 
    catch (err) { res.status(500).json({ error: "Database error" }); }
  });
  app.post("/api/clients", authenticateHR, async (req, res) => {
    const { name, vat_number, contact_email, phone, address, notes } = req.body;
    try { res.status(201).json((await query(`INSERT INTO clients (name, vat_number, contact_email, phone, address, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [name, vat_number || null, contact_email || null, phone || null, address || null, notes || null])).rows[0]); } 
    catch (err) { res.status(500).json({ error: "Database error" }); }
  });
};
