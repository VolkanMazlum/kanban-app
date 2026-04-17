import React, { useState, useEffect, useMemo } from "react";
import * as api from "../api";
import { OFFER_STATUSES, OFFER_TYPES, SERVICE_CATEGORIES } from "../constants/offerteConstants.js";

// -- Formatting helpers --
const fmtK = (num) => {
  const v = parseFloat(num) || 0;
  return v.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 1 }) + " k€";
};

const fmtEuro = (num) => {
  const v = parseFloat(num) || 0;
  return "€" + v.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

export default function OfferteKPI() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterYear, setFilterYear] = useState("all");
  const [availableYears, setAvailableYears] = useState([]);

  useEffect(() => {
    api.getAvailableYears().then(setAvailableYears).catch(console.error);
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.getOfferteKPI(filterYear);
        setData(res);
      } catch (err) {
        console.error("Failed to load Offerte KPIs", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [filterYear]);

  const stats = useMemo(() => {
    if (!data || !data.overall) return {};
    const { total_count, total_value, accepted_count, accepted_value } = data.overall;
    const convRate = total_count > 0 ? Math.round((accepted_count / total_count) * 100) : 0;
    return {
      total_count: parseInt(total_count) || 0,
      total_value: parseFloat(total_value) || 0,
      accepted_count: parseInt(accepted_count) || 0,
      accepted_value: parseFloat(accepted_value) || 0,
      convRate
    };
  }, [data]);

  if (loading && !data) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 12, color: "#9CA3AF" }}>
        <div style={{ width: 32, height: 32, border: "3px solid #E5E7EB", borderTop: "3px solid #2563EB", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        Caricamento statistiche...
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ padding: "28px 32px", overflowY: "auto", height: "100%", fontFamily: "'Inter',sans-serif", background: "#F9FAFB" }}>
      
      {/* HEADER */}
      <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: "#111827", margin: 0, letterSpacing: "-0.025em" }}>Offerte KPI & Statistics</h2>
          <p style={{ color: "#6B7280", margin: "4px 0 0", fontSize: 14 }}>Analisi delle performance commerciali e trend annuali</p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", background: "#fff", padding: "6px 14px", borderRadius: 12, border: "1.5px solid #E5E7EB" }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#9CA3AF" }}>ANNO DI RIFERIMENTO:</span>
          <select 
            value={filterYear} 
            onChange={e => setFilterYear(e.target.value)}
            style={{ border: "none", background: "none", fontSize: 14, fontWeight: 700, outline: "none", color: "#2563EB", cursor: "pointer" }}
          >
            <option value="all">Tutti gli anni</option>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Volume Totale", val: stats.total_count, icon: "📊", color: "#2563EB", bg: "#EFF6FF" },
          { label: "Valore Preventivato", val: fmtK(stats.total_value), icon: "💰", color: "#7C3AED", bg: "#F5F3FF" },
          { label: "Valore Accettato", val: fmtK(stats.accepted_value), icon: "✅", color: "#059669", bg: "#ECFDF5" },
          { label: "Conversion Rate", val: `${stats.convRate}%`, icon: "📈", color: "#F59E0B", bg: "#FFFBEB" },
        ].map((c, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 16, padding: "20px 24px", border: "1.5px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 24 }}>{c.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: c.color, background: c.bg, padding: "2px 8px", borderRadius: 6, letterSpacing: "0.05em" }}>{c.label.toUpperCase()}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#111827" }}>{c.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr", gap: 16, marginBottom: 24 }}>
        
        {/* ANNUAL TREND CHART */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1.5px solid #E5E7EB" }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 4, height: 16, background: "#2563EB", borderRadius: 2 }} />
            Trend Annuale (Volume & Valore)
          </h3>
          <div style={{ height: 260, display: "flex", alignItems: "flex-end", gap: 24, paddingBottom: 20, borderBottom: "1.5px solid #F3F4F6" }}>
            {data.trend.map(t => {
              const maxVal = Math.max(...data.trend.map(x => parseFloat(x.total_val) || 1));
              const hTotal = ((parseFloat(t.total_val) || 0) / maxVal) * 200;
              const hAccepted = ((parseFloat(t.accepted_val) || 0) / maxVal) * 200;
              
              return (
                <div key={t.anno} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <div style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 4, height: 200 }}>
                    {/* Potential bar */}
                    <div title={`Potenziale: ${fmtK(t.total_val)}`} style={{ width: 14, height: hTotal, background: "#DBEAFE", borderRadius: "4px 4px 0 0", position: "relative" }}>
                      {/* Accepted bar (overlapping or side by side?) - Let's do side by side or layered */}
                      <div title={`Accettato: ${fmtK(t.accepted_val)}`} style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: hAccepted, background: "#2563EB", borderRadius: "4px 4px 0 0" }} />
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#111827" }}>{t.anno}</div>
                    <div style={{ fontSize: 9, color: "#9CA3AF", fontWeight: 700 }}>{t.count} OFF.</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 20 }}>
             <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
               <div style={{ width: 10, height: 10, borderRadius: 3, background: "#DBEAFE" }} />
               <span style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>Volume Totale</span>
             </div>
             <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
               <div style={{ width: 10, height: 10, borderRadius: 3, background: "#2563EB" }} />
               <span style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>Volume Accettato</span>
             </div>
          </div>
        </div>

        {/* STATUS DISTRIBUTION */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1.5px solid #E5E7EB" }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 20 }}>Distribuzione per Stato</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {OFFER_STATUSES.map(s => {
              const d = data.statusDist.find(x => x.status === s.id) || { count: 0, total: 0 };
              const pct = stats.total_count > 0 ? (d.count / stats.total_count) * 100 : 0;
              return (
                <div key={s.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11, fontWeight: 700 }}>
                    <span style={{ color: "#374151" }}>{s.icon} {s.label}</span>
                    <span style={{ color: "#9CA3AF" }}>{d.count} ({Math.round(pct)}%)</span>
                  </div>
                  <div style={{ height: 8, background: "#F3F4F6", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: s.color, borderRadius: 4 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        
        {/* SERVICE CATEGORIES BREAKDOWN */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1.5px solid #E5E7EB" }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 20 }}>Analisi per Settore (Valore)</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {data.categoryDist.sort((a,b) => b.total - a.total).slice(0, 8).map(c => {
              const cat = SERVICE_CATEGORIES.find(x => x.id === c.category);
              const maxCat = Math.max(...data.categoryDist.map(x => parseFloat(x.total) || 1));
              const pct = (parseFloat(c.total) / maxCat) * 100;
              return (
                <div key={c.category}>
                   <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11, fontWeight: 700 }}>
                    <span style={{ color: "#374151" }}>{cat?.label || c.category}</span>
                    <span style={{ color: cat?.color || "#6B7280" }}>{fmtK(c.total)}</span>
                  </div>
                  <div style={{ height: 6, background: "#F3F4F6", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: cat?.color || "#6B7280", borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* TOP CLIENTS */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1.5px solid #E5E7EB" }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 20 }}>Top 10 Clienti (per Valore)</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {data.topClients.map((c, idx) => {
              const maxClient = data.topClients[0]?.total || 1;
              const pct = (parseFloat(c.total) / maxClient) * 100;
              return (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#F3F4F6", color: "#6B7280", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800 }}>{idx + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11, fontWeight: 700 }}>
                      <span style={{ color: "#111827" }}>{c.cliente || "Sconosciuto"}</span>
                      <span style={{ color: "#2563EB" }}>{fmtK(c.total)}</span>
                    </div>
                    <div style={{ height: 4, background: "#F3F4F6", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: "#2563EB", borderRadius: 2 }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
