import Avatar from "./Avatar.jsx";

export default function AssigneePicker({ employees, selectedIds, onChange }) {
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