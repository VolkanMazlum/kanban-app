module.exports = function (app, query, pool, authenticate, authenticateHR) {

  // ---- GET SUMMARY STATS (Deprecated - computed client-side now) ----
  app.get('/api/offerte/summary', authenticateHR, async (req, res) => {
    try {
      const { rows } = await query(`
        SELECT o.status, COUNT(DISTINCT o.id) as count, SUM(ol.valore) as total
        FROM offerte o
        LEFT JOIN offerta_lines ol ON o.id = ol.offerta_id AND ol.included = true
        GROUP BY o.status
      `);
      const summary = rows.reduce((acc, row) => {
        acc[row.status] = { count: parseInt(row.count) || 0, total: parseFloat(row.total) || 0 };
        return acc;
      }, {});
      res.json(summary);
    } catch (err) {
      console.error('Error fetching offerte summary:', err);
      res.status(500).json({ error: 'Failed to fetch summary' });
    }
  });

  // ---- GET KPI / STATISTICS ----
  app.get('/api/offerte/kpi', authenticateHR, async (req, res) => {
    try {
      const { year, client, tipo } = req.query;
      const filters = [];
      const values = [];

      const trendFilters = [];
      const trendValues = [];

      // Handle year conversion (4-digit from frontend -> 2-digit in DB)
      if (year && year !== 'all') {
        const y = parseInt(year);
        const y2 = y > 2000 ? y % 100 : y;
        values.push(y2);
        filters.push(`o.anno = $${values.length}`);
      }

      if (client) {
        values.push(client);
        filters.push(`o.cliente = $${values.length}`);

        trendValues.push(client);
        trendFilters.push(`o.cliente = $${trendValues.length}`);
      }

      if (tipo && tipo !== 'all') {
        values.push(tipo);
        filters.push(`o.tipo = $${values.length}`);

        trendValues.push(tipo);
        trendFilters.push(`o.tipo = $${trendValues.length}`);
      }

      const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
      const trendWhere = trendFilters.length > 0 ? `WHERE ${trendFilters.join(' AND ')}` : '';

      // 1. Annual Trend (Always show all years, but filtered by client/tipo if present)
      const { rows: trend } = await query(`
        SELECT o.anno, 
               COUNT(DISTINCT CASE WHEN o.status NOT IN ('revisione', 'info_only') THEN o.id END) as count, 
               COALESCE(SUM(CASE WHEN o.status NOT IN ('revisione', 'info_only') THEN ol.valore ELSE 0 END), 0) as total_val,
               COALESCE(SUM(CASE WHEN o.status='accettata' THEN ol.valore ELSE 0 END), 0) as accepted_val
        FROM offerte o
        LEFT JOIN offerta_lines ol ON o.id = ol.offerta_id AND ol.included = true
        ${trendWhere}
        GROUP BY o.anno
        ORDER BY o.anno ASC
      `, trendValues);

      // 2. Status Distribution
      const { rows: statusDist } = await query(`
        SELECT o.status, COUNT(DISTINCT o.id) as count, COALESCE(SUM(ol.valore), 0) as total
        FROM offerte o
        LEFT JOIN offerta_lines ol ON o.id = ol.offerta_id AND ol.included = true
        ${whereClause}
        GROUP BY o.status
      `, values);

      // 3. Type Distribution
      const { rows: typeDist } = await query(`
        SELECT o.tipo, COUNT(DISTINCT o.id) as count, COALESCE(SUM(ol.valore), 0) as total
        FROM offerte o
        LEFT JOIN offerta_lines ol ON o.id = ol.offerta_id AND ol.included = true
        ${whereClause}
        GROUP BY o.tipo
      `, values);

      // 4. Category Breakdown
      const sqlCategory = `
        SELECT ol.category, COALESCE(SUM(ol.valore), 0) as total
        FROM offerta_lines ol
        JOIN offerte o ON ol.offerta_id = o.id
        ${whereClause ? whereClause + ' AND' : 'WHERE'} ol.included = true
        GROUP BY ol.category
      `;
      const { rows: categoryDist } = await query(sqlCategory, values);

      // 5. Client Statistics (All)
      const { rows: topClients } = await query(`
        SELECT o.cliente, 
               COALESCE(SUM(ol.valore), 0) as total, 
               COUNT(DISTINCT o.id) as count,
               COALESCE(SUM(CASE WHEN o.status='accettata' THEN ol.valore ELSE 0 END), 0) as accepted_val
        FROM offerte o
        LEFT JOIN offerta_lines ol ON o.id = ol.offerta_id AND ol.included = true
        ${whereClause ? whereClause + ' AND o.cliente IS NOT NULL AND o.cliente != \'\'' : 'WHERE o.cliente IS NOT NULL AND o.cliente != \'\''}
        GROUP BY o.cliente
        ORDER BY total DESC
      `, values);

      // 6. Overall Stats
      const { rows: overall } = await query(`
        SELECT COUNT(DISTINCT CASE WHEN o.status NOT IN ('revisione', 'info_only') THEN o.id END) as total_count, 
               COALESCE(SUM(CASE WHEN o.status NOT IN ('revisione', 'info_only') THEN ol.valore ELSE 0 END), 0) as total_value,
               COUNT(DISTINCT CASE WHEN o.status='accettata' OR o.status='parziale' THEN o.id END) as accepted_count,
               COALESCE(SUM(CASE WHEN o.status='accettata' THEN ol.valore ELSE 0 END), 0) as accepted_value
        FROM offerte o
        LEFT JOIN offerta_lines ol ON o.id = ol.offerta_id AND ol.included = true
        ${whereClause}
      `, values);

      res.json({
        trend,
        statusDist,
        typeDist,
        categoryDist,
        topClients,
        overall: overall[0]
      });
    } catch (err) {
      console.error('Error fetching offerte KPIs:', err);
      res.status(500).json({ error: 'Failed to fetch KPIs' });
    }
  });

  // ---- GET UNIQUE OFFERTE CLIENTS ----
  app.get('/api/offerte/clients', authenticateHR, async (req, res) => {
    try {
      const { rows } = await query(`
        SELECT DISTINCT cliente 
        FROM offerte 
        WHERE cliente IS NOT NULL AND cliente != ''
        ORDER BY cliente ASC
      `);
      res.json(rows.map(r => r.cliente));
    } catch (err) {
      console.error('Error fetching offerte clients:', err);
      res.status(500).json({ error: 'Failed to fetch clients' });
    }
  });

  // ---- GET EXISTING PREVENTIVI (for linking) ----
  app.get('/api/offerte/preventivi-esistenti', authenticateHR, async (req, res) => {
    try {
      const { rows } = await query(`
        SELECT cc.id as commessa_client_id, cc.commessa_id, cc.preventivo, c.name as commessa_name
        FROM commessa_clients cc
        JOIN commesse c ON cc.commessa_id = c.id
        WHERE cc.preventivo IS NOT NULL AND cc.preventivo != ''
        ORDER BY cc.id DESC
      `);
      res.json(rows);
    } catch (err) {
      console.error('Error fetching existing preventivi:', err);
      res.status(500).json({ error: 'Failed to fetch preventivi' });
    }
  });

  // ---- GET ALL OFFERTE ----
  app.get('/api/offerte', authenticateHR, async (req, res) => {
    try {
      const filters = [];
      const values = [];
      let sql = `
        SELECT o.*, c.name as client_name,
        (
          SELECT COALESCE(SUM(fl.valore_ordine), 0) / 1000.0
          FROM fatturato_lines fl
          JOIN commessa_clients cc ON fl.commessa_client_id = cc.id
          WHERE cc.commessa_id = o.commessa_id
            AND (o.client_id IS NULL OR cc.client_id = o.client_id)
            AND (
              cc.preventivo ILIKE '%' || o.preventivo_number || '-' || LPAD(o.anno::text, 2, '0') || '%'
              OR cc.preventivo ILIKE '%' || LPAD(o.preventivo_number, 2, '0') || '-' || LPAD(o.anno::text, 2, '0') || '%'
              OR cc.preventivo ILIKE '%' || o.preventivo_number || '/' || LPAD(o.anno::text, 2, '0') || '%'
            )
        ) as valore_acquisito
        FROM offerte o
        LEFT JOIN clients c ON o.client_id = c.id
      `;

      if (req.query.anno) {
        filters.push(`o.anno = $${filters.length + 1}`);
        values.push(req.query.anno);
      }
      if (req.query.status && req.query.status !== 'all') {
        filters.push(`o.status = $${filters.length + 1}`);
        values.push(req.query.status);
      }

      if (filters.length > 0) {
        sql += ` WHERE ` + filters.join(' AND ');
      }

      sql += ` ORDER BY o.anno DESC, o.preventivo_number DESC, o.revision DESC`;

      const { rows: offerte } = await query(sql, values);

      // Fetch lines
      if (offerte.length > 0) {
        const offertaIds = offerte.map(o => o.id);
        const { rows: lines } = await query(`
          SELECT * FROM offerta_lines WHERE offerta_id = ANY($1)
        `, [offertaIds]);

        // Group lines back to offerte
        offerte.forEach(o => {
          o.lines = {};
          const myLines = lines.filter(l => l.offerta_id === o.id);
          myLines.forEach(l => {
            if (!o.lines[l.category]) o.lines[l.category] = {};
            o.lines[l.category][l.attivita] = {
              id: l.id,
              valore: l.valore,
              included: l.included,
              status: l.status,
              note: l.note
            };
          });
        });
      }

      res.json(offerte);
    } catch (err) {
      console.error('Error fetching offerte:', err);
      res.status(500).json({ error: 'Failed to fetch offerte' });
    }
  });

  // ---- CREATE OFFERTA ----
  app.post('/api/offerte', authenticateHR, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const {
        anno, preventivo_number, revision, is_final_revision, tipo, oggetto,
        committente, cliente, client_id, superficie, destinazione_uso, specifiche,
        valore_totale, importo_opere, periodo_inizio, periodo_fine,
        note, status, lines, commessa_id
      } = req.body;

      const offerRes = await client.query(`
        INSERT INTO offerte (
          anno, preventivo_number, revision, is_final_revision, tipo, oggetto, 
          committente, cliente, client_id, superficie, destinazione_uso, specifiche, 
          valore_totale, importo_opere, periodo_inizio, periodo_fine, note, status, commessa_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *
      `, [
        anno, preventivo_number, revision, is_final_revision, tipo, oggetto,
        committente, cliente, client_id || null, superficie, destinazione_uso, specifiche,
        valore_totale || 0, importo_opere || 0, periodo_inizio || null, periodo_fine || null, note, status, commessa_id || null
      ]);
      const newOffer = offerRes.rows[0];

      if (lines) {
        for (const [category, activities] of Object.entries(lines)) {
          for (const [attivita, actData] of Object.entries(activities)) {
            if (actData.included) {
              await client.query(`
                INSERT INTO offerta_lines (offerta_id, category, attivita, valore, status)
                VALUES ($1, $2, $3, $4, $5)
              `, [newOffer.id, category, attivita, (parseFloat(actData.valore) || 0), actData.status || 'pending']);
            }
          }
        }
      }

      await client.query('COMMIT');
      res.json(newOffer);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error creating offerta:', err);
      res.status(500).json({ error: 'Failed to create offerta' });
    } finally {
      client.release();
    }
  });

  // ---- UPDATE OFFERTA ----
  app.put('/api/offerte/:id', authenticateHR, async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const {
        anno, preventivo_number, revision, is_final_revision, tipo, oggetto,
        committente, cliente, client_id, superficie, destinazione_uso, specifiche,
        valore_totale, importo_opere, periodo_inizio, periodo_fine,
        note, status, lines, commessa_id
      } = req.body;

      const offerRes = await client.query(`
        UPDATE offerte SET
          anno=$1, preventivo_number=$2, revision=$3, is_final_revision=$4, tipo=$5, oggetto=$6, 
          committente=$7, cliente=$8, client_id=$9, superficie=$10, destinazione_uso=$11, specifiche=$12, 
          valore_totale=$13, importo_opere=$14, periodo_inizio=$15, periodo_fine=$16, note=$17, status=$18, commessa_id=$19,
          updated_at=NOW()
        WHERE id=$20
        RETURNING *
      `, [
        anno, preventivo_number, revision, is_final_revision, tipo, oggetto,
        committente, cliente, client_id || null, superficie, destinazione_uso, specifiche,
        valore_totale || 0, importo_opere || 0, periodo_inizio || null, periodo_fine || null, note, status, commessa_id || null, id
      ]);

      if (offerRes.rowCount === 0) throw new Error("Offerta not found");

      await client.query(`DELETE FROM offerta_lines WHERE offerta_id=$1`, [id]);
      if (lines) {
        for (const [category, activities] of Object.entries(lines)) {
          for (const [attivita, actData] of Object.entries(activities)) {
            if (actData.included) {
              await client.query(`
                INSERT INTO offerta_lines (offerta_id, category, attivita, valore, status)
                VALUES ($1, $2, $3, $4, $5)
              `, [id, category, attivita, (parseFloat(actData.valore) || 0), actData.status || 'pending']);
            }
          }
        }
      }

      await client.query('COMMIT');
      res.json(offerRes.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error updating offerta:', err);
      res.status(500).json({ error: 'Failed to update offerta' });
    } finally {
      client.release();
    }
  });

  // ---- DELETE OFFERTA ----
  app.delete('/api/offerte/:id', authenticateHR, async (req, res) => {
    try {
      await query(`DELETE FROM offerte WHERE id=$1`, [req.params.id]);
      res.json({ message: 'Deleted' });
    } catch (err) {
      console.error('Error deleting offerta:', err);
      res.status(500).json({ error: 'Failed to delete offerta' });
    }
  });

  // ---- ACCEPT OFFERTA (AUTO CREATE OR MERGE TASK/COMMESSA) ----
  app.post('/api/offerte/:id/accept', authenticateHR, async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: offers } = await client.query(`SELECT * FROM offerte WHERE id=$1`, [id]);
      if (offers.length === 0) throw new Error("Offerta not found");
      const offerta = offers[0];

      // If the offer is already fully processed (linked to a system task AND accepted), do nothing.
      // NOTE: Manual linking (old data) sets commessa_id initially but task_id is only 
      // synced to the offer record AFTER the 'accept' merge logic runs.
      if (offerta.status === 'accettata' && offerta.task_id) {
        await client.query('ROLLBACK');
        console.warn(`[Offerte] Attempted to re-accept an already processed offer (ID: ${id})`);
        return res.status(400).json({ error: 'This offer has already been converted and processed.' });
      }

      const { rows: offerLines } = await client.query(`
        SELECT * FROM offerta_lines WHERE offerta_id=$1 AND status='accepted' AND included=true
      `, [id]);

      let taskId = offerta.task_id;
      let commessaId = offerta.commessa_id;
      let ccId = null;

      // Ensure a title exists for matching logic
      let taskTitle = "";
      if (offerta.anno) taskTitle += String(offerta.anno).padStart(2, '0');
      if (offerta.tipo) taskTitle += `-${offerta.tipo}`;
      if (offerta.preventivo_number) taskTitle += `-${String(offerta.preventivo_number).padStart(2, '0')}`;
      if (offerta.revision) taskTitle += `-R${offerta.revision}`;
      taskTitle = taskTitle ? `${taskTitle} - ${offerta.oggetto}` : (offerta.oggetto || "Nuovo Progetto (Auto)");
      const preventivoStr = taskTitle.split(' - ')[0];

      if (commessaId) {
        // It's linked to an EXISTING system project. We find the commessa_clients row to add lines to.
        const { rows: ccRows } = await client.query(`
          SELECT * FROM commessa_clients WHERE commessa_id=$1 ORDER BY id DESC LIMIT 1
        `, [commessaId]);

        if (ccRows.length > 0) {
          ccId = ccRows[0].id;
        } else {
          // Fallback: If commessa exists but no client is mapped, just create the cc mapping
          const ccRes = await client.query(`
            INSERT INTO commessa_clients (commessa_id, client_id, preventivo, voce_bilancio)
            VALUES ($1, $2, $3, $4) RETURNING *
          `, [commessaId, offerta.client_id || null, preventivoStr, 'R.04 - PREVENTIVO EX']);
          ccId = ccRes.rows[0].id;
        }

        // Get its task id
        const { rows: commRows } = await client.query(`SELECT task_id FROM commesse WHERE id=$1`, [commessaId]);
        if (commRows.length > 0) taskId = commRows[0].task_id;

      } else {
        // ---- CREATE BRAND NEW PROJECT ----
        const taskRes = await client.query(`
          INSERT INTO tasks (title, description, status) 
          VALUES ($1, $2, 'new') RETURNING *
        `, [taskTitle, offerta.specifiche]);
        taskId = taskRes.rows[0].id;

        const commessaNum = offerta.anno ? `${offerta.anno}-${String(offerta.preventivo_number || 0).padStart(3, '0')}` : null;
        const commRes = await client.query(`
          INSERT INTO commesse (task_id, name, comm_number) 
          VALUES ($1, $2, $3) RETURNING *
        `, [taskId, offerta.oggetto, commessaNum]);
        commessaId = commRes.rows[0].id;

        const ccRes = await client.query(`
          INSERT INTO commessa_clients (commessa_id, client_id, preventivo, voce_bilancio)
          VALUES ($1, $2, $3, $4) RETURNING *
        `, [
          commessaId,
          offerta.client_id || null,
          preventivoStr,
          'R.04 - PREVENTIVO'
        ]);
        ccId = ccRes.rows[0].id;
      }

      // Add the accepted lines to fatturato_lines for this ccId
      for (const l of offerLines) {
        await client.query(`
          INSERT INTO fatturato_lines (commessa_client_id, attivita, valore_ordine)
          VALUES ($1, $2, $3)
        `, [ccId, l.attivita, l.valore * 1000]);
      }

      // Finalize offer status
      await client.query(`
        UPDATE offerte SET task_id=$1, commessa_id=$2, status='accettata' WHERE id=$3
      `, [taskId, commessaId, id]);

      await client.query('COMMIT');
      res.json({ message: 'Offer processed', taskId, commessaId });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error accepting offerta:', err);
      res.status(500).json({ error: 'Failed to accept offerta: ' + err.message });
    } finally {
      client.release();
    }
  });

  // ---- PATCH LINE STATUS ----
  app.patch('/api/offerte/:id/lines/status', authenticateHR, async (req, res) => {
    const { id } = req.params;
    const { category, attivita, status, offerStatus } = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update specific line
      const lineUpdate = await client.query(`
        UPDATE offerta_lines 
        SET status = $1 
        WHERE offerta_id = $2 AND category = $3 AND attivita = $4
        RETURNING *
      `, [status, id, category, attivita]);

      if (lineUpdate.rowCount === 0) {
        throw new Error("Line not found or no change made");
      }

      // Update offer status if provided
      if (offerStatus) {
        await client.query(`UPDATE offerte SET status = $1 WHERE id = $2`, [offerStatus, id]);
      }

      await client.query('COMMIT');
      res.json({ success: true, line: lineUpdate.rows[0], offerStatus });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error patching line status:', err);
      res.status(500).json({ error: 'Failed to update status: ' + err.message });
    } finally {
      client.release();
    }
  });

};
