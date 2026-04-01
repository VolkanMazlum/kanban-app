import React from "react";
import { MONTHS } from "../constants/costConstants.js";
import { getDaysInMonth } from "../utils/costUtils.js";

export default function TimesheetTab({ 
  employees, user, allTasks, selectedYear, selectedMonth, setSelectedMonth, 
  selectedEmp, setSelectedEmp, dailyHours, setDailyHours, handleDaySave, saving 
}) {
  const isHR = user?.role === 'hr';
  const currentYear  = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const today        = new Date(); today.setHours(0,0,0,0);
  
  const days = getDaysInMonth(selectedYear, selectedMonth);
  // Match tasks by identifying assigned phases or directly by task assignees
  const assignedTasks = allTasks.filter(t => 
    (t.phases?.some(phase => phase.assignee_hours?.some(a => a.id === selectedEmp?.id))) ||
    ((t.assignees || []).some(a => a.id === selectedEmp?.id))
  ).map(t => ({
    ...t,
    comm_number: t.commessa?.comm_number || ""
  }));

  let totalWorkerHours = 0;
  Object.values(dailyHours).forEach(taskMap => {
    Object.values(taskMap).forEach(d => { totalWorkerHours += (parseFloat(d.hours) || 0); });
  });

  return (
    <div style={{background:"#fff",borderRadius:16,border:"1px solid #E5E7EB",overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.02)",marginTop:24}}>
      <div style={{padding:"20px 24px",borderBottom:"1px solid #F3F4F6",background:"#fff"}}>
        <h3 style={{fontSize:16,fontWeight:700,color:"#111827",margin:"0 0 2px"}}>Daily Work Hours — {MONTHS[selectedMonth-1]} {selectedYear}</h3>
        <p style={{fontSize:13,color:"#6B7280",margin:0}}>
          {isHR ? "Log hours for the selected employee" : "Select a month and log your daily hours"}
        </p>
      </div>

      <div style={{padding:24}}>
        <div style={{marginBottom:24,display:"flex",gap:16,alignItems:"flex-end",flexWrap:"wrap"}}>
          {isHR && (
            <div style={{flex:"0 0 240px"}}>
              <label style={{fontSize:11,color:"#374151",fontWeight:700,marginBottom:8,display:"block",letterSpacing:"0.05em"}}>SELECT EMPLOYEE</label>
              <select
                value={selectedEmp?.id || ""}
                onChange={e => { setSelectedEmp(employees.find(emp => String(emp.id) === e.target.value) || null); setDailyHours({}); }}
                style={{background:"#F9FAFB",border:"1.5px solid #E5E7EB",borderRadius:10,padding:"10px 14px",fontSize:13,width:"100%",color:"#111827",fontFamily:"'Inter',sans-serif",outline:"none"}}
              >
                <option value="">— Select —</option>
                {employees.map(e => <option key={e.id} value={String(e.id)}>{e.name}</option>)}
              </select>
            </div>
          )}

          {!isHR && selectedEmp && (
            <div style={{flex:"0 0 240px", padding: "10px 16px", background: "#f3f4f6", borderRadius: 10}}>
              <label style={{fontSize:10,color:"#6b7280",fontWeight:700,marginBottom:4,display:"block"}}>SIGNED AS</label>
              <div style={{fontSize:15, fontWeight:700, color: "#111827"}}>{selectedEmp.name}</div>
            </div>
          )}

          <div style={{flex:1}}>
            <label style={{fontSize:11,color:"#374151",fontWeight:700,marginBottom:8,display:"block",letterSpacing:"0.05em"}}>MONTH</label>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {MONTHS.map((m, idx) => {
                const mn = idx + 1; 
                const isPast = selectedYear < currentYear || (selectedYear === currentYear && mn <= currentMonth);
                return (
                  <button key={mn} onClick={() => isPast && setSelectedMonth(mn)}
                    style={{
                      padding:"6px 14px", borderRadius:8, border:"none", cursor: isPast ? "pointer" : "default", fontSize:12, fontWeight:700,
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
            <div style={{marginBottom:20,padding:"12px 20px",background:"#F0F7FF",borderRadius:12,display:"flex",justifyContent:"space-between",alignItems:"center", border: "1.5px solid #BFDBFE"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:"#2563EB"}} />
                <span style={{fontSize:13,color:"#1E40AF",fontWeight:700}}>Monthly Activity Summary</span>
              </div>
              <div style={{display: "flex", gap: 12, alignItems: "center"}}>
                <span style={{fontSize:12, color: "#60A5FA", fontWeight: 700}}>TOTAL HOURS LOGGED:</span>
                <span style={{fontSize:20,fontWeight:800,color:"#2563EB"}}>{totalWorkerHours.toFixed(1)}h</span>
              </div>
            </div>

            <div style={{ overflowX: "auto", paddingBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 14, minWidth: "980px" }}>
                {Array.from({length: (days[0].getDay() + 6) % 7}).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {days.map(day => {
                  const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                  const isPast    = day <= today;
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  const isToday   = day.toDateString() === today.toDateString();
                  const dayLabel  = day.toLocaleString("en-US", { weekday:"short" });

                  const activeTasksOnThisDay = assignedTasks.filter(t => {
                    const dayTime = day.getTime();
                    const startRaw = t.planned_start || t.created_at;
                    const startTime = new Date(startRaw).setHours(0,0,0,0);
                    const endRaw = t.planned_end || t.deadline;
                    const endTime = endRaw ? new Date(endRaw).setHours(23,59,59,999) : Infinity;
                    return dayTime >= startTime && dayTime <= endTime;
                  });

                  const dayTotal = assignedTasks.reduce((sum, t) => sum + (parseFloat(dailyHours[t.id]?.[dateStr]?.hours) || 0), 0);
                  const hasHours = dayTotal > 0;

                  return (
                    <div key={dateStr} style={{
                      background: isWeekend ? "#F9FAFB" : hasHours ? "#F0FDF4" : "#fff",
                      borderRadius:14, padding:"12px",
                      border:`2px solid ${isToday ? "#2563EB" : hasHours ? "#86EFAC" : isWeekend ? "#F3F4F6" : "#E5E7EB"}`,
                      opacity: isPast ? 1 : 0.45,
                      display: "flex", flexDirection: "column", minHeight: 125,
                      boxShadow: isToday ? "0 4px 12px rgba(37,99,235,0.1)" : "none",
                      transition: "all 0.2s"
                    }}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10, paddingBottom: 8, borderBottom: "1px solid #F3F4F6"}}>
                        <span style={{fontSize:10,fontWeight:800,color:isWeekend?"#9CA3AF":isToday?"#2563EB":"#6B7280"}}>{dayLabel.toUpperCase()}</span>
                        <div style={{display: "flex", gap: 5, alignItems: "center"}}>
                            {hasHours && <span style={{fontSize:11, fontWeight:800, color:"#059669"}}>{dayTotal}h</span>}
                            <span style={{fontSize:16,fontWeight:800,color:isWeekend?"#D1D5DB":isToday?"#2563EB":"#111827"}}>{day.getDate()}</span>
                        </div>
                      </div>

                      <div style={{maxHeight: 200, overflowY: "auto", paddingRight: 4}}>
                        {activeTasksOnThisDay.length === 0 ? (
                          <div style={{fontSize:10, color:"#D1D5DB", textAlign:"center", marginTop:16, fontStyle: "italic"}}>—</div>
                        ) : (
                          activeTasksOnThisDay.map(task => {
                            const entry = dailyHours[task.id]?.[dateStr] || { hours: "", note: "" };
                            return (
                              <div key={task.id} style={{marginBottom: 10}}>
                                <div style={{fontSize:9.5, fontWeight:700, color:"#374151", marginBottom: 4, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}} title={task.title}>
                                  {task.title}
                                </div>
                                <input
                                  type="number" min="0" max="24" step="0.5" disabled={!isPast}
                                  value={entry.hours || ""}
                                  onChange={e => setDailyHours(p => ({...p, [task.id]: {...(p[task.id]||{}), [dateStr]: {...(p[task.id]?.[dateStr]||{}), hours: e.target.value}}}))}
                                  onBlur={e => isPast && handleDaySave(task.id, dateStr, e.target.value, entry.note)}
                                  placeholder="0.0"
                                  style={{
                                    width:"100%", border:`1.5px solid ${entry.hours ? (isWeekend ? "#FDBA74" : "#86EFAC") : "#E5E7EB"}`,
                                    borderRadius:8, padding:"6px 8px", fontSize:12, fontWeight:700, textAlign:"right",
                                    background: "#fff", color:"#111827", outline:"none", appearance: "none"
                                  }}
                                />
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {saving && <div style={{marginTop:16,textAlign:"right",fontSize:13,color:"#2563EB", fontWeight: 700, display:"flex", alignItems:"center", justifyContent:"flex-end", gap:8}}>
              <div style={{width:12, height:12, border:"2px solid #BFDBFE", borderTop:"2px solid #2563EB", borderRadius:"50%", animation:"spin 0.7s linear infinite"}} />
              Syncing...
            </div>}
          </>
        ) : (
          <div style={{padding:"80px 0",textAlign:"center",color:"#9CA3AF",fontSize:15, fontWeight: 500, background: "#F9FAFB", borderRadius: 16, border:"2px dashed #E5E7EB"}}>
             Select an employee from the dropdown to continue
          </div>
        )}
      </div>
    </div>
  );
}