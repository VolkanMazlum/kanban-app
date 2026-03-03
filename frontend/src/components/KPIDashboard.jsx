import { TOPIC_STYLE } from "../constants/index.js";
import Avatar from "./Avatar.jsx";
import { useState, useEffect } from "react";
import * as api from "../api.js";


function MiniGantt({ phases, monthStart, monthEnd }) {
  const start  = new Date(monthStart);
  const end    = new Date(monthEnd);
  start.setHours(0,0,0,0);
  end.setHours(0,0,0,0);
  const totalDays = Math.round((end - start) / 86400000) + 1;

  // Gün başlıkları
  const days = [];
  const cur = new Date(start);
  while (cur <= end) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }

  return (
    <div style={{padding:"12px 16px"}}>
      {/* Gün çizgisi */}
      <div style={{position:"relative",marginBottom:8}}>
        <div style={{display:"flex",height:20,borderRadius:4,overflow:"hidden",background:"#E5E7EB"}}>
          {[...Array(Math.ceil(totalDays/7))].map((_,wi)=>(
            <div key={wi} style={{flex:`0 0 ${(7/totalDays)*100}%`,fontSize:9,color:"#9CA3AF",display:"flex",alignItems:"center",justifyContent:"center",borderRight:"1px solid #D1D5DB"}}>
              W{wi+1}
            </div>
          ))}
        </div>
      </div>

      {/* Phase barları */}
      <div style={{display:"flex",flexDirection:"column",gap:4}}>
        {phases.map(ph => {
          const phStart = new Date(Math.max(new Date(ph.start_date), start));
          const phEnd   = new Date(Math.min(new Date(ph.end_date), end));
          phStart.setHours(0,0,0,0);
          phEnd.setHours(0,0,0,0);
          if (phStart > phEnd) return null;

          const off   = Math.round((phStart - start) / 86400000);
          const span  = Math.max(Math.round((phEnd - phStart) / 86400000) + 1, 1);
          const left  = `${(off / totalDays) * 100}%`;
          const width = `${Math.min((span / totalDays) * 100, 100 - (off/totalDays)*100)}%`;
          const phColor = ph.status==="done"?"#059669":ph.status==="active"?"#F59E0B":"#6B7280";

          return (
            <div key={ph.phase_id} style={{position:"relative",height:24}}>
              {/* Task adı solda */}
              <div style={{position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",width:"20%",fontSize:10,color:"#6B7280",fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",paddingRight:4}}>
                {ph.task_title}
              </div>
              {/* Bar */}
              <div style={{position:"absolute",left:"20%",right:0,height:"100%"}}>
                <div
                  title={`${ph.phase_name}\n${ph.start_date} → ${ph.end_date}\n${ph.estimated_hours ? ph.estimated_hours+'h est.' : ''}`}
                  style={{
                    position:"absolute", left, width,
                    height:20, top:"50%", transform:"translateY(-50%)",
                    borderRadius:4, background:phColor, opacity:0.9,
                    display:"flex", alignItems:"center", padding:"0 6px",
                    overflow:"hidden", cursor:"default",
                    boxShadow:"0 1px 3px rgba(0,0,0,0.1)"
                  }}
                >
                  <span style={{fontSize:9,color:"#fff",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                    {ph.status==="done"?"✓ ":""}{ph.phase_name}
                    {ph.estimated_hours ? ` · ${ph.estimated_hours}h` : ""}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default function KPIDashboard({ kpi, employees }) {
  if (!kpi) return <div style={{padding:40,textAlign:"center",color:"#9CA3AF",fontFamily:"'Inter',sans-serif",fontSize:14}}>Loading KPIs...</div>;

  const { summary, by_status, by_topic = [], per_employee, trend } = kpi;
  const maxTrend = Math.max(...trend.map(t=>t.completed), 1);
  const [maxCapacity, setMaxCapacity] = useState(250);
  const [editingCapacity, setEditingCapacity] = useState(false);
  const [tempCapacity, setTempCapacity] = useState(250);

  const [monthlyData, setMonthlyData]       = useState(null);
  const [monthAnchor, setMonthAnchor]       = useState(0); // 0 = bu ay, -1 = geçen ay
  const [expandedEmp, setExpandedEmp]       = useState(null);
  const [loadingMonthly, setLoadingMonthly] = useState(false);  
  const targetDate  = new Date();
  targetDate.setMonth(targetDate.getMonth() + monthAnchor);
  const targetYear  = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth() + 1;
  const monthLabel  = targetDate.toLocaleString("en-US", { month: "long", year: "numeric" });

useEffect(() => {
  setLoadingMonthly(true);
  api.getWorkloadMonthly(targetYear, targetMonth)
    .then(setMonthlyData)
    .catch(console.error)
    .finally(() => setLoadingMonthly(false));
}, [monthAnchor]);


  useEffect(() => {
    api.getSettings().then(s => {
      const val = parseInt(s.max_capacity || "250");
      setMaxCapacity(val);
      setTempCapacity(val);
    }).catch(console.error);
  }, []);

  const handleCapacitySave = async () => {
    await api.updateSetting("max_capacity", String(tempCapacity));
    setMaxCapacity(tempCapacity);
    setEditingCapacity(false);
  };
  const MAX_CAPACITY = maxCapacity;

  const cards = [
    { icon:"📋", label:"Total Tasks",        val: summary.total,                color:"#2563EB", bg:"#EFF6FF" },
    { icon:"✅", label:"Done This Month",     val: summary.completed_month,      color:"#059669", bg:"#ECFDF5" },
    { icon:"⚡", label:"In Progress",         val: by_status.process||0,         color:"#0891B2", bg:"#ECFEFF" },
    { icon:"🚫", label:"Blocked",             val: by_status.blocked||0,         color:"#DC2626", bg:"#FEF2F2" },
    { icon:"⏰", label:"Overdue",             val: summary.overdue,              color:"#EA580C", bg:"#FFF7ED" },
    { icon:"📅", label:"Avg. Days to Done",   val:`${summary.avg_days_to_complete||0}d`, color:"#0369A1", bg:"#E0F2FE" },
    { icon:"⏱️", label:"Total Est. Hours",    val: monthlyData ? monthlyData.employees.reduce((sum,emp)=>sum+parseFloat(emp.phase_hours||0),0).toFixed(0) : 0, color:"#7C3AED", bg:"#F5F3FF" },
    { icon:"👥", label:"Team Size",           val: summary.working_employees_res,             color:"#374151", bg:"#F9FAFB" },
  ];

  return (
    <div style={{padding:"28px 32px",overflowY:"auto",height:"calc(100vh - 65px)",fontFamily:"'Inter',sans-serif",background:"#F9FAFB"}}>
      <div style={{marginBottom:24}}>
        <h2 style={{fontSize:22,fontWeight:700,color:"#111827",margin:"0 0 4px"}}>Performance Dashboard</h2>
        <p style={{color:"#6B7280",margin:0,fontSize:14}}>Company-wide KPIs and hourly workload — TEKSER S.R.L.</p>
      </div>
      
      
      <div style={{padding:"18px 24px",borderBottom:"1px solid #F3F4F6",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <h3 style={{fontSize:14,fontWeight:700,color:"#111827",margin:0}}>Team Workload</h3>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {editingCapacity ? (
            <>
              <input type="number" value={tempCapacity}
                onChange={e=>setTempCapacity(parseInt(e.target.value))}
                style={{width:70,border:"1.5px solid #2563EB",borderRadius:6,padding:"4px 8px",fontSize:12,textAlign:"center"}}
              />
              <button onClick={handleCapacitySave} style={{background:"#2563EB",color:"#fff",border:"none",borderRadius:6,padding:"4px 10px",fontSize:12,cursor:"pointer",fontWeight:600}}>Save</button>
              <button onClick={()=>setEditingCapacity(false)} style={{background:"#F3F4F6",color:"#374151",border:"none",borderRadius:6,padding:"4px 10px",fontSize:12,cursor:"pointer"}}>Cancel</button>
            </>
          ) : (
            <span onClick={()=>setEditingCapacity(true)}
              style={{fontSize:12,color:"#6B7280",cursor:"pointer",padding:"4px 8px",borderRadius:6,border:"1px dashed #E5E7EB"}}
              title="Click to edit"
            >
              {employees.length} members · Max <strong>{MAX_CAPACITY}h</strong>/person ✏️
            </span>
          )}
        </div>
      </div>

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

      {/* ── Aylık Workload Section ── */}
      <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",overflow:"hidden",marginTop:20}}>
        
        {/* Header + Ay Navigasyonu */}
        <div style={{padding:"18px 24px",borderBottom:"1px solid #F3F4F6",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <h3 style={{fontSize:14,fontWeight:700,color:"#111827",margin:"0 0 2px"}}>Monthly Phase Workload</h3>
            <p style={{fontSize:12,color:"#6B7280",margin:0}}>Click a member to see their phase timeline</p>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button onClick={()=>setMonthAnchor(a=>a-1)} style={{background:"#fff",border:"1.5px solid #E5E7EB",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:12,color:"#374151",fontWeight:600}}>←</button>
            <span style={{fontSize:13,fontWeight:700,color:"#111827",minWidth:140,textAlign:"center"}}>{monthLabel}</span>
            <button onClick={()=>setMonthAnchor(a=>a+1)} style={{background:"#fff",border:"1.5px solid #E5E7EB",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:12,color:"#374151",fontWeight:600}}>→</button>
            <button onClick={()=>setMonthAnchor(0)} style={{background:"#2563EB",color:"#fff",border:"none",borderRadius:7,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:600}}>This Month</button>
          </div>
        </div>

        {loadingMonthly ? (
          <div style={{padding:32,textAlign:"center",color:"#9CA3AF",fontSize:13}}>Loading...</div>
        ) : (
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{background:"#F9FAFB"}}>
                {["Team Member","Phase Hours","Workload","Phases"].map(h=>(
                  <th key={h} style={{padding:"10px 16px",fontSize:11,fontWeight:700,color:"#6B7280",textAlign:h==="Team Member"?"left":"center",letterSpacing:"0.05em"}}>{h.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(monthlyData?.employees||[]).map((emp,i)=>{
                const hours = parseFloat(emp.phase_hours) || 0;
                const pct   = Math.min(Math.round((hours / MAX_CAPACITY) * 100), 100);
                const barColor = pct>75?"#DC2626":pct>40?"#D97706":"#059669";
                const isExpanded = expandedEmp === emp.id;
                const phases = emp.phases || [];

                return (
                  <>
                    <tr key={emp.id}
                      onClick={()=>setExpandedEmp(isExpanded ? null : emp.id)}
                      style={{borderTop:"1px solid #F3F4F6",cursor:"pointer",background:isExpanded?"#F0F7FF":"#fff",transition:"background 0.15s"}}
                    >
                      <td style={{padding:"12px 16px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <Avatar name={emp.name} size={32} idx={i}/>
                          <div style={{fontSize:13,fontWeight:600,color:"#111827"}}>{emp.name}</div>
                        </div>
                      </td>
                      <td style={{padding:"12px 16px",textAlign:"center"}}>
                        <span style={{fontSize:14,fontWeight:700,color:barColor}}>{Math.round(hours)}h</span>
                      </td>
                      <td style={{padding:"12px 16px",width:160}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{flex:1,background:"#F3F4F6",borderRadius:4,height:8}}>
                            <div style={{background:barColor,width:`${pct}%`,height:"100%",borderRadius:4}}/>
                          </div>
                          <span style={{fontSize:11,color:barColor,fontWeight:700,width:36}}>{pct}%</span>
                        </div>
                      </td>
                      <td style={{padding:"12px 16px",textAlign:"center"}}>
                        <span style={{fontSize:12,color:"#6B7280"}}>{phases.length} phase{phases.length!==1?"s":""} {isExpanded?"▲":"▼"}</span>
                      </td>
                    </tr>

                    {/* Expanded: Mini Gantt */}
                    {isExpanded && phases.length > 0 && (
                      <tr key={`${emp.id}-detail`} style={{borderTop:"1px solid #E5E7EB"}}>
                        <td colSpan={4} style={{padding:"0 0 0 0",background:"#F8FAFF"}}>
                          <MiniGantt phases={phases} monthStart={monthlyData.monthStart} monthEnd={monthlyData.monthEnd} />
                        </td>
                      </tr>
                    )}

                    {isExpanded && phases.length === 0 && (
                      <tr key={`${emp.id}-empty`}>
                        <td colSpan={4} style={{padding:"16px 24px",textAlign:"center",color:"#9CA3AF",fontSize:13,background:"#F8FAFF"}}>
                          No phases assigned this month
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>



    </div>
  );
}