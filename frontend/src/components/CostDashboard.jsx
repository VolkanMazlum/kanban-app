import { useState, useEffect } from "react";
import * as api from "../api";
import EmployeeCostsTab from "./EmployeeCostsTab.jsx";
import TimesheetTab from "./TimesheetTab.jsx";
import { MONTHS } from "../constants/costConstants.js";

export default function CostDashboard({ employees, user }) {
  const isHR = user.role === 'hr';
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const YEAR_OPTIONS = Array.from({ length: currentYear - 2024 + 4 }, (_, i) => 2024 + i);

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [costs, setCosts] = useState([]);
  const [loadingCosts, setLoadingCosts] = useState(false);

  // ── ÇALIŞAN MALİYETLERİ & MESAİ STATE ──
  const [showCostModal, setShowCostModal] = useState(false);
  const [selectedEmpHR, setSelectedEmpHR] = useState(null);
  const [newCost, setNewCost] = useState({ annual_gross: "", valid_from: new Date().toISOString().slice(0, 10) });
  const [showOvertimeModal, setShowOvertimeModal] = useState(false);
  const [overtimeData, setOvertimeData] = useState([]);
  const [overtimeInput, setOvertimeInput] = useState({ month: currentMonth, amount: "" });

  const [showExtraCostModal, setShowExtraCostModal] = useState(false);
  const [extraCostsData, setExtraCostsData] = useState([]);
  const [extraCostInput, setExtraCostInput] = useState({ task_id: "", description: "", amount: "", date: new Date().toISOString().slice(0, 10) });
  const [loadingExtra, setLoadingExtra] = useState(false);

  // ── TIMESHEET & TASK STATE ──
  const [allTasks, setAllTasks] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [dailyHours, setDailyHours] = useState({});
  const [saving, setSaving] = useState(false);

  // Set initial employee for standard users
  useEffect(() => {
    if (!isHR && user.employeeId && employees.length > 0) {
      const self = employees.find(e => e.id === user.employeeId);
      if (self) setSelectedEmp(self);
    }
  }, [isHR, user.employeeId, employees]);

  useEffect(() => {
    api.getTasks().then(setAllTasks).catch(console.error);
  }, []);

  useEffect(() => {
    if (!isHR) return;
    setLoadingCosts(true);
    api.getCosts(selectedYear).then(setCosts).catch(console.error).finally(() => setLoadingCosts(false));
  }, [isHR, selectedYear]);

  useEffect(() => {
    if (!selectedEmp) return;
    api.getWorkHours(selectedEmp.id, selectedYear, selectedMonth).then(data => {
      const map = {};
      data.forEach(r => {
        if (!map[r.task_id]) map[r.task_id] = {};
        map[r.task_id][r.date.slice(0, 10)] = { hours: r.hours || "", note: r.note || "" };
      });
      setDailyHours(map);
    }).catch(console.error);
  }, [selectedEmp, selectedYear, selectedMonth]);

  const handleDaySave = async (taskId, date, hours, note) => {
    if (!selectedEmp) return;
    setSaving(true);
    try {
      await api.saveWorkHours({
        employee_id: selectedEmp.id,
        task_id: taskId,
        date,
        hours: parseFloat(hours) || 0,
        note: note || null
      });
      setDailyHours(p => ({ ...p, [taskId]: { ...(p[taskId] || {}), [date]: { hours, note } } }));
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleAddCost = async () => {
    if (!selectedEmpHR || !newCost.annual_gross) return;
    try {
      await api.addEmployeeCost(selectedEmpHR.id, newCost);
      const updated = await api.getCosts(selectedYear);
      setCosts(updated);
      const freshEmp = updated.find(e => e.id === selectedEmpHR.id);
      setSelectedEmpHR(freshEmp);
      setShowCostModal(false);
      setNewCost({ annual_gross: "", valid_from: new Date().toISOString().slice(0, 10) });
    } catch (err) { console.error(err); }
  };

  const loadOvertime = async (emp) => {
    setSelectedEmpHR(emp);
    try {
      const data = await api.getOvertimeCosts(emp.id, selectedYear);
      setOvertimeData(data); setShowOvertimeModal(true);
    } catch (err) { console.error(err); }
  };

  const handleAddOvertime = async () => {
    if (!selectedEmpHR || !overtimeInput.amount) return;
    try {
      await api.saveOvertimeCost(selectedEmpHR.id, { year: selectedYear, month: overtimeInput.month, hours: overtimeInput.amount });
      const [updatedCosts, updatedOvertime] = await Promise.all([api.getCosts(selectedYear), api.getOvertimeCosts(selectedEmpHR.id, selectedYear)]);
      setCosts(updatedCosts); setOvertimeData(updatedOvertime);
      setOvertimeInput(p => ({ ...p, amount: "" }));
    } catch (err) { console.error(err); }
  };

  const loadExtraCosts = async (emp) => {
    setSelectedEmpHR(emp);
    setLoadingExtra(true);
    try {
      const data = await api.getEmployeeExtraCosts(emp.id, selectedYear);
      setExtraCostsData(data);
      setShowExtraCostModal(true);
    } catch (err) { console.error(err); }
    setLoadingExtra(false);
  };

  const handleAddExtraCost = async () => {
    if (!selectedEmpHR) return;
    if (!extraCostInput.task_id || !extraCostInput.amount || !extraCostInput.description) {
      alert("Please fill in Taks, Description and Amount.");
      return;
    }
    try {
      await api.saveEmployeeExtraCost(selectedEmpHR.id, extraCostInput);
      const [updatedCosts, updatedExtra] = await Promise.all([
        api.getCosts(selectedYear),
        api.getEmployeeExtraCosts(selectedEmpHR.id, selectedYear)
      ]);
      setCosts(updatedCosts);
      setExtraCostsData(updatedExtra);
      // Keep task_id selected for next entry, but clear description/amount
      setExtraCostInput(p => ({ ...p, description: "", amount: "" }));
    } catch (err) {
      console.error(err);
      alert("Error adding extra cost: " + err.message);
    }
  };

  const handleDeleteExtraCost = async (id) => {
    if (!window.confirm("Are you sure you want to delete this extra cost?")) return;
    try {
      await api.deleteEmployeeExtraCost(id);
      const [updatedCosts, updatedExtra] = await Promise.all([
        api.getCosts(selectedYear),
        api.getEmployeeExtraCosts(selectedEmpHR.id, selectedYear)
      ]);
      setCosts(updatedCosts);
      setExtraCostsData(updatedExtra);
    } catch (err) { console.error(err); }
  };

  const inpStyle = {
    border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "9px 12px",
    fontSize: 13, color: "#111827", fontFamily: "'Inter',sans-serif", width: "100%", outline: "none"
  };

  return (
    <div style={{ padding: "28px 32px", overflowY: "auto", height: "calc(100vh - 65px)", fontFamily: "'Inter',sans-serif", background: "#F9FAFB" }}>

      {/* ── HEADER ── */}
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>Employee Costs & Timesheet</h2>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(parseInt(e.target.value))}
              style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 14, fontWeight: 700, color: "#2563EB", background: "#EFF6FF", outline: "none", cursor: "pointer" }}
            >
              {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <p style={{ color: "#6B7280", margin: 0, fontSize: 14 }}>
            {isHR ? "Manage employee rates and view timesheets" : "Log your daily worked hours per task"}
          </p>
        </div>
      </div>

      {isHR && (
        <EmployeeCostsTab
          costs={costs}
          loadingCosts={loadingCosts}
          setSelectedEmpHR={setSelectedEmpHR}
          setShowCostModal={setShowCostModal}
          loadOvertime={loadOvertime}
          loadExtraCosts={loadExtraCosts}
        />
      )}

      {/* ── MESAİ MODAL ── */}
      {showOvertimeModal && selectedEmpHR && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: "#9CA3AF", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 2 }}>MANAGE OVERTIME ({selectedYear})</div>
              <h3 style={{ color: "#111827", margin: 0, fontSize: 18, fontWeight: 700 }}>{selectedEmpHR.name}</h3>
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 6, color: "#374151" }}>MONTH</label>
                <select value={overtimeInput.month} onChange={e => setOvertimeInput(p => ({ ...p, month: e.target.value }))} style={inpStyle}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 6, color: "#374151" }}>OVERTIME HOURS</label>
                <input type="number" step="0.5" value={overtimeInput.amount} onChange={e => setOvertimeInput(p => ({ ...p, amount: e.target.value }))} style={inpStyle} />
              </div>
              <div style={{ display: "flex", alignItems: "flex-end" }}><button onClick={handleAddOvertime} style={{ padding: "10px 14px", background: "#10B981", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 16 }}>+</button></div>
            </div>
            <div style={{ marginBottom: 20, maxHeight: 150, overflowY: "auto", background: "#F9FAFB", padding: 12, borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 8 }}>RECORDED OVERTIME HOURS ({selectedYear})</div>
              {overtimeData.map(od => (
                <div key={od.month} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #E5E7EB", fontSize: 13 }}>
                  <span>{MONTHS[od.month - 1]}</span><span style={{ fontWeight: 600, color: "#DC2626" }}>{parseFloat(od.amount)}h</span>
                </div>
              ))}
            </div>
            <button onClick={() => setShowOvertimeModal(false)} style={{ width: "100%", padding: 11, background: "#F9FAFB", border: "1.5px solid #E5E7EB", color: "#374151", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>Close</button>
          </div>
        </div>
      )}

      {/* ── EXTRA COSTS MODAL ── */}
      {showExtraCostModal && selectedEmpHR && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 600, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: "#9CA3AF", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 2 }}>MANAGE EXTRA COSTS ({selectedYear})</div>
              <h3 style={{ color: "#111827", margin: 0, fontSize: 18, fontWeight: 700 }}>{selectedEmpHR.name}</h3>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 10, marginBottom: 20, alignItems: "flex-end" }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 6 }}>TASK/PROJECT</label>
                <select
                  value={extraCostInput.task_id}
                  onChange={e => setExtraCostInput(p => ({ ...p, task_id: e.target.value }))}
                  style={inpStyle}
                >
                  <option value="">Select Task...</option>
                  {allTasks
                    .filter(t => 
                      t.commessa && // Must be linked to a project
                      (t.assignees || []).some(a => a.id === selectedEmpHR?.id) // Must be assigned to this employee
                    )
                    .map(t => (
                      <option key={t.id} value={t.id}>
                        [{t.commessa.comm_number || 'No #'}]{t.commessa.name ? ` ${t.commessa.name}` : ''} - {t.title}
                      </option>
                    ))
                  }
                </select>
                {allTasks.filter(t => t.commessa && (t.assignees || []).some(a => a.id === selectedEmpHR?.id)).length === 0 && (
                  <div style={{ fontSize: 9, color: "#DC2626", marginTop: 4, fontWeight: 600 }}>
                    ⚠ No tasks linked to a Project are currently assigned to this employee.
                  </div>
                )}
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 6 }}>DESCRIPTION</label>
                <input type="text" value={extraCostInput.description} onChange={e => setExtraCostInput(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Travel, Ticket" style={inpStyle} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 6 }}>AMOUNT (€)</label>
                <input type="number" step="0.01" value={extraCostInput.amount} onChange={e => setExtraCostInput(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" style={inpStyle} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 6 }}>DATE</label>
                <input type="date" value={extraCostInput.date} onChange={e => setExtraCostInput(p => ({ ...p, date: e.target.value }))} style={inpStyle} />
              </div>
              <div>
                <button onClick={handleAddExtraCost} style={{ padding: "10px 14px", background: "#3B82F6", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 16 }}>+</button>
              </div>
            </div>

            <div style={{ marginBottom: 20, height: 250, overflowY: "auto", background: "#F9FAFB", padding: 12, borderRadius: 8, border: "1px solid #E5E7EB" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
                <span>RECORDED HISTORY ({selectedYear})</span>
                {extraCostsData.length > 0 && <span>Total: €{extraCostsData.reduce((s, x) => s + parseFloat(x.amount), 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span>}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#6B7280", borderBottom: "1px solid #E5E7EB" }}>
                    <th style={{ padding: 8 }}>Date</th>
                    <th style={{ padding: 8 }}>Task</th>
                    <th style={{ padding: 8 }}>Note</th>
                    <th style={{ padding: 8, textAlign: "right" }}>Amount</th>
                    <th style={{ padding: 8 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {extraCostsData.length === 0 ? (
                    <tr><td colSpan="5" style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>No costs found for {selectedYear}. Check other years in the dashboard.</td></tr>
                  ) : extraCostsData.map(ec => (
                    <tr key={ec.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                      <td style={{ padding: 8 }}>{new Date(ec.date).toLocaleDateString()}</td>
                      <td style={{ padding: 8, fontWeight: 600 }}>{ec.task_title}</td>
                      <td style={{ padding: 8 }}>{ec.description}</td>
                      <td style={{ padding: 8, textAlign: "right", fontWeight: 700, color: "#111827" }}>€{parseFloat(ec.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</td>
                      <td style={{ padding: 8, textAlign: "right" }}>
                        <button onClick={() => handleDeleteExtraCost(ec.id)} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 14 }}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={() => setShowExtraCostModal(false)} style={{ width: "100%", padding: 11, background: "#F9FAFB", border: "1.5px solid #E5E7EB", color: "#374151", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>Close</button>
          </div>
        </div>
      )}

      {/* ── MAAŞ MODAL ── */}
      {showCostModal && selectedEmpHR && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: "#9CA3AF", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 2 }}>MANAGE SALARY & HISTORY</div>
              <h3 style={{ color: "#111827", margin: 0, fontSize: 18, fontWeight: 700 }}>{selectedEmpHR.name}</h3>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, color: "#374151", fontWeight: 600, marginBottom: 6 }}>NEW ANNUAL GROSS (€)</label>
              <input type="number" step="1000" value={newCost.annual_gross} onChange={e => setNewCost(p => ({ ...p, annual_gross: e.target.value }))} placeholder="e.g. 45000" style={inpStyle} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 11, color: "#374151", fontWeight: 600, marginBottom: 6 }}>VALID FROM DATE</label>
              <input type="date" value={newCost.valid_from} onChange={e => setNewCost(p => ({ ...p, valid_from: e.target.value }))} style={inpStyle} />
            </div>
            {(selectedEmpHR.cost_history || []).length > 0 && (
              <div style={{ marginBottom: 20, background: "#F9FAFB", borderRadius: 10, padding: 16, border: "1px solid #E5E7EB" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 10, letterSpacing: "0.05em" }}>COST HISTORY</div>
                <div style={{ maxHeight: 120, overflowY: "auto" }}>
                  {(selectedEmpHR.cost_history).map((item, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: idx === selectedEmpHR.cost_history.length - 1 ? "none" : "1px solid #E5E7EB", fontSize: 12 }}>
                      <span style={{ fontWeight: 600, color: "#111827" }}>€{parseFloat(item.annual_gross).toLocaleString("it-IT")}</span>
                      <span style={{ color: "#6B7280" }}>since {item.valid_from}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleAddCost} style={{ flex: 1, padding: 11, background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>Update Salary</button>
              <button onClick={() => { setShowCostModal(false); setSelectedEmpHR(null); }} style={{ flex: 1, padding: 11, background: "#F9FAFB", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── İŞÇİ: TIMESHEET ── */}
      <TimesheetTab
        employees={employees}
        user={user}
        allTasks={allTasks}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        selectedEmp={selectedEmp}
        setSelectedEmp={setSelectedEmp}
        dailyHours={dailyHours}
        setDailyHours={setDailyHours}
        handleDaySave={handleDaySave}
        saving={saving}
      />
    </div>
  );
}