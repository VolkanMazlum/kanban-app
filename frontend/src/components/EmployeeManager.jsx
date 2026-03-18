import { useState } from "react";
import { inp } from "../constants/index.js";
import Avatar from "./Avatar.jsx";

export default function EmployeeManager({ employees, isHR, onAdd, onDelete, onClose }) {
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd(name, position);
    setName("");
    setPosition("");
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(17,24,39,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,backdropFilter:"blur(4px)"}}>
      <div style={{background:"#fff",borderRadius:16,padding:28,width:460,boxShadow:"0 20px 60px rgba(0,0,0,0.15)",fontFamily:"'Inter',sans-serif"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
          <div>
            <div style={{fontSize:10,color:"#9CA3AF",letterSpacing:"0.1em",fontWeight:600,marginBottom:2}}>MANAGEMENT</div>
            <h3 style={{color:"#111827",margin:0,fontSize:18,fontWeight:700}}>Team Members</h3>
          </div>
          <button onClick={onClose} style={{background:"#F3F4F6",border:"none",borderRadius:8,width:32,height:32,cursor:"pointer",color:"#6B7280",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>

        {/* Create Form - Admin Only */}
        {isHR && (
          <div style={{display:"flex",gap:8,marginBottom:20,alignItems:"flex-end"}}>
            <div style={{flex:2}}>
              <div style={{fontSize:10,fontWeight:600,color:"#6B7280",marginBottom:4,marginLeft:2}}>FULL NAME</div>
              <input 
                placeholder="e.g. Mario Rossi" 
                value={name} 
                onChange={e=>setName(e.target.value)}
                style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid #E5E7EB",fontSize:13}}
              />
            </div>
            <div style={{flex:1.5}}>
              <div style={{fontSize:10,fontWeight:600,color:"#6B7280",marginBottom:4,marginLeft:2}}>POSITION</div>
              <input 
                placeholder="e.g. Architect" 
                value={position} 
                onChange={e=>setPosition(e.target.value)}
                style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid #E5E7EB",fontSize:13}}
              />
            </div>
            <button 
              onClick={handleAdd}
              style={{background:"#2563EB",color:"#fff",border:"none",borderRadius:8,height:38,padding:"0 16px",fontWeight:600,cursor:"pointer",fontSize:13}}
            >
              Add
            </button>
          </div>
        )}

        <div style={{maxHeight:400,overflowY:"auto",borderTop:"1px solid #F3F4F6"}}>
          {employees.filter(e => e.is_active !== false).map((emp,i)=>(
            <div key={emp.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:"1px solid #F3F4F6"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <Avatar name={emp.name} size={36} idx={i} />
                <div>
                  <div style={{fontSize:14,fontWeight:600,color:"#111827"}}>{emp.name}</div>
                  <div style={{fontSize:12,color:"#6B7280"}}>{emp.position || "No position set"}</div>
                </div>
              </div>
              {isHR && (
                <button 
                  onClick={()=>onDelete(emp.id)}
                  style={{background:"transparent",border:"none",color:"#DC2626",fontSize:11,fontWeight:600,cursor:"pointer",opacity:0.6}}
                  onMouseEnter={e=>e.currentTarget.style.opacity=1}
                  onMouseLeave={e=>e.currentTarget.style.opacity=0.6}
                >
                  REMOVE
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}