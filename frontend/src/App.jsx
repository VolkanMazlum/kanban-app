import { useState, useEffect, useRef, useCallback } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import * as api from "./api.js";
import { COLUMNS } from "./constants/index.js";
import Toast from "./components/Toast.jsx";
import TaskModal from "./components/TaskModal.jsx";
import TaskCard from "./components/TaskCard.jsx";
import EmployeeManager from "./components/EmployeeManager.jsx";
import GanttChart from "./components/GanttChart.jsx";
import KPIDashboard from "./components/KPIDashboard.jsx";
import CostDashboard from "./components/CostDashboard.jsx";
import HRFinanceDashboard from "./components/HRFinanceDashboard.jsx";
import Login from "./components/Login.jsx";

export default function App() {
  const [tasks, setTasks]         = useState([]);
  const [employees, setEmployees] = useState([]);
  const [kpi, setKpi]             = useState(null);
  const [filterEmpId, setFilter]  = useState("all");
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [modal, setModal]         = useState(null);
  const [dragOver, setDragOver]   = useState(null);
  const [toasts, setToasts]       = useState([]);
  const dragId = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();

  const token = localStorage.getItem("token");
  const isHR = localStorage.getItem("isHR") === "true";
  const isAuthenticated = !!token;

  useEffect(() => {
    // Redirect to login if not authenticated and not already on login page
    if (!isAuthenticated && location.pathname !== "/login") {
      navigate("/login");
    }
  }, [isAuthenticated, location.pathname, navigate]);

  const toast = useCallback((msg, type="success") => {
    const id = Date.now();
    setToasts(p => [...p, {id, msg, type}]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  }, []);

  const loadAll = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [t, e, k] = await Promise.all([
        api.getTasks(), 
        api.getEmployees(), 
        isHR ? api.getKPI() : Promise.resolve(null)
      ]);
      setTasks(t); setEmployees(e); setKpi(k); setError(null);
    } catch(err) { 
      setError(err.message);
      if (err.message.includes("Token") || err.message.includes("Authentication required") || err.message.includes("Invalid or expired") || err.message.includes("401")) {
        localStorage.removeItem("token");
        localStorage.removeItem("isHR");
        navigate("/login");
      }
    } finally { setLoading(false); }
  }, [isAuthenticated, isHR, navigate]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("isHR");
    navigate("/login");
  };

  const handleDrop = async (e, colId) => {
    e.preventDefault(); setDragOver(null);
    const id = dragId.current; if (!id) return;
    setTasks(p => p.map(t => t.id === id ? {...t, status: colId} : t));
    try {
      await api.patchTaskStatus(id, colId);
      if (isHR) {
        const k = await api.getKPI(); setKpi(k);
      }
    } catch(err) { toast(err.message, "error"); loadAll(); }
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
        savedTaskId = created.id;
        toast("Task created");
      }
      if (phases && phases.length > 0 && savedTaskId) {
        await api.saveTaskPhases(savedTaskId, phases);
      }
      const [t, k] = await Promise.all([api.getTasks(), isHR ? api.getKPI() : Promise.resolve(null)]);
      setTasks(t); setKpi(k);
      setModal(null);
    } catch(err) { toast(err.message, "error"); }
  };

  const handleDelete = async (id) => {
    setTasks(p => p.filter(t => t.id !== id));
    try {
      await api.deleteTask(id);
      if (isHR) {
        const k = await api.getKPI(); setKpi(k);
      }
      toast("Task deleted");
    } catch(err) { toast(err.message, "error"); loadAll(); }
  };

  const handleEmpAdd = async (name, role) => {
    try {
      const e = await api.createEmployee(name, role);
      setEmployees(p => [...p, e]); toast(`${e.name} added`);
      if (isHR) {
        const k = await api.getKPI(); setKpi(k);
      }
    } catch(err) { toast(err.message, "error"); }
  };

  const handleEmpDelete = async (id) => {
    setEmployees(p => p.filter(e => e.id !== id));
    try {
      await api.deleteEmployee(id);
      const [t, k] = await Promise.all([api.getTasks(), isHR ? api.getKPI() : Promise.resolve(null)]);
      setTasks(t); setKpi(k); toast("Member removed");
    } catch(err) { toast(err.message, "error"); loadAll(); }
  };

  const filtered = filterEmpId === "all"
    ? tasks
    : tasks.filter(t => {
        const matchAssignee = (t.assignees || []).some(a => Number(a.id) === Number(filterEmpId));
        const matchPhase = (t.phases || []).some(ph => {
          const ass = ph.assignee_hours || ph.assignees || [];
          return ass.some(a => Number(a.id) === Number(filterEmpId));
        });
        return matchAssignee || matchPhase;
      });

  if (location.pathname === "/login") {
    return <Login onLoginSuccess={() => loadAll()} />;
  }

    const TABS = [
      { id: "/", label: "📋 Board" },
      { id: "/gantt", label: "📅 Gantt" },
      { id: "/costs", label: "⏳ Timesheet & Labor" },
      ...(isHR ? [
        { id: "/finances", label: "📈 Finances & HR" },
        { id: "/kpi", label: "📊 KPIs" }
      ] : [])
    ];

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
          <div style={{display:"flex",background:"#F3F4F6",borderRadius:8,padding:3,marginLeft:20, flexWrap: "wrap"}}>
            {TABS.map(tab=>(
              <button key={tab.id} onClick={()=>navigate(tab.id)} style={{
                padding:"6px 16px",borderRadius:6,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,
                fontFamily:"'Inter',sans-serif",
                background: location.pathname === tab.id ? "#fff" : "transparent",
                color: location.pathname === tab.id ? "#111827" : "#6B7280",
                boxShadow: location.pathname === tab.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition:"all 0.15s",
              }}>{tab.label}</button>
            ))}

            <button onClick={handleLogout} style={{
              background:"#FEF2F2", border:"1.5px solid #FECACA",
              borderRadius:8, padding:"6px 14px", color:"#DC2626",
              fontSize:12, cursor:"pointer", fontWeight:600, marginLeft: 12
            }}>Logout</button>
          </div>
        </div>

        {location.pathname === "/" && (
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
          {location.pathname === "/" && (
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
      <div style={{ height: "calc(100vh - 65px)", overflow: "hidden" }}>
        {loading ? (
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",flexDirection:"column",gap:12,color:"#9CA3AF",fontSize:13}}>
            <div style={{width:32,height:32,border:"3px solid #E5E7EB",borderTop:"3px solid #2563EB",borderRadius:"50%",animation:"spin 0.7s linear infinite"}} />
            Loading...
          </div>
        ) : error ? (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:12}}>
            <div style={{color:"#DC2626",fontSize:14}}>⚠ {error}</div>
            <button onClick={loadAll} style={{background:"#2563EB",color:"#fff",border:"none",borderRadius:8,padding:"8px 20px",fontFamily:"'Inter',sans-serif",fontSize:13,cursor:"pointer"}}>Retry</button>
          </div>
        ) : (
          <Routes>
            <Route path="/" element={
              <div style={{display:"flex",height:"100%",overflow:"hidden"}}>
                {COLUMNS.map((col, i) => {
                  const colTasks = filtered.filter(t => t.status === col.id);
                  const isDrop = dragOver === col.id;
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
                      <div style={{flex:1,overflowY:"auto",padding:14,minHeight:0}}>
                        {colTasks.length === 0 && (
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
            } />
            <Route path="/gantt" element={<GanttChart tasks={tasks} employees={employees} />} />
            <Route path="/costs" element={<CostDashboard employees={employees} isHR={isHR} />} />
            
            {/* HR Only Routes */}
            {isHR && (
              <>
                <Route path="/finances" element={<HRFinanceDashboard isHR={isHR} />} />
                <Route path="/kpi" element={<KPIDashboard kpi={kpi} employees={employees} tasks={tasks} />} />
              </>
            )}

            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </div>

      {modal?.type==="task" && <TaskModal task={modal.task} employees={employees} onSave={handleTaskSave} onClose={()=>setModal(null)} />}
      {modal?.type==="employees" && <EmployeeManager employees={employees} onAdd={handleEmpAdd} onDelete={handleEmpDelete} onClose={()=>setModal(null)} />}
      
      <Toast toasts={toasts} />
    </div>
  );
}
