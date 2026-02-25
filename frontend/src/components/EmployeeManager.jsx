import { useState } from "react";
import { inp } from "../constants/index.js";
import Avatar from "./Avatar.jsx";

export default function EmployeeManager({ employees, onAdd, onDelete, onClose }) {
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