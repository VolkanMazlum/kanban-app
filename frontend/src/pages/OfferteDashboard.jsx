import React, { useState, useEffect, useMemo, useCallback } from "react";
import * as api from "../api";
import {
  OFFER_STATUSES, OFFER_TYPES, LINE_STATUSES, ENTITY_ROLES,
  SERVICE_CATEGORIES, DESTINAZIONI_USO,
  getEmptyOffer, formatOfferCode, calculateOfferTotal,
  countIncludedActivities, getStatusStyle, getLineStatusStyle
} from "../constants/offerteConstants.js";
import { inpStyle } from "../constants/costConstants.js";
import { downloadAuthenticatedFile } from "../utils/downloadUtils";

// ── Number formatting ──
const fmtK = (num) => {
  const v = parseFloat(num) || 0;
  if (v === 0) return "—";
  return v.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
};

const fmtEu = (num) => {
  const v = parseFloat(num) || 0;
  if (v === 0) return "—";
  return `€${v.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function OfferteDashboard({ isHR }) {
  // ── State ──
  const [offers, setOffers] = useState([]);
  const [clients, setClients] = useState([]);
  const [existingPreventivi, setExistingPreventivi] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterYear, setFilterYear] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterClient, setFilterClient] = useState("");
  const [filterTipo, setFilterTipo] = useState("all");

  const [showModal, setShowModal] = useState(false);
  const [editingOffer, setEditingOffer] = useState(null);
  const [form, setForm] = useState(getEmptyOffer());
  const [linkMode, setLinkMode] = useState("new"); // "new" or "existing"
  const [saving, setSaving] = useState(false);

  const [expandedRows, setExpandedRows] = useState(new Set());
  const [activeModalTab, setActiveModalTab] = useState("info");

  // ── Data Fetching ──
  const loadData = useCallback(async () => {
    if (!isHR) return;
    try {
      // Fetch ALL offers for the year to compute dynamic stats accurately without losing other statuses
      const [offData, extPrev] = await Promise.all([
        api.getOfferte(filterYear, "all"),
        api.getPreventiviEsistenti()
      ]);
      setOffers(offData || []);
      setExistingPreventivi(extPrev || []);
    } catch (err) {
      console.error("Failed to load offerte", err);
    }
  }, [isHR, filterYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (isHR) {
      api.getClients().then(setClients).catch(console.error);
    }
  }, [isHR]);

  // ── Available years from offers ──
  const availableYears = useMemo(() => {
    const years = [...new Set(offers.map(o => o.anno))].sort((a, b) => b - a);
    return years;
  }, [offers]);

  // ── Available clients from offers ──
  const availableClients = useMemo(() => {
    const clientsSet = new Set(offers.map(o => o.cliente).filter(c => c && c.trim() !== ""));
    return [...clientsSet].sort((a, b) => a.localeCompare(b));
  }, [offers]);

  // ── DYNAMIC SUMMARY STATS ──
  // Calculate summary stats based on all filters EXCEPT status filter
  const summaryStats = useMemo(() => {
    const stats = {};
    OFFER_STATUSES.forEach(s => { stats[s.id] = { count: 0, total: 0 }; });
    
    offers.forEach(o => {
      // Apply filters (client, tipo, and search)
      if (filterClient && o.cliente !== filterClient) return;
      if (filterTipo !== "all" && o.tipo !== filterTipo) return;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const code = formatOfferCode(o.anno, o.tipo, o.preventivo_number, o.revision);
        if (!(
          code.toLowerCase().includes(s) ||
          (o.oggetto || "").toLowerCase().includes(s) ||
          (o.cliente || "").toLowerCase().includes(s) ||
          (o.committente || "").toLowerCase().includes(s) ||
          (o.destinazione_uso || "").toLowerCase().includes(s)
        )) return;
      }

      if (stats[o.status]) {
        stats[o.status].count += 1;
        
        let offerVal = 0;
        Object.values(o.lines || {}).forEach(cat => {
          Object.values(cat || {}).forEach(line => {
            if (line.included && ["accepted", "rejected", "pending", "revised"].includes(line.status)) {
              offerVal += (parseFloat(line.valore) || 0);
            }
          });
        });
        stats[o.status].total += offerVal;
      }
    });
    
    return stats;
  }, [offers, filterClient, filterTipo, searchTerm]);

  // ── FILTERED OFFERS ──
  const filteredOffers = useMemo(() => {
    return offers.filter(o => {
      if (filterStatus !== "all" && o.status !== filterStatus) return false;
      if (filterClient && o.cliente !== filterClient) return false;
      if (filterTipo !== "all" && o.tipo !== filterTipo) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const code = formatOfferCode(o.anno, o.tipo, o.preventivo_number, o.revision);
        return (
          code.toLowerCase().includes(s) ||
          (o.oggetto || "").toLowerCase().includes(s) ||
          (o.cliente || "").toLowerCase().includes(s) ||
          (o.committente || "").toLowerCase().includes(s) ||
          (o.destinazione_uso || "").toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [offers, filterStatus, filterClient, filterTipo, searchTerm]);

  // ── Handlers ──
  const toggleExpand = (id) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openNewOffer = () => {
    setEditingOffer(null);
    setForm(getEmptyOffer());
    setLinkMode("new");
    setActiveModalTab("info");
    setShowModal(true);
  };

  const openEditOffer = (offer) => {
    setEditingOffer(offer);

    // Check if it's linked to an existing project visually by seeing if commessa_id is set 
    // or if preventivo_number is a complex string indicating it was linked.
    if (offer.commessa_id) setLinkMode("existing");
    else setLinkMode("new");

    // Convert YYYY-MM-DD strings for date inputs
    const pInizio = offer.periodo_inizio ? offer.periodo_inizio.split('T')[0] : "";
    const pFine = offer.periodo_fine ? offer.periodo_fine.split('T')[0] : "";

    setForm({ ...offer, periodo_inizio: pInizio, periodo_fine: pFine });
    setActiveModalTab("info");
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const total = calculateOfferTotal(form.lines);
    const payload = {
      ...form,
      valore_totale: total,
    };

    try {
      let savedOffer;
      if (editingOffer) {
        savedOffer = await api.updateOfferta(editingOffer.id, payload);
      } else {
        savedOffer = await api.createOfferta(payload);
      }

      // If the user changed the status to "accettata" via the form dropdown 
      // OR if the line toggles auto-set it to "accettata", but it hasn't been converted yet:
      if (payload.status === "accettata" && (!editingOffer || (!editingOffer.task_id && !editingOffer.commessa_id))) {
        await api.acceptOfferta(savedOffer.id);
        alert("Offerta accettata! Commessa creata con successo in base alle attività selezionate.");
      }

      setShowModal(false);
      loadData();
    } catch (err) {
      console.error(err);
      alert("Errore durante il salvataggio: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Eliminare questa offerta?")) return;
    try {
      await api.deleteOfferta(id);
      loadData();
    } catch (err) {
      console.error(err);
      alert("Error deleting offerta");
    }
  };

  const handleAccept = async (id) => {
    if (!window.confirm("Accettare l'offerta e convertirla in progetto (Commessa)?")) return;
    try {
      await api.acceptOfferta(id);
      alert("Offerta accettata! Commessa creata.");
      loadData();
    } catch (err) {
      console.error(err);
      alert("Errore durante l'accettazione: " + err.message);
    }
  };

  const handleLineToggle = (catId, actKey) => {
    setForm(prev => {
      const lines = { ...prev.lines };
      if (!lines[catId]) lines[catId] = {};
      const existing = lines[catId][actKey];
      if (existing?.included) {
        const { [actKey]: _, ...rest } = lines[catId];
        lines[catId] = rest;
        if (Object.keys(lines[catId]).length === 0) delete lines[catId];
      } else {
        lines[catId] = { ...lines[catId], [actKey]: { included: true, valore: 0, status: "pending" } };
      }
      return { ...prev, lines };
    });
  };

  const handleLineValueChange = (catId, actKey, val) => {
    setForm(prev => {
      const lines = { ...prev.lines };
      if (!lines[catId]) lines[catId] = {};
      lines[catId] = { ...lines[catId], [actKey]: { ...lines[catId][actKey], valore: val } };
      return { ...prev, lines };
    });
  };

  const handleLineStatusChange = async (offerId, catId, actKey, newStatus) => {
    let newOfferStatus = null;
    setOffers(prev => prev.map(o => {
      if (o.id !== offerId) return o;
      const lines = { ...o.lines };
      if (!lines[catId]) return o;
      lines[catId] = { ...lines[catId], [actKey]: { ...lines[catId][actKey], status: newStatus } };

      const allLines = [];
      Object.values(lines).forEach(cat => {
        Object.values(cat).forEach(act => { if (act.included) allLines.push(act); });
      });
      const allAccepted = allLines.every(l => l.status === "accepted");
      const allRejected = allLines.every(l => l.status === "rejected");
      const hasMixed = allLines.some(l => l.status === "accepted") && allLines.some(l => l.status === "rejected");

      let status = o.status;
      if (allAccepted) status = "accettata";
      else if (allRejected) status = "non_accettata";
      else if (hasMixed) status = "parziale";

      newOfferStatus = status;
      return { ...o, lines, status };
    }));

    try {
      await api.patchLineStatus(offerId, {
        category: catId,
        attivita: actKey,
        status: newStatus,
        offerStatus: newOfferStatus
      });
    } catch (err) {
      console.error("Failed to update line status:", err);
      alert("Errore durante l'aggiornamento dello stato: " + err.message);
      loadData(); // Revert state from server
    }
  };

  if (!isHR) {
    return <div style={{ padding: 40, textAlign: "center", color: "#6B7280" }}>Accesso non autorizzato. Privilegi HR richiesti.</div>;
  }

  // ── CATEGORY COLOR LOOKUP ──
  const catColors = {};
  SERVICE_CATEGORIES.forEach(c => { catColors[c.id] = { color: c.color, bg: c.bg }; });

  return (
    <div style={{ padding: "28px 32px", overflowY: "auto", height: "100%", fontFamily: "'Inter',sans-serif", background: "#F9FAFB" }}>

      {/* ══════════════════ HEADER ══════════════════ */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div style={{ flex: "1 1 auto", minWidth: 250 }}>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: "#111827", margin: 0, letterSpacing: "-0.025em" }}>
              Elenco Offerte
            </h2>
            <p style={{ color: "#6B7280", margin: "4px 0 0", fontSize: 14 }}>
              Gestione preventivi, gare e offerte commerciali
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => downloadAuthenticatedFile("/reports/offerte", `Export_Offerte_${new Date().toISOString().split('T')[0]}.xlsx`)}
              style={{
                background: "#fff", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: 10, padding: "11px 20px",
                fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "all 0.2s",
                fontFamily: "'Inter',sans-serif"
              }}
              onMouseOver={e => e.currentTarget.style.background = "#F9FAFB"}
              onMouseOut={e => e.currentTarget.style.background = "#fff"}
            >
              📥 Esporta Excel
            </button>
            <button
              onClick={openNewOffer}
              style={{
                background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
                color: "#fff", border: "none", borderRadius: 10, padding: "11px 22px",
                fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "all 0.2s",
                boxShadow: "0 4px 14px rgba(37, 99, 235, 0.3)", fontFamily: "'Inter',sans-serif"
              }}
              onMouseOver={e => e.currentTarget.style.transform = "translateY(-1px)"}
              onMouseOut={e => e.currentTarget.style.transform = "translateY(0)"}
            >
              + Nuova Offerta
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════ SUMMARY CARDS ══════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(185, 1fr))", gap: 14, marginBottom: 24 }}>
        {OFFER_STATUSES.map(s => {
          const stat = summaryStats[s.id] || { count: 0, total: 0 };
          return (
            <div
              key={s.id}
              onClick={() => setFilterStatus(filterStatus === s.id ? "all" : s.id)}
              style={{
                background: filterStatus === s.id ? s.bg : "#fff",
                border: `1.5px solid ${filterStatus === s.id ? s.color : "#E5E7EB"}`,
                borderRadius: 12, padding: "16px 18px", cursor: "pointer",
                transition: "all 0.2s", boxShadow: filterStatus === s.id ? `0 4px 12px ${s.color}20` : "0 1px 3px rgba(0,0,0,0.04)"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>{s.icon}</span>
                <span style={{
                  fontSize: 10, fontWeight: 800, color: s.color, letterSpacing: "0.05em",
                  background: s.bg, padding: "2px 8px", borderRadius: 6, border: `1px solid ${s.border}`
                }}>{s.label.toUpperCase()}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1 }}>{stat.count}</div>
              <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginTop: 4 }}>
                {stat.total > 0 ? `${fmtK(stat.total)} k€` : "—"}
              </div>
            </div>
          );
        })}
      </div>

      {/* ══════════════════ FILTERS BAR ══════════════════ */}
      <div style={{
        marginBottom: 20, padding: "14px 20px", background: "#fff", borderRadius: 12,
        border: "1.5px solid #E5E7EB", display: "flex", alignItems: "center",
        justifyContent: "space-between", flexWrap: "wrap", gap: 14
      }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center", flex: "1 1 600px", flexWrap: "wrap" }}>
          {/* Search */}
          <div style={{ position: "relative", flex: "1 1 280px" }}>
            <input
              type="text" placeholder="Cerca per codice, oggetto, cliente..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              style={{
                padding: "10px 12px 10px 38px", borderRadius: 10, border: "1.5px solid #E5E7EB",
                fontSize: 13, width: "100%", outline: "none", background: "#F9FAFB",
                fontFamily: "'Inter',sans-serif", transition: "all 0.2s"
              }}
              onFocus={e => { e.target.style.borderColor = "#2563EB"; e.target.style.background = "#fff"; }}
              onBlur={e => { e.target.style.borderColor = "#E5E7EB"; e.target.style.background = "#F9FAFB"; }}
            />
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", fontSize: 15 }}>🔍</span>
            {searchTerm && (
              <button onClick={() => setSearchTerm("")}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 13 }}>✕</button>
            )}
          </div>

          <div style={{ height: 24, width: 1, background: "#E5E7EB" }} />

          {/* Client filter */}
          <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
            style={{ padding: "9px 12px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 13, fontWeight: 600, color: "#111827", background: "#fff", cursor: "pointer", outline: "none", fontFamily: "'Inter',sans-serif", maxWidth: 180 }}>
            <option value="">Tutti i clienti</option>
            {availableClients.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Year filter */}
          <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
            style={{ padding: "9px 12px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 13, fontWeight: 600, color: "#111827", background: "#fff", cursor: "pointer", outline: "none", fontFamily: "'Inter',sans-serif" }}>
            <option value="all">Tutti gli anni</option>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          {/* Tipo filter */}
          <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)}
            style={{ padding: "9px 12px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 13, fontWeight: 600, color: "#111827", background: "#fff", cursor: "pointer", outline: "none", fontFamily: "'Inter',sans-serif" }}>
            <option value="all">Tutti i tipi</option>
            {OFFER_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>

          {/* Status filter */}
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ padding: "9px 12px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 13, fontWeight: 600, color: "#111827", background: "#fff", cursor: "pointer", outline: "none", fontFamily: "'Inter',sans-serif" }}>
            <option value="all">Tutti gli stati</option>
            {OFFER_STATUSES.map(s => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
          </select>
        </div>

        <div style={{ fontSize: 13, fontWeight: 600, color: "#6B7280" }}>
          <span style={{ color: "#111827" }}>{filteredOffers.length}</span> offert{filteredOffers.length === 1 ? "a" : "e"}
        </div>
      </div>

      {/* ══════════════════ MAIN TABLE ══════════════════ */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E5E7EB", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.03)" }}>
        {filteredOffers.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "#9CA3AF" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Nessuna offerta trovata</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Crea una nuova offerta o modifica i filtri</div>
          </div>
        ) : (
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1100 }}>
            <thead>
              <tr style={{ background: "#F9FAFB" }}>
                {["", "CODICE", "TIPO", "OGGETTO", "CLIENTE", "DEST. D'USO", "ATTIVITÀ", "VALORE (k€)", "ACQUISITO (k€)", "STATO", "AZIONI"].map(h => (
                  <th key={h} style={{
                    padding: "11px 14px", fontSize: 10, fontWeight: 700, color: "#6B7280",
                    textAlign: "left", whiteSpace: "nowrap", borderBottom: "2px solid #E5E7EB",
                    letterSpacing: "0.05em",
                    ...(h === "" ? { width: 36 } : {}),
                    ...(h === "AZIONI" ? { width: 100, textAlign: "center" } : {})
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredOffers.map(offer => {
                const code = formatOfferCode(offer.anno, offer.tipo, offer.preventivo_number, offer.revision);
                const statusStyle = getStatusStyle(offer.status);
                const actCount = countIncludedActivities(offer.lines);
                const isExpanded = expandedRows.has(offer.id);

                // Gather all active categories for badges
                const activeCats = SERVICE_CATEGORIES.filter(cat => {
                  const catLines = offer.lines[cat.id];
                  return catLines && Object.values(catLines).some(a => a.included);
                });

                return (
                  <React.Fragment key={offer.id}>
                    {/* ── Main Row ── */}
                    <tr
                      style={{
                        background: isExpanded ? "#FAFBFF" : "#fff",
                        borderBottom: isExpanded ? "none" : "1px solid #F3F4F6",
                        transition: "background 0.15s", cursor: "pointer"
                      }}
                      onClick={() => toggleExpand(offer.id)}
                    >
                      {/* Expand arrow */}
                      <td style={{ padding: "12px 10px 12px 14px", width: 36 }}>
                        <span style={{
                          display: "inline-block", transition: "transform 0.2s",
                          transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                          fontSize: 12, color: "#9CA3AF"
                        }}>▶</span>
                      </td>
                      {/* Code */}
                      <td style={{ padding: "12px 14px", fontWeight: 800, fontSize: 13, color: "#4F46E5", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.02em" }}>
                        {code}
                        {offer.is_final_revision && (
                          <span style={{ marginLeft: 6, fontSize: 9, background: "#059669", color: "#fff", padding: "1px 5px", borderRadius: 4, fontWeight: 700, verticalAlign: "middle" }}>FINAL</span>
                        )}
                      </td>
                      {/* Type */}
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                          background: offer.tipo === "G" ? "#FEF3C7" : "#EFF6FF",
                          color: offer.tipo === "G" ? "#92400E" : "#1D4ED8",
                          border: `1px solid ${offer.tipo === "G" ? "#FDE68A" : "#BFDBFE"}`
                        }}>
                          {offer.tipo === "G" ? "GARA" : "PREV"}
                        </span>
                      </td>
                      {/* Object */}
                      <td style={{ padding: "12px 14px", maxWidth: 280 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", lineHeight: 1.3 }}>{offer.oggetto || "—"}</div>
                        {offer.committente && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>via {offer.committente}</div>}
                        {offer.note && (
                          <div style={{
                            fontSize: 11, color: "#6B7280", marginTop: 4,
                            fontStyle: "italic", whiteSpace: "nowrap", overflow: "hidden",
                            textOverflow: "ellipsis", borderLeft: "2px solid #E5E7EB", paddingLeft: 6
                          }}>
                            {offer.note}
                          </div>
                        )}
                      </td>
                      {/* Client */}
                      <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 600, color: "#374151" }}>{offer.cliente || "—"}</td>
                      {/* Dest. d'uso */}
                      <td style={{ padding: "12px 14px", fontSize: 11, color: "#6B7280" }}>{offer.destinazione_uso || "—"}</td>
                      {/* Activities count + badges */}
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", gap: 3, flexWrap: "wrap", alignItems: "center" }}>
                          {activeCats.length === 0 ? (
                            <span style={{ fontSize: 11, color: "#D1D5DB" }}>—</span>
                          ) : (
                            activeCats.map(cat => (
                              <span key={cat.id} style={{
                                fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                                background: cat.bg, color: cat.color, border: `1px solid ${cat.color}30`,
                                whiteSpace: "nowrap"
                              }}>{cat.label}</span>
                            ))
                          )}
                        </div>
                      </td>
                      {/* Value */}
                      <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: "#111827", whiteSpace: "nowrap" }}>
                        {offer.valore_totale > 0 ? fmtK(offer.valore_totale) : "—"}
                      </td>
                      {/* Value (Acquired) */}
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", flexDirection: "column", minWidth: 80 }}>
                          <span style={{
                            fontSize: 13, fontWeight: 800,
                            color: offer.valore_acquisito >= offer.valore_totale && offer.valore_totale > 0 ? "#059669" : "#374151"
                          }}>
                            {offer.valore_acquisito > 0 ? fmtK(offer.valore_acquisito) : "0,0"}
                          </span>
                          {offer.valore_totale > 0 && (
                            <div style={{ width: "100%", height: 3, background: "#E5E7EB", borderRadius: 2, marginTop: 4 }}>
                              <div style={{
                                width: `${Math.min(100, (offer.valore_acquisito / offer.valore_totale) * 100)}%`,
                                height: "100%",
                                background: (offer.valore_acquisito >= offer.valore_totale) ? "#10B981" : "#6366F1",
                                borderRadius: 2
                              }} />
                            </div>
                          )}
                        </div>
                      </td>
                      {/* Status */}
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 8,
                          background: statusStyle.bg, color: statusStyle.color,
                          border: `1px solid ${statusStyle.border}`, whiteSpace: "nowrap"
                        }}>{statusStyle.icon} {statusStyle.label}</span>
                      </td>
                      {/* Actions */}
                      <td style={{ padding: "12px 14px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                          {offer.status === "accettata" && !offer.task_id && (
                            <button onClick={() => handleAccept(offer.id)}
                              title="Converti in Progetto (Board)"
                              style={{ background: "#ECFDF5", color: "#059669", border: "1px solid #A7F3D0", borderRadius: 6, padding: "5px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}
                              onMouseOver={e => e.currentTarget.style.background = "#D1FAE5"}
                              onMouseOut={e => e.currentTarget.style.background = "#ECFDF5"}
                            >✅</button>
                          )}
                          <button onClick={() => openEditOffer(offer)}
                            title="Modifica"
                            style={{ background: "#F3F4F6", border: "1px solid #D1D5DB", borderRadius: 6, padding: "5px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
                            onMouseOver={e => e.currentTarget.style.background = "#E5E7EB"}
                            onMouseOut={e => e.currentTarget.style.background = "#F3F4F6"}
                          >✏️</button>
                          <button onClick={() => handleDelete(offer.id)}
                            title="Elimina"
                            style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 6, padding: "5px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                          >🗑</button>
                        </div>
                      </td>
                    </tr>

                    {/* ── Expanded Detail Row ── */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={10} style={{ padding: 0, borderBottom: "2px solid #E5E7EB" }}>
                          <div style={{
                            background: "linear-gradient(180deg, #F8FAFF 0%, #F3F4F6 100%)",
                            padding: "16px 20px 20px 50px",
                            animation: "slideIn 0.2s ease-out"
                          }}>
                            {/* Detail grid */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
                              {offer.specifiche && (
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", marginBottom: 2 }}>SPECIFICHE</div>
                                  <div style={{ fontSize: 12, color: "#374151" }}>{offer.specifiche}</div>
                                </div>
                              )}
                              {offer.superficie && (
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", marginBottom: 2 }}>SUPERFICIE</div>
                                  <div style={{ fontSize: 12, color: "#374151" }}>{offer.superficie}</div>
                                </div>
                              )}
                              {offer.importo_opere && (
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", marginBottom: 2 }}>IMPORTO OPERE</div>
                                  <div style={{ fontSize: 12, color: "#374151" }}>{fmtEu(offer.importo_opere)}</div>
                                </div>
                              )}
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", marginBottom: 2 }}>VALORE ACQUISITO</div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: offer.valore_acquisito >= offer.valore_totale ? "#059669" : "#111827" }}>
                                  {fmtK(offer.valore_acquisito)} k€
                                  {offer.valore_totale > 0 && ` (${Math.round((offer.valore_acquisito / offer.valore_totale) * 100)}%)`}
                                </div>
                              </div>
                              {(offer.periodo_inizio || offer.periodo_fine) && (
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", marginBottom: 2 }}>PERIODO</div>
                                  <div style={{ fontSize: 12, color: "#374151" }}>
                                    {offer.periodo_inizio || "—"} → {offer.periodo_fine || "—"}
                                  </div>
                                </div>
                              )}
                              {offer.note && (
                                <div style={{ gridColumn: "span 2" }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", marginBottom: 2 }}>NOTE</div>
                                  <div style={{ fontSize: 12, color: "#374151", fontStyle: "italic" }}>{offer.note}</div>
                                </div>
                              )}
                            </div>

                            {/* Activities breakdown */}
                            <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", marginBottom: 8, letterSpacing: "0.05em" }}>
                              DETTAGLIO ATTIVITÀ
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
                              {SERVICE_CATEGORIES.map(cat => {
                                const catLines = offer.lines[cat.id];
                                if (!catLines) return null;
                                const activities = Object.entries(catLines).filter(([_, a]) => a.included);
                                if (activities.length === 0) return null;

                                return (
                                  <div key={cat.id} style={{
                                    background: "#fff", borderRadius: 10, border: `1.5px solid ${cat.color}25`,
                                    padding: "10px 14px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
                                  }}>
                                    <div style={{
                                      fontSize: 10, fontWeight: 800, color: cat.color,
                                      marginBottom: 8, display: "flex", alignItems: "center", gap: 6
                                    }}>
                                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cat.color }} />
                                      {cat.label}
                                    </div>
                                    {activities.map(([key, act]) => {
                                      const actDef = cat.activities.find(a => a.key === key);
                                      const lineStatusStyle = getLineStatusStyle(act.status);
                                      return (
                                        <div key={key} style={{
                                          display: "flex", justifyContent: "space-between", alignItems: "center",
                                          padding: "4px 0", borderBottom: "1px solid #F3F4F6"
                                        }}>
                                          <span style={{ fontSize: 12, color: "#374151" }}>{actDef?.label || key}</span>
                                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>
                                              {act.valore > 0 ? `${fmtK(act.valore)}` : "—"}
                                            </span>
                                            {/* Per-activity status selector */}
                                            <select
                                              value={act.status || "pending"}
                                              onClick={e => e.stopPropagation()}
                                              onChange={e => {
                                                e.stopPropagation();
                                                handleLineStatusChange(offer.id, cat.id, key, e.target.value);
                                              }}
                                              style={{
                                                fontSize: 9, fontWeight: 700, padding: "2px 4px", borderRadius: 4,
                                                border: `1px solid ${lineStatusStyle.color}40`,
                                                color: lineStatusStyle.color, background: "#fff",
                                                cursor: "pointer", outline: "none", fontFamily: "'Inter',sans-serif"
                                              }}
                                            >
                                              {LINE_STATUSES.map(ls => (
                                                <option key={ls.id} value={ls.id}>{ls.label}</option>
                                              ))}
                                            </select>
                                          </div>
                                        </div>
                                      );
                                    })}
                                    <div style={{
                                      marginTop: 6, paddingTop: 6, borderTop: `1px solid ${cat.color}20`,
                                      display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700
                                    }}>
                                      <span style={{ color: "#6B7280" }}>Subtotale</span>
                                      <span style={{ color: cat.color }}>
                                        {fmtK(activities.reduce((s, [_, a]) => s + (parseFloat(a.valore) || 0), 0))} k€
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>

            {/* ── FOOTER TOTALS ── */}
            <tfoot style={{ background: "#F9FAFB", borderTop: "2px solid #E5E7EB" }}>
              <tr style={{ fontWeight: 800, color: "#111827", fontSize: 12 }}>
                <td colSpan={7} style={{ padding: "14px", textAlign: "right" }}>TOTALE:</td>
                <td style={{ padding: "14px", fontWeight: 800, color: "#4F46E5" }}>
                  {fmtK(filteredOffers.reduce((rowSum, o) => {
                    let offerContribution = 0;
                    Object.values(o.lines || {}).forEach(cat => {
                      Object.values(cat || {}).forEach(line => {
                        // IMPORTANT: Only include lines marked as 'included'
                        if (line.included && ["accepted", "rejected", "pending", "revised"].includes(line.status)) {
                          offerContribution += (parseFloat(line.valore) || 0);
                        }
                      });
                    });
                    return rowSum + offerContribution;
                  }, 0))} k€
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* ══════════════════ CREATE/EDIT MODAL ══════════════════ */}
      {showModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(17,24,39,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 300, backdropFilter: "blur(6px)", padding: "30px 0"
        }}>
          <div style={{
            background: "#fff", borderRadius: 18, width: 1050, maxHeight: "95vh",
            overflowY: "auto", boxShadow: "0 25px 80px rgba(0,0,0,0.2)"
          }}>
            {/* Modal header */}
            <div style={{
              padding: "20px 28px", borderBottom: "1px solid #E5E7EB",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              position: "sticky", top: 0, background: "#fff", zIndex: 10, borderRadius: "18px 18px 0 0"
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#111827" }}>
                  {editingOffer ? "Modifica Offerta" : "Nuova Offerta"}
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9CA3AF" }}>
                  {editingOffer ? formatOfferCode(form.anno, form.tipo, form.preventivo_number, form.revision) : "Compila i dettagli dell'offerta"}
                </p>
              </div>
              <button onClick={() => setShowModal(false)}
                style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#9CA3AF", padding: 4 }}>✕</button>
            </div>

            {/* Modal tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid #E5E7EB", background: "#FAFBFC", padding: "0 28px" }}>
              {[
                { id: "info", label: "📋 Informazioni", sublabel: "Dati generali" },
                { id: "services", label: "🔧 Servizi", sublabel: "Attività offerte" },
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveModalTab(tab.id)}
                  style={{
                    padding: "14px 20px", border: "none", cursor: "pointer",
                    background: activeModalTab === tab.id ? "#fff" : "transparent",
                    borderBottom: activeModalTab === tab.id ? "2px solid #2563EB" : "2px solid transparent",
                    color: activeModalTab === tab.id ? "#2563EB" : "#6B7280",
                    fontWeight: 700, fontSize: 12, fontFamily: "'Inter',sans-serif",
                    transition: "all 0.15s", marginBottom: -1
                  }}
                >
                  <div>{tab.label}</div>
                  <div style={{ fontSize: 10, fontWeight: 500, marginTop: 1 }}>{tab.sublabel}</div>
                </button>
              ))}
            </div>

            {/* Modal body */}
            <div style={{ padding: "24px 28px" }}>

              {/* ─── TAB: Info ─── */}
              {activeModalTab === "info" && (
                <div>
                  {/* Identification */}
                  <div style={{
                    background: "#F0FDF4", padding: 18, borderRadius: 12,
                    border: "1px solid #BBF7D0", marginBottom: 20
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <h4 style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#166534", letterSpacing: "0.05em" }}>
                        IDENTIFICAZIONE OFFERTA
                      </h4>

                      {/* Link Mode Selector */}
                      <div style={{ display: "flex", gap: 16 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: linkMode === "new" ? "#166534" : "#6B7280", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                          <input type="radio" name="linkMode" value="new" checked={linkMode === "new"} onChange={() => setLinkMode("new")} style={{ accentColor: "#166534", cursor: "pointer" }} />
                          Nuovo Preventivo
                        </label>
                        <label style={{ fontSize: 11, fontWeight: 700, color: linkMode === "existing" ? "#166534" : "#6B7280", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                          <input type="radio" name="linkMode" value="existing" checked={linkMode === "existing"} onChange={() => setLinkMode("existing")} style={{ accentColor: "#166534", cursor: "pointer" }} />
                          Collega a Esistente
                        </label>
                      </div>
                    </div>

                    {linkMode === "existing" ? (
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#374151" }}>Seleziona Preventivo Sistem</label>
                        <select value={form.commessa_id || ""}
                          onChange={e => {
                            const selectedId = e.target.value;
                            const prev = existingPreventivi.find(p => String(p.commessa_id) === selectedId);
                            setForm({
                              ...form,
                              commessa_id: prev?.commessa_id || null,
                              preventivo_number: prev ? prev.preventivo : ""
                            });
                          }}
                          style={{ ...inpStyle, width: "100%", maxWidth: 600 }}>
                          <option value="">— Cerca o Seleziona un preventivo esistente —</option>
                          {existingPreventivi.map(p => (
                            <option key={p.commessa_id} value={p.commessa_id}>
                              {p.preventivo} / {p.commessa_name}
                            </option>
                          ))}
                        </select>
                        <p style={{ margin: "6px 0 0", fontSize: 11, color: "#059669" }}>
                          Selezionando un preventivo esistente, l'offerta verrà automaticamente agganciata a quel progetto in fase di accettazione.
                        </p>
                      </div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 14 }}>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 700, color: "#374151" }}>Anno</label>
                          <input type="number" value={form.anno}
                            onChange={e => setForm({ ...form, anno: parseInt(e.target.value) || 0 })}
                            style={inpStyle} placeholder="26" />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 700, color: "#374151" }}>Tipo</label>
                          <select value={form.tipo}
                            onChange={e => setForm({ ...form, tipo: e.target.value })}
                            style={inpStyle}>
                            {OFFER_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 700, color: "#374151" }}>Numero PR</label>
                          <input type="text" value={form.preventivo_number}
                            onChange={e => setForm({ ...form, preventivo_number: e.target.value })}
                            style={inpStyle} placeholder="Es: 19 o PR-19" />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 700, color: "#374151" }}>Revisione</label>
                          <input type="number" value={form.revision}
                            onChange={e => setForm({ ...form, revision: parseInt(e.target.value) || 0 })}
                            style={inpStyle} placeholder="0" />
                        </div>
                        <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 4 }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#374151" }}>
                            <input type="checkbox" checked={form.is_final_revision}
                              onChange={e => setForm({ ...form, is_final_revision: e.target.checked })}
                              style={{ width: 16, height: 16, cursor: "pointer" }} />
                            Rev. Finale
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Project info */}
                  <div style={{
                    background: "#EFF6FF", padding: 18, borderRadius: 12,
                    border: "1px solid #BFDBFE", marginBottom: 20
                  }}>
                    <h4 style={{ margin: "0 0 14px", fontSize: 11, fontWeight: 800, color: "#1D4ED8", letterSpacing: "0.05em" }}>
                      DATI PROGETTO
                    </h4>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: "#374151" }}>Oggetto</label>
                        <input value={form.oggetto}
                          onChange={e => setForm({ ...form, oggetto: e.target.value })}
                          style={inpStyle} placeholder="Descrizione del progetto" />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: "#374151" }}>Committente</label>
                        <input value={form.committente}
                          onChange={e => setForm({ ...form, committente: e.target.value })}
                          style={inpStyle} placeholder="Riferimento/intermediario" />
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: "#374151" }}>Cliente</label>
                        <div style={{ display: "flex", gap: 6 }}>
                          <select value={form.client_id}
                            onChange={e => {
                              const cl = clients.find(c => String(c.id) === e.target.value);
                              setForm({ ...form, client_id: e.target.value, cliente: cl?.name || form.cliente });
                            }}
                            style={{ ...inpStyle, flex: 1 }}>
                            <option value="">— Seleziona / Nuovo —</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                        {!form.client_id && (
                          <input value={form.cliente}
                            onChange={e => setForm({ ...form, cliente: e.target.value })}
                            style={{ ...inpStyle, marginTop: 6 }} placeholder="Nome cliente libero" />
                        )}
                      </div>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: "#374151" }}>Superficie</label>
                        <input value={form.superficie}
                          onChange={e => setForm({ ...form, superficie: e.target.value })}
                          style={inpStyle} placeholder="es. 5.000 mq" />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: "#374151" }}>Destinazione d'uso</label>
                        <select value={form.destinazione_uso}
                          onChange={e => setForm({ ...form, destinazione_uso: e.target.value })}
                          style={inpStyle}>
                          <option value="">— Seleziona —</option>
                          {DESTINAZIONI_USO.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: "#374151" }}>Importo Opere (€)</label>
                        <input value={form.importo_opere}
                          onChange={e => setForm({ ...form, importo_opere: e.target.value })}
                          style={inpStyle} placeholder="0" />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: "#374151" }}>Periodo Inizio</label>
                        <input type="date" value={form.periodo_inizio}
                          onChange={e => setForm({ ...form, periodo_inizio: e.target.value })}
                          style={inpStyle} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: "#374151" }}>Periodo Fine</label>
                        <input type="date" value={form.periodo_fine}
                          onChange={e => setForm({ ...form, periodo_fine: e.target.value })}
                          style={inpStyle} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: "#374151" }}>Stato</label>
                        <select value={form.status}
                          onChange={e => setForm({ ...form, status: e.target.value })}
                          style={inpStyle}>
                          {OFFER_STATUSES.map(s => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: "#374151" }}>Specifiche Tecniche</label>
                        <textarea value={form.specifiche}
                          onChange={e => setForm({ ...form, specifiche: e.target.value })}
                          style={{ ...inpStyle, height: 60, resize: "vertical" }} placeholder="Requisiti, dettagli tecnici..." />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: "#374151" }}>Note Interne</label>
                        <textarea value={form.note}
                          onChange={e => setForm({ ...form, note: e.target.value })}
                          style={{ ...inpStyle, height: 60, resize: "vertical" }} placeholder="Commenti interni, promemoria..." />
                      </div>
                    </div>
                  </div>

                  {/* Totale calcolato */}
                  <div style={{
                    background: "#F5F3FF", padding: "14px 18px", borderRadius: 12,
                    border: "1px solid #DDD6FE", display: "flex", justifyContent: "space-between", alignItems: "center"
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#7C3AED" }}>
                      Valore Totale Offerta (calcolato dalle attività)
                    </span>
                    <span style={{ fontSize: 22, fontWeight: 800, color: "#7C3AED" }}>
                      {fmtK(calculateOfferTotal(form.lines))} k€
                    </span>
                  </div>
                </div>
              )}

              {/* ─── TAB: Services ─── */}
              {activeModalTab === "services" && (
                <div>
                  <div style={{ marginBottom: 16, fontSize: 12, color: "#6B7280" }}>
                    Seleziona i servizi inclusi nell'offerta e inserisci i valori in k€. Questi verranno collegati alle attività del sistema.
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    {SERVICE_CATEGORIES.map(cat => {
                      const catLines = form.lines[cat.id] || {};
                      const catTotal = Object.values(catLines).reduce((s, a) => a.included ? s + (parseFloat(a.valore) || 0) : s, 0);
                      const hasAny = Object.values(catLines).some(a => a.included);

                      return (
                        <div key={cat.id} style={{
                          background: hasAny ? cat.bg : "#FAFBFC",
                          border: `1.5px solid ${hasAny ? cat.color + "40" : "#E5E7EB"}`,
                          borderRadius: 12, padding: "14px 16px",
                          transition: "all 0.2s"
                        }}>
                          <div style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            marginBottom: 10
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{
                                width: 8, height: 8, borderRadius: "50%", background: cat.color
                              }} />
                              <span style={{ fontSize: 12, fontWeight: 800, color: cat.color }}>{cat.label}</span>
                            </div>
                            {catTotal > 0 && (
                              <span style={{
                                fontSize: 11, fontWeight: 700, color: cat.color,
                                background: "#fff", padding: "2px 8px", borderRadius: 6,
                                border: `1px solid ${cat.color}30`
                              }}>{fmtK(catTotal)} k€</span>
                            )}
                          </div>

                          {cat.activities.map(act => {
                            const lineData = catLines[act.key];
                            const isIncluded = lineData?.included;

                            return (
                              <div key={act.key} style={{
                                display: "flex", alignItems: "center", gap: 8,
                                padding: "6px 0", borderBottom: "1px solid rgba(0,0,0,0.05)"
                              }}>
                                <input
                                  type="checkbox"
                                  checked={!!isIncluded}
                                  onChange={() => handleLineToggle(cat.id, act.key)}
                                  style={{ width: 16, height: 16, cursor: "pointer", accentColor: cat.color }}
                                />
                                <span style={{
                                  flex: 1, fontSize: 12, fontWeight: isIncluded ? 600 : 400,
                                  color: isIncluded ? "#111827" : "#9CA3AF"
                                }}>{act.label}</span>
                                {isIncluded && (
                                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <input
                                      type="number"
                                      value={lineData?.valore || ""}
                                      onChange={e => handleLineValueChange(cat.id, act.key, e.target.value)}
                                      style={{
                                        width: 90, padding: "4px 8px", borderRadius: 6,
                                        border: "1.5px solid #E5E7EB", fontSize: 12,
                                        fontWeight: 600, textAlign: "right", outline: "none",
                                        fontFamily: "'Inter',sans-serif"
                                      }}
                                      placeholder="0"
                                    />
                                    <span style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600 }}>k€</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>

                  {/* Grand total */}
                  <div style={{
                    marginTop: 20, background: "#F5F3FF", padding: "14px 18px", borderRadius: 12,
                    border: "1px solid #DDD6FE", display: "flex", justifyContent: "space-between", alignItems: "center"
                  }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#7C3AED" }}>Totale Offerta</span>
                      <span style={{ fontSize: 11, color: "#9CA3AF", marginLeft: 8 }}>
                        ({countIncludedActivities(form.lines)} attività selezionate)
                      </span>
                    </div>
                    <span style={{ fontSize: 24, fontWeight: 800, color: "#7C3AED" }}>
                      {fmtK(calculateOfferTotal(form.lines))} k€
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div style={{
              padding: "16px 28px", borderTop: "1px solid #E5E7EB",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              position: "sticky", bottom: 0, background: "#fff", borderRadius: "0 0 18px 18px"
            }}>
              <button onClick={() => setShowModal(false)}
                style={{
                  padding: "10px 20px", background: "#F3F4F6", color: "#374151",
                  border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 13,
                  fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif"
                }}>
                Annulla
              </button>
              <div style={{ display: "flex", gap: 10 }}>
                {activeModalTab === "info" && (
                  <button onClick={() => setActiveModalTab("services")}
                    style={{
                      padding: "10px 20px", background: "#EFF6FF", color: "#2563EB",
                      border: "1.5px solid #BFDBFE", borderRadius: 10, fontSize: 13,
                      fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif"
                    }}>
                    Avanti → Servizi
                  </button>
                )}
                <button onClick={handleSave}
                  style={{
                    padding: "10px 24px", background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
                    color: "#fff", border: "none", borderRadius: 10, fontSize: 13,
                    fontWeight: 700, cursor: "pointer", fontFamily: "'Inter',sans-serif",
                    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)"
                  }}>
                  {editingOffer ? "Salva Modifiche" : "Crea Offerta"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
