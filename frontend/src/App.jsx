import { useState, useEffect, useRef, useCallback } from "react";
import * as api from "./api.js";

const COLUMNS = [
  { id: "new",     label: "NEW",        color: "#2563EB", light: "#EFF6FF", dot: "#BFDBFE" },
  { id: "process", label: "IN PROCESS", color: "#059669", light: "#ECFDF5", dot: "#A7F3D0" },
  { id: "blocked", label: "BLOCKED",    color: "#DC2626", light: "#FEF2F2", dot: "#FECACA" },
  { id: "done",    label: "DONE",       color: "#7C3AED", light: "#F5F3FF", dot: "#DDD6FE" },
];

const TOPICS = [
  "Electrical","Mechanical","Civil & Structural","HVAC",
  "Fire & Safety","BMS / Automation","Commissioning",
  "Documentation","Site Supervision","Procurement",
];

const TOPIC_STYLE = {
  "Electrical":        { bg:"#FEF3C7", text:"#B45309", border:"#FDE68A" },
  "Mechanical":        { bg:"#DBEAFE", text:"#1D4ED8", border:"#BFDBFE" },
  "Civil & Structural":{ bg:"#F3F4F6", text:"#374151", border:"#E5E7EB" },
  "HVAC":              { bg:"#D1FAE5", text:"#065F46", border:"#A7F3D0" },
  "Fire & Safety":     { bg:"#FEE2E2", text:"#991B1B", border:"#FECACA" },
  "BMS / Automation":  { bg:"#EDE9FE", text:"#6D28D9", border:"#DDD6FE" },
  "Commissioning":     { bg:"#E0F2FE", text:"#0369A1", border:"#BAE6FD" },
  "Documentation":     { bg:"#FFF7ED", text:"#C2410C", border:"#FED7AA" },
  "Site Supervision":  { bg:"#F0FDF4", text:"#166534", border:"#BBF7D0" },
  "Procurement":       { bg:"#FDF4FF", text:"#7E22CE", border:"#E9D5FF" },
};

const AVATAR_PALETTES = [
  ["#DBEAFE","#1E40AF"],["#D1FAE5","#065F46"],["#FEE2E2","#991B1B"],
  ["#EDE9FE","#5B21B6"],["#FEF3C7","#92400E"],["#E0F2FE","#075985"],
];

const inp = {
  width:"100%", background:"#fff", border:"1.5px solid #E5E7EB",
  borderRadius:"8px", padding:"9px 12px", color:"#111827",
  fontSize:"13px", fontFamily:"'Inter',sans-serif",
  boxSizing:"border-box", outline:"none",
};

