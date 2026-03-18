import { useState, useEffect } from "react";
import * as api from "../api";
import { GENERAL_COST_FIELDS } from "../constants/costConstants.js";

export default function ProjectFinances({ isHR }) {
  const currentYear = new Date().getFullYear();
  const YEAR_OPTIONS = ["all", currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
  const [selectedYear, setSelectedYear] = useState("all");

  const [loading, setLoading] = useState(false);
  const [costs, setCosts] = useState([]);
  const [finances, setFinances] = useState({ tasks: [], task_hours: [] });
  const [fatturatoByTask, setFatturatoByTask] = useState([]);

  const fmtEu = (num) => parseFloat(num || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const parseEuNum = (val) => {
    if (!val) return 0;
    if (typeof val === "number") return val;
    let str = String(val).trim().replace(/[^0-9,.-]/g, "");
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) {
      return parseFloat(str.replace(/\./g, "").replace(",", "."));
    } else {
      const dotCount = (str.match(/\./g) || []).length;
      if (dotCount > 1) return parseFloat(str.replace(/\./g, ""));
      return parseFloat(str.replace(/,/g, "")) || 0;
    }
  };

  const [generalCosts, setGeneralCosts] = useState({ rent: 0, operating: 0, equipment: 0, unexpected: 0 });
  const [yearlyGeneralCosts, setYearlyGeneralCosts] = useState({}); // { '24': 10000, '25': 15000 }
  const [generalCostsInput, setGeneralCostsInput] = useState({ rent: "", operating: "", equipment: "", unexpected: "" });
  const [savingGeneralCost, setSavingGeneralCost] = useState({});

  useEffect(() => {
    if (!isHR) return;
    setLoading(true);
    // Load general costs
    api.getCosts(selectedYear).then(setCosts).catch(console.error);

    // Load finances and weights
    Promise.all([
      api.getTaskFinances(selectedYear),
      api.getSettings(),
      api.getFatturatoByTask(selectedYear)
    ]).then(([fin, settings, byTask]) => {
      setFinances(fin);
      setFatturatoByTask(byTask);

      // Extract and sum general costs
      const vals = {};
      const yearlyTotals = {};

      GENERAL_COST_FIELDS.forEach(field => {
        if (selectedYear === 'all') {
          // Sum across all years (keys like gc_rent_2024, gc_rent_2025...)
          const prefix = `gc_${field.key}_`;
          Object.keys(settings).forEach(k => {
            if (k.startsWith(prefix)) {
              const numVal = parseFloat(settings[k]) || 0;
              const longYear = k.replace(prefix, ''); // "2024"
              const shortYear = longYear.slice(2);    // "24"

              vals[field.key] = (vals[field.key] || 0) + numVal;
              yearlyTotals[shortYear] = (yearlyTotals[shortYear] || 0) + numVal;
            }
          });
        } else {
          // Single target year
          const singleVal = parseFloat(settings[`gc_${field.key}_${selectedYear}`]) || 0;
          vals[field.key] = singleVal;
          const shortYear = String(selectedYear).slice(2);
          yearlyTotals[shortYear] = (yearlyTotals[shortYear] || 0) + singleVal;
        }
      });

      setGeneralCosts(vals);
      setYearlyGeneralCosts(yearlyTotals);
      setGeneralCostsInput({
        rent: vals.rent || "",
        operating: vals.operating || "",
        equipment: vals.equipment || "",
        unexpected: vals.unexpected || "",
      });
    }).catch(console.error).finally(() => setLoading(false));
  }, [isHR, selectedYear]);

  if (!isHR) {
    return <div style={{ padding: 40, textAlign: "center", color: "#6B7280" }}>Unauthorized access. HR privileges required.</div>;
  }

  const handleSaveGeneralCost = async (field, value) => {
    const numVal = parseFloat(value) || 0;
    setGeneralCosts(p => ({ ...p, [field]: numVal }));
    setSavingGeneralCost(p => ({ ...p, [field]: true }));
    try {
      // Assume backend saves the string representation
      await api.updateSetting(`gc_${field}_${selectedYear}`, String(numVal));
    } catch (err) { console.error(err); }
    setSavingGeneralCost(p => ({ ...p, [field]: false }));
  };

  const totalGeneralCost = GENERAL_COST_FIELDS.reduce((sum, f) => sum + (generalCosts[f.key] || 0), 0);

  // Weights are now year-aware. Group fatturatoByTask by year
  const fattByYear = {};
  fatturatoByTask.forEach(r => {
    if (!fattByYear[r.year_code]) fattByYear[r.year_code] = [];
    fattByYear[r.year_code].push(r);
  });

  const yearlyTotalWeights = {};
  Object.keys(fattByYear).forEach(y => {
    yearlyTotalWeights[y] = fattByYear[y].reduce((sum, r) => sum + parseEuNum(r.total_valore_ordine), 0);
  });

  // Task-specific summed values for display
  const getTaskFattData = (taskId) => {
    const relevant = fatturatoByTask.filter(r => r.task_id === taskId);
    return {
      total_valore_ordine: relevant.reduce((sum, r) => sum + parseEuNum(r.total_valore_ordine), 0),
      total_fatturato: relevant.reduce((sum, r) => sum + parseEuNum(r.total_fatturato), 0),
      total_scheduled: relevant.reduce((sum, r) => sum + parseEuNum(r.total_scheduled_amount), 0),
      byYear: relevant
    };
  };

  // The core refined logic: sum of (YearlyProjectWeight / YearlyTotalWeight * YearlyTotalGeneralCost)
  const getExtraCost = (taskId) => {
    const taskData = getTaskFattData(taskId);
    let totalExtra = 0;

    taskData.byYear.forEach(yData => {
      const year = yData.year_code;
      const yearTotalWeight = yearlyTotalWeights[year] || 0;
      const yearTotalGC = yearlyGeneralCosts[year] || 0;

      if (yearTotalWeight > 0 && yearTotalGC > 0) {
        const weight = parseEuNum(yData.total_valore_ordine);
        totalExtra += (weight / yearTotalWeight) * yearTotalGC;
      }
    });

    return totalExtra;
  };

  // Global total weight (for footer display only)
  const totalWeight = Object.values(yearlyTotalWeights).reduce((sum, w) => sum + w, 0);

  return (
    <div style={{ padding: "28px 32px", overflowY: "auto", height: "100%", fontFamily: "'Inter',sans-serif", background: "#F9FAFB" }}>

      {/* HEADER */}
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>Project Finances & Overhead Costs</h2>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value === "all" ? "all" : parseInt(e.target.value))}
              style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 14, fontWeight: 700, color: "#2563EB", background: "#EFF6FF", outline: "none", cursor: "pointer" }}
            >
              {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y === "all" ? "All Time" : y}</option>)}
            </select>
          </div>
          <p style={{ color: "#6B7280", margin: 0, fontSize: 14 }}>Allocate general costs and track profitability per project</p>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6B7280", fontSize: 13 }}>Loading financial data...</div>
      ) : (
        <>
          {/* GENEL GİDERLER PANELİ */}
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", padding: "20px 24px", marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 2 }}>OVERHEAD — {selectedYear}</div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>General Company Costs</h3>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9CA3AF" }}>These costs will be distributed across projects based on weight</p>
              </div>
              {totalGeneralCost > 0 && (
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700, letterSpacing: "0.05em", marginBottom: 2 }}>TOTAL OVERHEAD</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#EF4444" }}>
                    €{totalGeneralCost.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
              {GENERAL_COST_FIELDS.map(field => (
                <div key={field.key} style={{ background: "#F9FAFB", borderRadius: 10, padding: "14px 16px", border: "1.5px solid #E5E7EB", transition: "border-color 0.15s", opacity: selectedYear === 'all' ? 0.8 : 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 16 }}>{field.icon}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", letterSpacing: "0.05em" }}>
                      {field.label.toUpperCase()} {selectedYear === 'all' ? '(TOTAL)' : `(${selectedYear})`}
                    </span>
                    {savingGeneralCost[field.key] && (
                      <span style={{ fontSize: 10, color: "#9CA3AF", marginLeft: "auto" }}>saving…</span>
                    )}
                  </div>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#9CA3AF", pointerEvents: "none" }}>€</span>
                    <input
                      type="number" step="100" min="0" value={generalCostsInput[field.key]}
                      onChange={e => setGeneralCostsInput(p => ({ ...p, [field.key]: e.target.value }))}
                      onBlur={e => handleSaveGeneralCost(field.key, e.target.value)}
                      disabled={selectedYear === 'all'}
                      placeholder={selectedYear === 'all' ? "Sum of all years" : "Annual Total"}
                      style={{
                        width: "100%", border: `1.5px solid ${generalCosts[field.key] > 0 ? field.color + "66" : "#E5E7EB"}`,
                        borderRadius: 8, padding: "8px 10px 8px 24px", fontSize: 14, fontWeight: 700,
                        color: generalCosts[field.key] > 0 ? field.color : "#374151",
                        background: selectedYear === 'all' ? "#F3F4F6" : "#fff",
                        outline: "none", boxSizing: "border-box", fontFamily: "'Inter',sans-serif",
                        cursor: selectedYear === 'all' ? "not-allowed" : "text"
                      }}
                    />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, color: field.color, fontWeight: 600 }}>
                    {generalCosts[field.key] > 0 ? `€${generalCosts[field.key].toLocaleString("it-IT", { minimumFractionDigits: 0 })}` : " "}
                  </div>
                  {selectedYear !== 'all' && (
                    <div style={{ fontSize: 9, color: "#9CA3AF", fontStyle: "italic", marginTop: 2 }}>Annual cost for {selectedYear}</div>
                  )}
                </div>
              ))}
            </div>

            {totalGeneralCost > 0 && totalWeight > 0 && (
              <div style={{ marginTop: 14, padding: "10px 14px", background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 8, display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 14 }}>📊</span>
                <span style={{ fontSize: 12, color: "#92400E", fontWeight: 500 }}>
                  Total overhead of <strong>€{totalGeneralCost.toLocaleString("it-IT", { minimumFractionDigits: 0 })}</strong> will be distributed based on <strong>Valore Ordine</strong> across <strong>{finances.tasks.filter(t => (getTaskFattData(t.id).total_valore_ordine) > 0).length}</strong> project{finances.tasks.filter(t => (getTaskFattData(t.id).total_valore_ordine) > 0).length !== 1 ? "s" : ""} (total base: <strong>€{totalWeight.toLocaleString("it-IT", { minimumFractionDigits: 0 })}</strong>)
                </span>
              </div>
            )}
            {totalGeneralCost > 0 && totalWeight === 0 && (
              <div style={{ marginTop: 14, padding: "10px 14px", background: "#F3F4F6", border: "1px solid #E5E7EB", borderRadius: 8, display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 14 }}>💡</span>
                <span style={{ fontSize: 12, color: "#6B7280" }}>Set project weights below to distribute overhead costs across projects</span>
              </div>
            )}
          </div>

          {/* PROJE TABLOSU */}
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden", marginBottom: 24, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000 }}>
              <thead>
                <tr style={{ background: "#F9FAFB" }}>
                  {[
                    { label: "Project / Task", align: "left" },
                    { label: "Logged Hours", align: "center" },
                    { label: "Labour Cost", align: "center" },
                    ...(selectedYear !== 'all' ? [{ label: "Weight", align: "center", hint: "Relative weight for overhead distribution" }] : []),
                    { label: "Overhead Share", align: "center", hint: "Portion of general costs allocated to this project" },
                    { label: "Total Cost", align: "center" },
                    { label: "Valore Ordine", align: "center", hint: "From Fatturato Register" },
                    { label: "Fatturato", align: "center", hint: "Already Billed" },
                    { label: "Rimanente", align: "center", hint: "Valore Ordine - Fatturato" },
                    { label: "Net Profit", align: "center" },
                  ].map(h => (
                    <th key={h.label} title={h.hint || ""} style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700, color: "#43474dff", textAlign: h.align, letterSpacing: "0.05em", cursor: h.hint ? "help" : "default" }}>
                      {h.label.toUpperCase()}{h.hint ? " ℹ" : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {finances.tasks.map(task => {
                  const tHours = finances.task_hours.filter(th => th.task_id === task.id);
                  let labourCost = 0; let totalHours = 0;
                  tHours.forEach(th => {
                    const emp = costs.find(e => e.id === th.employee_id);
                    const rate = emp ? parseFloat(emp.hourly_rate_theoretical) : 0;
                    labourCost += (parseFloat(th.total_hours) * rate);
                    totalHours += parseFloat(th.total_hours);
                  });

                  const fattData = getTaskFattData(task.id);
                  const valoreOrdine = fattData.total_valore_ordine;
                  const fatturato = fattData.total_fatturato;

                  const extraCost = getExtraCost(task.id);
                  const totalCost = labourCost + extraCost;
                  const rimanente = Math.max(0, valoreOrdine - fatturato);
                  const profit = fatturato - totalCost;
                  const isProfitable = profit >= 0;

                  // Weight percentage display (Project's share of Lifetime Order Value)
                  const weightPct = (totalWeight > 0 && valoreOrdine > 0)
                    ? ((valoreOrdine / totalWeight) * 100).toFixed(1)
                    : null;

                  return (
                    <tr key={task.id} style={{ borderTop: "1px solid #F3F4F6", transition: "background 0.15s" }} onMouseEnter={(e) => e.currentTarget.style.background = "#F9FAFB"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: 600, color: "#111827" }}>{task.title}</td>
                      <td style={{ padding: "14px 16px", textAlign: "center", fontSize: 13, fontWeight: 600, color: "#374151" }}>{totalHours.toFixed(1)}h</td>
                      <td style={{ padding: "14px 16px", textAlign: "center", fontSize: 13, fontWeight: 600, color: "#DC2626" }}>- €{fmtEu(labourCost)}</td>
                      {selectedYear !== 'all' && (
                        <td style={{ padding: "14px 16px", textAlign: "center" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: (valoreOrdine > 0) ? "#4F46E5" : "#D1D5DB" }}>
                              {weightPct ? `${weightPct}%` : "—"}
                            </span>
                            {valoreOrdine > 0 && <span style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 500 }}>€{valoreOrdine.toLocaleString("it-IT", { minimumFractionDigits: 0 })}</span>}
                          </div>
                        </td>
                      )}
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        {extraCost > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#cd08f5ff" }}>- €{fmtEu(extraCost)}</span>
                            <span style={{ fontSize: 10, color: "#D1D5DB" }}>of overhead</span>
                          </div>
                        ) : <span style={{ color: "#D1D5DB", fontSize: 13 }}>—</span>}
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: totalCost > 0 ? "#DC2626" : "#D1D5DB", background: totalCost > 0 ? "#FEF2F2" : "transparent", padding: totalCost > 0 ? "3px 8px" : "0", borderRadius: 6 }}>
                          {totalCost > 0 ? `- €${fmtEu(totalCost)}` : "—"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center", color: "#6366F1", fontWeight: 600 }}>{valoreOrdine > 0 ? `€${fmtEu(valoreOrdine)}` : "—"}</td>
                      <td style={{ padding: "14px 16px", textAlign: "center", color: "#059669", fontWeight: 700 }}>
                        {fatturato > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                            <span style={{ fontSize: 13, fontWeight: 700 }}>€{fmtEu(fatturato)}</span>
                            {valoreOrdine > 0 && (
                              <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 500 }}>({((fatturato / valoreOrdine) * 100).toFixed(1)}%)</span>
                            )}
                          </div>
                        ) : "—"}
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center", color: rimanente > 0 ? "#F59E0B" : "#6B7280", fontWeight: 600 }}>{valoreOrdine > 0 ? `€${fmtEu(rimanente)}` : "—"}</td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        {fatturato > 0 || totalCost > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                            <span style={{ fontSize: 14, fontWeight: 800, color: isProfitable ? "#059669" : "#DC2626", background: isProfitable ? "#F0FDF4" : "#FEF2F2", padding: "4px 10px", borderRadius: 6 }}>
                              {isProfitable ? "+" : ""}€{profit.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            {extraCost > 0 && <span style={{ fontSize: 10, color: "#9CA3AF" }}>incl. overhead</span>}
                          </div>
                        ) : <span style={{ color: "#D1D5DB", fontSize: 13 }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* TOTALS ROW */}
              {finances.tasks.length > 0 && (() => {
                let grandLabour = 0, grandFatturato = 0, grandValore = 0, grandHours = 0, grandExtra = 0;
                finances.tasks.forEach(task => {
                  const tHours = finances.task_hours.filter(th => th.task_id === task.id);
                  tHours.forEach(th => {
                    const emp = costs.find(e => e.id === th.employee_id);
                    const rate = emp ? parseFloat(emp.hourly_rate_theoretical) : 0;
                    grandLabour += parseFloat(th.total_hours) * rate;
                    grandHours += parseFloat(th.total_hours);
                  });
                  grandExtra += getExtraCost(task.id);
                  const fattData = getTaskFattData(task.id);
                  grandFatturato += fattData.total_fatturato;
                  grandValore += fattData.total_valore_ordine;
                });
                const grandTotal = grandLabour + grandExtra;
                const grandRimanente = Math.max(0, grandValore - grandFatturato);
                const grandProfit = grandFatturato - grandTotal;
                return (
                  <tfoot>
                    <tr style={{ background: "#F9FAFB", borderTop: "2px solid #E5E7EB" }}>
                      <td style={{ padding: "12px 16px", fontSize: 12, fontWeight: 700, color: "#6B7280" }}>TOTALS</td>
                      <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 700, color: "#374151" }}>{grandHours.toFixed(1)}h</td>
                      <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 700, color: "#DC2626" }}>- €{fmtEu(grandLabour)}</td>
                      {selectedYear !== 'all' && (
                        <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 11, color: "#9CA3AF" }}>Σ €{totalWeight.toLocaleString("it-IT", { minimumFractionDigits: 0 })}</td>
                      )}
                      <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 700, color: "#cd08f5ff" }}>- €{fmtEu(grandExtra)}</td>
                      <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 700, color: "#DC2626" }}>- €{fmtEu(grandTotal)}</td>
                      <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 700, color: "#6366F1" }}>€{fmtEu(grandValore)}</td>
                      <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 700, color: "#059669" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <span>€{fmtEu(grandFatturato)}</span>
                          {grandValore > 0 && (
                            <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 500 }}>({((grandFatturato / grandValore) * 100).toFixed(1)}%)</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 700, color: grandRimanente > 0 ? "#F59E0B" : "#6B7280" }}>€{fmtEu(grandRimanente)}</td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: grandProfit >= 0 ? "#059669" : "#DC2626", background: grandProfit >= 0 ? "#F0FDF4" : "#FEF2F2", padding: "4px 10px", borderRadius: 6 }}>
                          {grandProfit >= 0 ? "+" : ""}€{grandProfit.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                );
              })()}
            </table>
          </div>
        </>
      )}
    </div>
  );
}
