import { TOPIC_STYLE } from "../constants/index.js";
import Avatar from "../components/Avatar.jsx";
import React, { useState, useEffect } from "react";
import * as api from "../api";

function MiniGantt({ phases, monthStart, monthEnd }) {
  const start = new Date(monthStart);
  const end = new Date(monthEnd);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const totalDays = Math.round((end - start) / 86400000) + 1;

  return (
    <div style={{ padding: "12px 16px" }}>
      {/* Hafta çizgisi */}
      <div style={{ position: "relative", marginBottom: 8 }}>
        <div style={{ display: "flex", height: 20, borderRadius: 4, overflow: "hidden", background: "#E5E7EB" }}>
          {[...Array(Math.ceil(totalDays / 7))].map((_, wi) => (
            <div key={wi} style={{ flex: `0 0 ${(7 / totalDays) * 100}%`, fontSize: 9, color: "#9CA3AF", display: "flex", alignItems: "center", justifyContent: "center", borderRight: "1px solid #D1D5DB" }}>
              W{wi + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Phase barları */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {phases.map(ph => {
          const phStart = new Date(Math.max(new Date(ph.start_date), start));
          const phEnd = new Date(Math.min(new Date(ph.end_date), end));
          phStart.setHours(0, 0, 0, 0);
          phEnd.setHours(0, 0, 0, 0);
          if (phStart > phEnd) return null;

          const off = Math.round((phStart - start) / 86400000);
          const span = Math.max(Math.round((phEnd - phStart) / 86400000) + 1, 1);
          const left = `${(off / totalDays) * 100}%`;
          const width = `${Math.min((span / totalDays) * 100, 100 - (off / totalDays) * 100)}%`;
          const phColor = ph.status === "done" ? "#059669" : ph.status === "active" ? "#F59E0B" : "#6B7280";

          return (
            <div key={ph.phase_id} style={{ position: "relative", height: 24 }}>
              <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: "20%", fontSize: 10, color: "#6B7280", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingRight: 4 }}>
                {ph.task_title}
              </div>
              <div style={{ position: "absolute", left: "20%", right: 0, height: "100%" }}>
                <div
                  title={`${ph.phase_name}\n${ph.start_date} → ${ph.end_date}\n${ph.estimated_hours ? ph.estimated_hours + 'h assigned to this member' : ''}`}
                  style={{
                    position: "absolute", left, width,
                    height: 20, top: "50%", transform: "translateY(-50%)",
                    borderRadius: 4, background: phColor, opacity: 0.9,
                    display: "flex", alignItems: "center", padding: "0 6px",
                    overflow: "hidden", cursor: "default",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                  }}
                >
                  <span style={{ fontSize: 9, color: "#fff", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {ph.status === "done" ? "✓ " : ""}{ph.phase_name}
                    {ph.estimated_hours ? ` · ${ph.estimated_hours}h` : ""}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function KPIDashboard({ employees }) {
  const [maxCapacity, setMaxCapacity] = useState(250);
  const [editingCapacity, setEditingCapacity] = useState(false);
  const [tempCapacity, setTempCapacity] = useState(250);

  const [monthlyData, setMonthlyData] = useState(null);
  const [kpiData, setKpiData] = useState(null);
  const [monthAnchor, setMonthAnchor] = useState(0);
  const [expandedEmp, setExpandedEmp] = useState(null);
  const [loading, setLoading] = useState(true);

  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + monthAnchor);
  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth() + 1;
  const monthLabel = targetDate.toLocaleString("en-US", { month: "long", year: "numeric" });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [m, k] = await Promise.all([
          api.getMonthlyWorkload(targetYear, targetMonth),
          api.getKPI(targetYear, targetMonth)
        ]);
        setMonthlyData(m);
        setKpiData(k);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [monthAnchor, targetYear, targetMonth]);

  useEffect(() => {
    api.getSettings().then(s => {
      const val = parseInt(s.max_capacity || "250");
      setMaxCapacity(val);
      setTempCapacity(val);
    }).catch(console.error);
  }, []);

  const handleCapacitySave = async () => {
    await api.updateSetting("max_capacity", String(tempCapacity));
    setMaxCapacity(tempCapacity);
    setEditingCapacity(false);
  };

  const MAX_CAPACITY = maxCapacity;

  if (loading && !kpiData) return <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontFamily: "'Inter',sans-serif", fontSize: 14 }}>Loading KPIs...</div>;
  if (!kpiData) return null;

  const { summary, by_status, trend } = kpiData;
  const maxTrend = trend.length ? Math.max(...trend.map(t => t.total), 1) : 1;
  const maxForecast = summary.forecast?.length ? Math.max(...summary.forecast.map(f => f.total), 1) : 1;

  const cards = [
    { icon: "📊", label: "Monthly Tasks", val: summary.total, color: "#2563EB", bg: "#EFF6FF" },
    { icon: "✅", label: "Completion Rate", val: summary.completed_month, color: "#059669", bg: "#ECFDF5" },
    { icon: "🏗️", label: "Phase Completed", val: summary.completed_phases || 0, color: "#F59E0B", bg: "#FFF7ED" },
    { icon: "💶", label: "Scheduled Revenue", val: `€${(summary.monthly_revenue || 0).toLocaleString("it-IT", { minimumFractionDigits: 0 })}`, color: "#7C3AED", bg: "#F5F3FF" },
    { icon: "👥", label: "Utilization", val: monthlyData ? `${Math.round((monthlyData.employees.reduce((sum, emp) => sum + parseFloat(emp.phase_hours || 0), 0) / (employees.length * MAX_CAPACITY)) * 100)}%` : "0%", color: "#0891B2", bg: "#ECFEFF" },
  ];

  const statusColors = { new: "#6366F1", process: "#F59E0B", blocked: "#DC2626", done: "#059669" };

  return (
    <div style={{ padding: "28px 32px", overflowY: "auto", height: "calc(100vh - 65px)", fontFamily: "'Inter',sans-serif", background: "#F9FAFB" }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>Monthly Workload KPI</h2>
          <p style={{ color: "#6B7280", margin: 0, fontSize: 14 }}>Monthly metrics and team workload — {monthLabel}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", padding: "6px 12px", borderRadius: 10, border: "1px solid #E5E7EB" }}>
            <button onClick={() => setMonthAnchor(a => a - 1)} style={{ background: "#F3F4F6", border: "none", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontSize: 14, color: "#374151", fontWeight: 700 }}>←</button>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#111827", minWidth: 140, textAlign: "center" }}>{monthLabel}</span>
            <button onClick={() => setMonthAnchor(a => a + 1)} style={{ background: "#F3F4F6", border: "none", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontSize: 14, color: "#374151", fontWeight: 700 }}>→</button>
            <button onClick={() => setMonthAnchor(0)} style={{ background: "#2563EB", color: "#fff", border: "none", borderRadius: 7, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600, marginLeft: 8 }}>Current</button>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 16, marginBottom: 24, marginTop: 20 }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: "#fff", borderRadius: 12, padding: 18, border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 22 }}>{c.icon}</div>
              <div style={{ fontSize: 9, background: c.bg, color: c.color, padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>{c.label.toUpperCase()}</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#111827", lineHeight: 1 }}>{c.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 0.8fr 2fr", gap: 20, marginBottom: 24 }}>
        {/* Status Mix Graph */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, border: "1px solid #E5E7EB", display: "flex", flexDirection: "column" }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: "0 0 16px" }}>Monthly Status Mix</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, justifyContent: "center" }}>
            {Object.entries(by_status).map(([status, count]) => {
              const pct = summary.total > 0 ? (count / summary.total) * 100 : 0;
              return (
                <div key={status}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 600, marginBottom: 4 }}>
                    <span style={{ textTransform: "capitalize", color: "#374151" }}>{status}</span>
                    <span style={{ color: "#6B7280" }}>{count} tasks</span>
                  </div>
                  <div style={{ background: "#F3F4F6", borderRadius: 10, height: 8 }}>
                    <div style={{ background: statusColors[status], width: `${pct}%`, height: "100%", borderRadius: 10 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Fatturato Taken Graph */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, border: "1px solid #E5E7EB", display: "flex", flexDirection: "column" }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: "0 0 20px" }}>Fatturato Taken</h3>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flex: 1, paddingBottom: 10 }}>
            {summary.forecast?.map((f, idx) => {
              const detailTitle = (f.details || [])
                .map(d => `${d.name}: €${Math.round(d.amount).toLocaleString("it-IT")}`)
                .join("\n");
              const fullTitle = `Breakdown for ${f.month}:\n${detailTitle || "No detailed activities"}`;

              return (
                <div key={f.month} title={fullTitle} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "help" }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: idx === 0 ? "#7C3AED" : "#9CA3AF" }}>€{Math.round(f.total / 1000)}k</div>
                  <div style={{ width: "100%", background: idx === 0 ? "#7C3AED" : "#C7D2FE", height: `${Math.max((f.total / maxForecast) * 70, 4)}px`, borderRadius: "4px 4px 0 0", opacity: idx === 0 ? 1 : 0.7 }} />
                  <div style={{ fontSize: 9, color: "#9CA3AF", textAlign: "center", fontWeight: idx === 0 ? 700 : 400 }}>{f.month}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Monthly Cost Trend */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, border: "1px solid #E5E7EB", display: "flex", flexDirection: "column" }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: "0 0 20px" }}>Monthly Cost Trend</h3>
          {trend.length === 0
            ? <div style={{ color: "#9CA3AF", fontSize: 12, textAlign: "center", padding: "20px 0", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>No cost data</div>
            : (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, flex: 1, paddingBottom: 10 }}>
                {trend.map(t => (
                  <div key={t.month} title={`Labor: €${t.labor?.toLocaleString('it-IT')}\nOverhead: €${t.overhead?.toLocaleString('it-IT')}\nTotal: €${t.total?.toLocaleString('it-IT')}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "help" }}>
                    <div style={{ fontSize: 8, fontWeight: 700, color: "#6B7280" }}>€{Math.round((t.total || 0) / 1000)}k</div>
                    <div style={{ width: "100%", display: "flex", flexDirection: "column-reverse", height: `${Math.max(((t.total || 0) / maxTrend) * 70, 4)}px`, borderRadius: "4px 4px 0 0", overflow: "hidden" }}>
                        <div style={{ background: "#EF4444", height: `${((t.labor || 0) / (t.total || 1)) * 100}%`, width: "100%" }} />
                        <div style={{ background: "#FCA5A5", height: `${((t.overhead || 0) / (t.total || 1)) * 100}%`, width: "100%" }} />
                    </div>
                    <div style={{ fontSize: 8, color: "#9CA3AF", textAlign: "center", fontWeight: 600 }}>{t.month}</div>
                  </div>
                ))}
              </div>
            )
          }
        </div>

        {/* Monthly Profitability Breakdown */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, border: "1px solid #E5E7EB", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: 0 }}>Monthly Profitability</h3>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, color: "#9CA3AF", fontWeight: 700 }}>NET PROFIT (EST.)</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: (summary.monthly_revenue - (summary.total_labor_cost || 0) - (summary.monthly_overhead || 0)) >= 0 ? "#10B981" : "#EF4444" }}>
                €{Math.round(summary.monthly_revenue - (summary.total_labor_cost || 0) - (summary.monthly_overhead || 0)).toLocaleString("it-IT")}
              </div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", maxHeight: 180 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <th style={{ textAlign: "left", padding: "4px 4px", color: "#6B7280" }}>CATEGORY</th>
                  <th style={{ textAlign: "right", padding: "4px 4px", color: "#6B7280" }}>AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {/* INCOME */}
                <tr style={{ background: "#F9FAFB" }}>
                  <td colSpan={2} style={{ padding: "4px 4px", fontWeight: 800, color: "#111827", fontSize: 9 }}>🟢 INCOME (TAKEN)</td>
                </tr>
                {(summary.forecast?.[0]?.details || []).map((d, i) => (
                  <tr key={`inc-${i}`} style={{ borderBottom: "1px solid #F9FAFB" }}>
                    <td style={{ padding: "4px 4px", color: "#374151" }}>{d.name}</td>
                    <td style={{ padding: "4px 4px", textAlign: "right", color: "#111827", fontWeight: 600 }}>+€{Math.round(d.amount).toLocaleString("it-IT")}</td>
                  </tr>
                ))}

                {/* LABOR */}
                <tr style={{ background: "#F9FAFB" }}>
                  <td colSpan={2} style={{ padding: "4px 4px", fontWeight: 800, color: "#111827", fontSize: 9, paddingTop: 10 }}>🔴 LABOR COSTS</td>
                </tr>
                {(summary.labor_costs || []).map((l, i) => (
                  <tr key={`lab-${i}`} style={{ borderBottom: "1px solid #F9FAFB" }}>
                    <td style={{ padding: "4px 4px", color: "#374151" }}>{l.name} <span style={{ fontSize: 8, color: "#9CA3AF" }}>({l.hours}h)</span></td>
                    <td style={{ padding: "4px 4px", textAlign: "right", color: "#DC2626", fontWeight: 500 }}>-€{Math.round(l.cost).toLocaleString("it-IT")}</td>
                  </tr>
                ))}

                {/* OVERHEAD */}
                <tr style={{ background: "#F9FAFB" }}>
                  <td colSpan={2} style={{ padding: "4px 4px", fontWeight: 800, color: "#111827", fontSize: 9, paddingTop: 10 }}>🏢 OVERHEAD (EST.)</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #F9FAFB" }}>
                  <td style={{ padding: "4px 4px", color: "#374151" }}>Monthly General Expenses</td>
                  <td style={{ padding: "4px 4px", textAlign: "right", color: "#DC2626", fontWeight: 500 }}>-€{Math.round(summary.monthly_overhead || 0).toLocaleString("it-IT")}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden", marginTop: 20 }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 2px" }}>Monthly Phase Workload</h3>
            <p style={{ fontSize: 12, color: "#6B7280", margin: 0 }}>Click a member to see their phase timeline</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setMonthAnchor(a => a - 1)} style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 12, color: "#374151", fontWeight: 600 }}>←</button>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#111827", minWidth: 140, textAlign: "center" }}>{monthLabel}</span>
            <button onClick={() => setMonthAnchor(a => a + 1)} style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 12, color: "#374151", fontWeight: 600 }}>→</button>
            <button onClick={() => setMonthAnchor(0)} style={{ background: "#2563EB", color: "#fff", border: "none", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>This Month</button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Loading...</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F9FAFB" }}>
                {["Team Member", "Phase Hours", "Workload", "Phases"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", fontSize: 11, fontWeight: 700, color: "#6B7280", textAlign: h === "Team Member" ? "left" : "center", letterSpacing: "0.05em" }}>{h.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(monthlyData?.employees || []).map((emp, i) => {
                const hours = parseFloat(emp.phase_hours) || 0;
                const pct = Math.min(Math.round((hours / MAX_CAPACITY) * 100), 100);
                const barColor = pct > 75 ? "#DC2626" : pct > 40 ? "#D97706" : "#059669";
                const isExpanded = expandedEmp === emp.id;
                const phases = emp.phases || [];

                return (
                  <React.Fragment key={emp.id}>
                    <tr
                      onClick={() => setExpandedEmp(isExpanded ? null : emp.id)}
                      style={{ borderTop: "#F3F4F6 1px solid", cursor: "pointer", background: isExpanded ? "#F0F7FF" : "#fff", transition: "background 0.15s" }}
                    >
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Avatar name={emp.name} size={32} idx={i} />
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{emp.name}</div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: barColor }}>{Math.round(hours)}h</span>
                      </td>
                      <td style={{ padding: "12px 16px", width: 160 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, background: "#F3F4F6", borderRadius: 4, height: 8 }}>
                            <div style={{ background: barColor, width: `${pct}%`, height: "100%", borderRadius: 4 }} />
                          </div>
                          <span style={{ fontSize: 11, color: barColor, fontWeight: 700, width: 36 }}>{pct}%</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <span style={{ fontSize: 12, color: "#6B7280" }}>{phases.length} phase{phases.length !== 1 ? "s" : ""} {isExpanded ? "▲" : "▼"}</span>
                      </td>
                    </tr>

                    {isExpanded && phases.length > 0 && (
                      <tr key={`${emp.id}-detail`} style={{ borderTop: "1px solid #E5E7EB" }}>
                        <td colSpan={4} style={{ padding: "0 0 0 0", background: "#F8FAFF" }}>
                          <MiniGantt phases={phases} monthStart={monthlyData.monthStart} monthEnd={monthlyData.monthEnd} />
                        </td>
                      </tr>
                    )}

                    {isExpanded && phases.length === 0 && (
                      <tr key={`${emp.id}-empty`}>
                        <td colSpan={4} style={{ padding: "16px 24px", textAlign: "center", color: "#9CA3AF", fontSize: 13, background: "#F8FAFF" }}>
                          No phases assigned this month
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}