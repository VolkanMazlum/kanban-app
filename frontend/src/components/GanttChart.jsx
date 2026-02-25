import { useState } from "react";
import { TOPIC_STYLE } from "../constants/index.js";
import Avatar from "./Avatar.jsx";

const STATUS_COLOR = { new:"#2563EB", process:"#059669", blocked:"#DC2626", done:"#7C3AED" };
const ROW_HEIGHT = 56; // Ana görev satırı yüksekliği
const TOPIC_ROW_HEIGHT = 40; // Her kategori için TEK BİR satır yüksekliği

export default function GanttChart({ tasks, employees }) {
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
    const s = t.actual_start ? new Date(t.actual_start) : t.planned_start ? new Date(t.planned_start) : new Date(t.deadline);
    const e2 = t.actual_end ? new Date(t.actual_end) : t.planned_end ? new Date(t.planned_end) : new Date(t.deadline);
    s.setHours(0,0,0,0); e2.setHours(0,0,0,0);
    return s <= windowEnd && e2 >= windowStart;
  }).sort((a,b) => new Date(a.deadline) - new Date(b.deadline));

  function getBarProps(startDateStr, endDateStr, fallbackDateStr) {
    const start = startDateStr ? new Date(startDateStr) : new Date(fallbackDateStr);
    const end   = endDateStr ? new Date(endDateStr) : new Date(fallbackDateStr);
    const s = new Date(Math.max(start, windowStart));
    const e2 = new Date(Math.min(end, windowEnd));
    //s.setHours(0,0,0,0); e2.setHours(0,0,0,0);
    if (s > e2) return null; 
    const off  = Math.round((s - windowStart) / 86400000);
    const span = Math.max(Math.round((e2 - s) / 86400000) + 1, 1);
    return {
      left:  `${(off / totalDays) * 100}%`,
      width: `${Math.min((span / totalDays) * 100, 100 - (off / totalDays) * 100)}%`
    };
  }

  const todayPct = today >= windowStart && today <= windowEnd ? `${(Math.round((today - windowStart) / 86400000) / totalDays) * 100}%` : null;

  const selBtn = (active) => ({ padding:"5px 12px", borderRadius:6, border:"none", cursor:"pointer", fontSize:12, fontWeight:600, fontFamily:"Inter,sans-serif", background: active?"#fff":"transparent", color: active?"#111827":"#6B7280", boxShadow: active?"0 1px 3px rgba(0,0,0,0.08)":"none", transition:"all 0.15s" });
  const outBtn = { background:"#fff", border:"1.5px solid #E5E7EB", borderRadius:7, padding:"6px 12px", cursor:"pointer", fontSize:12, color:"#374151", fontFamily:"Inter,sans-serif", fontWeight:600 };

  return (
    <div style={{padding:"28px 32px",overflowY:"auto",height:"calc(100vh - 65px)",fontFamily:"Inter,sans-serif",background:"#F9FAFB"}}>
      <div style={{marginBottom:20}}>
        <h2 style={{fontSize:22,fontWeight:700,color:"#111827",margin:"0 0 4px"}}>Gantt Chart</h2>
        <p style={{color:"#6B7280",margin:0,fontSize:14}}>Task timeline grouped by project phases</p>
      </div>

      {/* Toolbar */}
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <select value={empFilter} onChange={e=>setEmpFilter(e.target.value)} style={{background:"#fff",border:"1.5px solid #E5E7EB",borderRadius:8,padding:"7px 12px",color:"#374151",fontSize:12,fontFamily:"Inter,sans-serif",cursor:"pointer",fontWeight:500}}>
          <option value="all">All Members</option>
          {employees.map(e=><option key={e.id} value={String(e.id)}>{e.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{background:"#fff",border:"1.5px solid #E5E7EB",borderRadius:8,padding:"7px 12px",color:"#374151",fontSize:12,fontFamily:"Inter,sans-serif",cursor:"pointer",fontWeight:500}}>
          <option value="all">All Statuses</option>
          <option value="new">New</option>
          <option value="process">In Process</option>
          <option value="blocked">Blocked</option>
          <option value="done">Done</option>
        </select>
        <div style={{display:"flex",background:"#F3F4F6",borderRadius:8,padding:3}}>
          {[1,2,3,6].map(m=>(<button key={m} onClick={()=>setRangeMonths(m)} style={selBtn(rangeMonths===m)}>{m}M</button>))}
        </div>
        <div style={{display:"flex",gap:6,marginLeft:"auto",alignItems:"center"}}>
          <button onClick={()=>setAnchor(a=>a-rangeMonths)} style={outBtn}>← Prev</button>
          <button onClick={()=>setAnchor(0)} style={{...outBtn,background:"#2563EB",color:"#fff",border:"none",boxShadow:"0 2px 6px rgba(37,99,235,0.3)"}}>Today</button>
          <button onClick={()=>setAnchor(a=>a+rangeMonths)} style={outBtn}>Next →</button>
        </div>
      </div>

      <div style={{display:"flex",gap:16,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        {Object.entries(STATUS_COLOR).map(([s,c])=>(
          <div key={s} style={{display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:12,height:12,borderRadius:3,background:c}}/>
            <span style={{fontSize:11,color:"#6B7280",fontWeight:500,textTransform:"capitalize"}}>{s==="process"?"In Process":s.charAt(0).toUpperCase()+s.slice(1)}</span>
          </div>
        ))}
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <div style={{width:12,height:12,borderRadius:3,background:"#059669"}}/><span style={{fontSize:11,color:"#6B7280",fontWeight:500}}>Phase Done</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <div style={{width:12,height:12,borderRadius:3,background:"#F59E0B"}}/><span style={{fontSize:11,color:"#6B7280",fontWeight:500}}>Phase Active</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <div style={{width:12,height:12,borderRadius:3,background:"#6B7280"}}/><span style={{fontSize:11,color:"#6B7280",fontWeight:500}}>Phase Pending</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{background:"#fff",borderRadius:12,padding:"48px 0",textAlign:"center",border:"1px solid #E5E7EB",color:"#9CA3AF",fontSize:14}}>
          No tasks with deadlines visible in this period
        </div>
      ) : (
        <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",overflow:"hidden", display:"flex"}}>
          
          {/* ─── SOL KOLON (Görevler ve Sadece Kategori İsimleri) ─── */}
          <div style={{width:256,flexShrink:0,borderRight:"1px solid #E5E7EB", background:"#fff"}}>
            <div style={{height:36,borderBottom:"1px solid #E5E7EB",background:"#F9FAFB",display:"flex",alignItems:"center",padding:"0 16px"}}>
              <span style={{fontSize:11,fontWeight:700,color:"#6B7280",letterSpacing:"0.05em"}}>TASKS & CATEGORIES</span>
            </div>
            
            {filtered.map((task) => {
              const asgn = task.assignees || [];
              const topics = task.topics || [];
              const phases = task.phases || [];

              return (
                <div key={task.id} style={{borderBottom:"1px solid #E5E7EB"}}>
                  {/* Ana Görev Başlığı */}
                  <div style={{height:ROW_HEIGHT, display:"flex", alignItems:"center", padding:"0 12px", background:"#FAFAFA", borderBottom: topics.length > 0 ? "1px solid #E5E7EB" : "none"}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:STATUS_COLOR[task.status]||"#9CA3AF",flexShrink:0, marginRight:10}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:700,color:"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.title}</div>
                    </div>
                    <div style={{display:"flex",flexShrink:0}}>
                      {asgn.slice(0,3).map((a,ai)=>(<div key={a.id} style={{marginLeft:ai>0?-6:0}}><Avatar name={a.name} size={22} idx={ai}/></div>))}
                    </div>
                  </div>

                  {/* Sadece Kategori (Topic) Başlıkları - Alt alta faz listesi kaldırıldı */}
                  {topics.map(topicName => {
                    const ts = TOPIC_STYLE[topicName] || {bg:"#F3F4F6",text:"#374151"};
                    const topicPhases = phases.filter(ph => ph.topic === topicName && ph.start_date && ph.end_date);
                    if (topicPhases.length === 0) return null;

                    return (
                      <div key={topicName} style={{height:TOPIC_ROW_HEIGHT, display:"flex", alignItems:"center", paddingLeft:24, background:ts.bg, borderBottom:"1px solid #fff"}}>
                        <span style={{fontSize:10, fontWeight:700, color:ts.text, letterSpacing:"0.05em"}}>{topicName.toUpperCase()}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* ─── SAĞ KOLON (Timeline ve Barlar) ─── */}
          <div style={{flex:1,overflowX:"auto",position:"relative",minWidth:0}}>
            <div style={{display:"flex",height:36,borderBottom:"1px solid #E5E7EB",background:"#F9FAFB"}}>
              {monthSegments.map((seg,i)=>(
                <div key={i} style={{flex:`0 0 ${(seg.days/totalDays)*100}%`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#374151",borderRight:i<monthSegments.length-1?"1px solid #E5E7EB":"none",letterSpacing:"0.03em"}}>{seg.label}</div>
              ))}
            </div>

            <div style={{position:"relative"}}>
              {/* Dikey ay ayırıcı çizgiler */}
              {(()=>{let x=0;return monthSegments.slice(0,-1).map((seg,mi)=>{x+=(seg.days/totalDays)*100;return <div key={mi} style={{position:"absolute",left:`${x}%`,top:0,bottom:"100%",height:"100%",width:1,background:"#E5E7EB",pointerEvents:"none"}}/>;});})()}
              
              {todayPct && (
                <div style={{position:"absolute",left:todayPct,top:0,bottom:0,width:2,background:"#F59E0B",zIndex:5,pointerEvents:"none"}}>
                  <div style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:8,height:8,borderRadius:"50%",background:"#F59E0B"}}/>
                </div>
              )}

              {filtered.map(task => {
                const taskBp = getBarProps(task.actual_start || task.planned_start, task.actual_end || task.planned_end, task.deadline);
                const topics = task.topics || [];
                const phases = task.phases || [];
                const bc = STATUS_COLOR[task.status] || "#9CA3AF";
                const isDone = task.status === "done";

                return (
                  <div key={task.id} style={{borderBottom:"1px solid #E5E7EB"}}>
                    
                    {/* Ana Görev Barı */}
                    <div style={{height:ROW_HEIGHT, position:"relative", background:"#FAFAFA", borderBottom: topics.length > 0 ? "1px solid #E5E7EB" : "none"}}>
                      {taskBp && (
                        <div style={{
                          position:"absolute", left:taskBp.left, width:taskBp.width, top:"50%", transform:"translateY(-50%)",
                          height:24, borderRadius:6, background: isDone ? `repeating-linear-gradient(45deg,${bc}cc,${bc}cc 5px,${bc}55 5px,${bc}55 10px)` : bc,
                          display:"flex", alignItems:"center", paddingLeft:8, overflow:"hidden", boxShadow:`0 2px 5px ${bc}44`, opacity: isDone?0.7:1
                        }}>
                          <span style={{fontSize:10,fontWeight:700,color:"#fff",whiteSpace:"nowrap"}}>{isDone?"✓":""} {task.title}</span>
                        </div>
                      )}
                    </div>

                    {/* Alt Faz Barları - TEK SATIRDA YAN YANA */}
                    {topics.map(topicName => {
                      const topicPhases = phases.filter(ph => ph.topic === topicName && ph.start_date && ph.end_date).sort((a,b)=>a.position-b.position);
                      if (topicPhases.length === 0) return null;

                      return (
                        // Her kategori için TEK bir satır oluşturuyoruz
                        <div key={topicName} style={{height:TOPIC_ROW_HEIGHT, position:"relative", borderBottom:"1px solid #F9FAFB", background:"rgba(249, 250, 251, 0.5)"}}>
                          
                          {/* O kategoriye ait tüm fazları bu tek satırın içine yan yana yerleştiriyoruz */}
                          {topicPhases.map(ph => {
                            const phBp = getBarProps(ph.start_date, ph.end_date, task.deadline);
                            if (!phBp) return null;

                            const phColor = ph.status==="done"?"#059669":ph.status==="active"?"#F59E0B":"#6B7280";
                            
                            return (
                              <div key={ph.id} title={`${ph.name}\n${ph.start_date} - ${ph.end_date} ${ph.note ? `\n📝 Note: ${ph.note}`: ""}`} style={{
                                position:"absolute", left:phBp.left, width:phBp.width, top:"50%", transform:"translateY(-50%)",
                                height: 22, borderRadius: 4, background: phColor, opacity: 0.9,
                                display: "flex", alignItems: "center", padding: "0 6px",
                                overflow: "hidden", cursor: "default",
                                border: "1px solid rgba(255,255,255,0.3)", boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                              }}>
                                {/* YENİ: İsimleri Barın İçine Yazdırma Kısmı */}
                                <span style={{fontSize: 9, color: "#fff", fontWeight: 600, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow:"hidden"}}>
                                  {ph.status==="done" && "✓ "}{ph.name}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}