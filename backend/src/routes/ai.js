
module.exports = (app, query, authenticate, authenticateHR) => {
  app.post("/api/ai/chat", authenticateHR, async (req, res) => {
    const { messages, contextDate } = req.body;

    try {
      // 1. Fetch Financial Context if a date is provided or detected
      let financialContext = "";
      if (contextDate) {
        const [year, month] = contextDate.split("-");
        // Fetch KPI summary for that month (simplified version of kpi route logic)
        const kpiRes = await query(`
          SELECT 
            (SELECT COUNT(*) FROM tasks WHERE (planned_start <= $2 AND planned_end >= $1)) as total_tasks,
            (SELECT COUNT(*) FROM tasks WHERE status = 'done' AND updated_at::date >= $1 AND updated_at::date <= $2) as completed_tasks,
            (SELECT COALESCE(SUM(fr.amount), 0) FROM fatturato_realized fr WHERE EXTRACT(YEAR FROM fr.registration_date) = $3 AND EXTRACT(MONTH FROM fr.registration_date) = $4) as revenue,
            (SELECT COALESCE(SUM(fp.amount), 0) FROM fatturato_proforma fp WHERE EXTRACT(YEAR FROM fp.date) = $3 AND EXTRACT(MONTH FROM fp.date) = $4) as proforma
        `, [`${year}-${month}-01`, new Date(year, month, 0).toISOString().slice(0,10), year, month]);
        
        const data = kpiRes.rows[0];
        financialContext += `\nFinancial Context for ${month}/${year}:
- Total active tasks: ${data.total_tasks}
- Completed tasks: ${data.completed_tasks}
- Monthly Revenue (Realized): €${Number(data.revenue).toLocaleString('it-IT')}
- Monthly Proforma: €${Number(data.proforma).toLocaleString('it-IT')}
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

        financialContext += `\nDettaglio Fatturato per Progetto (Mese ${month}/${year}):\n${breakdowns || 'Nessun fatturato registrato per singole commesse in questo mese.'}\nSe la commessa non è in questa lista, significa che ha 0€ per questo mese.`;
      }

      // 2. Fetch specific lifetime data if a Commessa Number code is found in the message
      const lastUserMsg = messages[messages.length - 1].content || "";
      const commessaMatches = lastUserMsg.match(/\b\d{2}-\d{3}\b/g);

      if (commessaMatches) {
        const uniqueCommesse = [...new Set(commessaMatches)];
        const specificRes = await query(`
          SELECT 
            c.comm_number,
            c.name,
            COALESCE(SUM(fl.valore_ordine), 0) as valore_ordine,
            (SELECT COALESCE(SUM(fr.amount), 0) FROM fatturato_realized fr JOIN fatturato_lines fl2 ON fr.fatturato_line_id = fl2.id JOIN commessa_clients cc2 ON fl2.commessa_client_id = cc2.id WHERE cc2.commessa_id = c.id) as total_realized,
            (SELECT COALESCE(SUM(fp.amount), 0) FROM fatturato_proforma fp JOIN fatturato_lines fl2 ON fp.fatturato_line_id = fl2.id JOIN commessa_clients cc2 ON fl2.commessa_client_id = cc2.id WHERE cc2.commessa_id = c.id) as total_proforma
          FROM commesse c
          LEFT JOIN commessa_clients cc ON c.id = cc.commessa_id
          LEFT JOIN fatturato_lines fl ON cc.id = fl.commessa_client_id
          WHERE c.comm_number = ANY($1)
          GROUP BY c.id
        `, [uniqueCommesse]);

        if (specificRes.rows.length > 0) {
          const specificBreakdowns = specificRes.rows.map(r => 
            `- [${r.comm_number}] ${r.name}:\n  Valore Ordine Totale (Lifetime): €${Number(r.valore_ordine).toLocaleString('it-IT')}\n  Fatturato Totale Accumulato (Realized): €${Number(r.total_realized).toLocaleString('it-IT')}\n  Proforma Totale Accumulato (Proforma): €${Number(r.total_proforma).toLocaleString('it-IT')}`
          ).join('\n\n');
          financialContext += `\n\n--- Dati Finanziari Globali (Intero ciclo vitale del Progetto) ---\n${specificBreakdowns}`;
        }
      }

      if (!financialContext) {
        financialContext = "Nessun dato finanziario fornito per questa richiesta. L'utente non ha chiesto un mese specifico né un numero di commessa valido (es. 25-015). Limitati a rispondere alle sue domande.";
      }

      const systemPrompt = {
        role: "system",
        content: `Sei l'Assistente IA HR di Tekser S.R.L.
Rispondi in italiano in modo conciso e professionale.
Puoi fornire dati finanziari (realized revenue e proforma).
${financialContext}

Rispondi sempre normalmente alle domande. Se ti chiedono informazioni finanziare, usa i dati nel context.`
      };

      // 2. Call Ollama
      const response = await fetch("http://ollama:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemma2:2b",
          messages: [systemPrompt, ...messages],
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.statusText}`);
      }

      const data = await response.json();
      res.json({ message: data.message });

    } catch (err) {
      console.error("AI Chat Error:", err);
      res.status(500).json({ error: "AI Assistant is currently unavailable." });
    }
  });
};
