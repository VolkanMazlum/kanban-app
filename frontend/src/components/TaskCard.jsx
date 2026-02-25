import { useState } from "react";
import { COLUMNS, TOPIC_STYLE } from "../constants/index.js";
import Avatar from "./Avatar.jsx";

export default function TaskCard({ task, onDragStart, onEdit, onDelete }) {
  const [hovered, setHovered] = useState(false);
  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== "done";
  const assignees = task.assignees || [];
  const topics = task.topics || [];
  const phases = task.phases || []; // Fazları çekiyoruz
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
      <div style={{ height:3, background:col.color, opacity:hovered?1:0, transition:"opacity 0.2s" }} />

      <div style={{ padding: 14 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
          
          {/* Çoklu Topic Badge Alanı */}
          <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
            {topics.map(t => {
              const ts = TOPIC_STYLE[t] || { bg: "#F3F4F6", text: "#374151", border: "#E5E7EB" };
              return (
                <span key={t} style={{ fontSize:10, fontWeight:600, color:ts.text, background:ts.bg, border:`1px solid ${ts.border}`, padding:"2px 6px", borderRadius:4 }}>
                  {t}
                </span>
              );
            })}
          </div>

          <div style={{ display:"flex", gap:4, opacity:hovered?1:0, transition:"opacity 0.15s" }}>
            <button onClick={() => onEdit(task)} style={{ background:"#F3F4F6", border:"none", borderRadius:5, padding:"3px 8px", color:"#374151", cursor:"pointer", fontSize:11, fontWeight:500 }}>Edit</button>
            <button onClick={() => onDelete(task.id)} style={{ background:"#FEF2F2", border:"none", borderRadius:5, padding:"3px 8px", color:"#DC2626", cursor:"pointer", fontSize:11, fontWeight:500 }}>✕</button>
          </div>
        </div>

        <div style={{ fontSize:13, fontWeight:600, color:"#111827", marginBottom:4, lineHeight:1.4 }}>{task.title}</div>

        {task.description && (
          <div style={{ fontSize:12, color:"#9CA3AF", lineHeight:1.5, marginBottom:8 }}>{task.description}</div>
        )}

        <div style={{
          maxHeight: hovered ? 800 : 0, // İçerik uzayabileceği için max-height'i artırdım
          opacity: hovered ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 0.3s cubic-bezier(.4,0,.2,1), opacity 0.2s",
        }}>
          {/* Tarih Özeti */}
          <div style={{ borderTop:"1px solid #F3F4F6", marginTop:8, paddingTop:10, display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 12px" }}>
            {[
              { label:"📅 Planned Start", val:plannedStart },
              { label:"🏁 Planned End",   val:plannedEnd   },
              { label:"▶ Actual Start",  val:actualStart  },
              { label:"✅ Actual End",    val:actualEnd    },
            ].map(({ label, val }) => (
              <div key={label}>
                <div style={{ fontSize:10, color:"#9CA3AF", fontWeight:600, marginBottom:1 }}>{label}</div>
                <div style={{ fontSize:11, color:val?"#111827":"#D1D5DB", fontWeight:val?500:400 }}>{val||"—"}</div>
              </div>
            ))}
          </div>

          {/* YENİ: Kategoriye Göre Gruplandırılmış Faz Listesi */}
          {phases.length > 0 && (
            <div style={{ marginTop: 12, borderTop:"1px solid #F3F4F6", paddingTop: 10 }}>
              <div style={{ fontSize:10, color:"#9CA3AF", fontWeight:700, marginBottom:6, letterSpacing:"0.05em" }}>PROJECT PHASES</div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {topics.map(topicName => {
                  const topicPhases = phases.filter(ph => ph.topic === topicName).sort((a,b)=>a.position-b.position);
                  if (topicPhases.length === 0) return null;
                  
                  const ts = TOPIC_STYLE[topicName] || { text: "#374151" };

                  return (
                    <div key={topicName} style={{ background: "#F9FAFB", borderRadius: 6, padding: "6px 8px", border: "1px solid #E5E7EB" }}>
                      {/* Kategori Başlığı */}
                      <div style={{ fontSize: 9, fontWeight: 700, color: ts.text, marginBottom: 4, letterSpacing: "0.05em" }}>
                        {topicName.toUpperCase()}
                      </div>
                      
                      {/* O Kategoriye Ait Fazlar */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {topicPhases.map(ph => {
                          const phColor = ph.status==="done"?"#059669":ph.status==="active"?"#F59E0B":"#6B7280";
                          return (
                            <div key={ph.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 5, overflow: "hidden" }}>
                                <div style={{ width: 5, height: 5, borderRadius: "50%", background: phColor, flexShrink: 0 }} />
                                <span style={{ fontSize: 10, color: "#4B5563", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {ph.name}
                                </span>
                              </div>
                              <span style={{ fontSize: 9, color: "#9CA3AF", flexShrink: 0, marginLeft: 8 }}>
                                {ph.start_date ? `${ph.start_date.slice(5)} / ${ph.end_date?.slice(5)||'?'}` : 'No date'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ marginTop:12, display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:col.color }} />
            <span style={{ fontSize:11, color:col.color, fontWeight:600 }}>{col.label}</span>
            {isOverdue && (
              <span style={{ fontSize:10, background:"#FEF2F2", color:"#DC2626", padding:"1px 6px", borderRadius:4, fontWeight:600, marginLeft:"auto" }}>⚠ OVERDUE</span>
            )}
          </div>
        </div>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:10 }}>
          {assignees.length === 0
            ? <span style={{ fontSize:11, color:"#D1D5DB" }}>Unassigned</span>
            : (
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ display:"flex" }}>
                  {assignees.slice(0,4).map((a,i) => (
                    <div key={a.id} style={{ marginLeft:i>0?-8:0 }}>
                      <Avatar name={a.name} size={22} idx={i} />
                    </div>
                  ))}
                </div>
                {assignees.length===1
                  ? <span style={{ fontSize:11, color:"#6B7280" }}>{assignees[0].name}</span>
                  : assignees.length>4
                    ? <span style={{ fontSize:11, color:"#6B7280" }}>+{assignees.length-4} more</span>
                    : <span style={{ fontSize:11, color:"#6B7280" }}>{assignees.length} members</span>
                }
              </div>
            )
          }
          {task.deadline && (
            <span style={{
              fontSize:11, fontWeight:isOverdue?600:400,
              color:isOverdue?"#DC2626":"#9CA3AF",
              background:isOverdue?"#FEF2F2":"transparent",
              padding:isOverdue?"1px 6px":"0", borderRadius:4,
            }}>
              {isOverdue?"⚠ ":""}{task.deadline.slice(0,10)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}