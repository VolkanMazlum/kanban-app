// src/components/CostDashboard/EmployeeCostsTab.jsx
import React from "react";
import Avatar from "./Avatar.jsx";

export default function EmployeeCostsTab({ costs, loadingCosts, setSelectedEmpHR, setShowCostModal, loadOvertime, loadExtraCosts }) {
  if (loadingCosts) {
    return <div style={{ padding: 32, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Loading...</div>;
  }

  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden", marginBottom: 24 }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#F9FAFB" }}>
            <th style={{ padding: "10px 16px", fontSize: 11, fontWeight: 700, color: "#6B7280", textAlign: "left", letterSpacing: "0.05em" }}>EMPLOYEE</th>
            <th style={{ padding: "10px 16px", fontSize: 11, fontWeight: 700, color: "#6B7280", textAlign: "center", letterSpacing: "0.05em" }}>ANNUAL GROSS</th>
            <th style={{ padding: "10px 16px", fontSize: 11, fontWeight: 700, color: "#6B7280", textAlign: "center", letterSpacing: "0.05em" }}>OVERTIME (H)</th>
            <th style={{ padding: "10px 16px", fontSize: 11, fontWeight: 700, color: "#6B7280", textAlign: "center", letterSpacing: "0.05em" }}>EMPLOYEE EXTRA COSTS</th>
            <th style={{ padding: "10px 16px", fontSize: 11, fontWeight: 700, color: "#6B7280", textAlign: "center", letterSpacing: "0.05em" }} title="Total hours worked (Timesheet records)">TOTAL HOURS (WORKED) ⓘ</th>
            <th style={{ padding: "10px 16px", fontSize: 11, fontWeight: 700, color: "#6B7280", textAlign: "center", letterSpacing: "0.05em" }} title="Based on 2000 hours per year">RATE (THEORY) ⓘ</th>
            <th style={{ padding: "10px 16px", fontSize: 11, fontWeight: 700, color: "#6B7280", textAlign: "center", letterSpacing: "0.05em" }} title="Calculation: Annual Gross / Total Worked Hours">RATE (DYNAMIC) ⓘ</th>
            <th style={{ padding: "10px 16px", fontSize: 11, fontWeight: 700, color: "#6B7280", textAlign: "center", letterSpacing: "0.05em" }}>VALID FROM</th>
            <th style={{ padding: "10px 16px", fontSize: 11, fontWeight: 700, color: "#6B7280", textAlign: "center", letterSpacing: "0.05em" }}>ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {costs.map((emp, i) => {
            const gross = parseFloat(emp.current_annual_gross) || 0;
            const actualHours = parseFloat(emp.actual_hours_this_year) || 0;
            const overtimeHours = parseFloat(emp.overtime_hours_this_year) || 0;
            const hasHistory = (emp.cost_history || []).length > 1;

            return (
              <tr key={emp.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                <td style={{ padding: "12px 16px" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><Avatar name={emp.name} size={32} idx={i} /><span style={{ fontSize: 13, fontWeight: 600 }}>{emp.name}</span></div></td>
                <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 13, fontWeight: 600 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    {gross > 0 ? `€${gross.toLocaleString("it-IT")}` : "—"}
                    {hasHistory && <span title="Has Salary History" style={{ fontSize: 10, cursor: "help" }}>📜</span>}
                  </div>
                </td>
                <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 13, fontWeight: 600, color: "#DC2626" }}>{overtimeHours > 0 ? `${overtimeHours}h` : "—"}</td>
                <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 13, fontWeight: 600, color: "#9333EA" }}>{parseFloat(emp.total_extra_costs) > 0 ? `€${parseFloat(emp.total_extra_costs).toLocaleString("it-IT")}` : "—"}</td>
                <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 13, fontWeight: 600, color: actualHours > 0 ? "#059669" : "#D1D5DB" }}>{actualHours > 0 ? `${actualHours.toFixed(1)}h` : "—"}</td>
                <td style={{ padding: "12px 16px", textAlign: "center" }}><span style={{ background: "#EFF6FF", color: "#2563EB", padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>€{emp.hourly_rate_theoretical}/h</span></td>
                <td style={{ padding: "12px 16px", textAlign: "center" }}><span style={{ background: "#F0FDF4", color: "#059669", padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>€{emp.hourly_rate_dynamic}/h</span></td>
                <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, color: "#6B7280" }}>{emp.current_valid_from || "—"}</td>
                <td style={{ padding: "12px 16px", textAlign: "center" }}>
                  <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                    <button onClick={() => { setSelectedEmpHR(emp); setShowCostModal(true); }} style={{ background: "#F3F4F6", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Salary</button>
                    <button onClick={() => loadExtraCosts(emp)} style={{ background: "#F3F4F6", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Extra</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}