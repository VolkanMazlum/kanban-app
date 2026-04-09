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
    label: "PROG CAD (MEP Standard)",
    color: "#2563EB", bg: "#EFF6FF", topic: "MEP",
    activities: [
      { key: "Studio di Fattibilità", label: "Studio di Fattibilità" },
      { key: "Due Diligence", label: "Due Diligence" },
      { key: "Progetto Preliminare", label: "Progetto Preliminare" },
      { key: "Progetto Definitivo per Permessi", label: "Progetto Definitivo per Permessi" },
      { key: "Progetto Definitivo", label: "Progetto Definitivo" },
      { key: "Progetto Definitivo per Appalto", label: "Progetto Definitivo per Appalto" },
      { key: "Progetto Esecutivo per Appalto", label: "Progetto Esecutivo per Appalto" },
      { key: "Direzione lavori Impianti", label: "Direzione lavori Impianti" },
      { key: "Assistenza ai Collaudi MEP", label: "Assistenza ai Collaudi MEP" },
      { key: "Collaudi tecnico-funzionali MEP", label: "Collaudi tecnico-funzionali MEP" },
    ]
  },
  {
    id: "PROG_BIM",
    label: "PROG BIM",
    color: "#6366F1", bg: "#EEF2FF", topic: "MEP",
    activities: [
      { key: "BIM modelling", label: "BIM modelling (Base)" },
      { key: "Studio di Fattibilità BIM", label: "Studio di Fattibilità BIM" },
      { key: "Progetto Preliminare in BIM", label: "Progetto Preliminare in BIM" },
      { key: "Progetto Definitivo in BIM", label: "Progetto Definitivo in BIM" },
      { key: "Progetto Esecutivo in BIM", label: "Progetto Esecutivo in BIM" },
    ]
  },
  {
    id: "ENERGIA",
    label: "ENERGIA",
    color: "#F59E0B", bg: "#FFFBEB", topic: "ENERGY",
    activities: [
      { key: "APE", label: "APE" },
      { key: "Legge 10/91", label: "Legge 10/91" },
      { key: "Diagnosi Energetica", label: "Diagnosi Energetica" },
    ]
  },
  {
    id: "SOSTENIBILITA_LEED",
    label: "LEED",
    color: "#10B981", bg: "#ECFDF5", topic: "SUSTAINABILITY",
    activities: [
      { key: "LEED", label: "LEED (Generale)" },
      { key: "LEED - Pre-Assessment", label: "LEED - Pre-Assessment" },
      { key: "LEED - Fase di progettazione", label: "LEED - Fase di progettazione" },
      { key: "LEED - Fase di costruzione", label: "LEED - Fase di costruzione" },
      { key: "LEED - CxA Base", label: "LEED - CxA Base" },
      { key: "LEED - CxA Avanzato impianti", label: "LEED - CxA Avanzato impianti" },
      { key: "LEED - CxA Avanzato involucro", label: "LEED - CxA Avanzato involucro" },
      { key: "LEED - Daylighting", label: "LEED - Daylighting" },
      { key: "LEED - Relazione di processo integrato", label: "LEED - Relazione di processo integrato" },
      { key: "LEED - Analisi del sito", label: "LEED - Analisi del sito" },
      { key: "LEED - Consulenza acustica", label: "LEED - Consulenza acustica" },
      { key: "LEED - Analisi LCA materiali", label: "LEED - Analisi LCA materiali" },
    ]
  },
  {
    id: "SOSTENIBILITA_BREEAM",
    label: "BREEAM",
    color: "#059669", bg: "#F0FDF4", topic: "SUSTAINABILITY",
    activities: [
      { key: "BREEAM", label: "BREEAM (Generale)" },
      { key: "BREEAM - Design stage", label: "BREEAM - Design stage" },
      { key: "BREEAM - Construction stage", label: "BREEAM - Construction stage" },
      { key: "BREEAM - Post Construction stage", label: "BREEAM - Post Construction stage" },
      { key: "BREEAM - Suitable Qualified Ecologist (LE04/05)", label: "BREEAM - Ecologist (LE04/05)" },
      { key: "BREEAM - Modellazione L10 + energia di processo (ENE01)", label: "BREEAM - Modellazione ENE01" },
      { key: "BREEAM - Life Cycle Assessment dell'edificio (MAT01)", label: "BREEAM - LCA Building (MAT01)" },
      { key: "BREEAM - Elemental Life Cycle Cost dell'edificio (MAN02)", label: "BREEAM - LCC Building (MAN02)" },
      { key: "BREEAM - Component Level LCC Plan (MAN02)", label: "BREEAM - LCC Component (MAN02)" },
      { key: "BREEAM - Analisi flussi verticali (ENE06)", label: "BREEAM - Flussi verticali (ENE06)" },
      { key: "BREEAM - Commissioning e Handover (MAN04)", label: "BREEAM - Comm. & Handover" },
      { key: "BREEAM - Commissioning dell'involucro (MAN04)", label: "BREEAM - Comm. Involucro" },
      { key: "BREEAM - Seasonal Commissioning e Aftercare (MAN05)", label: "BREEAM - Seasonal Comm." },
      { key: "BREEAM - Comfort e adattabilità camb. climatici (HEA04)", label: "BREEAM - Comfort (HEA04)" },
      { key: "BREEAM - Risk Assessment (HEA07)", label: "BREEAM - Risk Assessment" },
      { key: "BREEAM - Tempi ritorno precipitazioni e gestione acque (POL03)", label: "BREEAM - Precipitazioni (POL03)" },
      { key: "BREEAM - Material Efficiency Analysis (MAT06)", label: "BREEAM - Mat. Efficiency (MAT06)" },
      { key: "BREEAM - Adattamento al cambiamento climatico (WST05)", label: "BREEAM - Adattamento WST05" },
      { key: "BREEAM - Passive Design Analysis (ENE04)", label: "BREEAM - Passive Design (ENE04)" },
    ]
  },
  {
    id: "SOSTENIBILITA_WELL",
    label: "WELL",
    color: "#0891B2", bg: "#ECFEFF", topic: "SUSTAINABILITY",
    activities: [
      { key: "WELL", label: "WELL (Generale)" },
      { key: "WELL - Pre-Assessment", label: "WELL - Pre-Assessment" },
      { key: "WELL - Fase di progettazione", label: "WELL - Fase di progettazione" },
      { key: "WELL - Fase di costruzione", label: "WELL - Fase di costruzione" },
      { key: "WELL - Fase di performance verification", label: "WELL - Performance Verif." },
      { key: "WELL - Commissioning dell'involucro", label: "WELL - Comm. Involucro" },
      { key: "WELL - Daylighting", label: "WELL - Daylighting" },
      { key: "WELL - PTA (Performance Test Agent)", label: "WELL - PTA Agent" },
      { key: "WELL - WELL Performance Rating", label: "WELL - Performance Rating" },
      { key: "WELL - monitoraggio e ricertificazione WELL", label: "WELL - monitoraggio/ricertif." },
    ]
  },
  {
    id: "SOSTENIBILITA_WIREDSCORE",
    label: "WIREDSCORE",
    color: "#4F46E5", bg: "#EEF2FF", topic: "SUSTAINABILITY",
    activities: [
      { key: "WIREDSCORE", label: "WIREDSCORE (Generale)" },
      { key: "WIREDSCORE - Pre-Assessment", label: "WIREDSCORE - Pre-Assessment" },
      { key: "WIREDSCORE - Consulenza per lvl certified", label: "WIREDSCORE - Certified" },
      { key: "WIREDSCORE - Incremento per lvl silver", label: "WIREDSCORE - Silver" },
      { key: "WIREDSCORE - Incremento per lvl gold", label: "WIREDSCORE - Gold" },
      { key: "WIREDSCORE - Incremento per lvl platinum", label: "WIREDSCORE - Platinum" },
    ]
  },
  {
    id: "SOSTENIBILITA_ALTRI",
    label: "SOST. (Altri)",
    color: "#475569", bg: "#F8FAFC", topic: "SUSTAINABILITY",
    activities: [
      { key: "CRREM", label: "CRREM" },
      { key: "EU Taxonomy", label: "EU Taxonomy" },
      { key: "CAM", label: "CAM" },
      { key: "LCA", label: "LCA" },
      { key: "GRESB", label: "GRESB" },
      { key: "FITWEL", label: "FITWEL" },
    ]
  },
  {
    id: "ACUSTICA",
    label: "ACUSTICA",
    color: "#7C3AED", bg: "#F5F3FF", topic: "ACUSTIC",
    activities: [
      { key: "Studio di Fattibilità", label: "Studio di Fattibilità" },
      { key: "Due Diligence", label: "Due Diligence" },
      { key: "Progetto Preliminare", label: "Progetto Preliminare" },
      { key: "Progetto Definitivo per Permessi", label: "Progetto Definitivo per Permessi" },
      { key: "Progetto Definitivo", label: "Progetto Definitivo" },
      { key: "Progetto Definitivo per Appalto", label: "Progetto Definitivo per Appalto" },
      { key: "Progetto Esecutivo per Appalto", label: "Progetto Esecutivo per Appalto" },
      { key: "Direzione lavori Impianti", label: "Direzione lavori Impianti" },
      { key: "Assistenza ai Collaudi Acustici", label: "Assistenza ai Collaudi Acustici" },
      { key: "Collaudi tecnico-funzionali Acustici", label: "Collaudi tecn.-funz. Acustici" },
    ]
  },
  {
    id: "VVF",
    label: "Antincendio (VVF)",
    color: "#DC2626", bg: "#FEF2F2", topic: "VVF",
    activities: [
      { key: "Studio di Fattibilità", label: "Studio di Fattibilità" },
      { key: "Due Diligence", label: "Due Diligence" },
      { key: "Progetto Preliminare", label: "Progetto Preliminare" },
      { key: "Progetto Definitivo per Permessi", label: "Progetto Definitivo per Permessi" },
      { key: "Progetto Definitivo", label: "Progetto Definitivo" },
      { key: "Progetto Definitivo per Appalto", label: "Progetto Definitivo per Appalto" },
      { key: "Progetto Esecutivo per Appalto", label: "Progetto Esecutivo per Appalto" },
      { key: "Direzione lavori Impianti", label: "Direzione lavori Impianti" },
      { key: "Assistenza ai Collaudi VVF", label: "Assistenza ai Collaudi VVF" },
      { key: "Collaudi tecnico-funzionali VVF", label: "Collaudi tecn.-funz. VVF" },
    ]
  },
  {
    id: "STRUTTURE",
    label: "STRUTTURE",
    color: "#0891B2", bg: "#ECFEFF", topic: "STRUCTURE",
    activities: [
      { key: "Studio di Fattibilità", label: "Studio di Fattibilità" },
      { key: "Due Diligence", label: "Due Diligence" },
      { key: "Progetto Preliminare", label: "Progetto Preliminare" },
      { key: "Progetto Definitivo per Permessi", label: "Progetto Definitivo per Permessi" },
      { key: "Progetto Definitivo", label: "Progetto Definitivo" },
      { key: "Progetto Definitivo per Appalto", label: "Progetto Definitivo per Appalto" },
      { key: "Progetto Esecutivo per Appalto", label: "Progetto Esecutivo per Appalto" },
      { key: "Direzione lavori Impianti", label: "Direzione lavori Impianti" },
      { key: "Assistenza ai Collaudi Strutture", label: "Assistenza ai Collaudi Strutture" },
      { key: "Collaudi tecnico-funzionali Strutture", label: "Collaudi tecn.-funz. Strutture" },
    ]
  },
  {
    id: "GEOTERMIA",
    label: "GEOTERMIA",
    color: "#65A30D", bg: "#F7FEE7", topic: "GEOTHERMAL",
    activities: [
      { key: "Studio di Fattibilità", label: "Studio di Fattibilità" },
      { key: "Due Diligence", label: "Due Diligence" },
      { key: "Progetto Preliminare", label: "Progetto Preliminare" },
      { key: "Progetto Definitivo per Permessi", label: "Progetto Definitivo per Permessi" },
      { key: "Progetto Definitivo", label: "Progetto Definitivo" },
      { key: "Progetto Definitivo per Appalto", label: "Progetto Definitivo per Appalto" },
      { key: "Progetto Esecutivo per Appalto", label: "Progetto Esecutivo per Appalto" },
      { key: "Direzione lavori Impianti", label: "Direzione lavori Impianti" },
      { key: "Assistenza ai Collaudi Geotermici", label: "Assistenza ai Collaudi Geotermici" },
      { key: "Collaudi tecnico-funzionali Geotermici", label: "Collaudi tecn.-funz. Geotermici" },
    ]
  },
  {
    id: "SPECIALISTICA_VARIE",
    label: "Altre Spec.",
    color: "#9333EA", bg: "#FAF5FF", topic: "SPECIAL",
    activities: [
      { key: "Invarianza Idraulica", label: "Invarianza Idraulica" },
      { key: "Altre Attività", label: "Altre Attività" },
    ]
  },
  {
    id: "CC",
    label: "Comm. (CC)",
    color: "#166534", bg: "#F0FDF4", topic: "CONTINUOUS COMMISSIONING",
    activities: [
      { key: "Sviluppo Simulazione per allenamento algoritmo AI-Eco", label: "Simulazione AI-Eco" },
      { key: "Sviluppo e rilascio dell'algoritmo AI-Eco", label: "Rilascio AI-Eco" },
      { key: "Continuous Commissioning ed Ongoing monitoring activities", label: "Cont. Comm. & Monitoring" }
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
