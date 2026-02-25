import { useState, useEffect, useRef } from "react";
import * as api from "../api.js";
import { COLUMNS, TOPICS, TOPIC_STYLE, inp } from "../constants/index.js";
import Avatar from "./Avatar.jsx";
import AssigneePicker from "./AssigneePicker.jsx";

export default function TaskModal({ task, employees, onSave, onClose }) {
  const blank = { title:"", description:"", topics:[], assignee_ids:[], deadline:"", status:"new", planned_start:"", planned_end:"", estimated_hours:"" };
  const init = task ? {
    title:task.title, description:task.description||"",
    topics:task.topics||[], assignee_ids:(task.assignees||[]).map(a=>a.id),
    deadline:task.deadline?.slice(0,10)||"", status:task.status,
    planned_start:task.planned_start?.slice(0,10)||"", planned_end:task.planned_end?.slice(0,10)||"",
    estimated_hours: task?.estimated_hours || ""
  } : blank;

  const [form, setForm] = useState(init);
  const [saving, setSaving] = useState(false);
  const [phases, setPhases] = useState(task?.phases || []);
  const [phaseTemplates, setPhaseTemplates] = useState({});
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

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
        topic_source: toggledTopic
      }));
      setPhases(p => [...p, ...newPhases].map((ph, i) => ({...ph, position: i})));
    }
  };

  const updatePhase = (idx, key, val) => {
    setPhases(p => p.map((ph, i) => {
      if (i !== idx) return ph;
      const updated = { ...ph, [key]: val };
      // Status done yapılınca end_date bugün otomatik set edilir
      if (key === "status" && val === "done") {
        updated.end_date = new Date().toISOString().slice(0, 10);
      }
      return updated;
    }));
};

  const phasesRef = useRef(phases);
  useEffect(() => { phasesRef.current = phases; }, [phases]);

  const handleSave = async (form) => {
    await onSave(form, phasesRef.current);
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
        
        {/* Kategoriler Butonları */}
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
          <div>
            <label style={{display:"block",fontSize:11,color:"#374151",marginBottom:6,fontWeight:600,letterSpacing:"0.05em"}}>ESTIMATED HOURS</label>
            <input type="number" min="0" step="0.5" value={form.estimated_hours} onChange={e => set("estimated_hours", e.target.value ? parseFloat(e.target.value) : null)} style={inp} placeholder="e.g. 24" />
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

        <div style={{marginBottom:24}}>
          <label style={{display:"block",fontSize:11,color:"#374151",marginBottom:8,fontWeight:600,letterSpacing:"0.05em"}}>
            ASSIGNEES <span style={{color:"#9CA3AF",fontWeight:400}}>(multiple allowed)</span>
          </label>
          <AssigneePicker employees={employees} selectedIds={form.assignee_ids} onChange={v=>set("assignee_ids",v)} />
        </div>

        {/* HATA YAPMAZ GRUPLAMA (Kategoriye Göre Bölünmüş Form Fazları) */}
        {phases.length > 0 && (
          <div style={{marginBottom:24}}>
            <label style={{display:"block",fontSize:11,color:"#374151",marginBottom:8,fontWeight:600,letterSpacing:"0.05em"}}>PROJECT PHASES</label>
            
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {form.topics.map(topicName => {
                const ts = TOPIC_STYLE[topicName] || { text: "#374151", bg: "#F3F4F6", border: "#E5E7EB" };
                const expectedNames = (phaseTemplates[topicName] || []).map(t => t.name);
                
                const topicPhases = phases
                  .map((ph, i) => ({ ph, idx: i }))
                  .filter(item => expectedNames.includes(item.ph.name) || item.ph.topic_source === topicName);

                if (topicPhases.length === 0) return null;

                return (
                  <div key={topicName} style={{ border: `1px solid ${ts.border}`, borderRadius: 8, overflow: "hidden" }}>
                    {/* Kategori Başlığı */}
                    <div style={{ background: ts.bg, padding: "8px 12px", borderBottom: `1px solid ${ts.border}` }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: ts.text, letterSpacing: "0.05em" }}>
                        {topicName.toUpperCase()}
                      </span>
                    </div>
                    
                    {/* Faz Kutucukları */}
                    <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: 8, background: "#F9FAFB" }}>
                      {topicPhases.map(({ ph, idx }) => (
                        <div key={idx} style={{ background: "#fff", borderRadius: 6, padding: "10px", border: "1px solid #E5E7EB", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                          
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{ph.name}</span>
                            <select value={ph.status} onChange={e => updatePhase(idx, "status", e.target.value)} style={{ ...inp, width: "auto", padding: "4px 8px", fontSize: 11 }}>
                              <option value="pending">Pending</option>
                              <option value="active">Active</option>
                              <option value="done">Done</option>
                            </select>
                          </div>
                          
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            <div>
                              <label style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600 }}>START</label>
                              <input type="date" value={ph.start_date} onChange={e => updatePhase(idx, "start_date", e.target.value)} style={{ ...inp, marginTop: 4, padding: "6px 10px" }} />
                            </div>
                            <div>
                              <label style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600 }}>END</label>
                              <input type="date" value={ph.end_date} onChange={e => updatePhase(idx, "end_date", e.target.value)} style={{ ...inp, marginTop: 4, padding: "6px 10px" }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
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