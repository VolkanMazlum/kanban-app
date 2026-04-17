
module.exports = (app, query, authenticate, authenticateHR) => {
  app.post("/api/ai/chat", authenticateHR, async (req, res) => {
    const { messages, contextDate } = req.body;

    /* ── Company & System knowledge ── */
    const COMPANY_KNOWLEDGE = `
=== INFORMAZIONI SULL'AZIENDA ===
Tekser S.R.L. è uno studio di ingegneria e consulenza tecnica con sede in Italia.
Si occupa principalmente di:
- Progettazione strutturale e ingegneria civile (residenziale, sanitario, industriale, sportivo, uffici, hotel, student housing, data center, istruzione, retail, edifici pubblici)
- Direzione lavori e supervisione cantieri
- Consulenza tecnica e analisi normative
- Progettazione BIM (Building Information Modeling)

=== INFORMAZIONI SUL SISTEMA ===
Questo sistema è un gestionale ERP/Kanban sviluppato su misura per Tekser S.R.L.
Le funzionalità principali includono:
1. KANBAN / TASK MANAGEMENT: Gestione di task/progetti con stati (New, In Process, Blocked, Done). Ogni task può avere fasi, sottoattività, scadenze e risorse assegnate.
2. COMMESSE (Progetti): Ogni commessa ha un numero univoco (formato YY-NNN, es: 26-001). Le commesse sono collegate a clienti, attività lavorative (fatturato_lines), ordini (fatturato_ordini), realized revenue e proforma.
3. OFFERTE: Gestione preventivi e gare d'appalto. Le offerte hanno stati: aperta, accettata, non_accettata. Possono essere di tipo P (Preventivo) o G (Gara).
4. CLIENTI: Anagrafica completa clienti con dati fiscali, contatti, indirizzi, banca, ecc.
5. FATTURATO DASHBOARD: Monitoraggio finanziario per commessa, per cliente, per anno. Include realized revenue, proforma, valore ordine e costi.
6. KPI DASHBOARD: Indicatori chiave di performance: workload, ore lavorate, ricavi mensili, tasso di conversione offerte.
7. GANTT CHART: Pianificazione visuale temporale dei task.
8. HR / RISORSE UMANE: Gestione dipendenti, ore lavorate, costi, straordinari, costi extra.
9. GESTIONE UTENTI: Ruoli (hr, user), autenticazione sicura, audit log delle operazioni.
10. REPORTISTICA: Export Excel/CSV di task, finanze, workload, dipendenti, clienti.

Tecnologie usate: Node.js + Express (backend), React (frontend), PostgreSQL (database), Docker (containerizzazione), Ollama + Gemma2 (AI locale).

Il sistema è progettato per garantire: sicurezza dei dati (autenticazione JWT, audit log), integrità transazionale (BEGIN/COMMIT PostgreSQL), e scalabilità.
=== FINE INFORMAZIONI ===
`;

    try {
      const lastUserMsg = messages[messages.length - 1]?.content || "";
      let financialContext = COMPANY_KNOWLEDGE;

      /* ── 1. Monthly financial context ── */
      if (contextDate) {
        const [year, month] = contextDate.split("-");
        const kpiRes = await query(`
          SELECT 
            (SELECT COUNT(*) FROM tasks WHERE (planned_start <= $2 AND planned_end >= $1)) as total_tasks,
            (SELECT COUNT(*) FROM tasks WHERE status = 'done' AND updated_at::date >= $1 AND updated_at::date <= $2) as completed_tasks,
            (SELECT COALESCE(SUM(fr.amount), 0) FROM fatturato_realized fr WHERE EXTRACT(YEAR FROM fr.registration_date) = $3 AND EXTRACT(MONTH FROM fr.registration_date) = $4) as revenue,
            (SELECT COALESCE(SUM(fp.amount), 0) FROM fatturato_proforma fp WHERE EXTRACT(YEAR FROM fp.date) = $3 AND EXTRACT(MONTH FROM fp.date) = $4) as proforma
        `, [`${year}-${month}-01`, new Date(year, month, 0).toISOString().slice(0,10), year, month]);

        const data = kpiRes.rows[0];
        financialContext += `\n=== DATI FINANZIARI ${month}/${year} ===
- Task attivi nel periodo: ${data.total_tasks}
- Task completati nel periodo: ${data.completed_tasks}
- Ricavi Realizzati del mese: €${Number(data.revenue).toLocaleString('it-IT')}
- Proforma del mese: €${Number(data.proforma).toLocaleString('it-IT')}
`;

        const commesseRes = await query(`
          WITH Realized AS (
            SELECT fl.commessa_client_id, SUM(fr.amount) as amount
            FROM fatturato_realized fr
            JOIN fatturato_lines fl ON fr.fatturato_line_id = fl.id
            WHERE EXTRACT(YEAR FROM fr.registration_date) = $1 AND EXTRACT(MONTH FROM fr.registration_date) = $2
            GROUP BY fl.commessa_client_id
          ),
          Proforma AS (
            SELECT fl.commessa_client_id, SUM(fp.amount) as amount
            FROM fatturato_proforma fp
            JOIN fatturato_lines fl ON fp.fatturato_line_id = fl.id
            WHERE EXTRACT(YEAR FROM fp.date) = $1 AND EXTRACT(MONTH FROM fp.date) = $2
            GROUP BY fl.commessa_client_id
          )
          SELECT 
            c.comm_number,
            c.name,
            COALESCE(SUM(r.amount), 0) as realized,
            COALESCE(SUM(p.amount), 0) as proforma
          FROM commesse c
          JOIN commessa_clients cc ON c.id = cc.commessa_id
          LEFT JOIN Realized r ON cc.id = r.commessa_client_id
          LEFT JOIN Proforma p ON cc.id = p.commessa_client_id
          GROUP BY c.id
          HAVING COALESCE(SUM(r.amount), 0) > 0 OR COALESCE(SUM(p.amount), 0) > 0
          ORDER BY realized DESC, proforma DESC
          LIMIT 30
        `, [year, month]);

        const breakdowns = commesseRes.rows.map(r =>
          `- [${r.comm_number}] ${r.name}: Realized €${Number(r.realized).toLocaleString('it-IT')}, Proforma €${Number(r.proforma).toLocaleString('it-IT')}`
        ).join('\n');

        financialContext += `\nDettaglio per Commessa (${month}/${year}):\n${breakdowns || 'Nessun fatturato registrato per questo mese.'}\nNota: se una commessa non è in lista significa €0 per questo mese.`;
      }

      /* ── 2. Specific commessa lifetime data ──
         Regex captures both:
           - Standard format:  26-001
           - Extended format:  26-G-19, 25-A-03, etc.
         Also falls back to keyword search on commessa name.
      ── */
      const commessaMatches = lastUserMsg.match(/\b\d{2}-[A-Z0-9](?:-[A-Z0-9]+)*\b/gi);
      const uniqueCommesse = commessaMatches ? [...new Set(commessaMatches.map(s => s.toUpperCase()))] : [];

      // Also try to match by partial name keywords (words ≥ 4 chars that aren't common Italian words)
      const stopWords = new Set(['cosa','qual','sono','valore','ordine','totale','della','delle','degli','questo','questa','quanti','euro','anno','mese','settembre','ottobre','novembre','dicembre','gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','what','about','tell','show','give','find','cerca','dimmi','mostra','trova','puoi','come','dove','quando','perché','quanto','quali']);
      const keywords = lastUserMsg
        .match(/\b[A-Za-zÀ-ÿ]{4,}\b/g)
        ?.map(w => w.toLowerCase())
        .filter(w => !stopWords.has(w)) || [];

      const specificRes = await query(`
        SELECT 
          c.comm_number,
          c.name,
          c.notes,
          (SELECT cl.name FROM clients cl 
           JOIN commessa_clients cc2 ON cc2.client_id = cl.id 
           WHERE cc2.commessa_id = c.id LIMIT 1) as client_name,
          COALESCE(SUM(fl.valore_ordine), 0) as valore_ordine,
          (SELECT COALESCE(SUM(fr.amount), 0) FROM fatturato_realized fr JOIN fatturato_lines fl2 ON fr.fatturato_line_id = fl2.id JOIN commessa_clients cc2 ON fl2.commessa_client_id = cc2.id WHERE cc2.commessa_id = c.id) as total_realized,
          (SELECT COALESCE(SUM(fp.amount), 0) FROM fatturato_proforma fp JOIN fatturato_lines fl2 ON fp.fatturato_line_id = fl2.id JOIN commessa_clients cc2 ON fl2.commessa_client_id = cc2.id WHERE cc2.commessa_id = c.id) as total_proforma,
          (SELECT COUNT(*) FROM offerte o WHERE o.commessa_id = c.id) as num_offerte
        FROM commesse c
        LEFT JOIN commessa_clients cc ON c.id = cc.commessa_id
        LEFT JOIN fatturato_lines fl ON cc.id = fl.commessa_client_id
        WHERE 
          ($1::text[] IS NOT NULL AND array_length($1::text[], 1) > 0 AND UPPER(c.comm_number) = ANY($1::text[]))
          OR ($2::text IS NOT NULL AND c.name ILIKE '%' || $2 || '%')
        GROUP BY c.id
        ORDER BY c.comm_number DESC
        LIMIT 5
      `, [uniqueCommesse.length > 0 ? uniqueCommesse : null, keywords.length > 0 ? keywords[0] : null]);

      if (specificRes.rows.length > 0) {
          const rows = specificRes.rows.map(r =>
            `- [${r.comm_number}] ${r.name}
  Cliente: ${r.client_name || 'Non assegnato'}
  Valore Ordine Totale: €${Number(r.valore_ordine).toLocaleString('it-IT')}
  Fatturato Realizzato: €${Number(r.total_realized).toLocaleString('it-IT')}
  Proforma Totale: €${Number(r.total_proforma).toLocaleString('it-IT')}
  Offerte collegate: ${r.num_offerte}
  Note: ${r.notes || 'Nessuna'}`
          ).join('\n\n');
          financialContext += `\n\n=== DATI COMMESSA (Ciclo Vitale Completo) ===\n${rows}`;
        } else if (uniqueCommesse.length > 0) {
          financialContext += `\n\nNOTA: Le commesse ${uniqueCommesse.join(', ')} NON sono presenti nel sistema. Verifica il numero esatto.`;
        }

      /* ── 3. Client lookup ── */
      const allClientsRes = await query(`
        SELECT id, name, vat_number, codice_univoco as sdi_code, email_pec as pec, 
               contact_email as email, phone, address, localita, province,
               codice_fiscale, pagamento, notes
        FROM clients
      `);
      const upperMsg = lastUserMsg.toUpperCase();
      const foundClients = allClientsRes.rows.filter(
        c => c.name && c.name.trim().length > 2 && upperMsg.includes(c.name.trim().toUpperCase())
      );

      if (foundClients.length > 0) {
        const cStr = foundClients.map(c =>
          `- Cliente: ${c.name}
  Email: ${c.email || 'N/A'}
  Telefono: ${c.phone || 'N/A'}
  PEC: ${c.pec || 'N/A'}
  P.IVA: ${c.vat_number || 'N/A'}
  Codice Fiscale: ${c.codice_fiscale || 'N/A'}
  Indirizzo: ${c.address ? `${c.address}, ${c.localita || ''} ${c.province || ''}`.trim() : 'N/A'}
  SDI: ${c.sdi_code || 'N/A'}
  Condizioni Pagamento: ${c.pagamento || 'N/A'}
  Note: ${c.notes || 'Nessuna'}`
        ).join('\n\n');
        financialContext += `\n\n=== DATI CLIENTE ===\n${cStr}\n(Usa questi dati ESATTAMENTE come scritti)`;
      }

      /* ── 4. Offerte stats if asked ── */
      const isAboutOfferte = /offert|preventi|gara|teklif|quotat/i.test(lastUserMsg);
      if (isAboutOfferte) {
        const offRes = await query(`
          SELECT 
            anno,
            tipo,
            COUNT(*) FILTER (WHERE status = 'aperta') as aperte,
            COUNT(*) FILTER (WHERE status = 'accettata') as accettate,
            COUNT(*) FILTER (WHERE status = 'non_accettata') as rifiutate,
            COUNT(*) as totale,
            ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'accettata') / NULLIF(COUNT(*),0), 1) as tasso_conv
          FROM offerte
          WHERE anno >= EXTRACT(YEAR FROM NOW()) - 3
          GROUP BY anno, tipo
          ORDER BY anno DESC, tipo
        `);
        if (offRes.rows.length > 0) {
          const offStr = offRes.rows.map(r =>
            `- ${r.anno} (${r.tipo === 'P' ? 'Preventivi' : 'Gare'}): ${r.totale} totali, ${r.aperte} aperte, ${r.accettate} accettate, ${r.rifiutate} rifiutate — Tasso conversione: ${r.tasso_conv || 0}%`
          ).join('\n');
          financialContext += `\n\n=== STATISTICHE OFFERTE (ultimi 3 anni) ===\n${offStr}`;
        }
      }

      /* ── 5. General system stats if asked about system/company ── */
      const isAboutSystem = /sistem|aziend|chi siet|cos'è|cosa fate|tekser|quant|statistic|totale/i.test(lastUserMsg);
      if (isAboutSystem) {
        const statsRes = await query(`
          SELECT 
            (SELECT COUNT(*) FROM commesse) as total_commesse,
            (SELECT COUNT(*) FROM tasks WHERE status != 'done') as task_attivi,
            (SELECT COUNT(*) FROM clients WHERE NOT obsoleto) as total_clienti,
            (SELECT COUNT(*) FROM employees WHERE category = 'internal') as dipendenti_interni,
            (SELECT COUNT(*) FROM offerte WHERE status = 'aperta') as offerte_aperte,
            (SELECT COALESCE(SUM(fr.amount),0) FROM fatturato_realized fr WHERE EXTRACT(YEAR FROM fr.registration_date) = EXTRACT(YEAR FROM NOW())) as fatturato_ytd
        `);
        const s = statsRes.rows[0];
        financialContext += `\n\n=== STATISTICHE SISTEMA ATTUALI ===
- Commesse totali nel sistema: ${s.total_commesse}
- Task attivi (non completati): ${s.task_attivi}
- Clienti attivi in anagrafica: ${s.total_clienti}
- Dipendenti interni: ${s.dipendenti_interni}
- Offerte aperte: ${s.offerte_aperte}
- Fatturato realizzato anno corrente (YTD): €${Number(s.fatturato_ytd).toLocaleString('it-IT')}`;
      }

      /* ── System prompt ── */
      const systemPrompt = {
        role: "system",
        content: `Sei l'Assistente AI HR di Tekser S.R.L.
Rispondi SEMPRE in italiano, in modo conciso, preciso e professionale.
Puoi fornire dati finanziari, informazioni su clienti, commesse, offerte e il sistema stesso.
Per domande su dati NON presenti nel contesto, dì chiaramente "Non ho dati su questo" invece di inventare.
Non inventare MAI numeri, date o dati non forniti nel contesto.
Se ti chiedono "chi sei" o "che sistema è questo", descrivi Tekser S.R.L. e il sistema gestionale.

${financialContext}

ISTRUZIONI DI RISPOSTA:
- Per dati finanziari usa i valori esatti dal contesto.
- Se un dato è mancante (NULL/non assegnato), segnalalo esplicitamente.
- Mantieni risposte concise ma complete.
- Puoi usare emoji per migliorare la leggibilità (es: ✅ ❌ 📊 💰 🏗️).`
      };

      /* ── Call Ollama ── */
      const response = await fetch("http://ollama:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemma2:2b",
          messages: [systemPrompt, ...messages],
          stream: false
        })
      });

      if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);

      const data = await response.json();
      res.json({ message: data.message });

    } catch (err) {
      console.error("AI Chat Error:", err);
      res.status(500).json({ error: "AI Assistant is currently unavailable." });
    }
  });
};
