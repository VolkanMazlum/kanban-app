import { useState, useEffect } from "react";
import { TOPIC_STYLE } from "../constants/index.js";
import Avatar from "../components/Avatar.jsx";
import TimesheetTab from "../components/TimesheetTab.jsx";
import * as api from "../api";

const STATUS_COLOR = { new: "#2563EB", process: "#059669", blocked: "#DC2626", done: "#7C3AED" };
const ROW_HEIGHT = 56; // Ana görev satırı yüksekliği
const TOPIC_ROW_HEIGHT = 40; // Her kategori için TEK BİR satır yüksekliği

export default function GanttChart({ tasks, employees, user }) {
  const isHR = user?.role === "hr";
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [empFilter, setEmpFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [rangeMonths, setRangeMonths] = useState(3);
  const [anchor, setAnchor] = useState(0);

  // ── TIMESHEET STATE (Moved from CostDashboard) ──
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [dailyHours, setDailyHours] = useState({});
  const [saving, setSaving] = useState(false);

  // Set initial employee for standard users
  useEffect(() => {
    if (!isHR && user.employeeId && employees.length > 0) {
      const self = employees.find(e => e.id === user.employeeId);
      if (self) setSelectedEmp(self);
    }
  }, [isHR, user.employeeId, employees]);

  // Sync Timesheet Employee with Gantt Filter if specific person is selected
  useEffect(() => {
    if (empFilter !== "all") {
      const target = employees.find(e => String(e.id) === empFilter);
      if (target) setSelectedEmp(target);
    }
  }, [empFilter, employees]);

  // Fetch Work Hours
  useEffect(() => {
    if (!selectedEmp) return;
    const year = windowStart.getFullYear();
    api.getWorkHours(selectedEmp.id, year, selectedMonth).then(data => {
      const map = {};
      data.forEach(r => {
        if (!map[r.task_id]) map[r.task_id] = {};
        map[r.task_id][r.date.slice(0, 10)] = { hours: r.hours || "", note: r.note || "" };
      });
      setDailyHours(map);
    }).catch(console.error);
  }, [selectedEmp, selectedMonth, anchor, rangeMonths]); // React to period changes too

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

  const [expandedTasks, setExpandedTasks] = useState({});

  const toggleTaskExpand = (taskId) => {
    setExpandedTasks(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const toggleAllExpand = (expand) => {
    const newExpanded = {};
    if (expand) {
      filtered.forEach(t => newExpanded[t.id] = true);
    }
    setExpandedTasks(newExpanded);
  };

  const windowStart = new Date(today.getFullYear(), today.getMonth() + anchor, 1);
  const windowEnd = new Date(windowStart.getFullYear(), windowStart.getMonth() + rangeMonths, 0);
  const totalDays = Math.round((windowEnd - windowStart) / 86400000) + 1;

  const monthSegments = [];
  let cur = new Date(windowStart);
  while (cur <= windowEnd) {
    const y = cur.getFullYear(), m = cur.getMonth();
    const segEnd = new Date(Math.min(new Date(y, m + 1, 0), windowEnd));
    const days = Math.round((segEnd - new Date(Math.max(cur, windowStart))) / 86400000) + 1;
    monthSegments.push({ label: cur.toLocaleString("en-US", { month: "short", year: "numeric" }), days });
    cur = new Date(y, m + 1, 1);
  }

  // Kişi ana görevde YOKSA bile fazlarında VARSA göster
  const filtered = tasks.filter(t => {
    if (!t.deadline && !t.planned_start) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;

    if (empFilter !== "all") {
      const inMainTask = (t.assignees || []).some(a => String(a.id) === empFilter);
      const inPhases = (t.phases || []).some(ph =>
        (ph.assignee_hours || ph.assignees || []).some(a => String(a.id) === empFilter)
      );
      if (!inMainTask && !inPhases) return false;
    }

    const s = t.planned_start ? new Date(t.planned_start) : new Date(t.deadline);
    const e2 = t.planned_end ? new Date(t.planned_end) : new Date(t.deadline);
    s.setHours(0, 0, 0, 0); e2.setHours(0, 0, 0, 0);
    return s <= windowEnd && e2 >= windowStart;
  }).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  function getBarProps(startDateStr, endDateStr, fallbackDateStr) {
    const start = startDateStr ? new Date(startDateStr) : new Date(fallbackDateStr);
    const end = endDateStr ? new Date(endDateStr) : new Date(fallbackDateStr);
    const s = new Date(Math.max(start, windowStart));
    const e2 = new Date(Math.min(end, windowEnd));
    if (s > e2) return null;
    const off = Math.round((s - windowStart) / 86400000);
    const span = Math.max(Math.round((e2 - s) / 86400000) + 1, 1);
    return {
      left: `${(off / totalDays) * 100}%`,
      width: `${Math.min((span / totalDays) * 100, 100 - (off / totalDays) * 100)}%`
    };
  }

  const todayPct = today >= windowStart && today <= windowEnd ? `${(Math.round((today - windowStart) / 86400000) / totalDays) * 100}%` : null;
  const selBtn = (active) => ({ padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "Inter,sans-serif", background: active ? "#fff" : "transparent", color: active ? "#111827" : "#6B7280", boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" });
  const outBtn = { background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontSize: 12, color: "#374151", fontFamily: "Inter,sans-serif", fontWeight: 600 };

  return (
    <div style={{ padding: "28px 32px", overflowY: "auto", height: "calc(100vh - 65px)", fontFamily: "Inter,sans-serif", background: "#F9FAFB" }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>Gantt Provision Chart</h2>
        <p style={{ color: "#6B7280", margin: 0, fontSize: 14 }}>Task timeline grouped by project phases</p>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <select value={empFilter} onChange={e => setEmpFilter(e.target.value)} style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "7px 12px", color: "#374151", fontSize: 12, fontFamily: "Inter,sans-serif", cursor: "pointer", fontWeight: 500 }}>
          <option value="all">All Members</option>
          {employees.map(e => <option key={e.id} value={String(e.id)}>{e.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "7px 12px", color: "#374151", fontSize: 12, fontFamily: "Inter,sans-serif", cursor: "pointer", fontWeight: 500 }}>
          <option value="all">All Statuses</option>
          <option value="new">New</option>
          <option value="process">In Process</option>
          <option value="blocked">Blocked</option>
          <option value="done">Done</option>
        </select>

        <div style={{ display: "flex", background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 8, overflow: "hidden" }}>
          <button onClick={() => toggleAllExpand(true)} style={{ padding: "7px 10px", background: "transparent", border: "none", borderRight: "1px solid #E5E7EB", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#374151" }}>Expand All</button>
          <button onClick={() => toggleAllExpand(false)} style={{ padding: "7px 10px", background: "transparent", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#374151" }}>Collapse All</button>
        </div>

        <div style={{ display: "flex", background: "#F3F4F6", borderRadius: 8, padding: 3, marginLeft: "auto" }}>
          {[1, 2, 3, 6].map(m => (<button key={m} onClick={() => setRangeMonths(m)} style={selBtn(rangeMonths === m)}>{m}M</button>))}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button onClick={() => setAnchor(a => a - rangeMonths)} style={outBtn}>← Prev</button>
          <button onClick={() => setAnchor(0)} style={{ ...outBtn, background: "#2563EB", color: "#fff", border: "none", boxShadow: "0 2px 6px rgba(37,99,235,0.3)" }}>Today</button>
          <button onClick={() => setAnchor(a => a + rangeMonths)} style={outBtn}>Next →</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 12, padding: "48px 0", textAlign: "center", border: "1px solid #E5E7EB", color: "#9CA3AF", fontSize: 14 }}>
          No tasks with deadlines visible in this period
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden", display: "flex" }}>

          {/* ─── SOL KOLON ─── */}
          <div style={{ width: 256, flexShrink: 0, borderRight: "1px solid #E5E7EB", background: "#fff" }}>
            <div style={{ height: 36, borderBottom: "1px solid #E5E7EB", background: "#F9FAFB", display: "flex", alignItems: "center", padding: "0 16px" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", letterSpacing: "0.05em" }}>TASKS & CATEGORIES</span>
            </div>

            {filtered.map((task) => {
              const topics = task.topics || [];
              const phases = task.phases || [];
              const isExpanded = expandedTasks[task.id];
              const hasTopics = topics.length > 0;

              // Tüm çalışanları toplayıp sol sütunda gösteriyoruz
              const allAsgnMap = new Map();
              (task.assignees || []).forEach(a => allAsgnMap.set(a.id, a));
              phases.forEach(ph => {
                (ph.assignee_hours || ph.assignees || []).forEach(a => allAsgnMap.set(a.id, a));
              });
              const uniqueAssignees = Array.from(allAsgnMap.values());

              return (
                <div key={task.id} style={{ borderBottom: "1px solid #E5E7EB" }}>
                  <div
                    onClick={() => hasTopics && toggleTaskExpand(task.id)}
                    style={{
                      height: ROW_HEIGHT, display: "flex", alignItems: "center", padding: "0 12px",
                      background: "#FAFAFA", borderBottom: (topics.length > 0 && isExpanded) ? "1px solid #E5E7EB" : "none",
                      cursor: hasTopics ? "pointer" : "default"
                    }}
                  >
                    <div style={{ width: 16, display: "flex", justifyContent: "center", marginRight: 4 }}>
                      {hasTopics ? (
                        <span style={{ fontSize: 10, color: "#9CA3AF", transition: "transform 0.2s", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                      ) : null}
                    </div>

                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLOR[task.status] || "#9CA3AF", flexShrink: 0, marginRight: 10 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</div>
                    </div>
                    <div style={{ display: "flex", flexShrink: 0 }}>
                      {uniqueAssignees.slice(0, 3).map((a, ai) => (<div key={a.id} style={{ marginLeft: ai > 0 ? -6 : 0 }} title={a.name}><Avatar name={a.name} size={22} idx={ai} /></div>))}
                    </div>
                  </div>

                  {isExpanded && topics.map(topicName => {
                    const ts = TOPIC_STYLE[topicName] || { bg: "#F3F4F6", text: "#374151" };
                    const topicPhases = phases.filter(ph => (ph.topic === topicName || ph.topic_source === topicName));

                    const validPhases = topicPhases.filter(ph =>
                      ph.start_date && ph.end_date &&
                      (empFilter === "all" || (ph.assignee_hours || ph.assignees || []).some(a => String(a.id) === empFilter))
                    );
                    if (validPhases.length === 0) return null;

                    return (
                      <div key={topicName} style={{ height: TOPIC_ROW_HEIGHT, display: "flex", alignItems: "center", paddingLeft: 24, background: ts.bg, borderBottom: "1px solid #fff" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: ts.text, letterSpacing: "0.05em" }}>{topicName.toUpperCase()}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* ─── SAĞ KOLON ─── */}
          <div style={{ flex: 1, overflowX: "auto", position: "relative", minWidth: 0 }}>
            <div style={{ display: "flex", height: 36, borderBottom: "1px solid #E5E7EB", background: "#F9FAFB" }}>
              {monthSegments.map((seg, i) => (
                <div key={i} style={{ flex: `0 0 ${(seg.days / totalDays) * 100}%`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#374151", borderRight: i < monthSegments.length - 1 ? "1px solid #E5E7EB" : "none", letterSpacing: "0.03em" }}>{seg.label}</div>
              ))}
            </div>

            <div style={{ position: "relative" }}>
              {(() => { let x = 0; return monthSegments.slice(0, -1).map((seg, mi) => { x += (seg.days / totalDays) * 100; return <div key={mi} style={{ position: "absolute", left: `${x}%`, top: 0, bottom: "100%", height: "100%", width: 1, background: "#E5E7EB", pointerEvents: "none" }} />; }); })()}

              {todayPct && (
                <div style={{ position: "absolute", left: todayPct, top: 0, bottom: 0, width: 2, background: "#F59E0B", zIndex: 5, pointerEvents: "none" }}>
                  <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 8, height: 8, borderRadius: "50%", background: "#F59E0B" }} />
                </div>
              )}

              {filtered.map(task => {
                const taskBp = getBarProps(task.planned_start, task.planned_end, task.deadline);
                const topics = task.topics || [];
                const phases = task.phases || [];
                const bc = STATUS_COLOR[task.status] || "#9CA3AF";
                const isDone = task.status === "done";
                const isExpanded = expandedTasks[task.id];

                return (
                  <div key={task.id} style={{ borderBottom: "1px solid #E5E7EB" }}>
                    <div style={{ height: ROW_HEIGHT, position: "relative", background: "#FAFAFA", borderBottom: (topics.length > 0 && isExpanded) ? "1px solid #E5E7EB" : "none" }}>
                      {taskBp && (
                        <div style={{
                          position: "absolute", left: taskBp.left, width: taskBp.width, top: "50%", transform: "translateY(-50%)",
                          height: 24, borderRadius: 6, background: isDone ? `repeating-linear-gradient(45deg,${bc}cc,${bc}cc 5px,${bc}55 5px,${bc}55 10px)` : bc,
                          display: "flex", alignItems: "center", paddingLeft: 8, overflow: "hidden", boxShadow: `0 2px 5px ${bc}44`, opacity: isDone ? 0.7 : 1
                        }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", whiteSpace: "nowrap" }}>{isDone ? "✓" : ""} {task.title}</span>
                        </div>
                      )}
                    </div>

                    {isExpanded && topics.map(topicName => {
                      const topicPhases = phases.filter(ph =>
                        (ph.topic === topicName || ph.topic_source === topicName) &&
                        ph.start_date && ph.end_date &&
                        (empFilter === "all" || (ph.assignee_hours || ph.assignees || []).some(a => String(a.id) === empFilter))
                      ).sort((a, b) => a.position - b.position);

                      if (topicPhases.length === 0) return null;

                      return (
                        <div key={topicName} style={{ height: TOPIC_ROW_HEIGHT, position: "relative", borderBottom: "1px solid #F9FAFB", background: "rgba(249, 250, 251, 0.5)" }}>
                          {topicPhases.map(ph => {
                            const phBp = getBarProps(ph.start_date, ph.end_date, task.deadline);
                            if (!phBp) return null;

                            const phColor = ph.status === "done" ? "#059669" : ph.status === "active" ? "#F59E0B" : "#6B7280";

                            // Tooltip içinde çalışanları ve saatlerini göstermek için
                            const assigneesInfo = (isHR && ph.assignee_hours) ? (ph.assignee_hours || []).map(a => `${a.name} (${a.estimated_hours || 0}h)`).join(', ') : "";
                            const notePart = (isHR && ph.note) ? `\n📝 ${ph.note}` : "";
                            const tooltip = `${ph.name}\n📅 ${ph.start_date} / ${ph.end_date}${notePart}${assigneesInfo ? `\n👥 ${assigneesInfo}` : ""}`;

                            return (
                              <div key={ph.id} title={tooltip} style={{
                                position: "absolute", left: phBp.left, width: phBp.width, top: "50%", transform: "translateY(-50%)",
                                height: 22, borderRadius: 4, background: phColor, opacity: 0.9,
                                display: "flex", alignItems: "center", padding: "0 6px",
                                overflow: "hidden", cursor: "help",
                                border: "1px solid rgba(255,255,255,0.3)", boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                              }}>
                                <span style={{ fontSize: 9, color: "#fff", fontWeight: 600, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                                  {ph.status === "done" && "✓ "}{ph.name}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TIMESHEET TAB (Positioned BELOW Gantt) ── */}
      <TimesheetTab
        employees={employees}
        user={user}
        allTasks={tasks}
        selectedYear={windowStart.getFullYear()}
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