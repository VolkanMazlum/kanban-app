import { TOPIC_STYLE } from "../constants/index.js";
import Avatar from "./Avatar.jsx";

export default function KPIDashboard({ kpi, employees }) {
  if (!kpi) return <div style={{padding:40,textAlign:"center",color:"#9CA3AF",fontFamily:"'Inter',sans-serif",fontSize:14}}>Loading KPIs...</div>;

  const { summary, by_status, by_topic = [], per_employee, trend } = kpi;
  const maxTrend = Math.max(...trend.map(t=>t.completed), 1);
  const MAX_CAPACITY = parseInt(import.meta.env.VITE_MAX_CAPACITY || "250");

  const cards = [
    { icon:"📋", label:"Total Tasks",        val: summary.total,                color:"#2563EB", bg:"#EFF6FF" },
    { icon:"✅", label:"Done This Month",     val: summary.completed_month,      color:"#059669", bg:"#ECFDF5" },
    { icon:"⚡", label:"In Progress",         val: by_status.process||0,         color:"#0891B2", bg:"#ECFEFF" },
    { icon:"🚫", label:"Blocked",             val: by_status.blocked||0,         color:"#DC2626", bg:"#FEF2F2" },
    { icon:"⏰", label:"Overdue",             val: summary.overdue,              color:"#EA580C", bg:"#FFF7ED" },
    { icon:"📅", label:"Avg. Days to Done",   val:`${summary.avg_days_to_complete||0}d`, color:"#0369A1", bg:"#E0F2FE" },
    { icon:"⏱️", label:"Total Est. Hours",    val: per_employee.reduce((sum,emp)=>sum+(emp.estimated_workload_hours||0),0).toFixed(0), color:"#7C3AED", bg:"#F5F3FF" },
    { icon:"👥", label:"Team Size",           val: employees.length,             color:"#374151", bg:"#F9FAFB" },
  ];

  return (
    <div style={{padding:"28px 32px",overflowY:"auto",height:"calc(100vh - 65px)",fontFamily:"'Inter',sans-serif",background:"#F9FAFB"}}>
      <div style={{marginBottom:24}}>
        <h2 style={{fontSize:22,fontWeight:700,color:"#111827",margin:"0 0 4px"}}>Performance Dashboard</h2>
        <p style={{color:"#6B7280",margin:0,fontSize:14}}>Company-wide KPIs and hourly workload — TEKSER S.R.L.</p>
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
              const estimatedHours = emp.estimated_workload_hours;
              const capacityPct = Math.round((estimatedHours/MAX_CAPACITY)*100);
              const displayPct = capacityPct>100?"100+":capacityPct;
              const pct = Math.min(capacityPct,100);
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