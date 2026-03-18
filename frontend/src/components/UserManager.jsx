import { useState, useEffect } from "react";
import * as api from "../api";

export default function UserManager({ isHR, onUserAdded }) {
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activeTab, setActiveTab] = useState("users"); // 'users' | 'logs'

  // New user form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "standard", position: "", category: "internal" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isHR) return;
    api.getUsers().then(setUsers).catch(console.error);
  }, [isHR]);

  useEffect(() => {
    if (!isHR || activeTab !== "logs") return;
    api.getAuditLogs(200).then(setAuditLogs).catch(console.error);
  }, [isHR, activeTab]);

  if (!isHR) {
    return <div style={{ padding: 40, textAlign: "center", color: "#6B7280" }}>Unauthorized.</div>;
  }

  const refreshUsers = () => api.getUsers().then(setUsers).catch(console.error);

  const handleCreate = async () => {
    if (!form.email.trim() || !form.name.trim() || !form.password.trim()) {
      setError("All fields are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.createUser(form);
      setForm({ email: "", name: "", password: "", role: "standard", position: "", category: "internal" });
      setShowForm(false);
      await refreshUsers();
      if (onUserAdded) onUserAdded(true);
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  const handleToggleActive = async (user) => {
    try {
      await api.updateUser(user.id, { is_active: !user.is_active });
      await refreshUsers();
      if (onUserAdded) onUserAdded(true);
    } catch (err) { console.error(err); }
  };

  const handleRoleChange = async (user, newRole) => {
    try {
      await api.updateUser(user.id, { role: newRole });
      await refreshUsers();
      if (onUserAdded) onUserAdded(true);
    } catch (err) { console.error(err); }
  };

  const handlePositionChange = async (user, newPos) => {
    try {
      await api.updateUser(user.id, { position: newPos });
      await refreshUsers();
      if (onUserAdded) onUserAdded(true);
    } catch (err) { console.error(err); }
  };

  const handleCategoryChange = async (user, newCat) => {
    try {
      await api.updateUser(user.id, { category: newCat });
      await refreshUsers();
      if (onUserAdded) onUserAdded(true);
    } catch (err) { console.error(err); }
  };

  const tabStyle = (id) => ({
    padding: "8px 18px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
    fontFamily: "'Inter',sans-serif",
    background: activeTab === id ? "#fff" : "transparent",
    color: activeTab === id ? "#111827" : "#6B7280",
    boxShadow: activeTab === id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
    transition: "all 0.15s",
  });

  const actionMap = { CREATE: "🟢", UPDATE: "🔵", DELETE: "🔴", STATUS_CHANGE: "🟡" };

  return (
    <div style={{ padding: "28px 32px", overflowY: "auto", height: "100%", fontFamily: "'Inter',sans-serif", background: "#F9FAFB" }}>

      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>User & Audit Management</h2>
          <p style={{ color: "#6B7280", margin: 0, fontSize: 14 }}>Manage user accounts and review system activity logs</p>
        </div>
        <div style={{ display: "flex", background: "#F3F4F6", borderRadius: 8, padding: 3 }}>
          <button style={tabStyle("users")} onClick={() => setActiveTab("users")}>👥 Users ({users.length})</button>
          <button style={tabStyle("logs")} onClick={() => setActiveTab("logs")}>📋 Audit Logs</button>
        </div>
      </div>

      {/* USERS TAB */}
      {activeTab === "users" && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <button onClick={() => setShowForm(!showForm)} style={{
              background: "#2563EB", color: "#fff", border: "none", borderRadius: 8,
              padding: "10px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer"
            }}>
              {showForm ? "Cancel" : "+ New User"}
            </button>
          </div>

          {/* New User Form */}
          {showForm && (
            <div style={{
              background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB",
              padding: 20, marginBottom: 20, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap"
            }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 4 }}>USERNAME / EMAIL</label>
                <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="e.g. marco.r" style={{
                    padding: "8px 12px", borderRadius: 6, border: "1.5px solid #E5E7EB",
                    fontSize: 13, fontWeight: 600, width: 180, outline: "none", fontFamily: "'Inter',sans-serif"
                  }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 4 }}>FULL NAME</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Marco Rossi" style={{
                    padding: "8px 12px", borderRadius: 6, border: "1.5px solid #E5E7EB",
                    fontSize: 13, fontWeight: 600, width: 180, outline: "none", fontFamily: "'Inter',sans-serif"
                  }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 4 }}>PASSWORD</label>
                <input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  type="password" placeholder="Minimum 6 chars" style={{
                    padding: "8px 12px", borderRadius: 6, border: "1.5px solid #E5E7EB",
                    fontSize: 13, fontWeight: 600, width: 160, outline: "none", fontFamily: "'Inter',sans-serif"
                  }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 4 }}>POSITION</label>
                <input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })}
                  placeholder="e.g. Architect" style={{
                    padding: "8px 12px", borderRadius: 6, border: "1.5px solid #E5E7EB",
                    fontSize: 13, fontWeight: 600, width: 140, outline: "none", fontFamily: "'Inter',sans-serif"
                  }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 4 }}>CATEGORY</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  style={{
                    padding: "8px 12px", borderRadius: 6, border: "1.5px solid #E5E7EB",
                    fontSize: 13, fontWeight: 600, width: 110, outline: "none", cursor: "pointer", fontFamily: "'Inter',sans-serif", background: "#fff"
                  }}>
                  <option value="internal">Internal</option>
                  <option value="consultant">Consultant</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 4 }}>ROLE</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                  style={{
                    padding: "8px 12px", borderRadius: 6, border: "1.5px solid #E5E7EB",
                    fontSize: 13, fontWeight: 600, width: 110, outline: "none", cursor: "pointer", fontFamily: "'Inter',sans-serif"
                  }}>
                  <option value="standard">Standard</option>
                  <option value="hr">HR / Admin</option>
                </select>
              </div>
              <button onClick={handleCreate} disabled={saving} style={{
                background: "#059669", color: "#fff", border: "none", borderRadius: 8,
                padding: "8px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer"
              }}>
                {saving ? "Saving..." : "Create User"}
              </button>
              {error && <span style={{ color: "#DC2626", fontSize: 12, fontWeight: 600 }}>{error}</span>}
            </div>
          )}

          {/* Users Table */}
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F9FAFB" }}>
                  {["Username", "Name", "Position", "Category", "Role", "Status", "Actions"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", fontSize: 11, fontWeight: 700, color: "#6B7280", textAlign: "left", borderBottom: "2px solid #E5E7EB" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                    <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#111827" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: "50%",
                          background: user.user_id ? (user.role === "hr" ? "#2563EB" : "#6B7280") : "#E5E7EB",
                          color: user.user_id ? "#fff" : "#9CA3AF",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 700
                        }}>{user.name?.charAt(0)?.toUpperCase() || "?"}</div>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span>{user.name}</span>
                          <span style={{ fontSize: 11, color: user.user_id ? "#6B7280" : "#DC2626", fontWeight: user.user_id ? 400 : 600 }}>
                            {user.email || "No User Access"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "#374151" }}>{user.position}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <select value={user.category || "internal"} onChange={e => handleCategoryChange(user, e.target.value)}
                        style={{
                          padding: "4px 8px", borderRadius: 6, border: "1px solid #D1D5DB",
                          fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif",
                          background: user.category === "consultant" ? "#FDF2F8" : "#F0FDF4",
                          color: user.category === "consultant" ? "#9D174D" : "#166534"
                        }}>
                        <option value="internal">Internal</option>
                        <option value="consultant">Consultant</option>
                      </select>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <select
                        value={user.role || "standard"}
                        onChange={e => handleRoleChange(user, e.target.value)}
                        disabled={!user.user_id}
                        style={{
                          padding: "4px 8px", borderRadius: 6, border: "1px solid #D1D5DB",
                          fontSize: 12, fontWeight: 600, cursor: user.user_id ? "pointer" : "not-allowed",
                          fontFamily: "'Inter',sans-serif",
                          background: !user.user_id ? "#F3F4F6" : (user.role === "hr" ? "#EFF6FF" : "#F9FAFB"),
                          color: !user.user_id ? "#9CA3AF" : (user.role === "hr" ? "#2563EB" : "#374151"),
                          opacity: user.user_id ? 1 : 0.6
                        }}>
                        <option value="standard">Standard</option>
                        <option value="hr">HR / Admin</option>
                      </select>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                        background: user.user_id ? (user.is_active ? "#F0FDF4" : "#FEF2F2") : "#F3F4F6",
                        color: user.user_id ? (user.is_active ? "#059669" : "#DC2626") : "#9CA3AF"
                      }}>
                        {!user.user_id ? "No Account" : (user.is_active ? "Active" : "Disabled")}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "#9CA3AF" }}>
                      {new Date(user.created_at).toLocaleDateString("it-IT")}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {user.user_id ? (
                        <button onClick={() => handleToggleActive(user)} style={{
                          background: user.is_active ? "#FEF2F2" : "#F0FDF4",
                          color: user.is_active ? "#DC2626" : "#059669",
                          border: `1px solid ${user.is_active ? "#FECACA" : "#BBF7D0"}`,
                          borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer"
                        }}>
                          {user.is_active ? "Disable" : "Enable"}
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>Create user to manage</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AUDIT LOGS TAB */}
      {activeTab === "logs" && (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F9FAFB" }}>
                {["", "Action", "Entity", "ID", "User", "IP", "Details", "Time"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#6B7280", textAlign: "left", borderBottom: "2px solid #E5E7EB", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {auditLogs.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>No activity recorded yet.</td></tr>
              ) : auditLogs.map(log => (
                <tr key={log.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "10px 14px", fontSize: 16 }}>{actionMap[log.action] || "⚪"}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 700, color: "#111827" }}>{log.action}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "#6366F1" }}>{log.entity_type}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#9CA3AF" }}>#{log.entity_id || "—"}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "#374151" }}>{log.user_name || log.user_email || "—"}</td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: "#9CA3AF", fontFamily: "monospace" }}>{log.ip_address || "—"}</td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: "#6B7280", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {log.details ? (typeof log.details === "string" ? log.details : JSON.stringify(log.details)) : "—"}
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: "#9CA3AF", whiteSpace: "nowrap" }}>
                    {new Date(log.created_at).toLocaleString("it-IT")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
