/**
 * Offerte Constants
 * Service categories aligned with R04 Excel structure AND existing phase_templates/attivita values
 */

// ── OFFER STATUSES ──
export const OFFER_STATUSES = [
  { id: "aperta",        label: "Aperta",        color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE", icon: "📨" },
  { id: "revisione",     label: "Revisione",     color: "#F59E0B", bg: "#FFFBEB", border: "#FDE68A", icon: "🔄" },
  { id: "accettata",     label: "Accettata",      color: "#059669", bg: "#ECFDF5", border: "#A7F3D0", icon: "✅" },
  { id: "non_accettata", label: "Non Accettata", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", icon: "❌" },
  { id: "parziale",      label: "Parzialmente Accettata", color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE", icon: "⚡" },
];

// ── OFFER TYPES ──
export const OFFER_TYPES = [
  { id: "P", label: "Preventivo" },
  { id: "G", label: "Gara" },
];

// ── LINE STATUS (per-activity acceptance) ──
export const LINE_STATUSES = [
  { id: "pending",    label: "In attesa",    color: "#6B7280" },
  { id: "accepted",   label: "Accettata",    color: "#059669" },
  { id: "rejected",   label: "Non Accettata", color: "#DC2626" },
  { id: "revised",    label: "Revisionata",  color: "#F59E0B" },
];

// ── ENTITY ROLES (Client / Supplier / Both) ──
export const ENTITY_ROLES = [
  { id: "client",   label: "Cliente",    color: "#2563EB" },
  { id: "supplier", label: "Fornitore",  color: "#F59E0B" },
  { id: "both",     label: "Entrambi",   color: "#7C3AED" },
];

// ── SERVICE CATEGORY GROUPS ──
// Each category contains sub-activities that match the existing phase_templates/attivita values
export const SERVICE_CATEGORIES = [
  {
    id: "PROG_CAD",
    label: "PROG CAD",
    color: "#2563EB",
    bg: "#EFF6FF",
    topic: "MEP",
    activities: [
      { key: "Studio di Fattibilità",                 label: "Studio di Fattibilità" },
      { key: "Progetto Preliminare",                  label: "Progetto Preliminare" },
      { key: "Progetto Definitivo",                   label: "Progetto Definitivo" },
      { key: "Progetto Esecutivo per Appalto",        label: "Progetto Esecutivo per Appalto" },
    ]
  },
  {
    id: "PROG_BIM",
    label: "PROG BIM",
    color: "#6366F1",
    bg: "#EEF2FF",
    topic: "MEP",
    activities: [
      // While generic BIM isn't natively in phase_templates, we map the most common convention 
      // or we can just append BIM to standard phases for custom tracking
      { key: "Studio di Fattibilità BIM",             label: "Studio di Fattibilità BIM" },
      { key: "Progetto Preliminare in BIM",           label: "Progetto Preliminare in BIM" },
      { key: "Progetto Definitivo in BIM",            label: "Progetto Definitivo in BIM" },
      { key: "Progetto Esecutivo in BIM",             label: "Progetto Esecutivo in BIM" },
      { key: "BIM modelling",                         label: "Modellazione BIM (Base)" },
    ]
  },
  {
    id: "CANTIERE",
    label: "CANTIERE",
    color: "#059669",
    bg: "#ECFDF5",
    topic: "MEP",
    activities: [
      { key: "Direzione lavori Impianti",             label: "Direzione lavori Impianti" },
      { key: "Collaudi tecnico-funzionali MEP",       label: "Collaudi tecnico-funzionali" },
      { key: "Assistenza ai Collaudi MEP",            label: "Assistenza ai Collaudi" },
    ]
  },
  {
    id: "ENERGIA",
    label: "ENERGIA",
    color: "#F59E0B",
    bg: "#FFFBEB",
    topic: "ENERGY",
    activities: [
      { key: "APE",                                   label: "APE" },
      { key: "Diagnosi Energetica",                   label: "Diagnosi Energetica" },
      { key: "Legge 10/91",                           label: "Legge 10/91" },
    ]
  },
  {
    id: "SOSTENIBILITA",
    label: "SOSTENIBILITÀ",
    color: "#10B981",
    bg: "#D1FAE5",
    topic: "SUSTAINABILITY",
    activities: [
      { key: "LEED",                                  label: "LEED" },
      { key: "BREEAM",                                label: "BREEAM" },
      { key: "WELL",                                  label: "WELL" },
      { key: "WIREDSCORE",                            label: "WIREDSCORE" },
      { key: "CRREM",                                 label: "CRREM" },
      { key: "EU Taxonomy",                           label: "EU Taxonomy" },
      { key: "CAM",                                   label: "CAM" },
      { key: "LCA",                                   label: "LCA" },
      { key: "GRESB",                                 label: "GRESB" },
    ]
  },
  {
    id: "SPECIALISTICA",
    label: "SPECIALISTICA",
    color: "#8B5CF6",
    bg: "#EDE9FE",
    topic: "MIXED",
    activities: [
      { key: "Consulenza acustica",                   label: "Acustica" }, // Maps well
      { key: "Progetto Definitivo per Appalto",       label: "Antincendio VVF" },
      { key: "Progetto Geotermico",                   label: "Geotermia" },
      { key: "Invarianza Idraulica",                  label: "Invarianza Idraulica" },
    ]
  },
  {
    id: "ALTRO",
    label: "ALTRO",
    color: "#6B7280",
    bg: "#F3F4F6",
    topic: "OTHER",
    activities: [
      { key: "Altre Attività",                        label: "Altre Attività" },
    ]
  },
  {
    id: "CC",
    label: "CC",
    color: "#166534",
    bg: "#F0FDF4",
    topic: "CONTINUOUS COMMISSIONING",
    activities: [
      { key: "Continuous Commissioning ed Ongoing monitoring activities", label: "Continuous Comm. (Monitoring)" },
      { key: "Sviluppo e rilascio dell'algoritmo AI-Eco",                 label: "AI-Eco Algorithm" }
    ]
  }
];

// ── DESTINAZIONE D'USO ──
export const DESTINAZIONI_USO = [
  "Uffici", "Residenziale", "Ricettivo", "Commerciale", "Istituzionale",
  "Industriale", "Ospedale", "Sportivo", "Misto", "Altro"
];

// ── HELPER: empty offer form ──
export const getEmptyOffer = () => ({
  anno: new Date().getFullYear() % 100,  // 2-digit year
  preventivo_number: "",
  revision: 0,
  is_final_revision: false,
  tipo: "P",
  oggetto: "",
  committente: "",
  cliente: "",
  client_id: "",
  supplier_ids: [],
  superficie: "",
  destinazione_uso: "",
  specifiche: "",
  valore_totale: 0,
  importo_opere: "",
  periodo_inizio: "",
  periodo_fine: "",
  criticita_ante: "",
  criticita_post: "",
  note: "",
  status: "aperta",
  // Service lines: { category_id: { activity_key: { included: bool, valore: number, status: 'pending' } } }
  lines: {},
});

// ── HELPER: format offer code ──
export const formatOfferCode = (anno, tipo, numero, rev) => {
  const parts = [];
  if (anno) parts.push(String(anno).padStart(2, '0'));
  if (tipo) parts.push(tipo);
  if (numero) parts.push(String(numero).padStart(2, '0'));
  if (rev !== undefined && rev !== null && rev > 0) parts.push(`R${rev}`);
  return parts.join('-') || '—';
};

// ── HELPER: calculate total from lines ──
export const calculateOfferTotal = (lines) => {
  let total = 0;
  Object.values(lines || {}).forEach(cat => {
    Object.values(cat || {}).forEach(act => {
      if (act.included && act.valore) {
        total += parseFloat(act.valore) || 0;
      }
    });
  });
  return total;
};

// ── HELPER: count included activities ──
export const countIncludedActivities = (lines) => {
  let count = 0;
  Object.values(lines || {}).forEach(cat => {
    Object.values(cat || {}).forEach(act => {
      if (act.included) count++;
    });
  });
  return count;
};

// ── HELPER: get status style ──
export const getStatusStyle = (status) => {
  const s = OFFER_STATUSES.find(s => s.id === status);
  return s || OFFER_STATUSES[0];
};

// ── HELPER: get line status style ──
export const getLineStatusStyle = (status) => {
  return LINE_STATUSES.find(s => s.id === status) || LINE_STATUSES[0];
};
