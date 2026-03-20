// src/components/CostDashboard/TimesheetTab.jsx
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
  const assignedTasks = allTasks.filter(t => t.phases?.some(phase => phase.assignee_hours?.some(a => a.id === selectedEmp?.id)));

  let totalWorkerHours = 0;
  Object.values(dailyHours).forEach(taskMap => {
    Object.values(taskMap).forEach(d => { totalWorkerHours += (parseFloat(d.hours) || 0); });
  });

  return (
    <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",overflow:"hidden"}}>
      <div style={{padding:"18px 24px",borderBottom:"1px solid #F3F4F6"}}>
        <h3 style={{fontSize:14,fontWeight:700,color:"#111827",margin:"0 0 2px"}}>Daily Work Hours — {selectedYear}</h3>
        <p style={{fontSize:12,color:"#6B7280",margin:0}}>
          {isHR ? "Select an employee to view/edit their log" : "Log your hours for assigned projects"}
        </p>
      </div>

      <div style={{padding:24}}>
        <div style={{marginBottom:20,display:"flex",gap:16,alignItems:"flex-end",flexWrap:"wrap"}}>
          {isHR && (
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
          )}

          {!isHR && selectedEmp && (
            <div style={{flex:"0 0 240px", padding: "10px 14px", background: "#f3f4f6", borderRadius: 8}}>
              <label style={{fontSize:10,color:"#6b7280",fontWeight:700,marginBottom:4,display:"block"}}>SIGNED AS</label>
              <div style={{fontSize:15, fontWeight:700, color: "#111827"}}>{selectedEmp.name}</div>
            </div>
          )}

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

            <div style={{ overflowX: "auto", paddingBottom: 10 }}>
              <div style={{
                display: "grid", 
                gridTemplateColumns: "repeat(7, 1fr)", 
                gap: 8,
                minWidth: "850px" 
              }}>
                {Array.from({length: (days[0].getDay() + 6) % 7}).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {days.map(day => {
                  const dateStr   = day.toISOString().slice(0,10);
                  const isPast    = day <= today;
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  const isToday   = day.toDateString() === today.toDateString();
                  const dayLabel  = day.toLocaleString("en-US", { weekday:"short" });

                  const activeTasksOnThisDay = assignedTasks.filter(t => {
                    const dayTime = day.getTime();
                    const start = t.actual_start || t.planned_start || t.created_at;
                    const startTime = new Date(start).setHours(0,0,0,0);
                    const end = t.actual_end || t.planned_end;
                    const endTime = end ? new Date(end).setHours(23,59,59,999) : Infinity;
                    return dayTime >= startTime && dayTime <= endTime;
                  });

                  const dayTotal = assignedTasks.reduce((sum, t) => sum + (parseFloat(dailyHours[t.id]?.[dateStr]?.hours) || 0), 0);
                  const hasHours = dayTotal > 0;

                  return (
                    <div key={dateStr} style={{
                      background: isWeekend ? "#F9FAFB" : hasHours ? "#F0FDF4" : "#fff",
                      borderRadius:10, padding:"6px 8px 8px",
                      border:`1.5px solid ${isToday ? "#2563EB" : hasHours ? "#86EFAC" : isWeekend ? "#F3F4F6" : "#E5E7EB"}`,
                      opacity: isPast ? 1 : 0.35,
                      display: "flex", flexDirection: "column", minHeight: 100
                    }}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6, paddingBottom: 4, borderBottom: "1px dashed #E5E7EB"}}>
                        <span style={{fontSize:9,fontWeight:700,color:isWeekend?"#D1D5DB":isToday?"#2563EB":"#9CA3AF"}}>{dayLabel}</span>
                        <div style={{display: "flex", gap: 4, alignItems: "center"}}>
                            {hasHours && <span style={{fontSize:10, fontWeight:700, color:"#059669"}}>{dayTotal}h</span>}
                            <span style={{fontSize:12,fontWeight:700,color:isWeekend?"#D1D5DB":isToday?"#2563EB":"#111827"}}>{day.getDate()}</span>
                        </div>
                      </div>

                      <div style={{maxHeight: 160, overflowY: "auto", paddingRight: 2}}>
                        {activeTasksOnThisDay.length === 0 ? (
                          <div style={{fontSize:8, color:"#D1D5DB", textAlign:"center", marginTop:8}}>No active tasks</div>
                        ) : (
                          activeTasksOnThisDay.map(task => {
                            const entry = dailyHours[task.id]?.[dateStr] || { hours: "", note: "" };
                            return (
                              <div key={task.id} style={{marginBottom: 6}}>
                                <div style={{fontSize:8.5, fontWeight:600, color:"#4B5563", marginBottom: 2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}} title={task.title}>
                                  {task.title}
                                </div>
                                <input
                                  type="number" min="0" max="24" step="0.5" disabled={!isPast}
                                  value={entry.hours || ""}
                                  onChange={e => setDailyHours(p => ({...p, [task.id]: {...(p[task.id]||{}), [dateStr]: {...(p[task.id]?.[dateStr]||{}), hours: e.target.value}}}))}
                                  onBlur={e => isPast && handleDaySave(task.id, dateStr, e.target.value, entry.note)}
                                  placeholder="h"
                                  style={{
                                    width:"100%", border:`1px solid ${entry.hours ? (isWeekend ? "#FDBA74" : "#86EFAC") : "#E5E7EB"}`,
                                    borderRadius:4, padding:"3px 5px", fontSize:10.5, textAlign:"right",
                                    background: isWeekend ? "#FFF7ED" : "#fff", color:"#111827", outline:"none"
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
            {saving && <div style={{marginTop:12,textAlign:"right",fontSize:11,color:"#9CA3AF"}}>Saving...</div>}
          </>
        ) : (
          <div style={{padding:"32px 0",textAlign:"center",color:"#9CA3AF",fontSize:13}}>Select an employee to log hours</div>
        )}
      </div>
    </div>
  );
}