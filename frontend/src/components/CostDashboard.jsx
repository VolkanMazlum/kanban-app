import { useState, useEffect } from "react";
import Avatar from "./Avatar.jsx";
import * as api from "../api.js";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const ANNUAL_HOURS = 2000;

function getDaysInMonth(year, month) {
  const days = [];
  const date = new Date(year, month - 1, 1);
  while (date.getMonth() === month - 1) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

export default function CostDashboard({ employees, isHR }) {
  const currentYear  = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const today        = new Date(); today.setHours(0,0,0,0);

  const [selectedYear, setSelectedYear]   = useState(currentYear);
  const YEAR_OPTIONS = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  const [hrTab, setHrTab]                 = useState("employees"); 
  const [costs, setCosts]                 = useState([]);
  const [loadingCosts, setLoadingCosts]   = useState(false);
  const [showCostModal, setShowCostModal] = useState(false);
  const [selectedEmpHR, setSelectedEmpHR] = useState(null);
  const [newCost, setNewCost]             = useState({ annual_gross: "", valid_from: new Date().toISOString().slice(0,10) });

  const [showOvertimeModal, setShowOvertimeModal] = useState(false);
  const [overtimeData, setOvertimeData]           = useState([]);
  const [overtimeInput, setOvertimeInput]         = useState({ month: currentMonth, amount: "" });

  const [finances, setFinances] = useState({ tasks: [], task_hours: [] });

  const [allTasks, setAllTasks]           = useState([]);
  const [selectedEmp, setSelectedEmp]     = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [dailyHours, setDailyHours]       = useState({});
  const [saving, setSaving]               = useState(false);

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
      api.getTaskFinances(selectedYear).then(setFinances).catch(console.error);
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
      // Güncel veriyi seçili çalışana da yansıt (Modal daki history'nin yenilenmesi için)
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

  const handleSaveRevenue = async (taskId, revenue) => {
    try {
      await api.saveTaskRevenue(taskId, { revenue: parseFloat(revenue) || 0 });
      setFinances(p => ({ ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, revenue } : t) }));
    } catch (err) { console.error(err); }
  };

  const days = getDaysInMonth(selectedYear, selectedMonth);
  const assignedTasks = allTasks.filter(t => t.phases?.some(phase => phase.assignee_hours?.some(a => a.id === selectedEmp?.id)));

  let totalWorkerHours = 0;
  Object.values(dailyHours).forEach(taskMap => {
    Object.values(taskMap).forEach(d => { totalWorkerHours += (parseFloat(d.hours) || 0); });
  });

  const inp = { border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#111827", fontFamily: "'Inter',sans-serif", width: "100%", outline: "none" };

  return (
    <div style={{padding:"28px 32px",overflowY:"auto",height:"calc(100vh - 65px)",fontFamily:"'Inter',sans-serif",background:"#F9FAFB"}}>

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
          </div>
        )}
      </div>

      {/* ── HR: ÇALIŞAN MALİYETLERİ ── */}
      {isHR && hrTab === "employees" && (
        <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",overflow:"hidden",marginBottom:24}}>
          {loadingCosts ? (
            <div style={{padding:32,textAlign:"center",color:"#9CA3AF",fontSize:13}}>Loading...</div>
          ) : (
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:"#F9FAFB"}}>
                  {["Employee","Annual Gross", "Overtime (h)", "Total Hours","Rate (Theory)","Rate (Dynamic)","Valid From","Actions"].map(header => (
                    <th key={header} style={{padding:"10px 16px",fontSize:11,fontWeight:700,color:"#6B7280",textAlign:header==="Employee"?"left":"center",letterSpacing:"0.05em"}}>{header.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {costs.map((emp, i) => {
                  const gross = parseFloat(emp.current_annual_gross) || 0;
                  const actualHours = parseFloat(emp.actual_hours_this_year) || 0;
                  const overtimeHours = parseFloat(emp.overtime_hours_this_year) || 0; 
                  const hasHistory = (emp.cost_history || []).length > 1;

                  return (
                    <tr key={emp.id} style={{borderTop:"1px solid #F3F4F6"}}>
                      <td style={{padding:"12px 16px"}}><div style={{display:"flex",alignItems:"center",gap:10}}><Avatar name={emp.name} size={32} idx={i}/><span style={{fontSize:13,fontWeight:600}}>{emp.name}</span></div></td>
                      <td style={{padding:"12px 16px",textAlign:"center",fontSize:13,fontWeight:600}}>
                         <div style={{display:"flex", alignItems:"center", justifyContent:"center", gap:4}}>
                            {gross > 0 ? `€${gross.toLocaleString("it-IT")}` : "—"}
                            {hasHistory && <span title="Has Salary History" style={{fontSize:10, cursor:"help"}}>📜</span>}
                         </div>
                      </td>
                      <td style={{padding:"12px 16px",textAlign:"center",fontSize:13,fontWeight:600,color:"#DC2626"}}>{overtimeHours > 0 ? `${overtimeHours}h` : "—"}</td>
                      <td style={{padding:"12px 16px",textAlign:"center",fontSize:13,fontWeight:600,color:actualHours>0?"#059669":"#D1D5DB"}}>{actualHours > 0 ? `${actualHours.toFixed(1)}h` : "—"}</td>
                      <td style={{padding:"12px 16px",textAlign:"center"}}><span style={{background:"#EFF6FF",color:"#2563EB",padding:"3px 10px",borderRadius:6,fontSize:12,fontWeight:700}}>€{emp.hourly_rate_theoretical}/h</span></td>
                      <td style={{padding:"12px 16px",textAlign:"center"}}><span style={{background:"#F0FDF4",color:"#059669",padding:"3px 10px",borderRadius:6,fontSize:12,fontWeight:700}}>€{emp.hourly_rate_dynamic}/h</span></td>
                      <td style={{padding:"12px 16px",textAlign:"center",fontSize:12,color:"#6B7280"}}>{emp.current_valid_from || "—"}</td>
                      <td style={{padding:"12px 16px",textAlign:"center"}}>
                        <button onClick={() => { setSelectedEmpHR(emp); setShowCostModal(true); }} style={{background:"#F3F4F6",border:"none",borderRadius:6,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer",marginRight:4}}>Salary</button>
                        <button onClick={() => loadOvertime(emp)} style={{background:"#FEF2F2",color:"#DC2626",border:"none",borderRadius:6,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Overtime</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── HR: PROJE FİNANSMANI ── */}
      {isHR && hrTab === "projects" && (
        <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",overflow:"hidden",marginBottom:24}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{background:"#F9FAFB"}}>
                {["Project / Task", "Logged Hours", "Actual Cost (Dynamic)", "Client Revenue (€)", "Profit / Loss"].map(h => (
                  <th key={h} style={{padding:"12px 16px",fontSize:11,fontWeight:700,color:"#6B7280",textAlign:h==="Project / Task"?"left":"center",letterSpacing:"0.05em"}}>{h.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {finances.tasks.map(task => {
                const tHours = finances.task_hours.filter(th => th.task_id === task.id);
                let totalCost = 0; let totalHours = 0;
                tHours.forEach(th => {
                  const emp = costs.find(e => e.id === th.employee_id);
                  const rate = emp ? parseFloat(emp.hourly_rate_dynamic) : 0;
                  totalCost += (parseFloat(th.total_hours) * rate);
                  totalHours += parseFloat(th.total_hours);
                });
                const revenue = parseFloat(task.revenue) || 0;
                const profit = revenue - totalCost;
                const isProfitable = profit >= 0;

                return (
                  <tr key={task.id} style={{borderTop:"1px solid #F3F4F6"}}>
                    <td style={{padding:"14px 16px",fontSize:13,fontWeight:600,color:"#111827"}}>{task.title}</td>
                    <td style={{padding:"14px 16px",textAlign:"center",fontSize:13,fontWeight:600,color:"#374151"}}>{totalHours.toFixed(1)}h</td>
                    <td style={{padding:"14px 16px",textAlign:"center",fontSize:13,fontWeight:600,color:"#DC2626"}}>- €{totalCost.toLocaleString("it-IT", {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                    <td style={{padding:"14px 16px",textAlign:"center"}}>
                      <input 
                        type="number" step="100" defaultValue={revenue > 0 ? revenue : ""} placeholder="e.g. 5000"
                        onBlur={e => handleSaveRevenue(task.id, e.target.value)}
                        style={{width:100, padding:"6px", border:"1px solid #D1D5DB", borderRadius:6, textAlign:"center", outline:"none", fontWeight:600, color:"#059669"}}
                      />
                    </td>
                    <td style={{padding:"14px 16px",textAlign:"center",fontSize:14,fontWeight:700,color:isProfitable ? "#059669" : "#DC2626"}}>
                      {isProfitable ? "+" : ""}€{profit.toLocaleString("it-IT", {minimumFractionDigits:2, maximumFractionDigits:2})}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── İŞÇİ: GÜNLÜK SAAT GİRİŞİ ── */}
      <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",overflow:"hidden"}}>
        <div style={{padding:"18px 24px",borderBottom:"1px solid #F3F4F6"}}>
          <h3 style={{fontSize:14,fontWeight:700,color:"#111827",margin:"0 0 2px"}}>Daily Work Hours — {selectedYear}</h3>
          <p style={{fontSize:12,color:"#6B7280",margin:0}}>Select your name and log hours for assigned projects</p>
        </div>

        <div style={{padding:24}}>
          <div style={{marginBottom:20,display:"flex",gap:16,alignItems:"flex-end",flexWrap:"wrap"}}>
            <div style={{flex:"0 0 240px"}}>
              <label style={{fontSize:11,color:"#374151",fontWeight:600,marginBottom:6,display:"block",letterSpacing:"0.05em"}}>SELECT EMPLOYEE</label>
              <select
                value={selectedEmp?.id || ""}
                onChange={e => { setSelectedEmp(employees.find(emp => String(emp.id) === e.target.value) || null); setDailyHours({}); }}
                style={{background:"#F9FAFB",border:"1.5px solid #E5E7EB",borderRadius:8,padding:"8px 12px",fontSize:13,width:"100%",color:"#374151",fontFamily:"'Inter',sans-serif"}}
              >
                <option value="">— Select —</option>
                {employees.map(e => <option key={e.id} value={String(e.id)}>{e.name}</option>)}
              </select>
            </div>

            <div style={{flex:1}}>
              <label style={{fontSize:11,color:"#374151",fontWeight:600,marginBottom:6,display:"block",letterSpacing:"0.05em"}}>MONTH</label>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {MONTHS.map((m, idx) => {
                  const mn = idx + 1; 
                  const isPast = selectedYear < currentYear || (selectedYear === currentYear && mn <= currentMonth);
                  return (
                    <button key={mn} onClick={() => isPast && setSelectedMonth(mn)}
                      style={{
                        padding:"5px 10px", borderRadius:6, border:"none", cursor: isPast ? "pointer" : "default", fontSize:12, fontWeight:600,
                        background: selectedMonth === mn ? "#2563EB" : isPast ? "#F3F4F6" : "#F9FAFB",
                        color: selectedMonth === mn ? "#fff" : isPast ? "#374151" : "#D1D5DB", transition:"all 0.15s"
                      }}
                    >{m}</button>
                  );
                })}
              </div>
            </div>
          </div>

          {selectedEmp ? (
            <>
              <div style={{marginBottom:16,padding:"10px 16px",background:"#F0F7FF",borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:12,color:"#374151",fontWeight:500}}>Total hours logged — {MONTHS[selectedMonth-1]} {selectedYear}</span>
                <span style={{fontSize:16,fontWeight:700,color:"#2563EB"}}>{totalWorkerHours.toFixed(1)}h</span>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:8}}>
                {Array.from({length: (days[0].getDay() + 6) % 7}).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}

                {days.map(day => {
                  const dateStr   = day.toISOString().slice(0,10);
                  const isPast    = day <= today;
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  const isToday   = day.toDateString() === today.toDateString();
                  const dayLabel  = day.toLocaleString("en-US", { weekday:"short" });

                  const dayTotal = assignedTasks.reduce((sum, t) => sum + (parseFloat(dailyHours[t.id]?.[dateStr]?.hours) || 0), 0);
                  const hasHours = dayTotal > 0;

                  return (
                    <div key={dateStr} style={{
                      background: isWeekend ? "#F9FAFB" : hasHours ? "#F0FDF4" : "#fff",
                      borderRadius:8, padding:"8px 8px 10px",
                      border:`1.5px solid ${isToday ? "#2563EB" : hasHours ? "#86EFAC" : isWeekend ? "#F3F4F6" : "#E5E7EB"}`,
                      opacity: isPast ? 1 : 0.35,
                      transition:"border-color 0.15s",
                      display: "flex", flexDirection: "column"
                    }}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8, paddingBottom: 6, borderBottom: "1px dashed #E5E7EB"}}>
                        <span style={{fontSize:9,fontWeight:700,color:isWeekend?"#D1D5DB":isToday?"#2563EB":"#9CA3AF"}}>{dayLabel}</span>
                        <div style={{display: "flex", gap: 6, alignItems: "center"}}>
                            {hasHours && <span style={{fontSize:10, fontWeight:700, color:"#059669"}}>{dayTotal}h</span>}
                            <span style={{fontSize:13,fontWeight:700,color:isWeekend?"#D1D5DB":isToday?"#2563EB":"#111827"}}>{day.getDate()}</span>
                        </div>
                      </div>

                      <div style={{maxHeight: 180, overflowY: "auto", paddingRight: 2}}>
                        {assignedTasks.map(task => {
                          const entry = dailyHours[task.id]?.[dateStr] || { hours: "", note: "" };
                          return (
                            <div key={task.id} style={{marginBottom: 8}}>
                              <div style={{fontSize:9, fontWeight:600, color:"#4B5563", marginBottom: 3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}} title={task.title}>
                                {task.title}
                              </div>
                              <input
                                type="number" min="0" max="24" step="0.5" disabled={!isPast || isWeekend}
                                value={entry.hours || ""}
                                onChange={e => setDailyHours(p => ({...p, [task.id]: {...(p[task.id]||{}), [dateStr]: {...(p[task.id]?.[dateStr]||{}), hours: e.target.value}}}))}
                                onBlur={e => isPast && !isWeekend && handleDaySave(task.id, dateStr, e.target.value, entry.note)}
                                placeholder="h"
                                style={{
                                  width:"100%", border:`1px solid ${entry.hours ? "#86EFAC" : "#E5E7EB"}`,
                                  borderRadius:4, padding:"4px 6px", fontSize:11, textAlign:"right",
                                  background: isWeekend ? "#F3F4F6" : "#fff", color:"#111827", outline:"none"
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              {saving && <div style={{marginTop:12,textAlign:"right",fontSize:11,color:"#9CA3AF"}}>Saving...</div>}
            </>
          ) : (
            <div style={{padding:"32px 0",textAlign:"center",color:"#9CA3AF",fontSize:13}}>Select an employee to log hours</div>
          )}
        </div>
      </div>

      {/* ── HR: SALARY MODAL (With Cost History) ── */}
      {showCostModal && selectedEmpHR && (
        <div style={{position:"fixed",inset:0,background:"rgba(17,24,39,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,backdropFilter:"blur(4px)"}}>
          <div style={{background:"#fff",borderRadius:16,padding:28,width:440,boxShadow:"0 20px 60px rgba(0,0,0,0.15)"}}>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:10,color:"#9CA3AF",letterSpacing:"0.1em",fontWeight:600,marginBottom:2}}>MANAGE SALARY & HISTORY</div>
              <h3 style={{color:"#111827",margin:0,fontSize:18,fontWeight:700}}>{selectedEmpHR.name}</h3>
            </div>
            
            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:11,color:"#374151",fontWeight:600,marginBottom:6}}>NEW ANNUAL GROSS (€)</label>
              <input type="number" step="1000" value={newCost.annual_gross} onChange={e => setNewCost(p => ({...p, annual_gross: e.target.value}))} placeholder="e.g. 45000" style={inp} />
            </div>
            <div style={{marginBottom:20}}>
              <label style={{display:"block",fontSize:11,color:"#374151",fontWeight:600,marginBottom:6}}>VALID FROM DATE</label>
              <input type="date" value={newCost.valid_from} onChange={e => setNewCost(p => ({...p, valid_from: e.target.value}))} style={inp} />
            </div>
            
            {/* COST HISTORY LİSTESİ BURADA */}
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
                  <select value={overtimeInput.month} onChange={e => setOvertimeInput(p => ({...p, month: e.target.value}))} style={inp}>{MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}</select>
                </div>
                <div style={{flex:1}}>
                  <label style={{display:"block",fontSize:11,fontWeight:600,marginBottom:6,color:"#374151"}}>OVERTIME HOURS</label>
                  <input type="number" step="0.5" value={overtimeInput.amount} onChange={e => setOvertimeInput(p => ({...p, amount: e.target.value}))} style={inp} />
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