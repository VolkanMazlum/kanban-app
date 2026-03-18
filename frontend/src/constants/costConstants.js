export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const ANNUAL_HOURS = 2000;

export const GENERAL_COST_FIELDS = [
  { key: "rent", label: "Rent", icon: "🏢", color: "#ff0000ff" },
  { key: "operating", label: "Operating Cost", icon: "⚙️", color: "#ff0000ff" },
  { key: "equipment", label: "Equipment", icon: "🔧", color: "#ff0000ff" },
  { key: "unexpected", label: "Unexpected Cost", icon: "⚠️", color: "#ff0000ff" },
];

export const getEmptyLine = () => ({
  attivita: "", descrizione: "", valore_ordine: "", fatturato_amount: "",
  rimanente_probabile: "", proforma: "", invoice_date: "", note: "",
  ordini: []
});

export const getEmptyClient = () => ({
  client_id: "", n_cliente: "", n_ordine: "", preventivo: "", ordine: "",
  n_ordine_zucchetti: "", voce_bilancio: "",
  lines: [getEmptyLine()]
});

export const getEmptyForm = () => ({
  task_id: "", comm_number: "", name: "",
  clients: [getEmptyClient()]
});

// Ortak input stili
export const inpStyle = {
  border: "1.5px solid #E5E7EB",
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 13,
  color: "#111827",
  fontFamily: "'Inter',sans-serif",
  width: "100%",
  outline: "none"
};