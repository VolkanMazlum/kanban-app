import { useState, useEffect } from "react";
import * as api from "../api";
import { EMPTY_LINE, EMPTY_CLIENT, EMPTY_FORM, inpStyle } from "../constants/costConstants.js";

export default function FatturatoDashboard({ isHR }) {
  const currentYear = new Date().getFullYear();
  const YEAR_OPTIONS = ["all", currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
  const [selectedYear, setSelectedYear] = useState("all");

  const [fatturatoList, setFatturatoList] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [fattFilterClient, setFattFilterClient] = useState("");

  const parseEuNum = (val) => {
    if (!val) return 0;
    if (typeof val === "number") return val;
    const str = String(val).trim();
    if (str.includes(".") && str.includes(",")) return parseFloat(str.replace(/\./g, "").replace(",", "."));
    if (str.includes(",")) return parseFloat(str.replace(",", "."));
    return parseFloat(str) || 0;
  };

  const [showFattModal, setShowFattModal] = useState(false);
  const [editingFatt, setEditingFatt] = useState(null);
  const [fattForm, setFattForm] = useState(EMPTY_FORM);
  const [savingFatt, setSavingFatt] = useState(false);

  const [showClientModal, setShowClientModal] = useState(false);
  const [clientForm, setClientForm] = useState({ name: "", vat_number: "" });
  const [savingClient, setSavingClient] = useState(false);

  useEffect(() => {
    if (!isHR) return;
    Promise.all([
      api.getFatturato(selectedYear),
      api.getClients(),
      api.getTasks()
    ])
    .then(([fatt, cls, tasks]) => {
      setFatturatoList(fatt);
      setClients(cls);
      setAllTasks(tasks);
    })
    .catch(console.error);
  }, [isHR, selectedYear]);

  if (!isHR) {
    return <div style={{ padding: 40, textAlign: "center", color: "#6B7280" }}>Unauthorized access. HR privileges required.</div>;
  }

  const openNewFatt = () => { setEditingFatt(null); setFattForm(EMPTY_FORM); setShowFattModal(true); };
  
  const openEditFatt = (row) => {
    setEditingFatt(row);
    const linkedTask = allTasks.find(t => t.id === row.task_id);
    
    let initialClients = row.clients && row.clients.length > 0 ? row.clients.map(c => ({
      ...c, lines: c.lines && c.lines.length > 0 ? c.lines : [{ ...EMPTY_LINE }]
    })) : [{ ...EMPTY_CLIENT }];

    if (linkedTask && linkedTask.phases) {
      const relevantPhases = linkedTask.phases.filter(ph => ph.status === 'active' || ph.status === 'done');
      
      initialClients = initialClients.map(client => {
        const existingActivities = new Set(client.lines.map(l => l.attivita));
        const missingPhases = relevantPhases.filter(ph => !existingActivities.has(ph.name));
        
        if (missingPhases.length > 0) {
          const linesToAdd = missingPhases.map(ph => ({ ...EMPTY_LINE, attivita: ph.name }));
          const filteredLines = client.lines.filter(l => l.attivita || l.valore_ordine || l.fatturato_amount);
          return { ...client, lines: [...(filteredLines.length > 0 ? filteredLines : []), ...linesToAdd] };
        }
        return client;
      });
    }

    setFattForm({
      task_id: row.task_id || "", 
      comm_number: row.comm_number || "", 
      name: row.name || "",
      clients: initialClients
    });
    setShowFattModal(true);
  };

  const handleSaveFatt = async () => {
    setSavingFatt(true);
    try {
      if (editingFatt) await api.updateFatturato(editingFatt.id, fattForm);
      else await api.createFatturato(fattForm);
      const fresh = await api.getFatturato(selectedYear);
      setFatturatoList(fresh); 
      setShowFattModal(false);
    } catch (err) { console.error(err); }
    setSavingFatt(false);
  };

  const handleDeleteFatt = async (id) => {
    if (!window.confirm("Delete this entire Commessa and ALL its clients/activities?")) return;
    try {
      await api.deleteFatturato(id);
      const fresh = await api.getFatturato(selectedYear);
      setFatturatoList(fresh);
    } catch (err) { console.error(err); }
  };

  const handleSaveClient = async () => {
    if (!clientForm.name.trim()) return;
    setSavingClient(true);
    try {
      const saved = await api.createClient(clientForm);
      setClients(p => [...p, saved]); 
      setShowClientModal(false);
    } catch (err) { console.error(err); }
    setSavingClient(false);
  };

  const filteredFatturatoList = fattFilterClient
    ? fatturatoList.map(comm => ({
        ...comm,
        clients: comm.clients.filter(c => String(c.client_id) === String(fattFilterClient))
      })).filter(comm => comm.clients.length > 0)
    : fatturatoList;

  const addClientBlock = () => setFattForm({ ...fattForm, clients: [...fattForm.clients, { ...EMPTY_CLIENT }] });
  const removeClientBlock = (cIdx) => { const newClients = [...fattForm.clients]; newClients.splice(cIdx, 1); setFattForm({ ...fattForm, clients: newClients }); };
  const handleClientChange = (cIdx, field, val) => { const newClients = [...fattForm.clients]; newClients[cIdx][field] = val; setFattForm({ ...fattForm, clients: newClients }); };
  const addLineToClient = (cIdx) => { const newClients = [...fattForm.clients]; newClients[cIdx].lines.push({ ...EMPTY_LINE }); setFattForm({ ...fattForm, clients: newClients }); };
  const removeLineFromClient = (cIdx, lIdx) => { const newClients = [...fattForm.clients]; newClients[cIdx].lines.splice(lIdx, 1); setFattForm({ ...fattForm, clients: newClients }); };
  const handleLineChange = (cIdx, lIdx, field, val) => { const newClients = [...fattForm.clients]; newClients[cIdx].lines[lIdx][field] = val; setFattForm({ ...fattForm, clients: newClients }); };

  return (
    <div style={{ padding: "28px 32px", overflowY: "auto", height: "calc(100vh - 65px)", fontFamily: "'Inter',sans-serif", background: "#F9FAFB" }}>
      
      {/* HEADER */}
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>Fatturato / Revenue Register</h2>
            <select 
              value={selectedYear} 
              onChange={e => setSelectedYear(e.target.value === "all" ? "all" : parseInt(e.target.value))}
              style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 14, fontWeight: 700, color: "#2563EB", background: "#EFF6FF", outline: "none", cursor: "pointer" }}
            >
              {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y === "all" ? "All Time" : y}</option>)}
            </select>
          </div>
          <p style={{ color: "#6B7280", margin: 0, fontSize: 14 }}>Manage invoiced amounts and incoming revenue</p>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <select
            value={fattFilterClient}
            onChange={e => setFattFilterClient(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, fontWeight: 600, color: "#374151", background: "#fff", cursor: "pointer", outline: "none" }}
          >
            <option value="">All Clients (Tümü)</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          
          <button onClick={openNewFatt} style={{ background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            + New Commessa
          </button>
        </div>
      </div>

      {/* DATA TABLE */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", overflowX: "auto" }}>
        {filteredFatturatoList.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>No entries found.</div> : (
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1200 }}>
            <thead>
              <tr style={{ background: "#F9FAFB" }}>
                {["Comm.","Task (Project)","Actions","N. Cliente","Cliente","Preventivo","Ordine","Attività","Valore Ordine","Fatturato","Rimanente","Rim. Prob.","Proforma"].map(h => <th key={h} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "#6B7280", textAlign: "left", whiteSpace: "nowrap", borderBottom: "2px solid #E5E7EB" }}>{h.toUpperCase()}</th>)}
              </tr>
            </thead>
            <tbody>
              {filteredFatturatoList.map((comm) => {
                const totalLines = comm.clients.reduce((sum, c) => sum + (c.lines?.length || 1), 0) || 1;
                let commRendered = false;

                return comm.clients.length === 0 ? (
                  <tr key={comm.id} style={{ borderBottom: "2px solid #E5E7EB" }}><td style={{ padding: "12px 14px", fontWeight: 700 }}>{comm.comm_number}</td><td style={{ padding: "12px 14px" }}>{comm.task_title}</td><td style={{ padding: "12px 14px" }}><button onClick={() => openEditFatt(comm)}>Edit</button></td><td colSpan={10} style={{ color: "#9CA3AF", padding: "12px" }}>No clients added.</td></tr>
                ) : comm.clients.map((client, cIdx) => {
                  const clientLines = client.lines?.length > 0 ? client.lines : [{}];
                  return clientLines.map((line, lIdx) => {
                    const isFirstComm = !commRendered; commRendered = true;
                    const isFirstCli = lIdx === 0;
                    const valOrdine = parseEuNum(line.valore_ordine);
                    const valFatt = parseEuNum(line.fatturato_amount);
                    const rimanente = valOrdine - valFatt;

                    return (
                      <tr key={`${comm.id}-${client.id}-${line.id||lIdx}`} style={{ borderBottom: lIdx === clientLines.length-1 && cIdx !== comm.clients.length-1 ? "1px dashed #D1D5DB" : cIdx === comm.clients.length-1 && lIdx === clientLines.length-1 ? "2px solid #E5E7EB" : "1px solid #F3F4F6" }}>
                        {isFirstComm && (
                          <>
                            <td rowSpan={totalLines} style={{ padding: "12px 14px", fontWeight: 800, color: "#4F46E5", verticalAlign: "top", borderRight: "1px solid #E5E7EB", background: "#FAFAFA" }}>{comm.comm_number || "—"}</td>
                            <td rowSpan={totalLines} style={{ padding: "12px 14px", fontWeight: 600, color: "#111827", verticalAlign: "top", maxWidth: 150, background: "#FAFAFA" }}>{comm.name ? (
                                <div><div style={{ fontWeight: 700 }}>{comm.name}</div><div style={{ fontSize: 11, color: "#9CA3AF" }}>{comm.task_title || "—"}</div></div>
                              ) : (comm.task_title || "—")}
                            </td>
                            <td rowSpan={totalLines} style={{ padding: "12px 14px", verticalAlign: "top", borderRight: "2px solid #E5E7EB", background: "#FAFAFA" }}>
                              <div style={{ display: "flex", gap: 4, flexDirection: "column" }}>
                                <button onClick={() => openEditFatt(comm)} style={{ background: "#F3F4F6", border: "1px solid #D1D5DB", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Edit</button>
                                <button onClick={() => handleDeleteFatt(comm.id)} style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Delete</button>
                              </div>
                            </td>
                          </>
                        )}
                        {isFirstCli && (
                          <>
                            <td rowSpan={clientLines.length} style={{ padding: "12px 14px", fontWeight: 700, color: "#6B7280", verticalAlign: "top", background: "#fff" }}>{client.n_cliente || "—"}</td>
                            <td rowSpan={clientLines.length} style={{ padding: "12px 14px", fontSize: 12, color: "#374151", verticalAlign: "top", fontWeight: 600, background: "#fff" }}>{client.client_name || "—"}</td>
                            <td rowSpan={clientLines.length} style={{ padding: "12px 14px", fontSize: 12, color: "#374151", verticalAlign: "top", background: "#fff" }}>{client.preventivo || "—"}</td>
                            <td rowSpan={clientLines.length} style={{ padding: "12px 14px", fontSize: 12, color: "#374151", verticalAlign: "top", borderRight: "1px solid #F3F4F6", background: "#fff" }}>{client.ordine || "—"}</td>
                          </>
                        )}
                        <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 600, color: "#111827" }}>{line.attivita || "—"}</td>
                        <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 600, color: "#6366F1" }}>{valOrdine ? `€${valOrdine.toLocaleString("it-IT", { minimumFractionDigits: 2 })}` : "—"}</td>
                        <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 700, color: "#059669" }}>{valFatt ? `€${valFatt.toLocaleString("it-IT", { minimumFractionDigits: 2 })}` : "—"}</td>
                        <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 600, color: rimanente > 0 ? "#F59E0B" : "#6B7280" }}>{valOrdine ? `€${rimanente.toLocaleString("it-IT", { minimumFractionDigits: 2 })}` : "—"}</td>
                        <td style={{ padding: "12px 14px", fontSize: 12, color: "#374151" }}>{line.rimanente_probabile ? `€${parseEuNum(line.rimanente_probabile).toLocaleString("it-IT", { minimumFractionDigits: 2 })}` : "—"}</td>
                        <td style={{ padding: "12px 14px", fontSize: 12, color: "#374151" }}>{line.proforma ? `€${parseEuNum(line.proforma).toLocaleString("it-IT", { minimumFractionDigits: 2 })}` : "—"}</td>
                      </tr>
                    );
                  })
                });
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* FATTURATO MODAL */}
      {showFattModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, backdropFilter: "blur(4px)", padding: "40px 0" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 960, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", maxHeight: "100%", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ color: "#111827", margin: 0, fontSize: 18, fontWeight: 700 }}>{editingFatt ? "Edit Commessa Hierarchy" : "New Commessa & Clients"}</h3>
              <button onClick={() => setShowFattModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}>✕</button>
            </div>

            <div style={{ background: "#F0FDF4", padding: 16, borderRadius: 8, border: "1px solid #BBF7D0", marginBottom: 20 }}>
              <h4 style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 800, color: "#166534" }}>1. COMMESSA (PROJECT ROOT)</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
                <div><label style={{ fontSize: 10, fontWeight: 700 }}>Comm. Number</label><input value={fattForm.comm_number} onChange={e => setFattForm({ ...fattForm, comm_number: e.target.value })} style={inpStyle} placeholder="e.g. 25-003" /></div>
                <div><label style={{ fontSize: 10, fontWeight: 700 }}>Commessa Name</label><input value={fattForm.name || ""} onChange={e => setFattForm({ ...fattForm, name: e.target.value })} style={inpStyle} placeholder="es. HOTEL DIANA MAJESTIC" /></div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700 }}>Linked Task</label>
                  <select 
                    value={fattForm.task_id} 
                    onChange={e => {
                      const selectedTaskId = e.target.value;
                      const oldTaskId = fattForm.task_id;
                      const oldTask = allTasks.find(t => String(t.id) === String(oldTaskId));
                      const selectedTask = allTasks.find(t => String(t.id) === String(selectedTaskId));
                      const oldPhaseNames = new Set(oldTask?.phases?.map(p => p.name) || []);
                      
                      let newClients = fattForm.clients.map(client => {
                        let cleanedLines = client.lines.filter(l => {
                          const isFromOldTask = oldPhaseNames.has(l.attivita);
                          const hasFinancialData = parseEuNum(l.valore_ordine) > 0 || parseEuNum(l.fatturato_amount) > 0;
                          return !(isFromOldTask && !hasFinancialData);
                        });

                        if (selectedTask && selectedTask.phases) {
                          const relevantPhases = selectedTask.phases.filter(ph => ph.status === 'active' || ph.status === 'done');
                          const existingActivities = new Set(cleanedLines.map(l => l.attivita));
                          const missingPhases = relevantPhases.filter(ph => !existingActivities.has(ph.name));
                          
                          if (missingPhases.length > 0) {
                            const linesToAdd = missingPhases.map(ph => ({ ...EMPTY_LINE, attivita: ph.name }));
                            cleanedLines = cleanedLines.filter(l => l.attivita || l.valore_ordine || l.fatturato_amount);
                            cleanedLines = [...(cleanedLines.length > 0 ? cleanedLines : []), ...linesToAdd];
                          }
                        }
                        
                        if (cleanedLines.length === 0) cleanedLines = [{ ...EMPTY_LINE }];
                        return { ...client, lines: cleanedLines };
                      });

                      setFattForm({ ...fattForm, task_id: selectedTaskId, name: selectedTask ? selectedTask.title : fattForm.name, clients: newClients });
                    }} 
                    style={inpStyle}
                  >
                    <option value="">— Not Linked —</option>
                    {allTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#1F2937" }}>2. CLIENTS & ACTIVITIES</h4>
                <button onClick={addClientBlock} style={{ background: "#2563EB", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+ Add Another Client</button>
              </div>

              {fattForm.clients.map((client, cIdx) => (
                <div key={cIdx} style={{ background: "#F9FAFB", padding: 16, borderRadius: 10, border: "2px solid #E5E7EB", marginBottom: 16, position: "relative" }}>
                  {fattForm.clients.length > 1 && <button onClick={() => removeClientBlock(cIdx)} style={{ position: "absolute", top: 16, right: 16, background: "#FEF2F2", color: "#DC2626", border: "none", padding: "4px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Remove Client</button>}
                  
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12, paddingRight: 60 }}>
                    <div><label style={{ fontSize: 10, fontWeight: 700 }}>N. Cliente</label><input value={client.n_cliente} onChange={e => handleClientChange(cIdx, "n_cliente", e.target.value)} style={inpStyle} placeholder="00" /></div>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700 }}>Client Profile</label>
                      <div style={{ display: "flex", gap: 4 }}>
                        <select value={client.client_id} onChange={e => handleClientChange(cIdx, "client_id", e.target.value)} style={{ ...inpStyle, padding: "6px", flex: 1 }}><option value="">— Select —</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                        <button onClick={() => setShowClientModal(true)} style={{ padding: "6px 10px", background: "#E5E7EB", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+</button>
                      </div>
                    </div>
                    <div><label style={{ fontSize: 10, fontWeight: 700 }}>Preventivo</label><input value={client.preventivo} onChange={e => handleClientChange(cIdx, "preventivo", e.target.value)} style={inpStyle} /></div>
                    <div><label style={{ fontSize: 10, fontWeight: 700 }}>Ordine Desc.</label><input value={client.ordine} onChange={e => handleClientChange(cIdx, "ordine", e.target.value)} style={inpStyle} /></div>
                  </div>

                  <div style={{ marginTop: 16, borderTop: "1px dashed #D1D5DB", paddingTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280" }}>ACTIVITIES FOR THIS CLIENT</div>
                      <button onClick={() => addLineToClient(cIdx)} style={{ background: "#10B981", color: "#fff", border: "none", padding: "4px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>+ Add Line</button>
                    </div>
                    {client.lines.map((line, lIdx) => (
                      <div key={lIdx} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                        <div style={{ flex: 2 }}><input placeholder="Attività" value={line.attivita} onChange={e => handleLineChange(cIdx, lIdx, "attivita", e.target.value)} style={{ ...inpStyle, padding: "6px" }} /></div>
                        <div style={{ flex: 1 }}><input type="number" placeholder="Valore €" value={line.valore_ordine} onChange={e => handleLineChange(cIdx, lIdx, "valore_ordine", e.target.value)} style={{ ...inpStyle, padding: "6px" }} /></div>
                        <div style={{ flex: 1 }}><input type="number" placeholder="Fatturato €" value={line.fatturato_amount} onChange={e => handleLineChange(cIdx, lIdx, "fatturato_amount", e.target.value)} style={{ ...inpStyle, padding: "6px" }} /></div>
                        <button onClick={() => removeLineFromClient(cIdx, lIdx)} disabled={client.lines.length === 1} style={{ background: "#F3F4F6", color: "#DC2626", border: "none", padding: "6px 10px", borderRadius: 6, cursor: client.lines.length > 1 ? "pointer" : "not-allowed" }}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button onClick={handleSaveFatt} disabled={savingFatt} style={{ width: "100%", padding: 14, background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>{savingFatt ? "Saving Everything..." : "Save Full Commessa Structure"}</button>
          </div>
        </div>
      )}

      {/* NEW CLIENT MODAL */}
      {showClientModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700 }}>Add New Client</h3>
            <div style={{ marginBottom: 14 }}><label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>CLIENT NAME</label><input value={clientForm.name} onChange={e => setClientForm({ ...clientForm, name: e.target.value })} style={inpStyle} placeholder="e.g. Comune di Milano" /></div>
            <div style={{ marginBottom: 24 }}><label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>VAT NUMBER (P.IVA)</label><input value={clientForm.vat_number} onChange={e => setClientForm({ ...clientForm, vat_number: e.target.value })} style={inpStyle} /></div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleSaveClient} disabled={savingClient} style={{ flex: 1, padding: 11, background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>{savingClient ? "Saving..." : "Save"}</button>
              <button onClick={() => setShowClientModal(false)} style={{ flex: 1, padding: 11, background: "#F9FAFB", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
