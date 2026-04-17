import { useState, useEffect, useRef } from "react";
import * as api from "../api";
import { COLUMNS, TOPICS, TOPIC_STYLE, inp } from "../constants/index.js";
import Avatar from "./Avatar.jsx";

export default function TaskModal({ task, employees, onSave, onClose }) {
  const blank = { title:"", description:"", label:"", topics:[], assignee_ids:[], deadline:"", status:"new", planned_start:"", planned_end:"", estimated_hours:"" };
  const init = task ? {
    title:task.title, description:task.description||"",
    label: task.label || "", topics:task.topics||[], assignee_ids:(task.assignees||[]).map(a=>a.id),
    deadline:task.deadline?.slice(0,10)||"", status:task.status,
    planned_start:task.planned_start?.slice(0,10)||"", planned_end:task.planned_end?.slice(0,10)||"",
    estimated_hours: task?.estimated_hours || ""
  } : blank;

  const [form, setForm] = useState(init);
  const [saving, setSaving] = useState(false);
  const [phases, setPhases] = useState(task?.phases || []);
  const [phaseTemplates, setPhaseTemplates] = useState({});
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  // Keeping the active phase
  const [activeTopicTab, setActiveTopicTab] = useState(form.topics[0] || "");
  const [searchTerms, setSearchTerms] = useState({}); // To store search query per phase index
  const [teamFilters, setTeamFilters] = useState({}); // To store selected team filter per phase index
  useEffect(() => {
    if (form.topics.length > 0 && !form.topics.includes(activeTopicTab)) {
      setActiveTopicTab(form.topics[0]);
    } else if (form.topics.length === 0) {
      setActiveTopicTab("");
    }
  }, [form.topics, activeTopicTab]);

  useEffect(() => {
    api.getPhaseTemplates().then(templates => {
      setPhaseTemplates(templates);
    }).catch(console.error);

    if (task?.id) {
      api.getTaskPhases(task.id).then(data => {
        setPhases(data.map(ph => ({
          ...ph,
          start_date: ph.start_date?.slice(0, 10) || "",
          end_date: ph.end_date?.slice(0, 10) || "",
          assignee_hours: ph.assignee_hours || [], 
          note: ph.note || "",
          estimated_hours: ph.estimated_hours || ""
        })));
      }).catch(console.error);
    }
  }, [task?.id]);

  const handleTopicToggle = (toggledTopic) => {
    const currentTopics = form.topics || [];
    const isSelected = currentTopics.includes(toggledTopic);
    
    const newTopics = isSelected 
      ? currentTopics.filter(t => t !== toggledTopic) 
      : [...currentTopics, toggledTopic];
    
    set("topics", newTopics);

    if (isSelected) {
      const templatesToRemove = (phaseTemplates[toggledTopic] || []).map(t => t.name);
      setPhases(p => p.filter(ph => !templatesToRemove.includes(ph.name)));
    } else {
      const templatesToAdd = phaseTemplates[toggledTopic] || [];
      const newPhases = templatesToAdd.map((t) => ({
        name: t.name, 
        position: phases.length, 
        start_date: "", 
        end_date: "", 
        status: "pending",
        topic_source: toggledTopic,
        assignee_hours: [] 
      }));
      setPhases(p => [...p, ...newPhases].map((ph, i) => ({...ph, position: i})));
    }
  };

  const updatePhase = (idx, key, val) => {
    setPhases(p => p.map((ph, i) => {
      if (i !== idx) return ph;
      const updated = { ...ph, [key]: val };
      return updated;
    }));
  };

  function getPhaseMonths(startDate, endDate) {
    if (!startDate || !endDate) return [];
    const months = [];
    const cur = new Date(startDate);
    cur.setDate(1);
    const end = new Date(endDate);
    end.setDate(1);
    while (cur <= end) {
      months.push({ year: cur.getFullYear(), month: cur.getMonth() + 1 });
      cur.setMonth(cur.getMonth() + 1);
    }
    return months;
  }

  const phasesRef = useRef(phases);
  useEffect(() => { phasesRef.current = phases; }, [phases]);

  const handleSave = async (form) => {
    // Collect all employee IDs from all phases to ensure task-level assignees match phase assignees
    const allAssignees = new Set();
    phasesRef.current.forEach(ph => {
      (ph.assignee_hours || []).forEach(ah => allAssignees.add(Number(ah.id)));
    });
    
    const updatedForm = {
      ...form,
      assignee_ids: Array.from(allAssignees)
    };
    
    await onSave(updatedForm, phasesRef.current);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(17,24,39,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,backdropFilter:"blur(4px)"}}>
      <div style={{background:"#fff",borderRadius:16,padding:28,width:540,maxHeight:"92vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.15)",fontFamily:"'Inter',sans-serif"}}>
        
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22}}>
          <div>
            <div style={{fontSize:10,color:"#9CA3AF",letterSpacing:"0.1em",fontWeight:600,marginBottom:2}}>{task?"EDIT TASK":"NEW TASK"}</div>
            <h3 style={{color:"#111827",margin:0,fontSize:18,fontWeight:700}}>{task?task.title:"Create Task"}</h3>
          </div>
          <button onClick={onClose} style={{background:"#F3F4F6",border:"none",borderRadius:8,width:32,height:32,cursor:"pointer",color:"#6B7280",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>

        <div style={{marginBottom:14}}>
          <label style={{display:"block",fontSize:11,color:"#374151",marginBottom:6,fontWeight:600,letterSpacing:"0.05em"}}>TITLE *</label>
          <input value={form.title} onChange={e=>set("title",e.target.value)} style={inp} placeholder="Task title..." />
        </div>
        
        <div style={{marginBottom:14}}>
          <label style={{display:"block",fontSize:11,color:"#374151",marginBottom:6,fontWeight:600,letterSpacing:"0.05em"}}>PROJECT TYPE</label>
          <select value={form.label} onChange={e=>set("label", e.target.value)} style={{...inp, cursor:"pointer"}}>
            <option value="">-- Select Type --</option>
            <option value="Residential"> Residential </option>
            <option value="Health"> Health </option>
            <option value="Industrial"> Industrial </option>
            <option value="Sports"> Sports </option>
            <option value="Offices"> Offices </option>
            <option value="Hotel"> Hotel </option>
            <option value="Student Housing"> Student Housing </option>
            <option value="Data Center"> Data Center </option>
            <option value="Education"> Education </option>
            <option value="Retail"> Retail </option>
            <option value="Public"> Public </option>
          </select>
        </div>
        
        <div style={{marginBottom:14}}>
          <label style={{display:"block",fontSize:11,color:"#374151",marginBottom:6,fontWeight:600,letterSpacing:"0.05em"}}>CATEGORIES (Multiple Allowed)</label>
          <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
            {TOPICS.map(t => {
              const isSel = form.topics.includes(t);
              const ts = TOPIC_STYLE[t] || { bg: "#F3F4F6", text: "#374151", border: "#E5E7EB" };
              return (
                <button type="button" key={t} onClick={() => handleTopicToggle(t)} style={{
                  background: isSel ? ts.bg : "#F9FAFB",
                  color: isSel ? ts.text : "#6B7280",
                  border: `1.5px solid ${isSel ? ts.border : "#E5E7EB"}`,
                  padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: isSel ? 700 : 500, cursor: "pointer", transition: "all 0.15s"
                }}>
                  {t} {isSel && "✓"}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{marginBottom:14}}>
          <label style={{display:"block",fontSize:11,color:"#374151",marginBottom:6,fontWeight:600,letterSpacing:"0.05em"}}>DESCRIPTION</label>
          <textarea value={form.description} onChange={e=>set("description",e.target.value)} rows={2} style={{...inp,resize:"vertical",lineHeight:1.5}} placeholder="Brief description..." />
        </div>
        
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <div>
            <label style={{display:"block",fontSize:11,color:"#374151",marginBottom:6,fontWeight:600,letterSpacing:"0.05em"}}>DEADLINE</label>
            <input type="date" value={form.deadline} onChange={e=>set("deadline",e.target.value)} style={inp} />
          </div>
        </div>
        
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <div>
            <label style={{display:"block",fontSize:11,color:"#374151",marginBottom:6,fontWeight:600,letterSpacing:"0.05em"}}>PLANNED START</label>
            <input type="date" value={form.planned_start} onChange={e=>set("planned_start",e.target.value)} style={inp} />
          </div>
          <div>
            <label style={{display:"block",fontSize:11,color:"#374151",marginBottom:6,fontWeight:600,letterSpacing:"0.05em"}}>PLANNED END</label>
            <input type="date" value={form.planned_end} onChange={e=>set("planned_end",e.target.value)} style={inp} />
          </div>
        </div>
        
        <div style={{marginBottom:24}}>
          <label style={{display:"block",fontSize:11,color:"#374151",marginBottom:8,fontWeight:600,letterSpacing:"0.05em"}}>STATUS</label>
          <div style={{display:"flex",gap:6}}>
            {COLUMNS.map(col=>(
              <button key={col.id} onClick={()=>set("status",col.id)} style={{
                flex:1, padding:"7px 4px", borderRadius:8, cursor:"pointer", fontSize:11, fontWeight:600,
                background:form.status===col.id?col.light:"#F9FAFB",
                border:`1.5px solid ${form.status===col.id?col.color:"#E5E7EB"}`,
                color:form.status===col.id?col.color:"#9CA3AF",
                fontFamily:"'Inter',sans-serif", transition:"all 0.15s",
              }}>{col.label}</button>
            ))}
          </div>
        </div>

        {/* PHASES BLOCK */}
        {phases.length > 0 && form.topics.length > 0 && (
          <div style={{marginBottom:24}}>
            <label style={{display:"block",fontSize:11,color:"#374151",marginBottom:8,fontWeight:600,letterSpacing:"0.05em"}}>PROJECT PHASES</label>
            
            {/* New Category Tabs */}
            <div style={{display:"flex", gap:8, marginBottom:16, flexWrap:"wrap", borderBottom:"1px solid #E5E7EB", paddingBottom:8}}>
              {form.topics.map(t => {
                const isActive = activeTopicTab === t;
                const ts = TOPIC_STYLE[t] || { bg: "#F3F4F6", text: "#374151", border: "#E5E7EB" };
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setActiveTopicTab(t)}
                    style={{
                      padding: "6px 14px", borderRadius: "6px 6px 0 0", border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all 0.2s",
                      background: isActive ? ts.bg : "transparent",
                      color: isActive ? ts.text : "#6B7280",
                      borderBottom: isActive ? `3px solid ${ts.border}` : "3px solid transparent",
                    }}
                  >
                    {t.toUpperCase()}
                  </button>
                );
              })}
            </div>

            {/*Show solo activated phase*/}
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {(() => {
                const topicName = activeTopicTab;
                if (!topicName) return null;

                const ts = TOPIC_STYLE[topicName] || { text: "#374151", bg: "#F3F4F6", border: "#E5E7EB" };
                const topicPhases = phases
                  .map((ph, i) => ({ ph, idx: i }))
                  .filter(item => item.ph.topic_source === topicName);

                if (topicPhases.length === 0) return <div style={{fontSize:11, color:"#9CA3AF"}}>No phases mapped to this category.</div>;

                return (
                  <div style={{ border: `1px solid ${ts.border}`, borderRadius: 8, overflow: "hidden", animation: "fadeIn 0.3s ease-in-out" }}>
                    <div style={{ background: ts.bg, padding: "8px 12px", borderBottom: `1px solid ${ts.border}` }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: ts.text, letterSpacing: "0.05em" }}>
                        {topicName.toUpperCase()} PHASES
                      </span>
                    </div>
                    
                    <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: 8, background: "#F9FAFB" }}>
                      {topicPhases.map(({ ph, idx }) => (
                        <div key={idx} style={{background:"#fff",borderRadius:6,padding:"10px",border:"1px solid #E5E7EB"}}>
                          
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                            <span style={{fontSize:12,fontWeight:600,color:"#374151"}}>{ph.name}</span>
                            <select value={ph.status} onChange={e=>updatePhase(idx,"status",e.target.value)} style={{...inp,width:"auto",padding:"4px 8px",fontSize:11}}>
                              <option value="pending">Pending</option>
                              <option value="active">Active</option>
                              <option value="done">Done</option>
                            </select>
                          </div>
                          
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:8}}>
                            <div>
                              <label style={{fontSize:10,color:"#9CA3AF",fontWeight:600}}>START</label>
                              <input type="date" value={ph.start_date} onChange={e=>updatePhase(idx,"start_date",e.target.value)} style={{...inp,marginTop:4,padding:"6px 10px"}} />
                            </div>
                            <div>
                              <label style={{fontSize:10,color:"#9CA3AF",fontWeight:600}}>END</label>
                              <input type="date" value={ph.end_date} onChange={e=>updatePhase(idx,"end_date",e.target.value)} style={{...inp,marginTop:4,padding:"6px 10px"}} />
                            </div>
                          </div>

                          <div style={{marginBottom:8}}>
                            <label style={{fontSize:10,color:"#9CA3AF",fontWeight:600}}>TOTAL ESTIMATED HOURS</label>
                            <div style={{...inp,marginTop:4,padding:"6px 10px",background:"#F3F4F6",color:"#374151",fontWeight:600}}>
                              {(ph.assignee_hours || []).reduce((total, assignee) => total + (parseFloat(assignee.estimated_hours) || 0), 0).toFixed(1)}h
                            </div>
                          </div>
                          
                          <div style={{ marginTop: 8, marginBottom: 12 }}>
                            <label style={{fontSize:10,color:"#9CA3AF",fontWeight:600}}>NOTES</label>
                            <input 
                              type="text" 
                              value={ph.note || ""} 
                              onChange={e => updatePhase(idx, "note", e.target.value)} 
                              style={{ ...inp, marginTop:4, padding: "6px 10px", fontSize: 11, width: "100%", background: "#F3F4F6" }} 
                              placeholder="Add a note for this phase... (Optional)" 
                            />
                          </div>

                          <div style={{background:"#F9FAFB", border:"1px solid #E5E7EB", padding: "8px", borderRadius: 6}}>
                            <label style={{fontSize:10,color:"#374151",fontWeight:700,marginBottom:8,display:"block"}}>ASSIGNEES & HOURS FOR THIS PHASE</label>
                            
                            {(!ph.start_date || !ph.end_date) && (
                              <div style={{fontSize:11,color:"#F59E0B",marginBottom:8,padding:"6px 8px",background:"#FFFBEB",borderRadius:6,border:"1px solid #FDE68A"}}>
                                ⚠ Enter start and end dates to set monthly hours
                              </div>
                            )}

                            {/* List of currently assigned employees */}
                            <div style={{display:"flex",flexDirection:"column",gap:8, marginBottom: 10}}>
                              {(ph.assignee_hours || []).map(assignment => {
                                const emp = employees.find(e => e.id === assignment.id);
                                if (!emp) return null;
                                const phaseMonths = getPhaseMonths(ph.start_date, ph.end_date);
                                const monthlyHours = assignment.monthly_hours || [];

                                return (
                                  <div key={emp.id} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: 8 }}>
                                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                                      <button type="button" onClick={() => {
                                        const current = ph.assignee_hours || [];
                                        const updated = current.filter(a => a.id !== emp.id);
                                        updatePhase(idx, "assignee_hours", updated);
                                      }} style={{
                                        width:20, height:20, borderRadius:"50%", border:"none",
                                        background: "#FEE2E2", color: "#DC2626",
                                        cursor:"pointer", fontSize:12, fontWeight:700,
                                        display: "flex", alignItems: "center", justifyContent: "center"
                                      }}>✕</button>
                                      <Avatar name={emp.name} size={20} idx={employees.indexOf(emp)} />
                                      <span style={{fontSize:12,color:"#374151",fontWeight: 600, flex:1}}>{emp.name}</span>
                                      <span style={{fontSize:10,color:"#6B7280", background: "#F3F4F6", padding: "2px 6px", borderRadius: 4}}>
                                        Total: {monthlyHours.reduce((s,m) => s + (parseFloat(m.hours)||0), 0)}h
                                      </span>
                                    </div>

                                    {phaseMonths.length > 0 && (
                                      <div style={{marginLeft:28, display:"flex", gap:6, flexWrap:"wrap", marginTop: 6}}>
                                        {phaseMonths.map(({year, month}) => {
                                          const mh = monthlyHours.find(m => m.year===year && m.month===month);
                                          const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                                          return (
                                            <div key={`${year}-${month}`} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                                              <span style={{fontSize:9,color:"#9CA3AF",fontWeight:600}}>{MONTH_LABELS[month-1]}</span>
                                              <input
                                                type="number" min="0" step="0.5"
                                                value={mh?.hours || ""}
                                                onChange={e => {
                                                  const updated = (ph.assignee_hours || []).map(a => {
                                                    if (a.id !== emp.id) return a;
                                                    const existingMonths = a.monthly_hours || [];
                                                    const hasMonth = existingMonths.find(m => m.year===year && m.month===month);
                                                    const newMonths = hasMonth
                                                      ? existingMonths.map(m => m.year===year && m.month===month ? {...m, hours: parseFloat(e.target.value)||0} : m)
                                                      : [...existingMonths, {year, month, hours: parseFloat(e.target.value)||0}];
                                                    const total = newMonths.reduce((s,m) => s+(parseFloat(m.hours)||0), 0);
                                                    return { ...a, monthly_hours: newMonths, estimated_hours: total };
                                                  });
                                                  updatePhase(idx, "assignee_hours", updated);
                                                }}
                                                placeholder="h"
                                                style={{width:40,border:"1.5px solid #E5E7EB",borderRadius:6,padding:"3px 4px",fontSize:11,textAlign:"center"}}
                                              />
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Search and Add new assignee */}
                            {(() => {
                              const searchVal = searchTerms[idx] || "";
                              const activeTeam = teamFilters[idx] || "";
                              const isDropdownOpen = searchVal.length > 0 || activeTeam.length > 0;

                              // All teams present in employees list
                              const allTeams = [...new Set(
                                employees
                                  .map(e => e.hr_details?.team)
                                  .filter(Boolean)
                              )].sort();

                              // Filtered candidates
                              const candidates = employees
                                .filter(e => !activeTeam || (e.hr_details?.team || "") === activeTeam)
                                .filter(e => e.name.toLowerCase().includes(searchVal.toLowerCase()))
                                .filter(e => !(ph.assignee_hours || []).some(a => a.id === e.id));

                              // Group by team for display
                              const grouped = candidates.reduce((acc, emp) => {
                                const t = emp.hr_details?.team || "No Team";
                                if (!acc[t]) acc[t] = [];
                                acc[t].push(emp);
                                return acc;
                              }, {});

                              return (
                                <div>
                                  {/* Team filter chips — always visible above the search box */}
                                  {allTeams.length > 0 && (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center", marginBottom: 6 }}>
                                      <span style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600, marginRight: 2 }}>TEAM:</span>
                                      <button
                                        type="button"
                                        onClick={() => setTeamFilters(prev => ({ ...prev, [idx]: "" }))}
                                        style={{
                                          padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 600, cursor: "pointer", border: "1.5px solid",
                                          background: !activeTeam ? "#EFF6FF" : "#F9FAFB",
                                          color: !activeTeam ? "#2563EB" : "#6B7280",
                                          borderColor: !activeTeam ? "#2563EB" : "#E5E7EB",
                                          transition: "all 0.15s"
                                        }}
                                      >All</button>
                                      {allTeams.map(team => (
                                        <button
                                          key={team}
                                          type="button"
                                          onClick={() => setTeamFilters(prev => ({ ...prev, [idx]: prev[idx] === team ? "" : team }))}
                                          style={{
                                            padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 600, cursor: "pointer", border: "1.5px solid",
                                            background: activeTeam === team ? "#EFF6FF" : "#F9FAFB",
                                            color: activeTeam === team ? "#2563EB" : "#6B7280",
                                            borderColor: activeTeam === team ? "#2563EB" : "#E5E7EB",
                                            transition: "all 0.15s"
                                          }}
                                        >{team}</button>
                                      ))}
                                    </div>
                                  )}

                                  {/* Search input + dropdown */}
                                  <div style={{ position: "relative", marginBottom: isDropdownOpen ? 8 : 0 }}>
                                    <input
                                      type="text"
                                      placeholder="+ Add member to this phase..."
                                      value={searchVal}
                                      onChange={e => setSearchTerms(prev => ({ ...prev, [idx]: e.target.value }))}
                                      style={{ ...inp, padding: "8px 12px", fontSize: 12, borderRadius: 8, background: "#fff", borderColor: "#D1D5DB" }}
                                    />
                                    {isDropdownOpen && (
                                      <div style={{
                                        position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
                                        background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8,
                                        boxShadow: "0 10px 25px rgba(0,0,0,0.12)", marginTop: 4, maxHeight: 220, overflowY: "auto"
                                      }}>
                                        {Object.keys(grouped).length > 0 ? (
                                          Object.entries(grouped).map(([team, members]) => (
                                            <div key={team}>
                                              {Object.keys(grouped).length > 1 && (
                                                <div style={{ padding: "5px 12px 3px", fontSize: 10, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.06em", background: "#F9FAFB" }}>
                                                  {team.toUpperCase()}
                                                </div>
                                              )}
                                              {members.map(emp => (
                                                <div
                                                  key={emp.id}
                                                  onClick={() => {
                                                    const current = ph.assignee_hours || [];
                                                    const updated = [...current, { id: emp.id, name: emp.name, estimated_hours: 0, monthly_hours: [] }];
                                                    updatePhase(idx, "assignee_hours", updated);
                                                    setSearchTerms(prev => ({ ...prev, [idx]: "" }));
                                                    setTeamFilters(prev => ({ ...prev, [idx]: "" }));
                                                  }}
                                                  style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", transition: "background 0.15s" }}
                                                  onMouseEnter={e => e.currentTarget.style.background = "#F3F4F6"}
                                                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                                >
                                                  <Avatar name={emp.name} size={24} idx={employees.indexOf(emp)} />
                                                  <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{emp.name}</div>
                                                    {emp.hr_details?.team && !activeTeam && (
                                                      <div style={{ fontSize: 10, color: "#9CA3AF" }}>{emp.hr_details.team}</div>
                                                    )}
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          ))
                                        ) : (
                                          <div style={{ padding: "12px", fontSize: 11, color: "#9CA3AF", textAlign: "center" }}>No matches found</div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        <div style={{display:"flex",gap:10}}>
          <button onClick={async()=>{setSaving(true);await handleSave(form);setSaving(false);}}
            disabled={saving||!form.title.trim()}
            style={{flex:1,padding:11,background:form.title.trim()?"#2563EB":"#E5E7EB",color:form.title.trim()?"#fff":"#9CA3AF",border:"none",borderRadius:8,fontFamily:"'Inter',sans-serif",fontSize:13,fontWeight:600,cursor:form.title.trim()?"pointer":"not-allowed"}}
          >{saving?"Saving...":"Save Task"}</button>
          <button onClick={onClose} style={{flex:1,padding:11,background:"#F9FAFB",color:"#374151",border:"1.5px solid #E5E7EB",borderRadius:8,fontFamily:"'Inter',sans-serif",fontSize:13,cursor:"pointer"}}>Cancel</button>
        </div>
      </div>
    </div>
  );
}