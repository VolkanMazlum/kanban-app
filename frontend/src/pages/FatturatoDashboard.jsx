import React, { useState, useEffect } from "react";
import * as api from "../api";
import { downloadAuthenticatedFile } from "../utils/downloadUtils";
import { getEmptyLine, getEmptyClient, getEmptyForm, inpStyle } from "../constants/costConstants.js";

const parseEuNum = (val) => {
  if (!val) return 0;
  if (typeof val === "number") return val;
  let str = String(val).trim().replace(/[^0-9,.-]/g, "");
  const lastComma = str.lastIndexOf(',');
  const lastDot = str.lastIndexOf('.');
  if (lastComma > lastDot) {
    return parseFloat(str.replace(/\./g, "").replace(",", "."));
  } else {
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount > 1) return parseFloat(str.replace(/\./g, ""));
    return parseFloat(str.replace(/,/g, "")) || 0;
  }
};
const fmtEu = (num) => parseFloat(num || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function FatturatoDashboard({ isHR }) {
  const [availableYears, setAvailableYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState("all");


  const [fatturatoList, setFatturatoList] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [fattFilterClient, setFattFilterClient] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [showFattModal, setShowFattModal] = useState(false);
  const [editingFatt, setEditingFatt] = useState(null);
  const [fattForm, setFattForm] = useState(getEmptyForm());
  const [savingFatt, setSavingFatt] = useState(false);

  const [showClientModal, setShowClientModal] = useState(false);
  const [clientForm, setClientForm] = useState({ name: "", vat_number: "" });
  const [savingClient, setSavingClient] = useState(false);

  const [salMonthlyData, setSalMonthlyData] = useState([]);
  const [salYear, setSalYear] = useState(new Date().getFullYear());
  const [savingSal, setSavingSal] = useState(false);
  const [obiettiviData, setObiettiviData] = useState({}); // { commId: [ {year, period, ordinante_val, acquisizioni_val} ] }

  useEffect(() => {
    if (isHR) {
      api.getAvailableYears().then(setAvailableYears).catch(console.error);
    }
  }, [isHR]);

  const fetchData = () => {

    Promise.all([
      api.getFatturato(selectedYear),
      api.getClients(),
      api.getTasks(),
      api.getMonthlySAL(selectedYear, null)
    ])
      .then(([fatt, cls, tasks, sal]) => {
        setFatturatoList(fatt);
        setClients(cls);
        setAllTasks(tasks);
        setSalMonthlyData(sal);

        // Pre-populate obiettiviData map from the nested data to avoid N+1 API calls
        const objMap = {};
        (fatt || []).forEach(comm => {
          (comm.clients || []).forEach(cl => {
            (cl.lines || []).forEach(ln => {
              if (ln.obiettivi) objMap[ln.id] = ln.obiettivi;
            });
          });
        });
        setObiettiviData(objMap);
      })
      .catch(console.error);
  };

  useEffect(() => {
    if (isHR) fetchData();
  }, [isHR, selectedYear, salYear]);

  if (!isHR) {
    return <div style={{ padding: 40, textAlign: "center", color: "#6B7280" }}>Unauthorized access. HR privileges required.</div>;
  }

  // ---- COMMESSA CRUD ----
  const openNewFatt = () => { setEditingFatt(null); setFattForm(getEmptyForm()); setShowFattModal(true); };

  const openEditFatt = (row) => {
    setEditingFatt(row);
    const linkedTask = allTasks.find(t => t.id === row.task_id);

    let initialClients = row.clients && row.clients.length > 0 ? row.clients.map(c => ({
      ...c, lines: c.lines && c.lines.length > 0 ? c.lines : [{ ...getEmptyLine() }]
    })) : [{ ...getEmptyClient() }];

    if (linkedTask && linkedTask.phases) {
      const relevantPhases = linkedTask.phases.filter(ph => ph.status === 'active' || ph.status === 'done');
      initialClients = initialClients.map(client => {
        const existingActivities = new Set(client.lines.map(l => l.attivita));
        const missingPhases = relevantPhases.filter(ph => !existingActivities.has(ph.name));
        if (missingPhases.length > 0) {
          const linesToAdd = missingPhases.map(ph => ({ ...getEmptyLine(), attivita: ph.name }));
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
    // Validation: Check if any line's ordini (percentages) exceed 100%
    for (const client of fattForm.clients) {
      for (const line of client.lines) {
        const totalPct = (line.ordini || []).reduce((sum, o) => sum + (parseFloat(o.percentage) || 0), 0);
        if (totalPct > 100.01) { // Allowing tiny floating point margin
          alert(`Error: The total percentage for activity "${line.attivita || 'unnamed'}" exceeds 100% (${totalPct.toFixed(2)}%). Please correct it before saving.`);
          return;
        }
      }
    }

    setSavingFatt(true);
    try {
      if (editingFatt) await api.updateFatturato(editingFatt.id, fattForm);
      else await api.createFatturato(fattForm);
      fetchData();
      setShowFattModal(false);
    } catch (err) { console.error(err); }
    setSavingFatt(false);
  };

  const handleDeleteFatt = async (id) => {
    if (!window.confirm("Delete this entire Commessa and ALL its clients/activities?")) return;
    try {
      await api.deleteFatturato(id);
      fetchData();
    } catch (err) { console.error(err); }
  };

  // ---- CLIENT CRUD ----
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

  const filteredFatturatoList = fatturatoList.map(comm => {
    // 1. First, apply client filter if active
    let clients = comm.clients;
    if (fattFilterClient) {
      clients = clients.filter(c => String(c.client_id) === String(fattFilterClient));
    }

    // 2. Second, apply search term filter if active
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const matchesComm =
        (comm.comm_number || "").toLowerCase().includes(s) ||
        (comm.name || "").toLowerCase().includes(s) ||
        (comm.task_title || "").toLowerCase().includes(s);

      // If comm itself doesn't match, check if any client or lines match
      if (!matchesComm) {
        clients = clients.filter(cl => {
          const matchesClient =
            (cl.client_name || "").toLowerCase().includes(s) ||
            (cl.n_cliente || "").toLowerCase().includes(s) ||
            (cl.n_ordine || "").toLowerCase().includes(s);

          const matchesAnyLine = (cl.lines || []).some(ln =>
            (ln.attivita || "").toLowerCase().includes(s) ||
            (ln.descrizione || "").toLowerCase().includes(s)
          );
          return matchesClient || matchesAnyLine;
        });
      }
    }

    return { ...comm, clients };
  }).filter(comm => comm.clients.length > 0);

  // Form Handlers
  const addClientBlock = () => setFattForm({ ...fattForm, clients: [...fattForm.clients, getEmptyClient()] });
  const removeClientBlock = (cIdx) => { const newClients = [...fattForm.clients]; newClients.splice(cIdx, 1); setFattForm({ ...fattForm, clients: newClients }); };
  const handleClientChange = (cIdx, field, val) => {
    const newClients = [...fattForm.clients];
    newClients[cIdx] = { ...newClients[cIdx], [field]: val };
    setFattForm({ ...fattForm, clients: newClients });
  };
  const addLineToClient = (cIdx) => {
    const newClients = [...fattForm.clients];
    newClients[cIdx] = { ...newClients[cIdx], lines: [...newClients[cIdx].lines, getEmptyLine()] };
    setFattForm({ ...fattForm, clients: newClients });
  };
  const removeLineFromClient = (cIdx, lIdx) => { const newClients = [...fattForm.clients]; newClients[cIdx].lines.splice(lIdx, 1); setFattForm({ ...fattForm, clients: newClients }); };
  /*** 
  const updateFatturatoFromOrdini = (newClients, cIdx, lIdx) => {
    const line = newClients[cIdx].lines[lIdx];
    const valOrdine = parseFloat(line.valore_ordine) || 0;
    const totalPct = (line.ordini || []).reduce((sum, o) => sum + (parseFloat(o.percentage) || 0), 0);
    // If there are installments, they define the fatturato_amount
    if ((line.ordini || []).length > 0) {
      line.fatturato_amount = (valOrdine * totalPct / 100).toFixed(2);
    }
  };*/

  const handleLineChange = (cIdx, lIdx, field, val) => {
    const newClients = [...fattForm.clients];
    const newLine = { ...newClients[cIdx].lines[lIdx], [field]: val };
    newClients[cIdx] = { ...newClients[cIdx], lines: [...newClients[cIdx].lines] };
    newClients[cIdx].lines[lIdx] = newLine;

    //if (field === "valore_ordine") updateFatturatoFromOrdini(newClients, cIdx, lIdx);
    setFattForm({ ...fattForm, clients: newClients });
  };
  const addOrdineToLine = (cIdx, lIdx) => {
    const newClients = [...fattForm.clients];
    const newLine = { ...newClients[cIdx].lines[lIdx] };
    if (!newLine.ordini) newLine.ordini = [];
    newLine.ordini = [...newLine.ordini, { label: "", percentage: "" }];
    newClients[cIdx] = { ...newClients[cIdx], lines: [...newClients[cIdx].lines] };
    newClients[cIdx].lines[lIdx] = newLine;
    //updateFatturatoFromOrdini(newClients, cIdx, lIdx);
    setFattForm({ ...fattForm, clients: newClients });
  };
  const removeOrdineFromLine = (cIdx, lIdx, oIdx) => {
    const newClients = [...fattForm.clients];
    newClients[cIdx].lines[lIdx].ordini.splice(oIdx, 1);
    //updateFatturatoFromOrdini(newClients, cIdx, lIdx);
    setFattForm({ ...fattForm, clients: newClients });
  };

  // ---- REALIZED REVENUE HANDLERS (Billing History) ----
  const addRealizedToLine = (cIdx, lIdx) => {
    const newClients = [...fattForm.clients];
    if (!newClients[cIdx].lines[lIdx].realized) newClients[cIdx].lines[lIdx].realized = [];
    newClients[cIdx].lines[lIdx].realized.push({ amount: "", registration_date: new Date().toISOString().split('T')[0], note: "" });
    setFattForm({ ...fattForm, clients: newClients });
  };

  const handleRealizedChange = (cIdx, lIdx, rIdx, field, val) => {
    const newClients = [...fattForm.clients];
    newClients[cIdx].lines[lIdx].realized[rIdx][field] = val;

    // Auto-update total fatturato_amount for the line
    const totalRealized = newClients[cIdx].lines[lIdx].realized.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
    newClients[cIdx].lines[lIdx].fatturato_amount = totalRealized > 0 ? totalRealized.toString() : "";

    setFattForm({ ...fattForm, clients: newClients });
  };

  const removeRealizedFromLine = (cIdx, lIdx, rIdx) => {
    const newClients = [...fattForm.clients];
    newClients[cIdx].lines[lIdx].realized.splice(rIdx, 1);

    // Auto-update total fatturato_amount for the line
    const totalRealized = newClients[cIdx].lines[lIdx].realized.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
    newClients[cIdx].lines[lIdx].fatturato_amount = totalRealized > 0 ? totalRealized.toString() : "";

    setFattForm({ ...fattForm, clients: newClients });
  };

  // ---- PROFORMA HANDLERS ----
  const addProformaToLine = (cIdx, lIdx) => {
    const newClients = [...fattForm.clients];
    if (!newClients[cIdx].lines[lIdx].proforma_entries) newClients[cIdx].lines[lIdx].proforma_entries = [];
    newClients[cIdx].lines[lIdx].proforma_entries.push({ amount: "", date: new Date().toISOString().split('T')[0], note: "" });
    setFattForm({ ...fattForm, clients: newClients });
  };

  const handleProformaChange = (cIdx, lIdx, pIdx, field, val) => {
    const newClients = [...fattForm.clients];
    newClients[cIdx].lines[lIdx].proforma_entries[pIdx][field] = val;

    // Auto-update total proforma for the line
    const totalProf = newClients[cIdx].lines[lIdx].proforma_entries.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    newClients[cIdx].lines[lIdx].proforma = totalProf > 0 ? totalProf.toString() : "";

    setFattForm({ ...fattForm, clients: newClients });
  };

  const removeProformaFromLine = (cIdx, lIdx, pIdx) => {
    const newClients = [...fattForm.clients];
    newClients[cIdx].lines[lIdx].proforma_entries.splice(pIdx, 1);

    // Auto-update total proforma for the line
    const totalProf = newClients[cIdx].lines[lIdx].proforma_entries.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    newClients[cIdx].lines[lIdx].proforma = totalProf > 0 ? totalProf.toString() : "";

    setFattForm({ ...fattForm, clients: newClients });
  };
  const handleOrdineChange = (cIdx, lIdx, oIdx, field, val) => {
    const newClients = [...fattForm.clients];
    const newLine = { ...newClients[cIdx].lines[lIdx] };
    const newOrdini = [...newLine.ordini];
    newOrdini[oIdx] = { ...newOrdini[oIdx], [field]: val };
    newLine.ordini = newOrdini;
    newClients[cIdx] = { ...newClients[cIdx], lines: [...newClients[cIdx].lines] };
    newClients[cIdx].lines[lIdx] = newLine;

    //if (field === "percentage") updateFatturatoFromOrdini(newClients, cIdx, lIdx);
    setFattForm({ ...fattForm, clients: newClients });
  };


  const handleObiettiviChange = (lineId, period, field, val) => {
    const prevLineObjs = obiettiviData[lineId] || [];
    const queryYear = (selectedYear && selectedYear !== "all") ? parseInt(selectedYear) : new Date().getFullYear();
    const idx = prevLineObjs.findIndex(o => o.period === period && o.year === queryYear);
    const newLineObjs = [...prevLineObjs];

    if (idx >= 0) {
      newLineObjs[idx] = { ...newLineObjs[idx], [field]: parseFloat(val) || 0 };
    } else {
      newLineObjs.push({ fatturato_line_id: lineId, year: queryYear, period, ordinante_val: 0, acquisizioni_val: 0, [field]: parseFloat(val) || 0 });
    }
    setObiettiviData(prev => ({ ...prev, [lineId]: newLineObjs }));
  };

  const handleSaveLineObiettivi = async (lineId) => {
    const lineObjs = obiettiviData[lineId] || [];
    if (lineObjs.length === 0) return;

    // Group by year and save each year
    const years = [...new Set(lineObjs.map(o => o.year))];
    try {
      for (const y of years) {
        const yearEntries = lineObjs.filter(o => o.year === y);
        await api.updateLineObiettiviBulk(lineId, { year: y, entries: yearEntries });
      }
      alert("Obiettivi updated for all years!");
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Error saving obiettivi: " + err.message);
    }
  };

  const handleSalAddEntry = (lineId) => {
    const newData = [...(salMonthlyData || [])];
    const targetMonth = new Date().getMonth() + 1;
    const targetYear = new Date().getFullYear();
    newData.push({
      fatturato_line_id: lineId,
      value: 0,
      year: targetYear,
      month: targetMonth,
      status: 'in_progress',
      temp_key: Math.random() // help React tracking if needed
    });
    setSalMonthlyData(newData);
  };


  return (
    <div style={{ padding: "28px 32px", overflowY: "auto", height: "100%", fontFamily: "'Inter',sans-serif", background: "#F9FAFB" }}>

      {/* HEADER SECTION */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div style={{ flex: "1 1 auto", minWidth: 250 }}>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: "#111827", margin: 0, letterSpacing: "-0.025em" }}>Fatturato / Revenue Register</h2>
            <p style={{ color: "#6B7280", margin: "4px 0 0", fontSize: 14 }}>Manage invoiced amounts and work progress tracking (SAL)</p>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              onClick={() => downloadAuthenticatedFile(`/reports/finances?year=${selectedYear}`, `Financial_Report_${selectedYear}_${new Date().toISOString().split('T')[0]}.xlsx`)}
              style={{ padding: "10px 18px", background: "#fff", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 8 }}
              onMouseOver={e => e.currentTarget.style.background = "#F9FAFB"}
              onMouseOut={e => e.currentTarget.style.background = "#fff"}>
              <span style={{ fontSize: 16 }}>📥</span> Export Report
            </button>
            <button
              onClick={openNewFatt}
              style={{ background: "#2563EB", color: "#fff", border: "none", borderRadius: 10, padding: "11px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "all 0.2s", boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)" }}
              onMouseOver={e => e.currentTarget.style.background = "#1D4ED8"}
              onMouseOut={e => e.currentTarget.style.background = "#2563EB"}
            >
              + New Commessa
            </button>
          </div>
        </div>

        {/* TOOLS & FILTERS BAR */}
        <div style={{ marginTop: 20, padding: "16px 20px", background: "#fff", borderRadius: 12, border: "1.5px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flex: "1 1 600px", flexWrap: "wrap" }}>
            {/* SEARCH INPUT */}
            <div style={{ position: "relative", flex: "1 1 300px" }}>

              <input
                type="text"
                placeholder="Search Project ID, Name, Client, Activity..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{
                  padding: "10px 12px 10px 40px",
                  borderRadius: 10,
                  border: "1.5px solid #E5E7EB",
                  fontSize: 14,
                  width: "100%",
                  outline: "none",
                  transition: "all 0.2s",
                  background: "#F9FAFB"
                }}
                onFocus={e => { e.target.style.borderColor = "#2563EB"; e.target.style.background = "#fff"; }}
                onBlur={e => { e.target.style.borderColor = "#E5E7EB"; e.target.style.background = "#F9FAFB"; }}
              />
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", fontSize: 16 }}>🔍</span>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 14 }}>
                  ✕
                </button>
              )}
            </div>

            <div style={{ height: 24, width: 1, background: "#E5E7EB" }}></div>

            {/* FILTERS */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase" }}>Filters:</label>
                <select
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value === "all" ? "all" : parseInt(e.target.value))}
                style={{ padding: "9px 12px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 13, fontWeight: 600, color: "#111827", background: "#fff", cursor: "pointer", outline: "none" }}
              >
                <option value="all">All Time</option>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>


              <select
                value={fattFilterClient}
                onChange={e => setFattFilterClient(e.target.value)}
                style={{ padding: "9px 12px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 13, fontWeight: 600, color: "#111827", background: "#fff", cursor: "pointer", outline: "none", maxWidth: 220 }}
              >
                <option value="">All Clients</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

          </div>

          <div style={{ fontSize: 13, fontWeight: 600, color: "#6B7280" }}>
            Showing <span style={{ color: "#111827" }}>{filteredFatturatoList.length}</span> Projects
          </div>
        </div>
      </div>

      {/* DATA TABLE */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", overflowX: "auto" }}>
        {filteredFatturatoList.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>No entries found.</div> : (
          <table style={{ borderCollapse: "collapse", minWidth: 1300 }}>
            <thead>
              <tr style={{ background: "#F9FAFB" }}>
                {/* 3 Sticky Columns */}
                <th style={{ position: "sticky", left: 0, zIndex: 10, background: "#F9FAFB", padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "#6B7280", textAlign: "left", whiteSpace: "nowrap", borderBottom: "2px solid #E5E7EB", width: 80, minWidth: 80, boxSizing: "border-box" }}>COMM.</th>
                <th style={{ position: "sticky", left: 80, zIndex: 10, background: "#F9FAFB", padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "#6B7280", textAlign: "left", whiteSpace: "nowrap", borderBottom: "2px solid #E5E7EB", width: 200, minWidth: 200, boxSizing: "border-box" }}>TASK (PROJECT)</th>
                <th style={{ position: "sticky", left: 280, zIndex: 10, background: "#F9FAFB", padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "#6B7280", textAlign: "left", whiteSpace: "nowrap", borderBottom: "2px solid #E5E7EB", borderRight: "2px solid #E5E7EB", width: 100, minWidth: 100, boxSizing: "border-box", boxShadow: "4px 0 4px -2px rgba(0,0,0,0.05)" }}>ACTIONS</th>

                {/* Scrollable columns */}
                {["Project Note", "N. Cliente", "Cliente", "N. Ordine", "Preventivo", "Ordine", "Voce Bil.", "Attività", "Fatturazione", "Valore Ordine", "Fatturato", "Rimanente", "SAL Val.", "Obiettivi", "Proforma"].map(h =>
                  <th key={h} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "#6B7280", textAlign: "left", whiteSpace: "nowrap", borderBottom: "2px solid #E5E7EB" }}>{h.toUpperCase()}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredFatturatoList.map((comm) => {
                const totalLines = comm.clients.reduce((sum, c) => {
                  const visibleLinesCount = (c.lines || []).filter(l => parseEuNum(l.valore_ordine) > 0).length || 1;
                  return sum + visibleLinesCount;
                }, 0) || 1;
                let commRendered = false;

                return (
                  <React.Fragment key={comm.id}>
                    {comm.clients.length === 0 ? (
                      <tr style={{ borderBottom: "2px solid #E5E7EB" }}>
                        <td style={{ position: "sticky", left: 0, zIndex: 5, background: "#fff", padding: "12px 14px", fontWeight: 700, width: 80, minWidth: 80 }}>{comm.comm_number}</td>
                        <td style={{ position: "sticky", left: 80, zIndex: 5, background: "#fff", padding: "12px 14px", width: 200, minWidth: 200 }}>{comm.task_title}</td>
                        <td style={{ position: "sticky", left: 280, zIndex: 5, background: "#fff", padding: "12px 14px", borderRight: "2px solid #E5E7EB", width: 100, minWidth: 100 }}><button onClick={() => openEditFatt(comm)}>Edit</button></td>
                        <td colSpan={15} style={{ color: "#9CA3AF", padding: "12px" }}>No clients added.</td>
                      </tr>
                    ) : (
                      comm.clients.map((client, cIdx) => {
                        const allClientLines = client.lines?.length > 0 ? client.lines : [{}];
                        const visibleClientLines = allClientLines.filter(line => !line.attivita || parseEuNum(line.valore_ordine) > 0);
                        const linesToRender = visibleClientLines.length > 0 ? visibleClientLines : [{}];

                        return linesToRender.map((line, lIdx) => {
                          const isFirstComm = !commRendered;
                          commRendered = true;
                          const isFirstCli = lIdx === 0;

                          const valOrdine = parseEuNum(line.valore_ordine);
                          const valFatt = selectedYear === "all" ? parseEuNum(line.fatturato_amount) : (line.realized || []).reduce((sum, r) => {
                            const rYear = r.registration_date ? parseInt(r.registration_date.split('-')[0]) : null;
                            return rYear === selectedYear ? sum + (parseFloat(r.amount) || 0) : sum;
                          }, 0);
                          const valProforma = selectedYear === "all" ? parseEuNum(line.proforma) : (line.proforma_entries || []).reduce((sum, p) => {
                            const pYear = p.date ? parseInt(p.date.split('-')[0]) : null;
                            return pYear === selectedYear ? sum + (parseFloat(p.amount) || 0) : sum;
                          }, 0);
                          const valProformaTotal = parseEuNum(line.proforma);
                          const globalFatt = parseEuNum(line.fatturato_amount);
                          const rimanente = Math.max(0, valOrdine - globalFatt - valProformaTotal);
                          const ordini = line.ordini || [];
                          const rowBorder = lIdx === linesToRender.length - 1 && cIdx !== comm.clients.length - 1 ? "1px dashed #D1D5DB" : cIdx === comm.clients.length - 1 && lIdx === linesToRender.length - 1 ? "2px solid #E5E7EB" : "1px solid #F3F4F6";

                          return (
                            <tr key={`${comm.id}-${client.id}-${line.id || lIdx}`} style={{ background: "#fff", borderBottom: rowBorder }}>
                              {isFirstComm && (
                                <>
                                  <td rowSpan={totalLines} style={{ position: "sticky", left: 0, zIndex: 5, padding: "12px 14px", fontWeight: 800, color: "#4F46E5", verticalAlign: "top", borderRight: "1px solid #E5E7EB", background: "#fff", width: 80, minWidth: 80 }}>{comm.comm_number || "—"}</td>
                                  <td rowSpan={totalLines} style={{ position: "sticky", left: 80, zIndex: 5, padding: "12px 14px", fontWeight: 600, color: "#111827", verticalAlign: "top", width: 200, minWidth: 200, maxWidth: 200, background: "#fff" }}>
                                    {comm.name ? (
                                      <div><div style={{ fontWeight: 700 }}>{comm.name}</div><div style={{ fontSize: 11, color: "#9CA3AF" }}>{comm.task_title || "—"}</div></div>
                                    ) : (comm.task_title || "—")}
                                  </td>
                                  <td rowSpan={totalLines} style={{ position: "sticky", left: 280, zIndex: 5, padding: "12px 14px", verticalAlign: "top", borderRight: "2px solid #E5E7EB", background: "#fff", width: 100, minWidth: 100, boxShadow: "4px 0 4px -2px rgba(0,0,0,0.05)" }}>
                                    <div style={{ display: "flex", gap: 4, flexDirection: "column" }}>
                                      <button onClick={() => openEditFatt(comm)} style={{ background: "#F3F4F6", border: "1px solid #D1D5DB", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Edit</button>
                                      <button onClick={() => handleDeleteFatt(comm.id)} style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Delete</button>
                                    </div>
                                  </td>
                                  <td rowSpan={totalLines} style={{ padding: "12px 14px", fontSize: 11, color: "#6B7280", verticalAlign: "top", maxWidth: 150, fontStyle: "italic" }}>{comm.notes || "—"}</td>
                                </>
                              )}
                              {isFirstCli && (
                                <>
                                  <td rowSpan={linesToRender.length} style={{ padding: "12px 14px", fontWeight: 700, color: "#6B7280", verticalAlign: "top" }}>{client.n_cliente || "—"}</td>
                                  <td rowSpan={linesToRender.length} style={{ padding: "12px 14px", fontSize: 12, color: "#374151", verticalAlign: "top", fontWeight: 600, maxWidth: 150 }}>{client.client_name || "—"}</td>
                                  <td rowSpan={linesToRender.length} style={{ padding: "12px 14px", fontSize: 11, color: "#4F46E5", verticalAlign: "top", fontWeight: 600 }}>{client.n_ordine || "—"}</td>
                                  <td rowSpan={linesToRender.length} style={{ padding: "12px 14px", fontSize: 12, color: "#374151", verticalAlign: "top", maxWidth: 120 }}>{client.preventivo || "—"}</td>
                                  <td rowSpan={linesToRender.length} style={{ padding: "12px 14px", fontSize: 12, color: "#374151", verticalAlign: "top", borderRight: "1px solid #F3F4F6", maxWidth: 150 }}>{client.ordine || "—"}</td>
                                </>
                              )}
                              <td style={{ padding: "12px 14px", fontSize: 11, fontWeight: 700, color: "#7C3AED" }}>{line.voce_bilancio || "—"}</td>
                              <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 600, color: "#111827", width: 250, whiteSpace: "normal" }}>
                                {line.attivita || "—"}
                                {line.descrizione && <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 400, marginTop: 4 }}>{line.descrizione}</div>}
                              </td>
                              <td style={{ padding: "4px 14px", fontSize: 12, minWidth: 200, verticalAlign: "middle" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                  {ordini.map(ord => (
                                    <div key={ord.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 4, padding: "2px 6px", fontSize: 11 }}>
                                      <span title={ord.note || ""}>
                                        <strong style={{ color: "#1D4ED8" }}>{ord.label}</strong>: {parseFloat(ord.percentage)}%
                                        <span style={{ marginLeft: 6, color: "#6B7280", fontStyle: "italic" }}>
                                          (€{fmtEu(valOrdine * (parseFloat(ord.percentage) / 100))})
                                        </span>
                                      </span>
                                    </div>
                                  ))}
                                  {ordini.length === 0 && <span style={{ color: "#9CA3AF", fontSize: 10 }}>None</span>}
                                </div>
                              </td>
                              <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 600, color: "#6366F1", whiteSpace: "nowrap" }}>{valOrdine ? `€${fmtEu(valOrdine)}` : "—"}</td>
                              <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 700, color: "#059669", whiteSpace: "nowrap" }}>{valFatt ? `€${fmtEu(valFatt)}` : "—"}</td>
                              <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 700, color: "#F59E0B", whiteSpace: "nowrap" }}>{rimanente > 0 ? `€${fmtEu(rimanente)}` : "—"}</td>
                              <td style={{ padding: "12px 14px", fontSize: 12, color: "#2563EB", whiteSpace: "nowrap" }}>
                                {(() => {
                                  // SAL VAL calculation: (In Progress) - (Sbloccato)
                                  // We use lifetime sum for the PROJECT's receivable balance
                                  const lineSalVal = (salMonthlyData || [])
                                    .filter(sm => Number(sm.fatturato_line_id) === Number(line.id))
                                    .reduce((sum, sm) => {
                                      const v = parseFloat(sm.value) || 0;
                                      return sm.status === "sbloccato" ? sum - v : sum + v;
                                    }, 0);
                                  return lineSalVal !== 0 ? `€${fmtEu(lineSalVal)}` : "—";
                                })()}
                              </td>
                              <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 600, color: "#7C3AED", whiteSpace: "nowrap" }}>
                                {(() => {
                                  const lineObjs = obiettiviData[line.id] || [];
                                  const lineTotalObj = (lineObjs || []).reduce((sum, o) => sum + (parseFloat(o.ordinante_val) || 0) + (parseFloat(o.acquisizioni_val) || 0), 0);
                                  return lineTotalObj > 0 ? `€${fmtEu(lineTotalObj)}` : "—";
                                })()}
                              </td>
                              <td style={{ padding: "12px 14px", fontSize: 12, color: "#374151", whiteSpace: "nowrap" }}>{valProforma ? `€${fmtEu(valProforma)}` : "—"}</td>
                            </tr>
                          );
                        });
                      })
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot style={{ background: "#F9FAFB", borderTop: "2px solid #E5E7EB", position: "sticky", bottom: 0, zIndex: 10 }}>
              <tr style={{ fontWeight: 800, color: "#111827", fontSize: 12 }}>
                <td colSpan={12} style={{ padding: "14px", textAlign: "right", borderRight: "1px solid #E5E7EB" }}>TOTALS:</td>
                {/* Valore Ordine */}
                <td style={{ padding: "14px", whiteSpace: "nowrap" }}>
                  €{fmtEu(filteredFatturatoList.reduce((s, c) => s + c.clients.reduce((ss, cl) => ss + cl.lines.reduce((sss, l) => sss + parseEuNum(l.valore_ordine), 0), 0), 0))}
                </td>
                {/* Fatturato */}
                <td style={{ padding: "14px", whiteSpace: "nowrap", color: "#059669" }}>
                  €{fmtEu(filteredFatturatoList.reduce((s, c) => s + c.clients.reduce((ss, cl) => ss + cl.lines.reduce((sss, l) => {
                    const lFatt = selectedYear === "all" ? parseEuNum(l.fatturato_amount) : (l.realized || []).reduce((sum, r) => {
                      const rYear = r.registration_date ? parseInt(r.registration_date.split('-')[0]) : null;
                      return rYear === selectedYear ? sum + (parseFloat(r.amount) || 0) : sum;
                    }, 0);
                    return sss + lFatt;
                  }, 0), 0), 0))}
                </td>
                {/* Rimanente */}
                <td style={{ padding: "14px", whiteSpace: "nowrap", color: "#F59E0B" }}>
                  €{fmtEu(filteredFatturatoList.reduce((s, c) => s + c.clients.reduce((ss, cl) => ss + cl.lines.reduce((sss, l) => {
                    const lFattTotal = parseEuNum(l.fatturato_amount);
                    const lProfTotal = parseEuNum(l.proforma);
                    const rim = Math.max(0, parseEuNum(l.valore_ordine) - lFattTotal - lProfTotal);
                    return sss + rim;
                  }, 0), 0), 0))}
                </td>
                {/* SAL Val. */}
                <td style={{ padding: "14px", whiteSpace: "nowrap", color: "#2563EB" }}>
                  €{fmtEu(filteredFatturatoList.reduce((s, c) => s + c.clients.reduce((ss, cl) => ss + cl.lines.reduce((sss, l) => {
                    const lSal = (salMonthlyData || [])
                      .filter(sm => Number(sm.fatturato_line_id) === Number(l.id))
                      .reduce((sum, sm) => {
                        const v = parseFloat(sm.value) || 0;
                        return sm.status === 'sbloccato' ? sum - v : sum + v;
                      }, 0);
                    return sss + lSal;
                  }, 0), 0), 0))}
                </td>
                {/* Obiettivi */}
                <td style={{ padding: "14px", whiteSpace: "nowrap", color: "#7C3AED" }}>
                  €{fmtEu(filteredFatturatoList.reduce((s, c) => s + c.clients.reduce((ss, cl) => ss + cl.lines.reduce((sss, l) => {
                    const lObj = (obiettiviData[l.id] || []).reduce((sum, o) => sum + (parseFloat(o.ordinante_val) || 0) + (parseFloat(o.acquisizioni_val) || 0), 0);
                    return sss + lObj;
                  }, 0), 0), 0))}
                </td>
                {/* Proforma */}
                <td style={{ padding: "14px", whiteSpace: "nowrap", color: "#374151" }}>
                  €{fmtEu(filteredFatturatoList.reduce((s, c) => s + c.clients.reduce((ss, cl) => ss + cl.lines.reduce((sss, l) => {
                    const lProf = selectedYear === "all" ? parseEuNum(l.proforma) : (l.proforma_entries || []).reduce((sum, p) => {
                      const pYear = p.date ? parseInt(p.date.split('-')[0]) : null;
                      return pYear === selectedYear ? sum + (parseFloat(p.amount) || 0) : sum;
                    }, 0);
                    return sss + lProf;
                  }, 0), 0), 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* FATTURATO MODAL (Edit Hierarchy) */}
      {
        showFattModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, backdropFilter: "blur(4px)", padding: "40px 0" }}>
            <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 960, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", maxHeight: "100%", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h3 style={{ color: "#111827", margin: 0, fontSize: 18, fontWeight: 700 }}>{editingFatt ? "Edit Commessa Hierarchy" : "New Commessa & Clients"}</h3>
                <button onClick={() => setShowFattModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}>✕</button>
              </div>

              <div style={{ background: "#F0FDF4", padding: 16, borderRadius: 8, border: "1px solid #BBF7D0", marginBottom: 20 }}>
                <h4 style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 800, color: "#166534" }}>1. COMMESSA (PROJECT ROOT)</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div><label style={{ fontSize: 11, fontWeight: 700, color: "#374151" }}>Project Name</label><input value={fattForm.name} onChange={e => setFattForm({ ...fattForm, name: e.target.value })} style={inpStyle} placeholder="Project Name" /></div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#374151" }}>Link to Task</label>
                    <select value={fattForm.task_id} onChange={e => {
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
                            const linesToAdd = missingPhases.map(ph => ({ ...getEmptyLine(), attivita: ph.name }));
                            cleanedLines = cleanedLines.filter(l => l.attivita || l.valore_ordine || l.fatturato_amount);
                            cleanedLines = [...(cleanedLines.length > 0 ? cleanedLines : []), ...linesToAdd];
                          }
                        }
                        if (cleanedLines.length === 0) cleanedLines = [{ ...getEmptyLine() }];
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
                  <div><label style={{ fontSize: 11, fontWeight: 700, color: "#374151" }}>Comm. Number</label><input value={fattForm.comm_number} onChange={e => setFattForm({ ...fattForm, comm_number: e.target.value })} style={inpStyle} placeholder="25-001" /></div>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#374151" }}>Project General Notes</label>
                  <textarea value={fattForm.notes} onChange={e => setFattForm({ ...fattForm, notes: e.target.value })} style={{ ...inpStyle, height: 60, resize: "vertical" }} placeholder="Internal notes, specific project requirements..." />
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

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 12, paddingRight: 60 }}>
                      <div><label style={{ fontSize: 10, fontWeight: 700 }}>N. Cliente</label><input value={client.n_cliente} onChange={e => handleClientChange(cIdx, "n_cliente", e.target.value)} style={inpStyle} placeholder="00" /></div>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700 }}>Client Profile</label>
                        <div style={{ display: "flex", gap: 4 }}>
                          <select value={client.client_id} onChange={e => handleClientChange(cIdx, "client_id", e.target.value)} style={{ ...inpStyle, padding: "6px", flex: 1 }}><option value="">— Select —</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                          <button onClick={() => setShowClientModal(true)} style={{ padding: "6px 10px", background: "#E5E7EB", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+</button>
                        </div>
                      </div>
                      <div><label style={{ fontSize: 10, fontWeight: 700 }}>N. Ordine Client</label><input value={client.n_ordine} onChange={e => handleClientChange(cIdx, "n_ordine", e.target.value)} style={inpStyle} placeholder="PO-12345" /></div>
                      <div><label style={{ fontSize: 10, fontWeight: 700 }}>Preventivo</label><input value={client.preventivo} onChange={e => handleClientChange(cIdx, "preventivo", e.target.value)} style={inpStyle} /></div>
                      <div><label style={{ fontSize: 10, fontWeight: 700 }}>Ordine Desc.</label><input value={client.ordine} onChange={e => handleClientChange(cIdx, "ordine", e.target.value)} style={inpStyle} /></div>
                    </div>

                    <div style={{ marginTop: 16, borderTop: "1px dashed #D1D5DB", paddingTop: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280" }}>ACTIVITIES FOR THIS CLIENT</div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          {/* Labels for the columns below */}
                          <div style={{ display: "flex", gap: 6, marginRight: 20 }}>
                            <div style={{ width: 150, fontSize: 10, fontWeight: 700, color: "#9CA3AF" }}>VALORE ORDINE</div>
                            <div style={{ width: 150, fontSize: 10, fontWeight: 700, color: "#9CA3AF" }}>FATTURATO</div>
                            <div style={{ width: 150, fontSize: 10, fontWeight: 700, color: "#9CA3AF" }}>PROFORMA</div>
                          </div>
                          <button onClick={() => addLineToClient(cIdx)} style={{ background: "#10B981", color: "#fff", border: "none", padding: "4px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>+ Add Line</button>
                        </div>
                      </div>
                      {client.lines.map((line, lIdx) => (
                        <div key={lIdx} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: 10, marginBottom: 8 }}>
                          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                            <div style={{ flex: 1 }}><input placeholder="Voce Bilancio" value={line.voce_bilancio} onChange={e => handleLineChange(cIdx, lIdx, "voce_bilancio", e.target.value)} style={{ ...inpStyle, padding: "6px", fontWeight: 700, borderColor: "#C7D2FE" }} /></div>
                            <div style={{ flex: 2 }}><input placeholder="Attività" value={line.attivita} onChange={e => handleLineChange(cIdx, lIdx, "attivita", e.target.value)} style={{ ...inpStyle, padding: "6px" }} /></div>
                            <div style={{ flex: 1 }}><input type="number" placeholder="Valore €" value={line.valore_ordine} onChange={e => handleLineChange(cIdx, lIdx, "valore_ordine", e.target.value)} style={{ ...inpStyle, padding: "6px" }} /></div>
                            <div style={{ flex: 1 }}>
                              <input
                                type="number"
                                placeholder="Fatturato €"
                                value={line.fatturato_amount}
                                onChange={e => handleLineChange(cIdx, lIdx, "fatturato_amount", e.target.value)}
                                style={{ ...inpStyle, padding: "6px", background: (line.realized && line.realized.length > 0) ? "#F3F4F6" : "#fff" }}
                                readOnly={line.realized && line.realized.length > 0}
                                title={line.realized && line.realized.length > 0 ? "Calculated from Billing History" : ""}
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <input
                                type="number"
                                placeholder="Proforma €"
                                value={line.proforma}
                                onChange={e => handleLineChange(cIdx, lIdx, "proforma", e.target.value)}
                                style={{ ...inpStyle, padding: "6px", background: (line.proforma_entries && line.proforma_entries.length > 0) ? "#F3F4F6" : "#fff" }}
                                readOnly={line.proforma_entries && line.proforma_entries.length > 0}
                                title={line.proforma_entries && line.proforma_entries.length > 0 ? "Calculated from Proforma History" : "Expected payment"}
                              />
                            </div>
                            <button onClick={() => removeLineFromClient(cIdx, lIdx)} disabled={client.lines.length === 1} style={{ background: "#F3F4F6", color: "#DC2626", border: "none", padding: "6px 10px", borderRadius: 6, cursor: client.lines.length > 1 ? "pointer" : "not-allowed" }}>✕</button>
                          </div>

                          {/* Nested Ordini (Percentages) */}
                          <div style={{ marginLeft: 20, borderLeft: "2px solid #E5E7EB", paddingLeft: 12, marginBottom: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 9, fontWeight: 700, color: "#6B7280" }}>PAYMENT SCHEDULE (%)</span>
                                {(() => {
                                  const total = (line.ordini || []).reduce((sum, o) => sum + (parseFloat(o.percentage) || 0), 0);
                                  if (total > 100) return <span style={{ fontSize: 9, fontWeight: 700, color: "#EF4444" }}>TOTAL: {total.toFixed(1)}% (EXCEEDS 100!)</span>;
                                  if (total > 0) return <span style={{ fontSize: 9, fontWeight: 700, color: total === 100 ? "#059669" : "#6B7280" }}>TOTAL: {total.toFixed(1)}%</span>;
                                  return null;
                                })()}
                              </div>
                              <button onClick={() => addOrdineToLine(cIdx, lIdx)} style={{ background: "#EEF2FF", color: "#4F46E5", border: "1px solid #C7D2FE", padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700, cursor: "pointer" }}>+ Add %</button>
                            </div>
                            {(line.ordini || []).map((ord, oIdx) => (
                              <div key={oIdx} style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                                <input placeholder="SAL 1" value={ord.label} onChange={e => handleOrdineChange(cIdx, lIdx, oIdx, "label", e.target.value)} style={{ ...inpStyle, flex: 2, padding: "4px", fontSize: 11 }} />
                                <input type="number" placeholder="%" value={ord.percentage} onChange={e => handleOrdineChange(cIdx, lIdx, oIdx, "percentage", e.target.value)} style={{ ...inpStyle, flex: 1, padding: "4px", fontSize: 11 }} />
                                <button onClick={() => removeOrdineFromLine(cIdx, lIdx, oIdx)} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 12 }}>✕</button>
                              </div>
                            ))}
                          </div>

                          {/* Nested Proforma Entries */}
                          <div style={{ marginLeft: 20, borderLeft: "2px solid #3B82F6", paddingLeft: 12, marginTop: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 9, fontWeight: 700, color: "#2563EB" }}>PROFORMA</span>
                                {(() => {
                                  const total = (line.proforma_entries || []).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
                                  if (total > 0) return <span style={{ fontSize: 9, fontWeight: 700, color: "#2563EB" }}>TOTAL: €{fmtEu(total)}</span>;
                                  return null;
                                })()}
                              </div>
                              <button onClick={() => addProformaToLine(cIdx, lIdx)} style={{ background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE", padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700, cursor: "pointer" }}>+ Add Proforma</button>
                            </div>
                            {(line.proforma_entries || []).map((prof, pIdx) => (
                              <div key={pIdx} style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                                <input
                                  type="date"
                                  value={prof.date ? prof.date.split('T')[0] : ""}
                                  onChange={e => handleProformaChange(cIdx, lIdx, pIdx, "date", e.target.value)}
                                  style={{ ...inpStyle, flex: 1, padding: "4px", fontSize: 11 }}
                                />
                                <input type="number" placeholder="Amount €" value={prof.amount} onChange={e => handleProformaChange(cIdx, lIdx, pIdx, "amount", e.target.value)} style={{ ...inpStyle, flex: 1, padding: "4px", fontSize: 11 }} />
                                <input placeholder="Note" value={prof.note} onChange={e => handleProformaChange(cIdx, lIdx, pIdx, "note", e.target.value)} style={{ ...inpStyle, flex: 2, padding: "4px", fontSize: 11 }} />
                                <button onClick={() => removeProformaFromLine(cIdx, lIdx, pIdx)} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 12 }}>✕</button>
                              </div>
                            ))}
                          </div>

                          {/* Nested Realized (Billing History) */}
                          <div style={{ marginLeft: 20, borderLeft: "2px solid #10B981", paddingLeft: 12, marginTop: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 9, fontWeight: 700, color: "#059669" }}>REGISTERED BILLING (FATTURATO)</span>
                                {(() => {
                                  const total = (line.realized || []).reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
                                  if (total > 0) return <span style={{ fontSize: 9, fontWeight: 700, color: "#059669" }}>TOTAL: €{fmtEu(total)}</span>;
                                  return null;
                                })()}
                              </div>
                              <button onClick={() => addRealizedToLine(cIdx, lIdx)} style={{ background: "#ECFDF5", color: "#059669", border: "1px solid #A7F3D0", padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700, cursor: "pointer" }}>+ Add Invoice</button>
                            </div>
                            {(line.realized || []).map((real, rIdx) => (
                              <div key={rIdx} style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                                <input
                                  type="date"
                                  value={real.registration_date ? real.registration_date.split('T')[0] : ""}
                                  onChange={e => handleRealizedChange(cIdx, lIdx, rIdx, "registration_date", e.target.value)}
                                  style={{ ...inpStyle, flex: 1, padding: "4px", fontSize: 11 }}
                                />
                                <input type="number" placeholder="Amount €" value={real.amount} onChange={e => handleRealizedChange(cIdx, lIdx, rIdx, "amount", e.target.value)} style={{ ...inpStyle, flex: 1, padding: "4px", fontSize: 11 }} />
                                <input placeholder="Note/Invoice #" value={real.note} onChange={e => handleRealizedChange(cIdx, lIdx, rIdx, "note", e.target.value)} style={{ ...inpStyle, flex: 2, padding: "4px", fontSize: 11 }} />
                                <button onClick={() => removeRealizedFromLine(cIdx, lIdx, rIdx)} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 12 }}>✕</button>
                              </div>
                            ))}
                          </div>

                          {/* Nested SAL & Obiettivi */}
                          {!line.id ? (
                            <div style={{ marginLeft: 20, marginTop: 12, padding: "10px 12px", background: "#FEF2F2", color: "#DC2626", borderRadius: 6, fontSize: 11, borderLeft: "4px solid #EF4444" }}>
                              <strong>NOTE:</strong> You must <strong>Save Commessa Structure</strong> before adding Monthly Progress (SAL) and Targets (Obiettivi) to this newly created activity.
                            </div>
                          ) : (
                            <>
                              <div style={{ marginLeft: 20, borderLeft: "2px solid #2563EB", paddingLeft: 12, marginTop: 12 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: "#2563EB" }}>MONTHLY PROGRESS (SAL) HISTORY</span>
                                  </div>
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button
                                      disabled={!line.id}
                                      onClick={() => handleSalAddEntry(line.id)}
                                      style={{
                                        background: line.id ? "#EFF6FF" : "#F3F4F6",
                                        color: line.id ? "#2563EB" : "#9CA3AF",
                                        border: `1px solid ${line.id ? "#BFDBFE" : "#D1D5DB"}`,
                                        padding: "2px 6px",
                                        borderRadius: 4,
                                        fontSize: 9,
                                        fontWeight: 700,
                                        cursor: line.id ? "pointer" : "not-allowed"
                                      }}
                                      title={!line.id ? "Save the new activity first to enable progress tracking" : ""}
                                    >
                                      + Add Progress
                                    </button>
                                    <button onClick={async () => {
                                      const entries = (salMonthlyData || []).filter(s => Number(s.fatturato_line_id) === Number(line.id));
                                      const distinctYears = [...new Set(entries.map(e => e.year))];
                                      try {
                                        for (const y of distinctYears) {
                                          const yearEntries = entries.filter(e => e.year === y);
                                          const distinctMonths = [...new Set(yearEntries.map(e => e.month))];
                                          for (const m of distinctMonths) {
                                            const monthEntries = yearEntries.filter(e => e.month === m).map(e => ({
                                              id: e.id || null, // Include ID!
                                              line_id: e.fatturato_line_id,
                                              value: parseFloat(e.value) || 0,
                                              status: e.status
                                            }));
                                            await api.updateMonthlySAL({ year: y, month: m, entries: monthEntries });
                                          }
                                        }
                                        alert("All SAL progress for this line saved!");
                                        fetchData();
                                      } catch (err) { console.error(err); alert("Error saving bulk SAL: " + err.message); }
                                    }} style={{ background: "#F0FDF4", color: "#166534", border: "1px solid #BBF7D0", padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700, cursor: "pointer" }}>Save All SAL (Beta)</button>
                                  </div>
                                </div>
                                {(salMonthlyData || []).filter(s => {
                                  if (line.id) return Number(s.fatturato_line_id) === Number(line.id);
                                  // For new unsaved lines, we can't easily correlate unless we have a consistent temp ID 
                                  // Actually, the most reliable way for NEW lines is if the user saves first.
                                  return false;
                                }).sort((a, b) => b.year - a.year || b.month - a.month).map((s, sIdx) => (
                                  <div key={sIdx} style={{
                                    display: "flex",
                                    gap: 4,
                                    marginBottom: 6,
                                    alignItems: "center",
                                    background: s.status === 'sbloccato' ? "#ffa4e8ff" : "transparent",
                                    border: s.status === 'sbloccato' ? "1.5px solid #ff00bfff" : "1.5px solid transparent",
                                    borderRadius: 10,
                                    padding: s.status === 'sbloccato' ? "6px" : "2px"
                                  }}>
                                    <select value={s.year} onChange={e => {
                                      const newData = [...salMonthlyData];
                                      const realIdx = newData.findIndex(x => x === s);
                                      if (realIdx >= 0) { newData[realIdx].year = parseInt(e.target.value); setSalMonthlyData(newData); }
                                    }} style={{ ...inpStyle, width: 65, padding: "4px", fontSize: 10 }}>
                                      {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                    <select value={s.month} onChange={e => {
                                      const newData = [...salMonthlyData];
                                      const realIdx = newData.findIndex(x => x === s);
                                      if (realIdx >= 0) { newData[realIdx].month = parseInt(e.target.value); setSalMonthlyData(newData); }
                                    }} style={{ ...inpStyle, width: 85, padding: "4px", fontSize: 10 }}>
                                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                    <input type="number" placeholder="Value €" value={s.value} onChange={e => {
                                      const newData = [...salMonthlyData];
                                      const realIdx = newData.findIndex(x => x === s);
                                      if (realIdx >= 0) { newData[realIdx].value = e.target.value; setSalMonthlyData(newData); }
                                    }} style={{ ...inpStyle, flex: 1, padding: "4px", fontSize: 11 }} />
                                    <select value={s.status} onChange={e => {
                                      const newData = [...salMonthlyData];
                                      const realIdx = newData.findIndex(x => x === s);
                                      if (realIdx >= 0) { newData[realIdx].status = e.target.value; setSalMonthlyData(newData); }
                                    }} style={{ ...inpStyle, flex: 1, padding: "4px", fontSize: 10 }}>
                                      <option value="in_progress">In Progress</option>
                                      <option value="sbloccato">Released (Sbloccato)</option>
                                    </select>
                                    <button onClick={async () => {
                                      if (!window.confirm("Delete this monthly progress?")) return;
                                      if (s.id) {
                                        // Saved in DB — delete via API
                                        try {
                                          await api.deleteMonthlySAL(s.id);
                                          fetchData();
                                        } catch (err) {
                                          console.error(err);
                                          alert("Error deleting SAL: " + err.message);
                                        }
                                      } else {
                                        // Unsaved local entry — just remove from state
                                        setSalMonthlyData(salMonthlyData.filter(x => x !== s));
                                      }
                                    }} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 12 }}>✕</button>
                                    <button onClick={async () => {
                                      try {
                                        await api.updateMonthlySAL({
                                          year: s.year,
                                          month: s.month,
                                          entries: [{
                                            id: s.id || null, // Include ID!
                                            line_id: s.fatturato_line_id,
                                            value: parseFloat(s.value) || 0,
                                            status: s.status
                                          }]
                                        });
                                        alert("Monthly progress saved!");
                                        fetchData();
                                      } catch (err) { console.error(err); }
                                    }} style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534", borderRadius: 4, padding: "2px 4px", fontSize: 9, fontWeight: 700, cursor: "pointer" }}>Save</button>
                                  </div>
                                ))}

                                {/* Monthly Receivable Summary */}
                                {(() => {
                                  const entries = (salMonthlyData || []).filter(s => Number(s.fatturato_line_id) === Number(line.id));
                                  if (entries.length === 0) return null;

                                  const summary = {};
                                  entries.forEach(e => {
                                    const key = `${e.year}-${e.month}`;
                                    if (!summary[key]) summary[key] = { year: e.year, month: e.month, diff: 0 };
                                    const val = parseFloat(e.value) || 0;
                                    if (e.status === 'sbloccato') summary[key].diff -= val;
                                    else summary[key].diff += val;
                                  });

                                  const sortedKeys = Object.keys(summary).sort((a, b) => {
                                    const [ya, ma] = a.split('-').map(Number);
                                    const [yb, mb] = b.split('-').map(Number);
                                    return yb - ya || mb - ma;
                                  });

                                  const receivables = sortedKeys.filter(k => summary[k].diff > 0.01);
                                  if (receivables.length === 0) return null;

                                  return (
                                    <div style={{ marginTop: 12, padding: "8px 12px", background: "#FFFBEB", border: "1px solid #FEF3C7", borderRadius: 8 }}>
                                      <div style={{ fontSize: 9, fontWeight: 800, color: "#92400E", marginBottom: 4, textTransform: "uppercase" }}>Monthly Receivables (Work in Progress)</div>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                        {receivables.map(k => (
                                          <div key={k} style={{ fontSize: 11, fontWeight: 700, color: "#D97706" }}>
                                            {summary[k].month}/{summary[k].year}: <span style={{ background: "#FEF3C7", padding: "1px 4px", borderRadius: 4 }}>Receivable: €{fmtEu(summary[k].diff)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>

                              {/* Nested Obiettivi (Targets) */}
                              <div style={{ marginLeft: 20, borderLeft: "2px solid #7C3AED", paddingLeft: 12, marginTop: 12 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                  <span style={{ fontSize: 9, fontWeight: 700, color: "#7C3AED" }}>OBIETTIVI</span>
                                  <button onClick={() => handleSaveLineObiettivi(line.id)} style={{ background: "#F5F3FF", color: "#7C3AED", border: "1px solid #DDD6FE", padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700, cursor: "pointer" }}>Save Obiettivi</button>
                                </div>
                                {(() => {
                                  const queryYear = (selectedYear && selectedYear !== "all") ? parseInt(selectedYear) : new Date().getFullYear();
                                  return ['Q1', 'Q2', 'Q3'].map(p => {
                                    const o = (obiettiviData[line.id] || []).find(obj => obj.period === p && obj.year === queryYear) || { ordinante_val: 0, acquisizioni_val: 0 };
                                    return (
                                      <div key={p} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 4 }}>
                                        <span style={{ fontSize: 10, fontWeight: 800, width: 25, color: "#7C3AED" }}>{p}</span>
                                        <div style={{ flex: 1 }}>
                                          <label style={{ fontSize: 8, display: "block", color: "#6B7280" }}>Ordinante €</label>
                                          <input type="number" value={o.ordinante_val} onChange={e => handleObiettiviChange(line.id, p, "ordinante_val", e.target.value)} style={{ ...inpStyle, padding: "4px", fontSize: 11 }} />
                                        </div>
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>



              <button onClick={handleSaveFatt} disabled={savingFatt} style={{ width: "100%", padding: 14, background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>{savingFatt ? "Saving..." : "Save Commessa Structure"}</button>
            </div>
          </div>
        )
      }

      {/* NEW CLIENT MODAL */}
      {
        showClientModal && (
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
        )
      }
    </div >
  );
}
