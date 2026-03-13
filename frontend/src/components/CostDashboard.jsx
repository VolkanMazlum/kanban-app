import { useState, useEffect } from "react";
import Avatar from "./Avatar.jsx";
import * as api from "../api.js";

// Sabitleri ve yardımcı fonksiyonları ayırdığımız dosyalardan çekiyoruz
import { 
  MONTHS, GENERAL_COST_FIELDS, EMPTY_LINE, EMPTY_CLIENT, EMPTY_FORM, inpStyle 
} from "../constants/costConstants.js";
import { getDaysInMonth } from "../utils/costUtils.js";

// Dışarı çıkardığımız Alt Bileşenler (Önceki adımda oluşturduklarımız)
import EmployeeCostsTab from "./EmployeeCostsTab.jsx";
import TimesheetTab from "./TimesheetTab.jsx";

export default function CostDashboard({ employees, isHR }) {
  const currentYear  = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const today        = new Date(); today.setHours(0,0,0,0);

  const [selectedYear, setSelectedYear]   = useState(currentYear);
  const YEAR_OPTIONS = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  const [hrTab, setHrTab]                 = useState("employees"); 
  const [costs, setCosts]                 = useState([]);
  const [loadingCosts, setLoadingCosts]   = useState(false);
  
  // ── ÇALIŞAN MALİYETLERİ & MESAİ STATE ──
  const [showCostModal, setShowCostModal] = useState(false);
  const [selectedEmpHR, setSelectedEmpHR] = useState(null);
  const [newCost, setNewCost]             = useState({ annual_gross: "", valid_from: new Date().toISOString().slice(0,10) });
  const [showOvertimeModal, setShowOvertimeModal] = useState(false);
  const [overtimeData, setOvertimeData]           = useState([]);
  const [overtimeInput, setOvertimeInput]         = useState({ month: currentMonth, amount: "" });

  // ── TIMESHEET & TASK STATE ──
  const [finances, setFinances] = useState({ tasks: [], task_hours: [] });
  const [allTasks, setAllTasks]           = useState([]);
  const [selectedEmp, setSelectedEmp]     = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [dailyHours, setDailyHours]       = useState({});
  const [saving, setSaving]               = useState(false);

  // ── GENERAL COSTS (Genel Giderler) ──
  const [generalCosts, setGeneralCosts]     = useState({ rent: 0, operating: 0, equipment: 0, unexpected: 0 });
  const [generalCostsInput, setGeneralCostsInput] = useState({ rent: "", operating: "", equipment: "", unexpected: "" });
  const [savingGeneralCost, setSavingGeneralCost] = useState({});

  // ── PER-TASK WEIGHTS ──
  const [taskWeights, setTaskWeights] = useState({});

  // ── FATTURATO VE MÜŞTERİ (CLIENT) STATE ──
  const [fatturatoList, setFatturatoList]   = useState([]);
  const [fatturatoByTask, setFatturatoByTask] = useState([]);
  const [showFattModal, setShowFattModal]   = useState(false);
  const [editingFatt, setEditingFatt]       = useState(null);
  const [fattForm, setFattForm]             = useState(EMPTY_FORM);
  const [savingFatt, setSavingFatt]         = useState(false);
  
  const [clients, setClients]               = useState([]);
  const [showClientModal, setShowClientModal] = useState(false);
  const [clientForm, setClientForm]         = useState({ name:"", vat_number:"", contact_email:"", phone:"", address:"", notes:"" });
  const [savingClient, setSavingClient]     = useState(false);

  // ── USE EFFECTS ──
  useEffect(() => {
    api.getTasks().then(setAllTasks).catch(console.error);
  }, []);

  useEffect(() => {
    if (!isHR) return;
    setLoadingCosts(true);
    api.getCosts(selectedYear).then(setCosts).catch(console.error).finally(() => setLoadingCosts(false));
  }, [isHR, selectedYear]);

  useEffect(() => {
    if (isHR && hrTab === "projects") {
      Promise.all([
        api.getTaskFinances(selectedYear),
        api.getSettings(),
        api.getFatturatoByTask(selectedYear)
      ]).then(([fin, settings, byTask]) => {
        setFinances(fin);
        setFatturatoByTask(byTask);

        const vals = {
          rent:       parseFloat(settings[`gc_rent_${selectedYear}`])       || 0,
          operating:  parseFloat(settings[`gc_operating_${selectedYear}`])  || 0,
          equipment:  parseFloat(settings[`gc_equipment_${selectedYear}`])  || 0,
          unexpected: parseFloat(settings[`gc_unexpected_${selectedYear}`]) || 0,
        };
        setGeneralCosts(vals);
        setGeneralCostsInput({
          rent:       vals.rent       || "",
          operating:  vals.operating  || "",
          equipment:  vals.equipment  || "",
          unexpected: vals.unexpected || "",
        });

        const weights = {};
        fin.tasks.forEach(t => {
          const raw = settings[`tw_${t.id}_${selectedYear}`];
          if (raw !== undefined) weights[t.id] = raw;
        });
        setTaskWeights(weights);
      }).catch(console.error);
    }
  }, [isHR, hrTab, selectedYear]);

  useEffect(() => {
    if (isHR && hrTab === "fatturato") {
      Promise.all([ api.getFatturato(selectedYear), api.getClients() ])
      .then(([fatt, cls]) => { setFatturatoList(fatt); setClients(cls); }).catch(console.error);
    }
  }, [isHR, hrTab, selectedYear]);

  useEffect(() => {
    if (!selectedEmp) return;
    api.getWorkHours(selectedEmp.id, selectedYear, selectedMonth).then(data => {
      const map = {};
      data.forEach(r => {
        if (!map[r.task_id]) map[r.task_id] = {};
        map[r.task_id][r.date.slice(0,10)] = { hours: r.hours || "", note: r.note || "" };
      });
      setDailyHours(map);
    }).catch(console.error);
  }, [selectedEmp, selectedYear, selectedMonth]);

  // ── HANDLERS ──
  const handleDaySave = async (taskId, date, hours, note) => {
    if (!selectedEmp) return;
    setSaving(true);
    try {
      await api.saveWorkHours({
        employee_id: selectedEmp.id,
        task_id: taskId,
        date,
        hours: parseFloat(hours) || 0,
        note: note || null
      });
      setDailyHours(p => ({ ...p, [taskId]: { ...(p[taskId] || {}), [date]: { hours, note } } }));
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleAddCost = async () => {
    if (!selectedEmpHR || !newCost.annual_gross) return;
    try {
      await api.addEmployeeCost(selectedEmpHR.id, newCost);
      const updated = await api.getCosts(selectedYear); 
      setCosts(updated);
      const freshEmp = updated.find(e => e.id === selectedEmpHR.id);
      setSelectedEmpHR(freshEmp);
      setShowCostModal(false); 
      setNewCost({ annual_gross: "", valid_from: new Date().toISOString().slice(0,10) });
    } catch (err) { console.error(err); }
  };

  const loadOvertime = async (emp) => {
    setSelectedEmpHR(emp);
    try {
      const data = await api.getOvertimeCosts(emp.id, selectedYear);
      setOvertimeData(data); setShowOvertimeModal(true);
    } catch (err) { console.error(err); }
  };

  const handleAddOvertime = async () => {
    if (!selectedEmpHR || !overtimeInput.amount) return;
    try {
      await api.saveOvertimeCost(selectedEmpHR.id, { year: selectedYear, month: overtimeInput.month, hours: overtimeInput.amount });
      const [updatedCosts, updatedOvertime] = await Promise.all([api.getCosts(selectedYear), api.getOvertimeCosts(selectedEmpHR.id, selectedYear)]);
      setCosts(updatedCosts); setOvertimeData(updatedOvertime);
      setOvertimeInput(p => ({ ...p, amount: "" }));
    } catch (err) { console.error(err); }
  };

  const handleSaveGeneralCost = async (field, value) => {
    const numVal = parseFloat(value) || 0;
    setGeneralCosts(p => ({ ...p, [field]: numVal }));
    setSavingGeneralCost(p => ({ ...p, [field]: true }));
    try {
      await api.updateSetting(`gc_${field}_${selectedYear}`, String(numVal));
    } catch (err) { console.error(err); }
    setSavingGeneralCost(p => ({ ...p, [field]: false }));
  };

  // ── FATTURATO 3-TIER İŞLEMLERİ ──
  const openNewFatt = () => { setEditingFatt(null); setFattForm(EMPTY_FORM); setShowFattModal(true); };
  const openEditFatt = (row) => {
    setEditingFatt(row);
    setFattForm({
      task_id: row.task_id || "", comm_number: row.comm_number || "", name: row.name || "",
      clients: row.clients && row.clients.length > 0 ? row.clients.map(c => ({
        ...c, lines: c.lines && c.lines.length > 0 ? c.lines : [{ ...EMPTY_LINE }]
      })) : [{ ...EMPTY_CLIENT }]
    });
    setShowFattModal(true);
  };
  const addClientBlock = () => setFattForm({ ...fattForm, clients: [...fattForm.clients, { ...EMPTY_CLIENT }] });
  const removeClientBlock = (cIdx) => { const newClients = [...fattForm.clients]; newClients.splice(cIdx, 1); setFattForm({ ...fattForm, clients: newClients }); };
  const handleClientChange = (cIdx, field, val) => { const newClients = [...fattForm.clients]; newClients[cIdx][field] = val; setFattForm({ ...fattForm, clients: newClients }); };
  const addLineToClient = (cIdx) => { const newClients = [...fattForm.clients]; newClients[cIdx].lines.push({ ...EMPTY_LINE }); setFattForm({ ...fattForm, clients: newClients }); };
  const removeLineFromClient = (cIdx, lIdx) => { const newClients = [...fattForm.clients]; newClients[cIdx].lines.splice(lIdx, 1); setFattForm({ ...fattForm, clients: newClients }); };
  const handleLineChange = (cIdx, lIdx, field, val) => { const newClients = [...fattForm.clients]; newClients[cIdx].lines[lIdx][field] = val; setFattForm({ ...fattForm, clients: newClients }); };
  
  const handleSaveFatt = async () => {
    setSavingFatt(true);
    try {
      if (editingFatt) await api.updateFatturato(editingFatt.id, fattForm);
      else await api.createFatturato(fattForm);
      const [fresh, byTask] = await Promise.all([api.getFatturato(selectedYear), api.getFatturatoByTask(selectedYear)]);
      setFatturatoList(fresh); setFatturatoByTask(byTask); setShowFattModal(false);
    } catch (err) { console.error(err); }
    setSavingFatt(false);
  };
  const handleDeleteFatt = async (id) => {
    if (!window.confirm("Delete this entire Commessa and ALL its clients/activities?")) return;
    try {
      await api.deleteFatturato(id);
      const [fresh, byTask] = await Promise.all([api.getFatturato(selectedYear), api.getFatturatoByTask(selectedYear)]);
      setFatturatoList(fresh); setFatturatoByTask(byTask);
    } catch (err) { console.error(err); }
  };
  const handleSaveClient = async () => {
    if (!clientForm.name.trim()) return;
    setSavingClient(true);
    try {
      const saved = await api.createClient(clientForm);
      setClients(p => [...p, saved]); setShowClientModal(false);
    } catch (err) { console.error(err); }
    setSavingClient(false);
  };

  // ── HESAPLAMALAR ──
  const totalGeneralCost = GENERAL_COST_FIELDS.reduce((sum, f) => sum + (generalCosts[f.key] || 0), 0);
  const totalWeight = finances.tasks.reduce((sum, t) => sum + (parseFloat(taskWeights[t.id]) || 0), 0);

  const getExtraCost = (taskId) => {
    if (totalWeight <= 0 || totalGeneralCost <= 0) return 0;
    const w = parseFloat(taskWeights[taskId]) || 0;
    return (w / totalWeight) * totalGeneralCost;
  };
  const getFattByTask = (taskId) => fatturatoByTask.find(r => r.task_id === taskId) || null;

  return (
    <div style={{padding:"28px 32px",overflowY:"auto",height:"calc(100vh - 65px)",fontFamily:"'Inter',sans-serif",background:"#F9FAFB"}}>

      {/* ── HEADER ── */}
      <div style={{marginBottom:24, display: "flex", justifyContent: "space-between", alignItems: "center"}}>
        <div>
          <div style={{display: "flex", alignItems: "center", gap: 12, marginBottom: 4}}>
            <h2 style={{fontSize:22,fontWeight:700,color:"#111827",margin:0}}>Cost & Timesheet Management</h2>
            <select 
              value={selectedYear} 
              onChange={e => setSelectedYear(parseInt(e.target.value))}
              style={{padding:"4px 10px", borderRadius:6, border:"1px solid #D1D5DB", fontSize:14, fontWeight:700, color:"#2563EB", background:"#EFF6FF", outline:"none", cursor:"pointer"}}
            >
              {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <p style={{color:"#6B7280",margin:0,fontSize:14}}>
            {isHR ? "Manage employee rates and project profitability" : "Log your daily worked hours per task"}
          </p>
        </div>
        {isHR && (
          <div style={{display:"flex", background:"#E5E7EB", borderRadius:8, padding:4}}>
            <button onClick={() => setHrTab("employees")} style={{padding:"8px 16px", borderRadius:6, border:"none", background: hrTab === "employees" ? "#fff" : "transparent", fontWeight:600, fontSize:13, cursor:"pointer", color: hrTab === "employees" ? "#111827" : "#6B7280", boxShadow: hrTab === "employees" ? "0 1px 3px rgba(0,0,0,0.1)" : "none"}}>Employee Costs</button>
            <button onClick={() => setHrTab("projects")} style={{padding:"8px 16px", borderRadius:6, border:"none", background: hrTab === "projects" ? "#fff" : "transparent", fontWeight:600, fontSize:13, cursor:"pointer", color: hrTab === "projects" ? "#111827" : "#6B7280", boxShadow: hrTab === "projects" ? "0 1px 3px rgba(0,0,0,0.1)" : "none"}}>Project Finances</button>
            <button onClick={() => setHrTab("fatturato")} style={{padding:"8px 16px", borderRadius:6, border:"none", background: hrTab === "fatturato" ? "#fff" : "transparent", fontWeight:600, fontSize:13, cursor:"pointer", color: hrTab === "fatturato" ? "#111827" : "#6B7280", boxShadow: hrTab === "fatturato" ? "0 1px 3px rgba(0,0,0,0.1)" : "none"}}>Fatturato</button>
          </div>
        )}
      </div>

      {/* ── HR: ÇALIŞAN MALİYETLERİ (Ayrılmış Bileşen) ── */}
      {isHR && hrTab === "employees" && (
        <EmployeeCostsTab 
          costs={costs} 
          loadingCosts={loadingCosts} 
          setSelectedEmpHR={setSelectedEmpHR} 
          setShowCostModal={setShowCostModal} 
          loadOvertime={loadOvertime} 
        />
      )}

      {/* ── HR: PROJE FİNANSMANI ── */}
      {isHR && hrTab === "projects" && (
        <>
          {/* GENEL GİDERLER PANELİ */}
          <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:"20px 24px",marginBottom:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
              <div>
                <div style={{fontSize:10,color:"#9CA3AF",fontWeight:700,letterSpacing:"0.1em",marginBottom:2}}>OVERHEAD — {selectedYear}</div>
                <h3 style={{margin:0,fontSize:16,fontWeight:700,color:"#111827"}}>General Company Costs</h3>
                <p style={{margin:"4px 0 0",fontSize:12,color:"#9CA3AF"}}>These costs will be distributed across projects based on weight</p>
              </div>
              {totalGeneralCost > 0 && (
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:10,color:"#9CA3AF",fontWeight:700,letterSpacing:"0.05em",marginBottom:2}}>TOTAL OVERHEAD</div>
                  <div style={{fontSize:22,fontWeight:800,color:"#EF4444"}}>
                    €{totalGeneralCost.toLocaleString("it-IT",{minimumFractionDigits:0,maximumFractionDigits:0})}
                  </div>
                </div>
              )}
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
              {GENERAL_COST_FIELDS.map(field => (
                <div key={field.key} style={{background:"#F9FAFB",borderRadius:10,padding:"14px 16px",border:"1.5px solid #E5E7EB",transition:"border-color 0.15s"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                    <span style={{fontSize:16}}>{field.icon}</span>
                    <span style={{fontSize:11,fontWeight:700,color:"#6B7280",letterSpacing:"0.05em"}}>{field.label.toUpperCase()}</span>
                    {savingGeneralCost[field.key] && (
                      <span style={{fontSize:10,color:"#9CA3AF",marginLeft:"auto"}}>saving…</span>
                    )}
                  </div>
                  <div style={{position:"relative"}}>
                    <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:"#9CA3AF",pointerEvents:"none"}}>€</span>
                    <input
                      type="number" step="100" min="0" value={generalCostsInput[field.key]}
                      onChange={e => setGeneralCostsInput(p => ({ ...p, [field.key]: e.target.value }))}
                      onBlur={e => handleSaveGeneralCost(field.key, e.target.value)}
                      placeholder="0"
                      style={{
                        width:"100%", border:`1.5px solid ${generalCosts[field.key] > 0 ? field.color + "66" : "#E5E7EB"}`,
                        borderRadius:8, padding:"8px 10px 8px 24px", fontSize:14, fontWeight:700,
                        color: generalCosts[field.key] > 0 ? field.color : "#374151", background:"#fff",
                        outline:"none", boxSizing:"border-box", fontFamily:"'Inter',sans-serif",
                      }}
                    />
                  </div>
                  {generalCosts[field.key] > 0 && (
                    <div style={{marginTop:6,fontSize:11,color:field.color,fontWeight:600}}>
                      €{generalCosts[field.key].toLocaleString("it-IT",{minimumFractionDigits:0})}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {totalGeneralCost > 0 && totalWeight > 0 && (
              <div style={{marginTop:14,padding:"10px 14px",background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:8,display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:14}}>📊</span>
                <span style={{fontSize:12,color:"#92400E",fontWeight:500}}>
                  Total overhead of <strong>€{totalGeneralCost.toLocaleString("it-IT",{minimumFractionDigits:0})}</strong> will be distributed across <strong>{finances.tasks.filter(t => (parseFloat(taskWeights[t.id])||0) > 0).length}</strong> weighted project{finances.tasks.filter(t => (parseFloat(taskWeights[t.id])||0) > 0).length !== 1 ? "s" : ""} (total weight: <strong>{totalWeight.toFixed(1)}</strong>)
                </span>
              </div>
            )}
            {totalGeneralCost > 0 && totalWeight === 0 && (
              <div style={{marginTop:14,padding:"10px 14px",background:"#F3F4F6",border:"1px solid #E5E7EB",borderRadius:8,display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:14}}>💡</span>
                <span style={{fontSize:12,color:"#6B7280"}}>Set project weights below to distribute overhead costs across projects</span>
              </div>
            )}
          </div>

          {/* PROJE TABLOSU */}
          <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",overflow:"hidden",marginBottom:24}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:"#F9FAFB"}}>
                  {[
                    { label:"Project / Task", align:"left" },
                    { label:"Logged Hours",   align:"center" },
                    { label:"Labour Cost",    align:"center" },
                    { label:"Weight",         align:"center", hint:"Relative weight for overhead distribution" },
                    { label:"Overhead Share", align:"center", hint:"Portion of general costs allocated to this project" },
                    { label:"Total Cost",     align:"center" },
                    { label:"Valore Ordine",  align:"center", hint:"From Fatturato Register" },
                    { label:"Fatturato (€)",  align:"center", hint:"From Fatturato Register" },
                    { label:"Net Profit",     align:"center" },
                  ].map(h => (
                    <th key={h.label} title={h.hint || ""} style={{padding:"12px 16px",fontSize:11,fontWeight:700,color:"#6B7280",textAlign:h.align,letterSpacing:"0.05em",cursor:h.hint?"help":"default"}}>
                      {h.label.toUpperCase()}{h.hint ? " ℹ" : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {finances.tasks.map(task => {
                  const tHours = finances.task_hours.filter(th => th.task_id === task.id);
                  let labourCost = 0; let totalHours = 0;
                  tHours.forEach(th => {
                    const emp = costs.find(e => e.id === th.employee_id);
                    const rate = emp ? parseFloat(emp.hourly_rate_dynamic) : 0;
                    labourCost += (parseFloat(th.total_hours) * rate);
                    totalHours += parseFloat(th.total_hours);
                  });

                  const fattData = getFattByTask(task.id);
                  const valoreOrdine = fattData ? parseFloat(fattData.total_valore_ordine) : 0;
                  const fatturato = fattData ? parseFloat(fattData.total_fatturato) : 0;

                  const extraCost  = getExtraCost(task.id);
                  const totalCost  = labourCost + extraCost;
                  const profit     = fatturato - totalCost;
                  const isProfitable = profit >= 0;

                  const weight     = taskWeights[task.id] ?? "";
                  const weightPct  = totalWeight > 0 && (parseFloat(weight) || 0) > 0
                    ? (((parseFloat(weight) || 0) / totalWeight) * 100).toFixed(1)
                    : null;

                  return (
                    <tr key={task.id} style={{borderTop:"1px solid #F3F4F6"}}>
                      <td style={{padding:"14px 16px",fontSize:13,fontWeight:600,color:"#111827"}}>{task.title}</td>
                      <td style={{padding:"14px 16px",textAlign:"center",fontSize:13,fontWeight:600,color:"#374151"}}>{totalHours.toFixed(1)}h</td>
                      <td style={{padding:"14px 16px",textAlign:"center",fontSize:13,fontWeight:600,color:"#DC2626"}}>- €{labourCost.toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                      <td style={{padding:"14px 16px",textAlign:"center"}}>
                        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                          <input
                            type="number" min="0" step="0.1" value={weight}
                            onChange={e => setTaskWeights(p => ({ ...p, [task.id]: e.target.value }))}
                            onBlur={e => api.updateSetting(`tw_${task.id}_${selectedYear}`, e.target.value || "0").catch(console.error)}
                            placeholder="—"
                            style={{ width:70, padding:"6px 8px", border:`1.5px solid ${(parseFloat(weight)||0) > 0 ? "#6366F1" : "#E5E7EB"}`, borderRadius:6, textAlign:"center", outline:"none", fontWeight:700, fontSize:13, color:(parseFloat(weight)||0) > 0 ? "#4F46E5" : "#374151", background:(parseFloat(weight)||0) > 0 ? "#EEF2FF" : "#fff", fontFamily:"'Inter',sans-serif"}}
                          />
                          {weightPct && <span style={{fontSize:10,color:"#9CA3AF",fontWeight:500}}>{weightPct}%</span>}
                        </div>
                      </td>
                      <td style={{padding:"14px 16px",textAlign:"center"}}>
                        {extraCost > 0 ? (
                          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                            <span style={{fontSize:13,fontWeight:700,color:"#F59E0B"}}>- €{extraCost.toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                            <span style={{fontSize:10,color:"#D1D5DB"}}>of overhead</span>
                          </div>
                        ) : <span style={{color:"#D1D5DB",fontSize:13}}>—</span>}
                      </td>
                      <td style={{padding:"14px 16px",textAlign:"center"}}>
                        <span style={{ fontSize:13,fontWeight:700, color: totalCost > 0 ? "#DC2626" : "#D1D5DB", background: totalCost > 0 ? "#FEF2F2" : "transparent", padding: totalCost > 0 ? "3px 8px" : "0", borderRadius:6 }}>
                          {totalCost > 0 ? `- €${totalCost.toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2})}` : "—"}
                        </span>
                      </td>
                      <td style={{padding:"14px 16px",textAlign:"center",color:"#6366F1",fontWeight:600}}>{valoreOrdine > 0 ? `€${valoreOrdine.toLocaleString()}` : "—"}</td>
                      <td style={{padding:"14px 16px",textAlign:"center",color:"#059669",fontWeight:700}}>{fatturato > 0 ? `€${fatturato.toLocaleString()}` : "—"}</td>
                      <td style={{padding:"14px 16px",textAlign:"center"}}>
                        {fatturato > 0 || totalCost > 0 ? (
                          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                            <span style={{ fontSize:14,fontWeight:800, color: isProfitable ? "#059669" : "#DC2626", background: isProfitable ? "#F0FDF4" : "#FEF2F2", padding:"4px 10px",borderRadius:6 }}>
                              {isProfitable ? "+" : ""}€{profit.toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2})}
                            </span>
                            {extraCost > 0 && <span style={{fontSize:10,color:"#9CA3AF"}}>incl. overhead</span>}
                          </div>
                        ) : <span style={{color:"#D1D5DB",fontSize:13}}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* TOTALS ROW */}
              {finances.tasks.length > 0 && (() => {
                let grandLabour = 0, grandFatturato = 0, grandValore = 0, grandHours = 0, grandExtra = 0;
                finances.tasks.forEach(task => {
                  const tHours = finances.task_hours.filter(th => th.task_id === task.id);
                  tHours.forEach(th => {
                    const emp = costs.find(e => e.id === th.employee_id);
                    const rate = emp ? parseFloat(emp.hourly_rate_dynamic) : 0;
                    grandLabour += parseFloat(th.total_hours) * rate;
                    grandHours  += parseFloat(th.total_hours);
                  });
                  grandExtra   += getExtraCost(task.id);
                  const fattData = getFattByTask(task.id);
                  if (fattData) {
                    grandFatturato += parseFloat(fattData.total_fatturato);
                    grandValore += parseFloat(fattData.total_valore_ordine);
                  }
                });
                const grandTotal  = grandLabour + grandExtra;
                const grandProfit = grandFatturato - grandTotal;
                return (
                  <tfoot>
                    <tr style={{background:"#F9FAFB",borderTop:"2px solid #E5E7EB"}}>
                      <td style={{padding:"12px 16px",fontSize:12,fontWeight:700,color:"#6B7280"}}>TOTALS</td>
                      <td style={{padding:"12px 16px",textAlign:"center",fontSize:12,fontWeight:700,color:"#374151"}}>{grandHours.toFixed(1)}h</td>
                      <td style={{padding:"12px 16px",textAlign:"center",fontSize:12,fontWeight:700,color:"#DC2626"}}>- €{grandLabour.toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                      <td style={{padding:"12px 16px",textAlign:"center",fontSize:11,color:"#9CA3AF"}}>Σ {totalWeight.toFixed(1)}</td>
                      <td style={{padding:"12px 16px",textAlign:"center",fontSize:12,fontWeight:700,color:"#F59E0B"}}>- €{grandExtra.toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                      <td style={{padding:"12px 16px",textAlign:"center",fontSize:12,fontWeight:700,color:"#DC2626"}}>- €{grandTotal.toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                      <td style={{padding:"12px 16px",textAlign:"center",fontSize:12,fontWeight:700,color:"#6366F1"}}>€{grandValore.toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                      <td style={{padding:"12px 16px",textAlign:"center",fontSize:12,fontWeight:700,color:"#059669"}}>€{grandFatturato.toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                      <td style={{padding:"12px 16px",textAlign:"center"}}>
                        <span style={{ fontSize:13,fontWeight:800, color: grandProfit >= 0 ? "#059669" : "#DC2626", background: grandProfit >= 0 ? "#F0FDF4" : "#FEF2F2", padding:"4px 10px",borderRadius:6 }}>
                          {grandProfit >= 0 ? "+" : ""}€{grandProfit.toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2})}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                );
              })()}
            </table>
          </div>
        </>
      )}

      {/* ── FATTURATO SEKMESİ ── */}
      {isHR && hrTab === "fatturato" && (
        <div style={{marginBottom:24}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div><div style={{fontSize:10,color:"#9CA3AF",fontWeight:700,letterSpacing:"0.1em",marginBottom:2}}>HR ONLY — {selectedYear}</div><h3 style={{margin:0,fontSize:16,fontWeight:700,color:"#111827"}}>Fatturato / Revenue Register</h3></div>
            <button onClick={openNewFatt} style={{background:"#2563EB",color:"#fff",border:"none",borderRadius:8,padding:"10px 18px",fontWeight:600,fontSize:13,cursor:"pointer"}}>+ New Commessa</button>
          </div>

          <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",overflowX:"auto"}}>
            {fatturatoList.length === 0 ? <div style={{padding:40,textAlign:"center",color:"#9CA3AF",fontSize:13}}>No entries for {selectedYear}.</div> : (
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:1200}}>
                <thead>
                  <tr style={{background:"#F9FAFB"}}>
                    {["Comm.","Task (Project)","Actions","N. Cliente","Cliente","Preventivo","Ordine","Attività","Valore Ordine","Fatturato","Rimanente","Rim. Prob.","Proforma"].map(h => <th key={h} style={{padding:"10px 14px",fontSize:10,fontWeight:700,color:"#6B7280",textAlign:"left",whiteSpace:"nowrap",borderBottom:"2px solid #E5E7EB"}}>{h.toUpperCase()}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {fatturatoList.map((comm) => {
                    const totalLines = comm.clients.reduce((sum, c) => sum + (c.lines?.length || 1), 0) || 1;
                    let commRendered = false;

                    return comm.clients.length === 0 ? (
                      <tr key={comm.id} style={{borderBottom:"2px solid #E5E7EB"}}><td style={{padding:"12px 14px",fontWeight:700}}>{comm.comm_number}</td><td style={{padding:"12px 14px"}}>{comm.task_title}</td><td style={{padding:"12px 14px"}}><button onClick={() => openEditFatt(comm)}>Edit</button></td><td colSpan={10} style={{color:"#9CA3AF",padding:"12px"}}>No clients added.</td></tr>
                    ) : comm.clients.map((client, cIdx) => {
                      const clientLines = client.lines?.length > 0 ? client.lines : [{}];
                      return clientLines.map((line, lIdx) => {
                        const isFirstComm = !commRendered; commRendered = true;
                        const isFirstCli = lIdx === 0;
                        const rimanente = (parseFloat(line.valore_ordine)||0) - (parseFloat(line.fatturato_amount)||0);

                        return (
                          <tr key={`${comm.id}-${client.id}-${line.id||lIdx}`} style={{borderBottom: lIdx === clientLines.length-1 && cIdx !== comm.clients.length-1 ? "1px dashed #D1D5DB" : cIdx === comm.clients.length-1 && lIdx === clientLines.length-1 ? "2px solid #E5E7EB" : "1px solid #F3F4F6"}}>
                            {isFirstComm && (
                              <>
                                <td rowSpan={totalLines} style={{padding:"12px 14px",fontWeight:800,color:"#4F46E5",verticalAlign:"top",borderRight:"1px solid #E5E7EB",background:"#FAFAFA"}}>{comm.comm_number || "—"}</td>
                                <td rowSpan={totalLines} style={{padding:"12px 14px",fontWeight:600,color:"#111827",verticalAlign:"top",maxWidth:150,background:"#FAFAFA"}}>{comm.name ? (
                                    <div><div style={{fontWeight:700}}>{comm.name}</div><div style={{fontSize:11,color:"#9CA3AF"}}>{comm.task_title || "—"}</div></div>
                                  ) : (comm.task_title || "—")}
                                </td>
                                <td rowSpan={totalLines} style={{padding:"12px 14px",verticalAlign:"top",borderRight:"2px solid #E5E7EB",background:"#FAFAFA"}}>
                                  <div style={{display:"flex",gap:4,flexDirection:"column"}}>
                                    <button onClick={() => openEditFatt(comm)} style={{background:"#F3F4F6",border:"1px solid #D1D5DB",borderRadius:6,padding:"4px 8px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Edit</button>
                                    <button onClick={() => handleDeleteFatt(comm.id)} style={{background:"#FEF2F2",color:"#DC2626",border:"1px solid #FECACA",borderRadius:6,padding:"4px 8px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Delete</button>
                                  </div>
                                </td>
                              </>
                            )}
                            {isFirstCli && (
                              <>
                                <td rowSpan={clientLines.length} style={{padding:"12px 14px",fontWeight:700,color:"#6B7280",verticalAlign:"top",background:"#fff"}}>{client.n_cliente || "—"}</td>
                                <td rowSpan={clientLines.length} style={{padding:"12px 14px",fontSize:12,color:"#374151",verticalAlign:"top",fontWeight:600,background:"#fff"}}>{client.client_name || "—"}</td>
                                <td rowSpan={clientLines.length} style={{padding:"12px 14px",fontSize:12,color:"#374151",verticalAlign:"top",background:"#fff"}}>{client.preventivo || "—"}</td>
                                <td rowSpan={clientLines.length} style={{padding:"12px 14px",fontSize:12,color:"#374151",verticalAlign:"top",borderRight:"1px solid #F3F4F6",background:"#fff"}}>{client.ordine || "—"}</td>
                              </>
                            )}
                            <td style={{padding:"12px 14px",fontSize:12,fontWeight:600,color:"#111827"}}>{line.attivita || "—"}</td>
                            <td style={{padding:"12px 14px",fontSize:12,fontWeight:600,color:"#6366F1"}}>{line.valore_ordine ? `€${parseFloat(line.valore_ordine).toLocaleString()}` : "—"}</td>
                            <td style={{padding:"12px 14px",fontSize:12,fontWeight:700,color:"#059669"}}>{line.fatturato_amount ? `€${parseFloat(line.fatturato_amount).toLocaleString()}` : "—"}</td>
                            <td style={{padding:"12px 14px",fontSize:12,fontWeight:600,color:rimanente>0?"#F59E0B":"#6B7280"}}>{line.valore_ordine ? `€${rimanente.toLocaleString()}` : "—"}</td>
                            <td style={{padding:"12px 14px",fontSize:12,color:"#374151"}}>{line.rimanente_probabile ? `€${parseFloat(line.rimanente_probabile).toLocaleString()}` : "—"}</td>
                            <td style={{padding:"12px 14px",fontSize:12,color:"#374151"}}>{line.proforma ? `€${parseFloat(line.proforma).toLocaleString()}` : "—"}</td>
                          </tr>
                        );
                      })
                    });
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── İŞÇİ: TIMESHEET (Ayrılmış Bileşen) ── */}
      <TimesheetTab 
        employees={employees}
        allTasks={allTasks}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        selectedEmp={selectedEmp}
        setSelectedEmp={setSelectedEmp}
        dailyHours={dailyHours}
        setDailyHours={setDailyHours}
        handleDaySave={handleDaySave}
        saving={saving}
      />

      {/* ── MODALS ── */}
      {/* 1. FATTURATO MODAL */}
      {showFattModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(17,24,39,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,backdropFilter:"blur(4px)",padding:"40px 0"}}>
          <div style={{background:"#fff",borderRadius:16,padding:28,width:960,boxShadow:"0 20px 60px rgba(0,0,0,0.15)",maxHeight:"100%",overflowY:"auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h3 style={{color:"#111827",margin:0,fontSize:18,fontWeight:700}}>{editingFatt ? "Edit Commessa Hierarchy" : "New Commessa & Clients"}</h3>
              <button onClick={() => setShowFattModal(false)} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#9CA3AF"}}>✕</button>
            </div>

            <div style={{background:"#F0FDF4",padding:16,borderRadius:8,border:"1px solid #BBF7D0",marginBottom:20}}>
              <h4 style={{margin:"0 0 12px",fontSize:11,fontWeight:800,color:"#166534"}}>1. COMMESSA (PROJECT ROOT)</h4>
              <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:16}}>
                <div><label style={{fontSize:10,fontWeight:700}}>Comm. Number</label><input value={fattForm.comm_number} onChange={e=>setFattForm({...fattForm,comm_number:e.target.value})} style={inpStyle} placeholder="e.g. 25-003"/></div>
                <div><label style={{fontSize:10,fontWeight:700}}>Commessa Name</label><input value={fattForm.name||""} onChange={e=>setFattForm({...fattForm,name:e.target.value})} style={inpStyle} placeholder="es. HOTEL DIANA MAJESTIC"/></div>
                <div><label style={{fontSize:10,fontWeight:700}}>Linked Task</label><select value={fattForm.task_id} onChange={e=>setFattForm({...fattForm,task_id:e.target.value})} style={inpStyle}><option value="">— Not Linked —</option>{allTasks.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></div>
              </div>
            </div>

            <div style={{marginBottom:24}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <h4 style={{margin:0,fontSize:13,fontWeight:800,color:"#1F2937"}}>2. CLIENTS & ACTIVITIES</h4>
                <button onClick={addClientBlock} style={{background:"#2563EB",color:"#fff",border:"none",padding:"6px 12px",borderRadius:6,fontSize:11,fontWeight:700,cursor:"pointer"}}>+ Add Another Client to Commessa</button>
              </div>

              {fattForm.clients.map((client, cIdx) => (
                <div key={cIdx} style={{background:"#F9FAFB",padding:16,borderRadius:10,border:"2px solid #E5E7EB",marginBottom:16,position:"relative"}}>
                  {fattForm.clients.length > 1 && <button onClick={() => removeClientBlock(cIdx)} style={{position:"absolute",top:16,right:16,background:"#FEF2F2",color:"#DC2626",border:"none",padding:"4px 8px",borderRadius:6,fontSize:10,fontWeight:700,cursor:"pointer"}}>Remove Client</button>}
                  
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4, 1fr)",gap:12,marginBottom:12,paddingRight:60}}>
                    <div><label style={{fontSize:10,fontWeight:700}}>N. Cliente</label><input value={client.n_cliente} onChange={e=>handleClientChange(cIdx, "n_cliente", e.target.value)} style={inpStyle} placeholder="00"/></div>
                    <div>
                      <label style={{fontSize:10,fontWeight:700}}>Client Profile</label>
                      <div style={{display:"flex",gap:4}}>
                        <select value={client.client_id} onChange={e=>handleClientChange(cIdx, "client_id", e.target.value)} style={{...inpStyle,padding:"6px",flex:1}}><option value="">— Select —</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
                        <button onClick={() => setShowClientModal(true)} style={{padding:"6px 10px",background:"#E5E7EB",border:"none",borderRadius:6,fontSize:11,fontWeight:700,cursor:"pointer"}}>+</button>
                      </div>
                    </div>
                    <div><label style={{fontSize:10,fontWeight:700}}>Preventivo</label><input value={client.preventivo} onChange={e=>handleClientChange(cIdx, "preventivo", e.target.value)} style={inpStyle}/></div>
                    <div><label style={{fontSize:10,fontWeight:700}}>Ordine Desc.</label><input value={client.ordine} onChange={e=>handleClientChange(cIdx, "ordine", e.target.value)} style={inpStyle}/></div>
                  </div>

                  <div style={{marginTop:16,borderTop:"1px dashed #D1D5DB",paddingTop:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                      <div style={{fontSize:10,fontWeight:700,color:"#6B7280"}}>ACTIVITIES FOR THIS CLIENT</div>
                      <button onClick={() => addLineToClient(cIdx)} style={{background:"#10B981",color:"#fff",border:"none",padding:"4px 8px",borderRadius:4,fontSize:10,fontWeight:700,cursor:"pointer"}}>+ Add Line</button>
                    </div>
                    {client.lines.map((line, lIdx) => (
                      <div key={lIdx} style={{display:"flex",gap:6,marginBottom:6}}>
                        <div style={{flex:2}}><input placeholder="Attività" value={line.attivita} onChange={e=>handleLineChange(cIdx, lIdx, "attivita", e.target.value)} style={{...inpStyle,padding:"6px"}}/></div>
                        <div style={{flex:1}}><input type="number" placeholder="Valore €" value={line.valore_ordine} onChange={e=>handleLineChange(cIdx, lIdx, "valore_ordine", e.target.value)} style={{...inpStyle,padding:"6px"}}/></div>
                        <div style={{flex:1}}><input type="number" placeholder="Fatturato €" value={line.fatturato_amount} onChange={e=>handleLineChange(cIdx, lIdx, "fatturato_amount", e.target.value)} style={{...inpStyle,padding:"6px"}}/></div>
                        <button onClick={() => removeLineFromClient(cIdx, lIdx)} disabled={client.lines.length===1} style={{background:"#F3F4F6",color:"#DC2626",border:"none",padding:"6px 10px",borderRadius:6,cursor:client.lines.length>1?"pointer":"not-allowed"}}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button onClick={handleSaveFatt} disabled={savingFatt} style={{width:"100%",padding:14,background:"#2563EB",color:"#fff",border:"none",borderRadius:8,fontWeight:700,fontSize:14,cursor:"pointer"}}>{savingFatt ? "Saving Everything..." : "Save Full Commessa Structure"}</button>
          </div>
        </div>
      )}

      {/* 2. YENİ MÜŞTERİ EKLEME MODALI */}
      {showClientModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(17,24,39,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400,backdropFilter:"blur(4px)"}}>
          <div style={{background:"#fff",borderRadius:16,padding:28,width:400,boxShadow:"0 20px 60px rgba(0,0,0,0.15)"}}>
            <h3 style={{margin:"0 0 20px",fontSize:18,fontWeight:700}}>Add New Client</h3>
            <div style={{marginBottom:14}}><label style={{fontSize:11,fontWeight:600,marginBottom:6,display:"block"}}>CLIENT NAME</label><input value={clientForm.name} onChange={e=>setClientForm({...clientForm,name:e.target.value})} style={inpStyle} placeholder="e.g. Comune di Milano"/></div>
            <div style={{marginBottom:24}}><label style={{fontSize:11,fontWeight:600,marginBottom:6,display:"block"}}>VAT NUMBER (P.IVA)</label><input value={clientForm.vat_number} onChange={e=>setClientForm({...clientForm,vat_number:e.target.value})} style={inpStyle}/></div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={handleSaveClient} disabled={savingClient} style={{flex:1,padding:11,background:"#2563EB",color:"#fff",border:"none",borderRadius:8,fontWeight:600,cursor:"pointer"}}>{savingClient ? "Saving..." : "Save"}</button>
              <button onClick={() => setShowClientModal(false)} style={{flex:1,padding:11,background:"#F9FAFB",color:"#374151",border:"1.5px solid #E5E7EB",borderRadius:8,fontWeight:600,cursor:"pointer"}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MAAŞ MODAL */}
      {showCostModal && selectedEmpHR && (
        <div style={{position:"fixed",inset:0,background:"rgba(17,24,39,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,backdropFilter:"blur(4px)"}}>
          <div style={{background:"#fff",borderRadius:16,padding:28,width:440,boxShadow:"0 20px 60px rgba(0,0,0,0.15)"}}>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:10,color:"#9CA3AF",letterSpacing:"0.1em",fontWeight:600,marginBottom:2}}>MANAGE SALARY & HISTORY</div>
              <h3 style={{color:"#111827",margin:0,fontSize:18,fontWeight:700}}>{selectedEmpHR.name}</h3>
            </div>
            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:11,color:"#374151",fontWeight:600,marginBottom:6}}>NEW ANNUAL GROSS (€)</label>
              <input type="number" step="1000" value={newCost.annual_gross} onChange={e => setNewCost(p => ({...p, annual_gross: e.target.value}))} placeholder="e.g. 45000" style={inpStyle} />
            </div>
            <div style={{marginBottom:20}}>
              <label style={{display:"block",fontSize:11,color:"#374151",fontWeight:600,marginBottom:6}}>VALID FROM DATE</label>
              <input type="date" value={newCost.valid_from} onChange={e => setNewCost(p => ({...p, valid_from: e.target.value}))} style={inpStyle} />
            </div>
            {(selectedEmpHR.cost_history || []).length > 0 && (
              <div style={{marginBottom:20, background:"#F9FAFB", borderRadius:10, padding:16, border:"1px solid #E5E7EB"}}>
                <div style={{fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:10, letterSpacing:"0.05em"}}>COST HISTORY</div>
                <div style={{maxHeight: 120, overflowY: "auto"}}>
                  {(selectedEmpHR.cost_history).map((item, idx) => (
                    <div key={idx} style={{display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom: idx === selectedEmpHR.cost_history.length - 1 ? "none" : "1px solid #E5E7EB", fontSize:12}}>
                      <span style={{fontWeight:600, color:"#111827"}}>€{parseFloat(item.annual_gross).toLocaleString("it-IT")}</span>
                      <span style={{color:"#6B7280"}}>since {item.valid_from}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{display:"flex",gap:10}}>
              <button onClick={handleAddCost} style={{flex:1,padding:11,background:"#2563EB",color:"#fff",border:"none",borderRadius:8,fontWeight:600,cursor:"pointer"}}>Update Salary</button>
              <button onClick={() => { setShowCostModal(false); setSelectedEmpHR(null); }} style={{flex:1,padding:11,background:"#F9FAFB",color:"#374151",border:"1.5px solid #E5E7EB",borderRadius:8,fontWeight:600,cursor:"pointer"}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MESAİ MODAL */}
      {showOvertimeModal && selectedEmpHR && (
         <div style={{position:"fixed",inset:0,background:"rgba(17,24,39,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,backdropFilter:"blur(4px)"}}>
           <div style={{background:"#fff",borderRadius:16,padding:28,width:440,boxShadow:"0 20px 60px rgba(0,0,0,0.15)"}}>
              <div style={{marginBottom:20}}>
                <div style={{fontSize:10,color:"#9CA3AF",letterSpacing:"0.1em",fontWeight:600,marginBottom:2}}>MANAGE OVERTIME ({selectedYear})</div>
                <h3 style={{color:"#111827",margin:0,fontSize:18,fontWeight:700}}>{selectedEmpHR.name}</h3>
              </div>
              <div style={{display:"flex",gap:10,marginBottom:20}}>
                <div style={{flex:1}}>
                  <label style={{display:"block",fontSize:11,fontWeight:600,marginBottom:6,color:"#374151"}}>MONTH</label>
                  <select value={overtimeInput.month} onChange={e => setOvertimeInput(p => ({...p, month: e.target.value}))} style={inpStyle}>{MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}</select>
                </div>
                <div style={{flex:1}}>
                  <label style={{display:"block",fontSize:11,fontWeight:600,marginBottom:6,color:"#374151"}}>OVERTIME HOURS</label>
                  <input type="number" step="0.5" value={overtimeInput.amount} onChange={e => setOvertimeInput(p => ({...p, amount: e.target.value}))} style={inpStyle} />
                </div>
                <div style={{display:"flex",alignItems:"flex-end"}}><button onClick={handleAddOvertime} style={{padding:"10px 14px",background:"#10B981",color:"#fff",border:"none",borderRadius:8,fontWeight:600,cursor:"pointer",fontSize:16}}>+</button></div>
              </div>
              <div style={{marginBottom:20,maxHeight:150,overflowY:"auto",background:"#F9FAFB",padding:12,borderRadius:8}}>
                <div style={{fontSize:11,fontWeight:700,color:"#6B7280",marginBottom:8}}>RECORDED OVERTIME HOURS ({selectedYear})</div>
                {overtimeData.map(od => (
                  <div key={od.month} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #E5E7EB",fontSize:13}}>
                    <span>{MONTHS[od.month-1]}</span><span style={{fontWeight:600,color:"#DC2626"}}>{parseFloat(od.amount)}h</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowOvertimeModal(false)} style={{width:"100%",padding:11,background:"#F9FAFB",border:"1.5px solid #E5E7EB",color:"#374151",borderRadius:8,cursor:"pointer",fontWeight:600}}>Close</button>
           </div>
         </div>
      )}

    </div>
  );
}