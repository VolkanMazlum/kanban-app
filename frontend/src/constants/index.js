export const COLUMNS = [
  { id: "new",     label: "NEW",        color: "#2563EB", light: "#EFF6FF", dot: "#BFDBFE" },
  { id: "process", label: "IN PROCESS", color: "#059669", light: "#ECFDF5", dot: "#A7F3D0" },
  { id: "blocked", label: "BLOCKED",    color: "#DC2626", light: "#FEF2F2", dot: "#FECACA" },
  { id: "done",    label: "DONE",       color: "#7C3AED", light: "#F5F3FF", dot: "#DDD6FE" },
];

export const TOPICS = [
  "MEP", "ENERGY", "SUSTAINABILITY", "ACUSTIC", 
  "VVF", "STRUCTURE", "GEOTHERMAL", "HYDRAULIC INVARIANCE", 
  "CONTINUOUS COMMISSIONING"
];

export const TOPIC_STYLE = {
  "MEP":                      { bg: "#DBEAFE", text: "#1D4ED8", border: "#BFDBFE" }, // Blue
  "ENERGY":                   { bg: "#FEF3C7", text: "#B45309", border: "#FDE68A" }, // Yellow/Orange
  "SUSTAINABILITY":           { bg: "#D1FAE5", text: "#065F46", border: "#A7F3D0" }, // Green
  "ACUSTIC":                  { bg: "#EDE9FE", text: "#6D28D9", border: "#DDD6FE" }, // Purple
  "VVF":                      { bg: "#FEE2E2", text: "#991B1B", border: "#FECACA" }, // Red
  "STRUCTURE":                { bg: "#F3F4F6", text: "#374151", border: "#E5E7EB" }, // Gray
  "GEOTHERMAL":               { bg: "#E0F2FE", text: "#0369A1", border: "#BAE6FD" }, // Light Blue
  "HYDRAULIC INVARIANCE":     { bg: "#FDF4FF", text: "#7E22CE", border: "#E9D5FF" }, // Pink
  "CONTINUOUS COMMISSIONING": { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" }, // Dark Green
};

export const AVATAR_PALETTES = [
  ["#DBEAFE","#1E40AF"],["#D1FAE5","#065F46"],["#FEE2E2","#991B1B"],
  ["#EDE9FE","#5B21B6"],["#FEF3C7","#92400E"],["#E0F2FE","#075985"],
];

export const inp = {
  width:"100%", background:"#fff", border:"1.5px solid #E5E7EB",
  borderRadius:"8px", padding:"9px 12px", color:"#111827",
  fontSize:"13px", fontFamily:"'Inter',sans-serif",
  boxSizing:"border-box", outline:"none",
};