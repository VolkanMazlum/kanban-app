import { AVATAR_PALETTES } from "../constants/index.js";

export default function Avatar({ name, size=28, idx=0 }) {
  const [bg,fg] = AVATAR_PALETTES[idx % AVATAR_PALETTES.length];
  const initials = (name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  return (
    <div title={name} style={{
      width:size, height:size, borderRadius:"50%", background:bg, color:fg,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:size*0.36, fontWeight:"700", flexShrink:0,
      border:"2px solid #fff", boxSizing:"content-box",
    }}>{initials}</div>
  );
}