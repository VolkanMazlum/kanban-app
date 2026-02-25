export default function Toast({ toasts }) {
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