function Avatar({ name, size=28, idx=0 }) {
  const [bg,fg] = AVATAR_PALETTES[idx % AVATAR_PALETTES.length];
  const initials = (name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  return (
    <div title={name} style={{
      width:size, height:size, borderRadius:"50%", background:bg, color:fg,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:size*0.36, fontWeight:"700", flexShrink:0,
      border:"2px solid #fff", boxSizing:"content-box",
    }}>{initials}</div>
  );
}

function Toast({ toasts }) {
  return (
    <div style={{position:"fixed",bottom:24,right:24,zIndex:400,display:"flex",flexDirection:"column",gap:8}}>
      {toasts.map(t=>(
        <div key={t.id} style={{
          background: t.type==="error"?"#FEF2F2":"#F0FDF4",
          border:`1.5px solid ${t.type==="error"?"#FECACA":"#BBF7D0"}`,
          color: t.type==="error"?"#991B1B":"#166534",
          borderRadius:8, padding:"10px 16px", fontSize:13,
          fontFamily:"'Inter',sans-serif", fontWeight:500,
          boxShadow:"0 4px 12px rgba(0,0,0,0.08)",
          animation:"slideIn 0.2s ease",
        }}>{t.type==="error"?"⚠ ":"✓ "}{t.msg}</div>
      ))}
    </div>
  );
}

function AssigneePicker({ employees, selectedIds, onChange }) {
  const toggle = id => {
    const n = Number(id);
    onChange(selectedIds.includes(n) ? selectedIds.filter(x=>x!==n) : [...selectedIds,n]);
  };
  return (
    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
      {employees.map((e,i)=>{
        const sel = selectedIds.includes(e.id);
        return (
          <button key={e.id} onClick={()=>toggle(e.id)} style={{
            display:"flex", alignItems:"center", gap:6,
            padding:"5px 10px 5px 6px", cursor:"pointer",
            background: sel?"#EFF6FF":"#F9FAFB",
            border:`1.5px solid ${sel?"#2563EB":"#E5E7EB"}`,
            borderRadius:20, fontSize:12,
            color: sel?"#1D4ED8":"#6B7280", fontWeight: sel?600:400,
            fontFamily:"'Inter',sans-serif", transition:"all 0.15s",
          }}>
            <Avatar name={e.name} size={18} idx={i} />
            {e.name}
            {sel && <span style={{fontSize:10,color:"#2563EB"}}>✓</span>}
          </button>
        );
      })}
    </div>
  );
}

function TaskModal({ task, employees, onSave, onClose }) {
  const blank = { title:"", description:"", topic:TOPICS[0], assignee_ids:[], deadline:"", status:"new", planned_start:"", planned_end:"" };
  const init = task ? {
    title:task.title, description:task.description||"",
    topic:task.topic||TOPICS[0], assignee_ids:(task.assignees||[]).map(a=>a.id),
    deadline:task.deadline?.slice(0,10)||"", status:task.status,
    planned_start:task.planned_start?.slice(0,10)||"", planned_end:task.planned_end?.slice(0,10)||"",
    estimated_hours: task?.estimated_hours || ""
  } : blank;
  const [form, setForm] = useState(init);
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const [phases, setPhases] = useState(task?.phases || []);
  const [phaseTemplates, setPhaseTemplates] = useState({});
  useEffect(() => {
  api.getPhaseTemplates().then(templates => {
    setPhaseTemplates(templates);
    // Yeni task ise ve phase yoksa, varsayılan topic için template yükle
    if (!task?.id && phases.length === 0) {
      const topicTemplates = templates[form.topic] || [];
      if (topicTemplates.length > 0) {
        setPhases(topicTemplates.map((t, i) => ({
          name: t.name,
          position: i,
          start_date: "",
          end_date: "",
          status: "pending"
        })));
      }
    }
  }).catch(console.error);

  if (task?.id) {
    api.getTaskPhases(task.id).then(data => {
      setPhases(data.map(ph => ({
        ...ph,
        start_date: ph.start_date?.slice(0, 10) || "",
        end_date: ph.end_date?.slice(0, 10) || "",
      })));
  }).catch(console.error);
}
}, [task?.id]);
  const handleTopicChange = (topic) => {
    set("topic", topic);
    const templates = phaseTemplates[topic] || [];
    if (templates.length > 0) {
      setPhases(templates.map((t, i) => ({
        name: t.name,
        position: i,
        start_date: "",
        end_date: "",
        status: "pending"
      })));
    }
  };

 const updatePhase = (idx, key, val) => {
  setPhases(p => {
    const updated = p.map((ph, i) => i === idx ? { ...ph, [key]: val } : ph);
    console.log("Updated phases:", updated);
    return updated;
    });
  };
  const phasesRef = useRef(phases);
  useEffect(() => { phasesRef.current = phases; }, [phases]);

  const handleSave = async (form) => {
    console.log("Saving phases:", phasesRef.current);
    await onSave(form, phasesRef.current);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(17,24,39,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,backdropFilter:"blur(4px)"}}>
      <div style={{background:"#fff",borderRadius:16,padding:28,width:500,maxHeight:"92vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.15)",fontFamily:"'Inter',sans-serif"}}>
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
          <label style={{display:"block",fontSize:11,color:"#374151",marginBottom:6,fontWeight:600,letterSpacing:"0.05em"}}>DESCRIPTION</label>
          <textarea value={form.description} onChange={e=>set("description",e.target.value)} rows={2} style={{...inp,resize:"vertical",lineHeight:1.5}} placeholder="Brief description..." />
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <div>
            <label style={{display:"block",fontSize:11,color:"#374151",marginBottom:6,fontWeight:600,letterSpacing:"0.05em"}}>CATEGORY</label>
            <select value={form.topic} onChange={e=>handleTopicChange(e.target.value)} style={{...inp,cursor:"pointer"}}>
              {TOPICS.map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
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
        <div style={{marginBottom:14}}>
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
        <div style={{marginBottom:14}}>
          <label style={{display:"block",fontSize:11,color:"#374151",marginBottom:6,fontWeight:600,letterSpacing:"0.05em"}}>
            ESTIMATED HOURS
          </label>
          <input
            type="number" min="0" step="0.5"
            value={form.estimated_hours}
            onChange={e => set("estimated_hours", e.target.value ? parseFloat(e.target.value) : null)}
            style={inp}
            placeholder="e.g. 24"
          />
        </div>
        <div style={{marginBottom:14}}>  
          <label style={{display:"block",fontSize:11,color:"#374151",marginBottom:6,fontWeight:600,letterSpacing:"0.05em"}}>DESCRIPTION</label>
          <textarea value={form.description} onChange={e=>set("description",e.target.value)} rows={2} style={{...inp,resize:"vertical",lineHeight:1.5}} placeholder="Brief description..." />
        </div>
        <div style={{marginBottom:24}}>
          <label style={{display:"block",fontSize:11,color:"#374151",marginBottom:8,fontWeight:600,letterSpacing:"0.05em"}}>
            ASSIGNEES <span style={{color:"#9CA3AF",fontWeight:400}}>(multiple allowed)</span>
          </label>
          <AssigneePicker employees={employees} selectedIds={form.assignee_ids} onChange={v=>set("assignee_ids",v)} />
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={async()=>{setSaving(true);await handleSave(form);setSaving(false);}}
            disabled={saving||!form.title.trim()}
            style={{flex:1,padding:11,background:form.title.trim()?"#2563EB":"#E5E7EB",color:form.title.trim()?"#fff":"#9CA3AF",border:"none",borderRadius:8,fontFamily:"'Inter',sans-serif",fontSize:13,fontWeight:600,cursor:form.title.trim()?"pointer":"not-allowed"}}
          >{saving?"Saving...":"Save Task"}</button>
          <button onClick={onClose} style={{flex:1,padding:11,background:"#F9FAFB",color:"#374151",border:"1.5px solid #E5E7EB",borderRadius:8,fontFamily:"'Inter',sans-serif",fontSize:13,cursor:"pointer"}}>Cancel</button>
        </div>
        {phases.length > 0 && (
      <div style={{marginBottom:14}}>
        <label style={{display:"block",fontSize:11,color:"#374151",marginBottom:8,fontWeight:600,letterSpacing:"0.05em"}}>
          PROJECT PHASES
        </label>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {phases.map((ph, idx) => (
            <div key={idx} style={{background:"#F9FAFB",borderRadius:8,padding:"10px 12px",border:"1px solid #E5E7EB"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                <span style={{fontSize:12,fontWeight:600,color:"#374151"}}>{ph.name}</span>
                <select
                  value={ph.status}
                  onChange={e => updatePhase(idx, "status", e.target.value)}
                  style={{...inp, width:"auto", padding:"3px 8px", fontSize:11}}
                >
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="done">Done</option>
                </select>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <div>
                  <label style={{fontSize:10,color:"#9CA3AF",fontWeight:600}}>START</label>
                  <input type="date" value={ph.start_date} onChange={e => updatePhase(idx,"start_date",e.target.value)} style={{...inp,marginTop:2}} />
                </div>
                <div>
                  <label style={{fontSize:10,color:"#9CA3AF",fontWeight:600}}>END</label>
                  <input type="date" value={ph.end_date} onChange={e => updatePhase(idx,"end_date",e.target.value)} style={{...inp,marginTop:2}} />
                </div>
              </div>
            </div>
          ))}
          </div>
        </div>
        )}
      </div>
    </div>  
  ); 
}

function EmployeeManager({ employees, onAdd, onDelete, onClose }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(17,24,39,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,backdropFilter:"blur(4px)"}}>
      <div style={{background:"#fff",borderRadius:16,padding:28,width:420,boxShadow:"0 20px 60px rgba(0,0,0,0.15)",fontFamily:"'Inter',sans-serif"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
          <div>
            <div style={{fontSize:10,color:"#9CA3AF",letterSpacing:"0.1em",fontWeight:600,marginBottom:2}}>MANAGEMENT</div>
            <h3 style={{color:"#111827",margin:0,fontSize:18,fontWeight:700}}>Team Members</h3>
          </div>
          <button onClick={onClose} style={{background:"#F3F4F6",border:"none",borderRadius:8,width:32,height:32,cursor:"pointer",color:"#6B7280",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name..." style={{...inp,flex:1}} />
        </div>
        <div style={{display:"flex",gap:8,marginBottom:20}}>
          <input value={role} onChange={e=>setRole(e.target.value)} placeholder="Role / title (optional)..." style={{...inp,flex:1}}
            onKeyDown={e=>e.key==="Enter"&&name.trim()&&(onAdd(name,role),setName(""),setRole(""))} />
          <button onClick={()=>{if(name.trim()){onAdd(name,role);setName("");setRole("");}}}
            style={{background:"#2563EB",color:"#fff",border:"none",borderRadius:8,padding:"0 16px",fontFamily:"'Inter',sans-serif",fontSize:13,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>Add</button>
        </div>
        <div style={{maxHeight:280,overflowY:"auto"}}>
          {employees.map((emp,i)=>(
            <div key={emp.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid #F3F4F6"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <Avatar name={emp.name} size={32} idx={i} />
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:"#111827"}}>{emp.name}</div>
                  {emp.role&&<div style={{fontSize:11,color:"#9CA3AF"}}>{emp.role}</div>}
                </div>
              </div>
              <button onClick={()=>onDelete(emp.id)} style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:6,padding:"4px 10px",color:"#DC2626",cursor:"pointer",fontSize:12,fontWeight:500}}>Remove</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}



// ─── Gantt Chart ──────────────────────────────────────────────
function GanttChart({ tasks, employees }) {
  const today = new Date();
  today.setHours(0,0,0,0);

  const [empFilter,    setEmpFilter]    = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [rangeMonths,  setRangeMonths]  = useState(3);
  const [anchor,       setAnchor]       = useState(0);

  const windowStart = new Date(today.getFullYear(), today.getMonth() + anchor, 1);
  const windowEnd   = new Date(windowStart.getFullYear(), windowStart.getMonth() + rangeMonths, 0);
  const totalDays   = Math.round((windowEnd - windowStart) / 86400000) + 1;

  const monthSegments = [];
  let cur = new Date(windowStart);
  while (cur <= windowEnd) {
    const y = cur.getFullYear(), m = cur.getMonth();
    const segEnd = new Date(Math.min(new Date(y, m+1, 0), windowEnd));
    const days = Math.round((segEnd - new Date(Math.max(cur, windowStart))) / 86400000) + 1;
    monthSegments.push({ label: cur.toLocaleString("en-US", {month:"short", year:"numeric"}), days });
    cur = new Date(y, m+1, 1);
  }

  const filtered = tasks.filter(t => {
    if (!t.deadline) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (empFilter !== "all" && !(t.assignees||[]).some(a=>String(a.id)===empFilter)) return false;
    const s = t.actual_start
      ? new Date(t.actual_start)
      : t.planned_start
        ? new Date(t.planned_start)
        : new Date(t.deadline);
    const e2 = t.actual_end
      ? new Date(t.actual_end)
      : t.planned_end
        ? new Date(t.planned_end)
        : new Date(t.deadline);
    s.setHours(0,0,0,0); e2.setHours(0,0,0,0);
    return s <= windowEnd && e2 >= windowStart;
  }).sort((a,b) => new Date(a.deadline) - new Date(b.deadline));

  function barProps(task) {
    const startDate = task.actual_start
      ? new Date(task.actual_start)
      : task.planned_start
        ? new Date(task.planned_start)
        : new Date(task.created_at || task.deadline);
    const endDate = task.actual_end
      ? new Date(task.actual_end)
      : task.planned_end
        ? new Date(task.planned_end)
        : new Date(task.deadline);
    const s  = new Date(Math.max(startDate, windowStart));
    const e2 = new Date(Math.min(endDate, windowEnd));
    s.setHours(0,0,0,0); e2.setHours(0,0,0,0);
    const off  = Math.round((s - windowStart) / 86400000);
    const span = Math.max(Math.round((e2 - s) / 86400000) + 1, 1);
    return {
      left:  `${(off / totalDays) * 100}%`,
      width: `${Math.min((span / totalDays) * 100, 100 - (off / totalDays) * 100)}%`
    };
  }

  const todayPct = today >= windowStart && today <= windowEnd
    ? `${(Math.round((today - windowStart) / 86400000) / totalDays) * 100}%`
    : null;

  const STATUS_COLOR = { new:"#2563EB", process:"#059669", blocked:"#DC2626", done:"#7C3AED" };
  const ROW       = 44;
  const PHASE_ROW = 18;

  const getRowHeight = (task) => {
    const phaseCount = (task.phases || []).filter(p => p.start_date && p.end_date).length;
    return ROW + (phaseCount * PHASE_ROW);
  };

  const selBtn = (active) => ({
    padding:"5px 12px", borderRadius:6, border:"none", cursor:"pointer",
    fontSize:12, fontWeight:600, fontFamily:"Inter,sans-serif",
    background: active?"#fff":"transparent", color: active?"#111827":"#6B7280",
    boxShadow: active?"0 1px 3px rgba(0,0,0,0.08)":"none", transition:"all 0.15s",
  });
  const outBtn = {
    background:"#fff", border:"1.5px solid #E5E7EB", borderRadius:7,
    padding:"6px 12px", cursor:"pointer", fontSize:12, color:"#374151",
    fontFamily:"Inter,sans-serif", fontWeight:600
  };

  return (
    <div style={{padding:"28px 32px",overflowY:"auto",height:"calc(100vh - 65px)",fontFamily:"Inter,sans-serif",background:"#F9FAFB"}}>
      <div style={{marginBottom:20}}>
        <h2 style={{fontSize:22,fontWeight:700,color:"#111827",margin:"0 0 4px"}}>Gantt Chart</h2>
        <p style={{color:"#6B7280",margin:0,fontSize:14}}>Task timeline with project phases</p>
      </div>

      {/* Toolbar */}
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <select value={empFilter} onChange={e=>setEmpFilter(e.target.value)}
          style={{background:"#fff",border:"1.5px solid #E5E7EB",borderRadius:8,padding:"7px 12px",color:"#374151",fontSize:12,fontFamily:"Inter,sans-serif",cursor:"pointer",fontWeight:500}}>
          <option value="all">All Members</option>
          {employees.map(e=><option key={e.id} value={String(e.id)}>{e.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
          style={{background:"#fff",border:"1.5px solid #E5E7EB",borderRadius:8,padding:"7px 12px",color:"#374151",fontSize:12,fontFamily:"Inter,sans-serif",cursor:"pointer",fontWeight:500}}>
          <option value="all">All Statuses</option>
          <option value="new">New</option>
          <option value="process">In Process</option>
          <option value="blocked">Blocked</option>
          <option value="done">Done</option>
        </select>
        <div style={{display:"flex",background:"#F3F4F6",borderRadius:8,padding:3}}>
          {[1,2,3,6].map(m=>(
            <button key={m} onClick={()=>setRangeMonths(m)} style={selBtn(rangeMonths===m)}>{m}M</button>
          ))}
        </div>
        <div style={{display:"flex",gap:6,marginLeft:"auto",alignItems:"center"}}>
          <button onClick={()=>setAnchor(a=>a-rangeMonths)} style={outBtn}>← Prev</button>
          <button onClick={()=>setAnchor(0)} style={{...outBtn,background:"#2563EB",color:"#fff",border:"none",boxShadow:"0 2px 6px rgba(37,99,235,0.3)"}}>Today</button>
          <button onClick={()=>setAnchor(a=>a+rangeMonths)} style={outBtn}>Next →</button>
        </div>
      </div>

      {/* Legend */}
      <div style={{display:"flex",gap:16,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        {Object.entries(STATUS_COLOR).map(([s,c])=>(
          <div key={s} style={{display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:12,height:12,borderRadius:3,background:c}}/>
            <span style={{fontSize:11,color:"#6B7280",fontWeight:500,textTransform:"capitalize"}}>
              {s==="process"?"In Process":s.charAt(0).toUpperCase()+s.slice(1)}
            </span>
          </div>
        ))}
        {/* Phase legend */}
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <div style={{width:12,height:12,borderRadius:3,background:"#059669"}}/>
          <span style={{fontSize:11,color:"#6B7280",fontWeight:500}}>Phase Done</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <div style={{width:12,height:12,borderRadius:3,background:"#F59E0B"}}/>
          <span style={{fontSize:11,color:"#6B7280",fontWeight:500}}>Phase Active</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <div style={{width:12,height:12,borderRadius:3,background:"#6B7280"}}/>
          <span style={{fontSize:11,color:"#6B7280",fontWeight:500}}>Phase Pending</span>
        </div>
        {todayPct && (
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:2,height:12,background:"#F59E0B",borderRadius:1}}/>
            <span style={{fontSize:11,color:"#6B7280",fontWeight:500}}>Today</span>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div style={{background:"#fff",borderRadius:12,padding:"48px 0",textAlign:"center",border:"1px solid #E5E7EB",color:"#9CA3AF",fontSize:14}}>
          No tasks with deadlines visible in this period
        </div>
      ) : (
        <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",overflow:"hidden"}}>
          <div style={{display:"flex"}}>

            {/* ── Sol: Label kolonu ── */}
            <div style={{width:256,flexShrink:0,borderRight:"1px solid #E5E7EB"}}>
              <div style={{height:36,borderBottom:"1px solid #F3F4F6",background:"#F9FAFB",display:"flex",alignItems:"center",padding:"0 14px"}}>
                <span style={{fontSize:11,fontWeight:700,color:"#6B7280",letterSpacing:"0.05em"}}>TASK</span>
              </div>
              {filtered.map((task, ri) => {
                const ts2  = TOPIC_STYLE[task.topic] || {bg:"#F3F4F6",text:"#374151"};
                const asgn = task.assignees || [];
                const rowH = getRowHeight(task);
                const taskPhases = (task.phases || []).filter(p => p.start_date && p.end_date);

                return (
                  <div key={task.id} style={{
                    height: rowH, display:"flex", flexDirection:"column",
                    justifyContent:"flex-start",
                    borderBottom: ri < filtered.length-1 ? "1px solid #F3F4F6" : "none",
                    background: ri%2===0 ? "#fff" : "#FAFAFA"
                  }}>
                    {/* Task header */}
                    <div style={{height:ROW,display:"flex",alignItems:"center",padding:"0 12px",gap:8}}>
                      <div style={{width:7,height:7,borderRadius:"50%",background:STATUS_COLOR[task.status]||"#9CA3AF",flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:600,color:"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.title}</div>
                        {task.topic && (
                          <span style={{fontSize:10,color:ts2.text,background:ts2.bg,padding:"1px 5px",borderRadius:3,fontWeight:600}}>{task.topic}</span>
                        )}
                      </div>
                      <div style={{display:"flex",flexShrink:0}}>
                        {asgn.slice(0,3).map((a,ai)=>(
                          <div key={a.id} style={{marginLeft:ai>0?-6:0}}><Avatar name={a.name} size={20} idx={ai}/></div>
                        ))}
                        {asgn.length>3 && <span style={{fontSize:10,color:"#9CA3AF",marginLeft:2,alignSelf:"center"}}>+{asgn.length-3}</span>}
                      </div>
                    </div>

                    {/* Phase labels */}
                    {taskPhases.map((ph, pi) => (
                      <div key={ph.id||pi} style={{
                        height: PHASE_ROW, display:"flex", alignItems:"center",
                        paddingLeft:24, gap:5,
                      }}>
                        <div style={{
                          width:6, height:6, borderRadius:"50%", flexShrink:0,
                          background: ph.status==="done"?"#059669":ph.status==="active"?"#F59E0B":"#6B7280"
                        }}/>
                        <span style={{fontSize:10,color:"#6B7280",fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                          {ph.name}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* ── Sağ: Timeline kolonu ── */}
            <div style={{flex:1,overflowX:"auto",position:"relative",minWidth:0}}>
              {/* Month headers */}
              <div style={{display:"flex",height:36,borderBottom:"1px solid #F3F4F6",background:"#F9FAFB"}}>
                {monthSegments.map((seg,i)=>(
                  <div key={i} style={{
                    flex:`0 0 ${(seg.days/totalDays)*100}%`,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:11,fontWeight:700,color:"#374151",
                    borderRight:i<monthSegments.length-1?"1px solid #E5E7EB":"none",
                    letterSpacing:"0.03em"
                  }}>
                    {seg.label}
                  </div>
                ))}
              </div>

              {/* Rows + bars */}
              <div style={{position:"relative"}}>
                {todayPct && (
                  <div style={{position:"absolute",left:todayPct,top:0,bottom:0,width:2,background:"#F59E0B",zIndex:5,pointerEvents:"none"}}>
                    <div style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:8,height:8,borderRadius:"50%",background:"#F59E0B"}}/>
                  </div>
                )}

                {filtered.map((task, ri) => {
                  const bp = barProps(task);
                  const bc = STATUS_COLOR[task.status] || "#9CA3AF";
                  const isDone    = task.status === "done";
                  const isBlocked = task.status === "blocked";
                  const overdue   = task.deadline && new Date(task.deadline) < today && task.status !== "done";
                  const rowH      = getRowHeight(task);
                  const taskPhases = (task.phases || [])
                    .filter(p => p.start_date && p.end_date)
                    .sort((a, b) => a.position - b.position);

                  return (
                    <div key={task.id} style={{
                      height: rowH, position:"relative",
                      borderBottom: ri < filtered.length-1 ? "1px solid #F3F4F6" : "none",
                      background: ri%2===0 ? "#fff" : "#FAFAFA"
                    }}>
                      {/* Month dividers */}
                      {(()=>{
                        let x=0;
                        return monthSegments.slice(0,-1).map((seg,mi)=>{
                          x += (seg.days/totalDays)*100;
                          return <div key={mi} style={{position:"absolute",left:`${x}%`,top:0,bottom:0,width:1,background:"#F3F4F6",pointerEvents:"none"}}/>;
                        });
                      })()}

                      {/* Ana task bar */}
                      <div style={{position:"relative",height:ROW}}>
                        <div
                          title={`${task.title}\nPlanned Start: ${task.planned_start?.slice(0,10)||"not set"}\nPlanned End: ${task.planned_end?.slice(0,10)||"not set"}\nActual Start: ${task.actual_start?.slice(0,10)||"not started"}\nActual End: ${task.actual_end?.slice(0,10)||"not finished"}\nDeadline: ${task.deadline?.slice(0,10)||"none"}\nStatus: ${task.status}\nAssignees: ${(task.assignees||[]).map(a=>a.name).join(", ")||"none"}`}
                          style={{
                            position:"absolute", left:bp.left, width:bp.width,
                            top:"50%", transform:"translateY(-50%)",
                            height:22, borderRadius:5,
                            background: isDone
                              ? `repeating-linear-gradient(45deg,${bc}cc,${bc}cc 5px,${bc}55 5px,${bc}55 10px)`
                              : bc,
                            border: isBlocked?"2px dashed #991B1B":overdue?"2px solid #EA580C":"none",
                            display:"flex", alignItems:"center", paddingLeft:7,
                            overflow:"hidden", cursor:"default",
                            boxShadow:`0 1px 4px ${bc}44`,
                            transition:"filter 0.15s, opacity 0.15s",
                            opacity: isDone?0.8:1,
                          }}
                          onMouseEnter={e=>{e.currentTarget.style.filter="brightness(1.12)";}}
                          onMouseLeave={e=>{e.currentTarget.style.filter="none";}}
                        >
                          <span style={{fontSize:10,fontWeight:600,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",textShadow:"0 1px 2px rgba(0,0,0,0.25)"}}>
                            {isDone?"✓ ":isBlocked?"⊘ ":overdue?"⚠ ":""}{task.title}
                          </span>
                        </div>
                      </div>

                      {/* Phase bar'ları */}
                      {taskPhases.map((ph, pi) => {
                        const phStart = new Date(Math.max(new Date(ph.start_date), windowStart));
                        const phEnd   = new Date(Math.min(new Date(ph.end_date), windowEnd));
                        phStart.setHours(0,0,0,0);
                        phEnd.setHours(0,0,0,0);
                        if (phStart > phEnd) return null;

                        const off   = Math.round((phStart - windowStart) / 86400000);
                        const span  = Math.max(Math.round((phEnd - phStart) / 86400000) + 1, 1);
                        const left  = `${(off / totalDays) * 100}%`;
                        const width = `${Math.min((span / totalDays) * 100, 100 - (off / totalDays) * 100)}%`;
                        const phColor = ph.status==="done"?"#059669":ph.status==="active"?"#F59E0B":"#6B7280";

                        return (
                          <div key={ph.id||pi} style={{
                            position:"relative", height:PHASE_ROW,
                            display:"flex", alignItems:"center",
                          }}>
                            <div
                              title={`${ph.name}\n${ph.start_date} → ${ph.end_date}\nStatus: ${ph.status}`}
                              style={{
                                position:"absolute", left, width,
                                height:12, borderRadius:3,
                                background: phColor,
                                opacity:0.8,
                                display:"flex", alignItems:"center", paddingLeft:5,
                                overflow:"hidden", cursor:"default",
                              }}
                            >
                              <span style={{fontSize:9,color:"#fff",fontWeight:600,whiteSpace:"nowrap"}}>
                                {ph.status==="done"?"✓ ":""}{ph.name}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}

      <div style={{marginTop:14,display:"flex",gap:20,fontSize:12,color:"#9CA3AF"}}>
        <span>Showing <strong style={{color:"#374151"}}>{filtered.length}</strong> of <strong style={{color:"#374151"}}>{tasks.filter(t=>t.deadline).length}</strong> tasks with deadlines</span>
        <span>Window: <strong style={{color:"#374151"}}>{windowStart.toLocaleDateString("en-GB")} – {windowEnd.toLocaleDateString("en-GB")}</strong></span>
      </div>
    </div>
  );
}


function KPIDashboard({ kpi, employees , tasks}) {
  if (!kpi) return <div style={{padding:40,textAlign:"center",color:"#9CA3AF",fontFamily:"'Inter',sans-serif",fontSize:14}}>Loading KPIs...</div>;

  const { summary, by_status, by_topic, per_employee, trend } = kpi;
  const maxTrend = Math.max(...trend.map(t=>t.completed), 1);
  
  const MAX_CAPACITY = parseInt(import.meta.env.VITE_MAX_CAPACITY || "250"); // max hours per employee per month for capacity utilization;
  const cards = [
    { icon:"📋", label:"Total Tasks",        val: summary.total,                color:"#2563EB", bg:"#EFF6FF" },
    { icon:"✅", label:"Done This Month",     val: summary.completed_month,      color:"#059669", bg:"#ECFDF5" },
    { icon:"⚡", label:"In Progress",         val: by_status.process||0,         color:"#0891B2", bg:"#ECFEFF" },
    { icon:"🚫", label:"Blocked",             val: by_status.blocked||0,         color:"#DC2626", bg:"#FEF2F2" },
    { icon:"⏰", label:"Overdue",             val: summary.overdue,              color:"#EA580C", bg:"#FFF7ED" },
    { icon:"📅", label:"Avg. Days to Done",   val:`${summary.avg_days_to_complete||0}d`, color:"#0369A1", bg:"#E0F2FE" },
    { icon:"⏱️", label:"Total Est. Hours",    val: per_employee.reduce((sum, emp) => sum + (emp.estimated_workload_hours || 0), 0).toFixed(0), color:"#7C3AED", bg:"#F5F3FF" },
    { icon:"👥", label:"Team Size",           val: employees.length,             color:"#374151", bg:"#F9FAFB" },
  ];

  return (
    <div style={{padding:"28px 32px",overflowY:"auto",height:"calc(100vh - 65px)",fontFamily:"'Inter',sans-serif",background:"#F9FAFB"}}>
      <div style={{marginBottom:24}}>
        <h2 style={{fontSize:22,fontWeight:700,color:"#111827",margin:"0 0 4px"}}>Performance Dashboard</h2>
        <p style={{color:"#6B7280",margin:0,fontSize:14}}>Company-wide KPIs and hourly workload — TEKSER S.R.L.</p>
      </div>

      {/* Stat cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:24}}>
        {cards.map(c=>(
          <div key={c.label} style={{background:"#fff",borderRadius:12,padding:20,border:"1px solid #E5E7EB",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
            <div style={{fontSize:24,marginBottom:8}}>{c.icon}</div>
            <div style={{fontSize:28,fontWeight:800,color:c.color,lineHeight:1}}>{c.val}</div>
            <div style={{fontSize:12,color:"#6B7280",marginTop:4,fontWeight:500}}>{c.label}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:24}}>
        {/* Trend chart */}
        <div style={{background:"#fff",borderRadius:12,padding:24,border:"1px solid #E5E7EB"}}>
          <h3 style={{fontSize:14,fontWeight:700,color:"#111827",margin:"0 0 20px"}}>Monthly Completions</h3>
          {trend.length===0
            ? <div style={{color:"#9CA3AF",fontSize:13,textAlign:"center",padding:"20px 0"}}>No completed tasks yet</div>
            : (
              <div style={{display:"flex",alignItems:"flex-end",gap:12,height:120}}>
                {trend.map(t=>(
                  <div key={t.month} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#7C3AED"}}>{t.completed}</div>
                    <div style={{width:"100%",background:"#7C3AED",height:`${Math.max((t.completed/maxTrend)*90,4)}px`,borderRadius:"4px 4px 0 0",opacity:0.8}} />
                    <div style={{fontSize:10,color:"#9CA3AF",textAlign:"center"}}>{t.month}</div>
                  </div>
                ))}
              </div>
            )
          }
        </div>

        {/* By topic */}
        <div style={{background:"#fff",borderRadius:12,padding:24,border:"1px solid #E5E7EB"}}>
          <h3 style={{fontSize:14,fontWeight:700,color:"#111827",margin:"0 0 16px"}}>Tasks by Category</h3>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {by_topic.slice(0,7).map(t=>{
              const s = TOPIC_STYLE[t.topic]||{bg:"#F3F4F6",text:"#374151"};
              const pct = t.total>0?Math.round((t.done/t.total)*100):0;
              return (
                <div key={t.topic}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <span style={{fontSize:11,color:s.text,fontWeight:600,background:s.bg,padding:"2px 8px",borderRadius:4}}>{t.topic}</span>
                    <span style={{fontSize:11,color:"#6B7280"}}>{t.done}/{t.total} done</span>
                  </div>
                  <div style={{background:"#F3F4F6",borderRadius:4,height:6}}>
                    <div style={{background:"#059669",width:`${pct}%`,height:"100%",borderRadius:4}} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Per-employee table */}
      <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",overflow:"hidden"}}>
        <div style={{padding:"18px 24px",borderBottom:"1px solid #F3F4F6",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <h3 style={{fontSize:14,fontWeight:700,color:"#111827",margin:0}}>Team Workload</h3>
          <span style={{fontSize:12,color:"#9CA3AF"}}>{employees.length} members (Max {MAX_CAPACITY} hours/person)</span>
        </div>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr style={{background:"#F9FAFB"}}>
              {["Team Member","Workload (Hours)","New","In Progress","Blocked","Done","Total"].map(h=>(
                <th key={h} style={{padding:"10px 16px",fontSize:11,fontWeight:700,color:"#6B7280",textAlign:h==="Team Member"?"left":"center",letterSpacing:"0.05em"}}>{h.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {per_employee.map((emp,i)=>{
              // 1. AKTİF İŞ YÜKÜNÜ HESAPLA: Biten görevleri saymıyoruz
              //const activeTasks = emp.total_assigned - emp.done_count;
              const estimatedHours = emp.estimated_workload_hours ; 
              const capacityPct = Math.round((estimatedHours / MAX_CAPACITY) * 100);
              const displayPct = capacityPct > 100 ? "100+" : capacityPct;
              const pct = Math.min(capacityPct, 100);

              const barColor = pct>75?"#DC2626":pct>40?"#D97706":"#059669";
              const statusVals = [emp.new_count,emp.in_process,emp.blocked,emp.done_count,emp.total_assigned];
              const statusColors = ["#2563EB","#059669","#DC2626","#7C3AED","#111827"];
              
              return (
                <tr key={emp.id} style={{borderTop:"1px solid #F3F4F6"}}>
                  <td style={{padding:"12px 16px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <Avatar name={emp.name} size={32} idx={i} />
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:"#111827"}}>{emp.name}</div>
                        {emp.role&&<div style={{fontSize:11,color:"#9CA3AF"}}>{emp.role}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{padding:"12px 16px",width:160}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{flex:1,background:"#F3F4F6",borderRadius:4,height:8}}>
                        <div style={{background:barColor,width:`${pct}%`,height:"100%",borderRadius:4}} />
                      </div>
                      <span style={{fontSize:11,color:barColor,fontWeight:700,width:32}}>{displayPct}%</span>
                    </div>
                    <div style={{fontSize:10,color:"#6B7280",marginTop:2}}>{Math.round(estimatedHours)}h</div>
                  </td>
                  {statusVals.map((v,ci)=>(
                    <td key={ci} style={{padding:"12px 16px",textAlign:"center"}}>
                      <span style={{fontSize:14,fontWeight:v>0?700:400,color:v>0?statusColors[ci]:"#D1D5DB"}}>{v}</span>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function TaskCard({ task, onDragStart, onEdit, onDelete }) {
  const [hovered, setHovered] = useState(false);
  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== "done";
  const ts = TOPIC_STYLE[task.topic] || { bg: "#F3F4F6", text: "#374151", border: "#E5E7EB" };
  const assignees = task.assignees || [];
  const col = COLUMNS.find(c => c.id === task.status) || COLUMNS[0];

  const plannedStart = task.planned_start?.slice(0, 10);
  const plannedEnd   = task.planned_end?.slice(0, 10);
  const actualStart  = task.actual_start?.slice(0, 10);
  const actualEnd    = task.actual_end?.slice(0, 10);

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, task.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#fff",
        border: `1.5px solid ${hovered ? col.color + "55" : "#E5E7EB"}`,
        borderRadius: 12,
        marginBottom: 10,
        cursor: "grab",
        boxShadow: hovered
          ? `0 8px 28px rgba(0,0,0,0.10), 0 0 0 3px ${col.color}18`
          : "0 1px 3px rgba(0,0,0,0.04)",
        transform: hovered ? "translateY(-2px) scale(1.01)" : "none",
        transition: "all 0.2s cubic-bezier(.4,0,.2,1)",
        fontFamily: "'Inter',sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Status accent line */}
      <div style={{
        height: 3,
        background: col.color,
        opacity: hovered ? 1 : 0,
        transition: "opacity 0.2s",
      }} />

      <div style={{ padding: 14 }}>
        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          {task.topic
            ? <span style={{ fontSize: 11, fontWeight: 600, color: ts.text, background: ts.bg, border: `1px solid ${ts.border}`, padding: "2px 8px", borderRadius: 5 }}>{task.topic}</span>
            : <span />}
          <div style={{ display: "flex", gap: 4, opacity: hovered ? 1 : 0, transition: "opacity 0.15s" }}>
            <button onClick={() => onEdit(task)} style={{ background: "#F3F4F6", border: "none", borderRadius: 5, padding: "3px 8px", color: "#374151", cursor: "pointer", fontSize: 11, fontWeight: 500 }}>Edit</button>
            <button onClick={() => onDelete(task.id)} style={{ background: "#FEF2F2", border: "none", borderRadius: 5, padding: "3px 8px", color: "#DC2626", cursor: "pointer", fontSize: 11, fontWeight: 500 }}>✕</button>
          </div>
        </div>

        {/* Title */}
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 4, lineHeight: 1.4 }}>{task.title}</div>

        {/* Description — always visible if exists */}
        {task.description && (
          <div style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.5, marginBottom: 8 }}>{task.description}</div>
        )}

        {/* ── Expanded detail panel ── */}
        <div style={{
          maxHeight: hovered ? 200 : 0,
          opacity: hovered ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 0.25s cubic-bezier(.4,0,.2,1), opacity 0.2s",
        }}>
          <div style={{
            borderTop: "1px solid #F3F4F6",
            marginTop: 8,
            paddingTop: 10,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "6px 12px",
          }}>
            {[
              { label: "📅 Planned Start", val: plannedStart },
              { label: "🏁 Planned End",   val: plannedEnd   },
              { label: "▶ Actual Start",  val: actualStart  },
              { label: "✅ Actual End",    val: actualEnd    },
            ].map(({ label, val }) => (
              <div key={label}>
                <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600, marginBottom: 1 }}>{label}</div>
                <div style={{ fontSize: 11, color: val ? "#111827" : "#D1D5DB", fontWeight: val ? 500 : 400 }}>
                  {val || "—"}
                </div>
              </div>
            ))}
          </div>

          {/* Status badge */}
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: col.color }} />
            <span style={{ fontSize: 11, color: col.color, fontWeight: 600 }}>{col.label}</span>
            {isOverdue && (
              <span style={{ fontSize: 10, background: "#FEF2F2", color: "#DC2626", padding: "1px 6px", borderRadius: 4, fontWeight: 600, marginLeft: "auto" }}>
                ⚠ OVERDUE
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
          {assignees.length === 0
            ? <span style={{ fontSize: 11, color: "#D1D5DB" }}>Unassigned</span>
            : (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ display: "flex" }}>
                  {assignees.slice(0, 4).map((a, i) => (
                    <div key={a.id} style={{ marginLeft: i > 0 ? -8 : 0 }}>
                      <Avatar name={a.name} size={22} idx={i} />
                    </div>
                  ))}
                </div>
                {assignees.length === 1
                  ? <span style={{ fontSize: 11, color: "#6B7280" }}>{assignees[0].name}</span>
                  : assignees.length > 4
                    ? <span style={{ fontSize: 11, color: "#6B7280" }}>+{assignees.length - 4} more</span>
                    : <span style={{ fontSize: 11, color: "#6B7280" }}>{assignees.length} members</span>
                }
              </div>
            )
          }
          {task.deadline && (
            <span style={{
              fontSize: 11, fontWeight: isOverdue ? 600 : 400,
              color: isOverdue ? "#DC2626" : "#9CA3AF",
              background: isOverdue ? "#FEF2F2" : "transparent",
              padding: isOverdue ? "1px 6px" : "0", borderRadius: 4,
            }}>
              {isOverdue ? "⚠ " : ""}{task.deadline.slice(0, 10)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [tasks, setTasks]         = useState([]);
  const [employees, setEmployees] = useState([]);
  const [kpi, setKpi]             = useState(null);
  const [view, setView]           = useState("board");
  const [filterEmpId, setFilter]  = useState("all");
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [modal, setModal]         = useState(null);
  const [dragOver, setDragOver]   = useState(null);
  const [toasts, setToasts]       = useState([]);
  const dragId = useRef(null);

  const toast = useCallback((msg,type="success")=>{
    const id = Date.now();
    setToasts(p=>[...p,{id,msg,type}]);
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),3000);
  },[]);

  const loadAll = useCallback(async()=>{
    try {
      const [t,e,k] = await Promise.all([api.getTasks(),api.getEmployees(),api.getKPI()]);

      console.log("1. Backend'den Gelen Görevler (Tasks):", t);
      console.log("2. Backend'den Gelen Çalişanlar (Employees):", e);
      console.log("3. Backend'den Gelen KPI Verisi:", k);
      console.log("Task phases örnek:", tasks[0]?.phases);

      setTasks(t); setEmployees(e); setKpi(k); setError(null);
    } catch(err){ setError(err.message); }
    finally { setLoading(false); }
  },[]);

  useEffect(()=>{ loadAll(); },[loadAll]);

  const handleDrop = async(e, colId)=>{
    e.preventDefault(); setDragOver(null);
    const id = dragId.current; if(!id) return;
    setTasks(p=>p.map(t=>t.id===id?{...t,status:colId}:t));
    try {
      await api.patchTaskStatus(id,colId);
      const k = await api.getKPI(); setKpi(k);
    } catch(err){ toast(err.message,"error"); loadAll(); }
  };

  const handleTaskSave = async (form, phases) => {
  try {
    let savedTaskId;
    if (modal?.task?.id) {
      const u = await api.updateTask(modal.task.id, form);
      savedTaskId = u.id;
      toast("Task updated");
    } else {
      const created = await api.createTask(form);
      savedTaskId = created.id;  // createTask RETURNING * dönüyor
      toast("Task created");
    }

    if (phases && phases.length > 0 && savedTaskId) {
      await api.saveTaskPhases(savedTaskId, phases);
    }

    // Her durumda fresh data çek
    const [t, k] = await Promise.all([api.getTasks(), api.getKPI()]);
    setTasks(t); setKpi(k);
    setModal(null);
  } catch (err) {
    toast(err.message, "error");
  }
};

  const handleDelete = async(id)=>{
    setTasks(p=>p.filter(t=>t.id!==id));
    try {
      await api.deleteTask(id);
      const k=await api.getKPI(); setKpi(k);
      toast("Task deleted");
    } catch(err){ toast(err.message,"error"); loadAll(); }
  };

  const handleEmpAdd = async(name,role)=>{
    try {
      const e=await api.createEmployee(name,role);
      setEmployees(p=>[...p,e]); toast(`${e.name} added`);
      const k = await api.getKPI();  
      setKpi(k);
    } catch(err){ toast(err.message,"error"); }
  };

  const handleEmpDelete = async(id)=>{
    setEmployees(p=>p.filter(e=>e.id!==id));
    try {
      await api.deleteEmployee(id);
      const [t,k]=await Promise.all([api.getTasks(),api.getKPI()]);
      setTasks(t); setKpi(k); toast("Member removed");
    } catch(err){ toast(err.message,"error"); loadAll(); }
  };

  const filtered = filterEmpId==="all"
    ? tasks
    : tasks.filter(t=>(t.assignees||[]).some(a=>String(a.id)===filterEmpId));

  return (
    <div style={{minHeight:"100vh",background:"#F9FAFB",fontFamily:"'Inter',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{overflow-y:auto;overflow-x:hidden;}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-thumb{background:#D1D5DB;border-radius:4px;}
        select option{background:#fff;color:#111827;}
        textarea{font-family:'Inter',sans-serif!important;}
        @keyframes slideIn{from{opacity:0;transform:translateX(12px);}to{opacity:1;transform:translateX(0);}}
        @keyframes spin{to{transform:rotate(360deg);}}
      `}</style>

      {/* Header */}
      <div style={{background:"#fff",borderBottom:"1px solid #E5E7EB",padding:"0 24px",height:65,display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:"0 1px 4px rgba(0,0,0,0.05)",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:36,height:36,background:"#2563EB",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:18}}>T</div>
          <div>
            <div style={{fontSize:17,fontWeight:800,color:"#111827",letterSpacing:"-0.02em"}}>TEKSER</div>
            <div style={{fontSize:10,color:"#9CA3AF",fontWeight:600,letterSpacing:"0.06em"}}>S.R.L. — PROJECT MANAGEMENT</div>
          </div>
          <div style={{display:"flex",background:"#F3F4F6",borderRadius:8,padding:3,marginLeft:20}}>
            {[{id:"board",label:"📋  Board"},{id:"kpi",label:"📊  KPIs"},{id:"gantt",label:"📅  Gantt"}].map(tab=>(
              <button key={tab.id} onClick={()=>setView(tab.id)} style={{
                padding:"6px 16px",borderRadius:6,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,
                fontFamily:"'Inter',sans-serif",
                background:view===tab.id?"#fff":"transparent",
                color:view===tab.id?"#111827":"#6B7280",
                boxShadow:view===tab.id?"0 1px 3px rgba(0,0,0,0.08)":"none",
                transition:"all 0.15s",
              }}>{tab.label}</button>
            ))}
          </div>
        </div>

        {view==="board" && (
          <div style={{display:"flex",gap:20}}>
            {COLUMNS.map(col=>(
              <div key={col.id} style={{textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:800,color:col.color}}>{tasks.filter(t=>t.status===col.id).length}</div>
                <div style={{fontSize:9,color:"#9CA3AF",fontWeight:600,letterSpacing:"0.08em"}}>{col.label}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {view==="board"&&(
            <select value={filterEmpId} onChange={e=>setFilter(e.target.value)}
              style={{background:"#F9FAFB",border:"1.5px solid #E5E7EB",borderRadius:8,padding:"7px 12px",color:"#374151",fontSize:12,fontFamily:"'Inter',sans-serif",cursor:"pointer",fontWeight:500}}>
              <option value="all">All Members</option>
              {employees.map(e=><option key={e.id} value={String(e.id)}>{e.name}</option>)}
            </select>
          )}
          <button onClick={()=>setModal({type:"employees"})}
            style={{background:"#F9FAFB",border:"1.5px solid #E5E7EB",borderRadius:8,padding:"7px 14px",color:"#374151",fontSize:12,fontFamily:"'Inter',sans-serif",cursor:"pointer",fontWeight:600}}>👥 Team</button>
          <button onClick={()=>setModal({type:"task"})}
            style={{background:"#2563EB",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontFamily:"'Inter',sans-serif",fontSize:13,fontWeight:600,cursor:"pointer",boxShadow:"0 2px 8px rgba(37,99,235,0.3)"}}>+ New Task</button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"calc(100vh - 65px)",flexDirection:"column",gap:12,color:"#9CA3AF",fontSize:13}}>
          <div style={{width:32,height:32,border:"3px solid #E5E7EB",borderTop:"3px solid #2563EB",borderRadius:"50%",animation:"spin 0.7s linear infinite"}} />
          Loading...
        </div>
      ) : error ? (
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"calc(100vh - 65px)",gap:12}}>
          <div style={{color:"#DC2626",fontSize:14}}>⚠ {error}</div>
          <button onClick={loadAll} style={{background:"#2563EB",color:"#fff",border:"none",borderRadius:8,padding:"8px 20px",fontFamily:"'Inter',sans-serif",fontSize:13,cursor:"pointer"}}>Retry</button>
        </div>
      ) : view==="gantt" ? (
        <GanttChart tasks={tasks} employees={employees} />
      ) : view==="kpi" ? (
        <KPIDashboard kpi={kpi} employees={employees} tasks={tasks} />
      ) : (
        <div style={{display:"flex", height:"calc(100vh - 65px)", overflow: "hidden"}}>
          {COLUMNS.map((col,i)=>{
            const colTasks = filtered.filter(t=>t.status===col.id);
            const isDrop = dragOver===col.id;
            return (
              <div key={col.id}
                onDragOver={e=>{e.preventDefault();setDragOver(col.id);}}
                onDragLeave={()=>setDragOver(null)}
                onDrop={e=>handleDrop(e,col.id)}
                style={{borderRight:i<3?"1px solid #E5E7EB":"none",display:"flex",flexDirection:"column",background:isDrop?col.light:"#F9FAFB",transition:"background 0.15s",flex:1}}
              >
                <div style={{padding:"14px 16px 12px",borderBottom:`2px solid ${col.color}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:"#fff"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:col.color}} />
                    <span style={{fontSize:12,fontWeight:700,color:col.color,letterSpacing:"0.06em"}}>{col.label}</span>
                  </div>
                  <span style={{fontSize:12,color:col.color,background:col.light,border:`1px solid ${col.dot}`,padding:"1px 9px",borderRadius:10,fontWeight:700}}>{colTasks.length}</span>
                </div>
                <div style={{flex:1,overflowY:"auto",padding:14, minHeight: 0}}>
                  {colTasks.length===0&&(
                    <div style={{border:`2px dashed ${isDrop?col.color:"#E5E7EB"}`,borderRadius:10,padding:"28px 16px",textAlign:"center",color:isDrop?col.color:"#D1D5DB",fontSize:12,fontWeight:500,transition:"all 0.2s"}}>
                      {isDrop?"Drop here ↓":"Drag tasks here"}
                    </div>
                  )}
                  {colTasks.map(task=>(
                    <TaskCard key={task.id} task={task}
                      onDragStart={(e,id)=>{dragId.current=id;}}
                      onEdit={t=>setModal({type:"task",task:t})}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal?.type==="task"&&<TaskModal task={modal.task} employees={employees} onSave={handleTaskSave} onClose={()=>setModal(null)} />}
      {modal?.type==="employees"&&<EmployeeManager employees={employees} onAdd={handleEmpAdd} onDelete={handleEmpDelete} onClose={()=>setModal(null)} />}
      <Toast toasts={toasts} />
    </div>
  );
}
