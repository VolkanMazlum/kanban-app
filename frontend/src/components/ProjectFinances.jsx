import { useState, useEffect } from "react";
import * as api from "../api";
import { GENERAL_COST_FIELDS } from "../constants/costConstants.js";

export default function ProjectFinances({ isHR }) {
  const currentYear = new Date().getFullYear();
  const YEAR_OPTIONS = ["all", ...Array.from({ length: currentYear - 2024 + 4 }, (_, i) => 2024 + i)];
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


  // Calculate weights for total overhead distribution
  // If a specific year is selected, all active tasks in that year share the overhead
  const yearlyTotalWeights = {};
  if (selectedYear !== 'all') {
    const yearCode = String(selectedYear).slice(2);
    yearlyTotalWeights[yearCode] = fatturatoByTask.reduce((sum, r) => sum + parseEuNum(r.total_valore_ordine), 0);
  } else {
    // For 'all' view, group by starting year prefix
    fatturatoByTask.forEach(r => {
      yearlyTotalWeights[r.year_code] = (yearlyTotalWeights[r.year_code] || 0) + parseEuNum(r.total_valore_ordine);
    });
  }

  // Calculate Fixed Consultant costs for the period
  const weightYears = Object.keys(yearlyTotalWeights).map(y => parseInt("20" + y));
  const gcYears = Object.keys(yearlyGeneralCosts).map(y => parseInt("20" + y));
  const dataYears = Array.from(new Set([...weightYears, ...gcYears]));
  if (dataYears.length === 0) dataYears.push(currentYear);

  const targetYearsForConsultants = selectedYear === "all" ? dataYears : [parseInt(selectedYear)];
  
  let totalConsultantFixed = 0;
  targetYearsForConsultants.forEach(y => {
    costs.filter(e => e.category === 'consultant').forEach(e => {
      const hr = e.hr_details || {};
      const startYear = hr.inizio_lavoro ? new Date(hr.inizio_lavoro).getFullYear() : -Infinity;
      const endYear = hr.scadenza_contratto ? new Date(hr.scadenza_contratto).getFullYear() : Infinity;

      if (y >= startYear && y <= endYear) {
        totalConsultantFixed += (parseFloat(e.current_annual_gross) || 0);
      }
    });
  });

  // Task-specific summed values for display
  const getTaskFattData = (taskId) => {
    const relevant = fatturatoByTask.filter(r => r.task_id === taskId);
    return {
      total_valore_ordine: relevant.length > 0 ? parseEuNum(relevant[0].total_valore_ordine) : 0,
      total_fatturato: relevant.reduce((sum, r) => sum + parseEuNum(r.total_fatturato), 0),
      total_scheduled: relevant.reduce((sum, r) => sum + parseEuNum(r.total_scheduled_amount), 0),
      total_extra_costs: relevant.reduce((sum, r) => sum + (parseFloat(r.total_extra_costs) || 0), 0),
      byYear: relevant
    };
  };

  // The core refined logic: sum of (YearlyProjectWeight / YearlyTotalWeight * YearlyTotalGeneralCost)
  const getExtraCost = (taskId) => {
    const taskData = getTaskFattData(taskId);

    let totalExtra = 0;
    taskData.byYear.forEach(yData => {
      // If we are in a specific year view, we use that year's overhead pool.
      // If 'all', we use the pool matching the project's year_code.
      const year = (selectedYear !== "all") ? String(selectedYear).slice(-2) : yData.year_code;
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
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>Structure & General Costs</h3>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9CA3AF" }}>General company operating expenses</p>
              </div>
              <div style={{ textAlign: "right", display: "flex", gap: 24 }}>
                {totalConsultantFixed > 0 && (
                   <div>
                    <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700, letterSpacing: "0.05em", marginBottom: 2 }}>CONSULTANTS (FIXED)</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#F59E0B" }}>
                      €{totalConsultantFixed.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                  </div>
                )}
                {totalGeneralCost > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700, letterSpacing: "0.05em", marginBottom: 2 }}>TOTAL OVERHEAD (GC)</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#EF4444" }}>
                      €{totalGeneralCost.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                  </div>
                )}
              </div>
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
                </div>
              ))}
            </div>
          </div>

          {/* PROJE TABLOSU */}
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden", marginBottom: 24, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000 }}>
              <thead>
                <tr style={{ background: "#F9FAFB" }}>
                  {[
                    { label: "Project / Task", align: "left" },
                    { label: "Logged Hours", align: "center" },
                    { label: "Internal Lab.", align: "center", hint: "Direct Labor (Internal Staff)" },
                    { label: "Weight", align: "center" },
                    { label: "Overhead", align: "center", hint: "Allocated General Costs" },
                    { label: "Direct Extra", align: "center", hint: "Commessa-specific costs (Tickets, etc.)" },
                    { label: "Total Cost", align: "center" },
                    { label: "Valore Ordine", align: "center" },
                    { label: "Fatturato", align: "center" },
                    { label: "Rimanente", align: "center" },
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
                  // Dynamic Visibility: The API now returns tasks that are active in the selected year.
                  // No more prefix-based filtering here.

                  const internalLabourCost = task.internal_cost || 0;
                  const totalHrs = task.total_hours || 0;

                  const fattData = getTaskFattData(task.id, task.comm_number);
                  const valoreOrdine = fattData.total_valore_ordine;
                  const fatturato = fattData.total_fatturato;
                  const directExtra = fattData.total_extra_costs;
 
                  const overheadGC = getExtraCost(task.id);
                  const totalCost = internalLabourCost + overheadGC + directExtra;
                  const profit = fatturato - totalCost;
                  const isProfitable = profit >= 0;

                  const weightPct = (totalWeight > 0 && valoreOrdine > 0)
                    ? ((valoreOrdine / totalWeight) * 100).toFixed(1)
                    : null;

                  return (
                    <tr key={task.id} style={{ borderTop: "1px solid #F3F4F6", transition: "background 0.15s" }} onMouseEnter={(e) => e.currentTarget.style.background = "#F9FAFB"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: 600, color: "#111827" }}>{task.title}</td>
                      <td style={{ padding: "14px 16px", textAlign: "center", fontSize: 13, fontWeight: 600, color: "#374151" }}>{totalHrs.toFixed(1)}h</td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>€{fmtEu(internalLabourCost)}</div>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: weightPct ? "#4F46E5" : "#D1D5DB" }}>{weightPct ? `${weightPct}%` : "—"}</span>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#cd08f5ff" }}>€{fmtEu(overheadGC)}</span>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#6366F1" }}>€{fmtEu(directExtra)}</span>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#DC2626", background: "#FEF2F2", padding: "3px 8px", borderRadius: 6 }}>€{fmtEu(totalCost)}</span>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center", color: "#6366F1", fontWeight: 600 }}>€{fmtEu(valoreOrdine)}</td>
                      <td style={{ padding: "14px 16px", textAlign: "center", color: "#059669", fontWeight: 700 }}>€{fmtEu(fatturato)}</td>
                      <td style={{ padding: "14px 16px", textAlign: "center", color: (valoreOrdine - fatturato) > 1 ? "#F59E0B" : "#D1D5DB", fontWeight: 700 }}>
                        €{fmtEu(Math.max(0, valoreOrdine - fatturato))}
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: isProfitable ? "#059669" : "#DC2626", background: isProfitable ? "#F0FDF4" : "#FEF2F2", padding: "4px 10px", borderRadius: 6 }}>
                          €{fmtEu(profit)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                {(() => {
                  const tableData = finances.tasks.map(task => {
                    const fattData = getTaskFattData(task.id, task.comm_number);
                    return {
                      hours: task.total_hours || 0,
                      labor: task.internal_cost || 0,
                      overhead: getExtraCost(task.id),
                      directExtra: fattData.total_extra_costs,
                      valore: fattData.total_valore_ordine,
                      fatturato: fattData.total_fatturato
                    };
                  });

                  const tHours = tableData.reduce((s, d) => s + d.hours, 0);
                  const tInt = tableData.reduce((s, d) => s + d.labor, 0);
                  const tOver = tableData.reduce((s, d) => s + d.overhead, 0);
                  const tDirExtra = tableData.reduce((s, d) => s + d.directExtra, 0);
                  const tVal = tableData.reduce((s, d) => s + d.valore, 0);
                  const tFat = tableData.reduce((s, d) => s + d.fatturato, 0);
                  const tTotal = tInt + tOver + tDirExtra;
                  const tProf = tFat - tTotal;
                  const finalCompanyNetProfit = tProf - totalConsultantFixed;

                  return (
                    <>
                      <tr key="totals-row" style={{ background: "#F9FAFB", borderTop: "2px solid #E5E7EB", fontWeight: 800 }}>
                        <td style={{ padding: "12px 16px" }}>GROSS TOTALS</td>
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>{tHours.toFixed(1)}h</td>
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>€{fmtEu(tInt)}</td>
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>100%</td>
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>€{fmtEu(tOver)}</td>
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>€{fmtEu(tDirExtra)}</td>
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>€{fmtEu(tTotal)}</td>
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>€{fmtEu(tVal)}</td>
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>€{fmtEu(tFat)}</td>
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>€{fmtEu(Math.max(0, tVal - tFat))}</td>
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>€{fmtEu(tProf)}</td>
                      </tr>
                      {/* Company Deductions */}
                      <tr key="consultant-deduction" style={{ background: "#FEF2F2", fontWeight: 700 }}>
                         <td colSpan={10} style={{ padding: "8px 16px", textAlign: "right", color: "#B91C1C", fontSize: 11 }}>TOTAL CONSULTANT WAGES (FIXED)</td>
                         <td style={{ padding: "8px 16px", textAlign: "center", color: "#B91C1C" }}>-€{fmtEu(totalConsultantFixed)}</td>
                      </tr>
                      <tr key="final-profit" style={{ background: "#ECFDF5", borderTop: "2px solid #059669", fontWeight: 900, fontSize: 14 }}>
                         <td colSpan={10} style={{ padding: "12px 16px", textAlign: "right", color: "#059669" }}>FINAL COMPANY NET PROFIT</td>
                         <td style={{ padding: "12px 16px", textAlign: "center", color: "#059669" }}>€{fmtEu(finalCompanyNetProfit)}</td>
                      </tr>
                    </>
                  )
                })()}
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
