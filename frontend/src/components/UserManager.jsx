import { useState, useEffect } from "react";
import * as api from "../api";
import { downloadAuthenticatedFile } from "../utils/downloadUtils";

export default function UserManager({ isHR, onUserAdded }) {
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activeTab, setActiveTab] = useState("users"); // 'users' | 'logs'

  // New user form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: "", name: "", password: "", role: "standard", position: "", category: "internal", hr_details: {} });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Edit user modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});

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
    if (!form.username?.trim() || !form.name.trim() || !form.password.trim()) {
      setError("Username, Name, and Password are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const nameParts = form.name.trim().split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";
      
      const creationData = {
        ...form,
        hr_details: {
          ...form.hr_details,
          firstName,
          lastName
        }
      };

      await api.createUser(creationData);
      setForm({ username: "", name: "", password: "", role: "standard", position: "", category: "internal", hr_details: {} });
      setShowForm(false);
      await refreshUsers();
      if (onUserAdded) onUserAdded(true);
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  const openEditUser = (user) => {
    setEditingUser(user);
    setEditForm({
      name: user.name || "",
      username: user.username || "",
      password: "",
      role: user.role || "standard",
      position: user.position || "",
      category: user.category || "internal",
      is_active: user.is_active !== undefined ? user.is_active : true,
      hr_details: user.hr_details || {}
    });
    setError(null);
    setShowEditModal(true);
  };

  const handleUpdateUser = async () => {
    setSaving(true);
    setError(null);
    try {
      const data = { ...editForm };
      if (!data.password?.trim()) delete data.password;
      const targetId = editingUser.user_id || editingUser.id;
      await api.updateUser(targetId, data);
      setShowEditModal(false);
      await refreshUsers();
      if (onUserAdded) onUserAdded(true);
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  const handleToggleActive = async (user) => {
    try {
      const targetId = user.user_id || user.id;
      await api.updateUser(targetId, { is_active: !user.is_active });
      await refreshUsers();
      if (onUserAdded) onUserAdded(true);
    } catch (err) { console.error(err); }
  };

  const handleRoleChange = async (user, newRole) => {
    try {
      const targetId = user.user_id || user.id;
      await api.updateUser(targetId, { role: newRole });
      await refreshUsers();
      if (onUserAdded) onUserAdded(true);
    } catch (err) { console.error(err); }
  };

  const handleCategoryChange = async (user, newCat) => {
    try {
      const targetId = user.user_id || user.id;
      await api.updateUser(targetId, { category: newCat });
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

      {activeTab === "users" && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <button onClick={() => setShowForm(!showForm)} style={{
              background: "#2563EB", color: "#fff", border: "none", borderRadius: 8,
              padding: "10px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer", marginRight: 8
            }}>{showForm ? "Cancel" : "+ New User"}</button>
            <button onClick={() => downloadAuthenticatedFile("/reports/employees", `Employees_HR_Report_${new Date().toISOString().split('T')[0]}.xlsx`)} style={{
              background: "#10B981", color: "#fff", border: "none", borderRadius: 8,
              padding: "10px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer", textDecoration: "none"
            }}>📥 Export Employees (Excel)</button>
          </div>
          {showForm && (
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", padding: 20, marginBottom: 20, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
              {[
                { label: "USERNAME", key: "username", type: "text" },
                { label: "FULL NAME", key: "name", type: "text" },
                { label: "PASSWORD", key: "password", type: "password" },
                { label: "POSITION", key: "position", type: "text" },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 4 }}>{f.label}</label>
                  <input type={f.type} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} style={{ padding: "8px 12px", borderRadius: 6, border: "1.5px solid #E5E7EB", fontSize: 13, width: 140 }} />
                </div>
              ))}
              <button onClick={handleCreate} disabled={saving} style={{ background: "#059669", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 600, cursor: "pointer" }}>{saving ? "Saving..." : "Create User"}</button>
            </div>
          )}
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F9FAFB" }}>
                  <th style={{ padding: "16px 24px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.05em" }}>Full Name</th>
                  <th style={{ padding: "16px 24px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.05em" }}>Username</th>
                  <th style={{ padding: "16px 24px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.05em" }}>Role</th>
                  <th style={{ padding: "16px 24px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.05em" }}>Position</th>
                  <th style={{ padding: "16px 24px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.05em" }}>Category</th>
                  <th style={{ padding: "16px 24px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</th>
                  <th style={{ padding: "16px 24px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.05em" }}>Joined</th>
                  <th style={{ padding: "16px 24px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.05em" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                    <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600 }}>{user.name}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13 }}>{user.username}</td>
                    <td style={{ padding: "12px 16px" }}>{user.role}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13 }}>{user.position}</td>
                    <td style={{ padding: "12px 16px" }}>{user.category}</td>
                    <td style={{ padding: "12px 16px", cursor: "pointer", textAlign: "center" }} title={user.is_active ? "Click to Disable" : "Click to Enable"} onClick={() => handleToggleActive(user)}>
                      {user.is_active ? "✅" : "❌"}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 11 }}>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: "12px 16px" }}><button onClick={() => openEditUser(user)} style={{ background: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "logs" && (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#F9FAFB" }}>{["Action", "Entity", "ID", "User (UName)", "Details", "Time"].map(h => <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#6B7280", textAlign: "left" }}>{h}</th>)}</tr></thead>
            <tbody>{auditLogs.map(log => <tr key={log.id} style={{ borderTop: "1px solid #F3F4F6" }}><td style={{ padding: "10px 14px", fontSize: 12 }}>{log.action}</td><td style={{ padding: "10px 14px" }}>{log.entity_type}</td><td style={{ padding: "10px 14px" }}>{log.entity_id}</td><td style={{ padding: "10px 14px" }}>{log.user_username || log.user_email}</td><td style={{ padding: "10px 14px", fontSize: 11 }}>{JSON.stringify(log.details)}</td><td style={{ padding: "10px 14px", fontSize: 11 }}>{new Date(log.created_at).toLocaleString()}</td></tr>)}</tbody>
          </table>
        </div>
      )}

      {showEditModal && <EditUserModal user={editingUser} form={editForm} setForm={setEditForm} onSave={handleUpdateUser} onClose={() => setShowEditModal(false)} saving={saving} error={error} />}
    </div>
  );
}

const HRField = ({ label, value, onChange, type = "text", placeholder = "" }) => (
  <div style={{ marginBottom: 12 }}>
    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 4, textTransform: "uppercase" }}>{label}</label>
    <input
      type={type}
      placeholder={placeholder}
      value={value || ""}
      onChange={e => onChange(e.target.value)}
      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, outline: "none", color: "#111827" }}
    />
  </div>
);

function EditUserModal({ user, form, setForm, onSave, onClose, saving, error }) {
  const [modalTab, setModalTab] = useState("account");
  const [tyear, setTyear] = useState(new Date().getFullYear());

  const updateHR = (key, val) => {
    setForm(prev => ({
      ...prev,
      hr_details: {
        ...(prev.hr_details || {}),
        [key]: val
      }
    }));
  };

  const mTabStyle = (id) => ({
    padding: "10px 16px", cursor: "pointer", fontSize: 12, fontWeight: 700, borderBottom: modalTab === id ? "2px solid #2563EB" : "2px solid transparent",
    color: modalTab === id ? "#2563EB" : "#6B7280", transition: "all 0.2s"
  });

  const trainingYears = [];
  const currentYear = new Date().getFullYear();
  for (let y = 2020; y <= currentYear + 10; y++) trainingYears.push(y);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(6px)" }}>
      <div style={{ background: "#fff", borderRadius: 20, width: 850, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
        <div style={{ padding: "24px 32px", borderBottom: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#111827" }}>Employee Extended Profile</h3>
            <p style={{ margin: "4px 0 0 0", color: "#6B7280", fontSize: 13 }}>Editing data for <b>{form.name}</b></p>
          </div>
          <button onClick={onClose} style={{ background: "#F3F4F6", border: "none", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", fontSize: 20 }}>&times;</button>
        </div>

        <div style={{ display: "flex", background: "#F9FAFB", borderBottom: "1px solid #F3F4F6", padding: "0 32px" }}>
          <div style={mTabStyle("account")} onClick={() => setModalTab("account")}>Account</div>
          <div style={mTabStyle("personal")} onClick={() => setModalTab("personal")}>Anagrafica</div>
          <div style={mTabStyle("pro")} onClick={() => setModalTab("pro")}>Professional / Inq.</div>
          <div style={mTabStyle("finance")} onClick={() => setModalTab("finance")}>Financial</div>
          <div style={mTabStyle("safe")} onClick={() => setModalTab("safe")}>Safety/Security</div>
          <div style={mTabStyle("skills")} onClick={() => setModalTab("skills")}>Skills/Langs</div>
          <div style={mTabStyle("training")} onClick={() => setModalTab("training")}>Training</div>
        </div>

        <div style={{ padding: 32, flex: 1, overflowY: "auto" }}>
          {modalTab === "account" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <HRField label="FIRST NAME" value={form.hr_details?.firstName} onChange={v => {
                const ln = form.hr_details?.lastName || "";
                updateHR("firstName", v);
                setForm(prev => ({ ...prev, name: (v + " " + ln).trim() }));
              }} />
              <HRField label="LAST NAME" value={form.hr_details?.lastName} onChange={v => {
                const fn = form.hr_details?.firstName || "";
                updateHR("lastName", v);
                setForm(prev => ({ ...prev, name: (fn + " " + v).trim() }));
              }} />
              <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 6 }}>FULL NAME (AUTO)</label><input value={form.name} readOnly style={{ width: "100%", padding: 10, borderRadius: 8, border: "1.5px solid #E5E7EB", background: "#F9FAFB" }} /></div>
              <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 6 }}>USERNAME</label><input value={form.username || form.email} onChange={e => setForm({ ...form, username: e.target.value })} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1.5px solid #E5E7EB" }} /></div>
              <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 6 }}>POSITION</label><input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1.5px solid #E5E7EB" }} /></div>
              <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 6 }}>CATEGORY</label><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1.5px solid #E5E7EB" }}><option value="internal">Internal</option><option value="consultant">Consultant</option></select></div>
              <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 6 }}>ROLE</label><select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1.5px solid #E5E7EB" }}><option value="standard">Standard</option><option value="hr">HR / Admin</option></select></div>
              <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 6 }}>STATUS</label><select value={form.is_active ? "true" : "false"} onChange={e => setForm({ ...form, is_active: e.target.value === "true" })} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1.5px solid #E5E7EB" }}><option value="true">Active (✅)</option><option value="false">Disabled (❌)</option></select></div>
              <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 6 }}>NEW PASSWORD (LEAVE BLANK FOR NO CHANGE)</label><input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1.5px solid #E5E7EB" }} /></div>
            </div>
          )}

          {modalTab === "personal" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
              <HRField label="Sesso (M/F)" value={form.hr_details?.sesso} onChange={v => updateHR("sesso", v)} />
              <HRField label="Data di Nascita" type="date" value={form.hr_details?.data_nascita} onChange={v => updateHR("data_nascita", v)} />
              <HRField label="Luogo Nascita" value={form.hr_details?.luogo_nascita} onChange={v => updateHR("luogo_nascita", v)} />
              <HRField label="Età" type="number" value={form.hr_details?.eta} onChange={v => updateHR("eta", v)} />
              <HRField label="Residenza" value={form.hr_details?.residenza} onChange={v => updateHR("residenza", v)} />
              <HRField label="Codice Fiscale" value={form.hr_details?.cf} onChange={v => updateHR("cf", v)} />
            </div>
          )}

          {modalTab === "pro" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <HRField label="Inizio Lavoro" type="date" value={form.hr_details?.inizio_lavoro} onChange={v => updateHR("inizio_lavoro", v)} />
              <HRField label="Anni Esperienza" type="number" value={form.hr_details?.anni_exp} onChange={v => updateHR("anni_exp", v)} />
              <HRField label="Qualifica" value={form.hr_details?.qualifica} onChange={v => updateHR("qualifica", v)} />
              <HRField label="Ordine di" value={form.hr_details?.ordine} onChange={v => updateHR("ordine", v)} />
              <HRField label="N. Iscrizione" value={form.hr_details?.n_iscrizione} onChange={v => updateHR("n_iscrizione", v)} />
              <HRField label="Data Iscrizione" type="date" value={form.hr_details?.data_iscrizione} onChange={v => updateHR("data_iscrizione", v)} />
              <HRField label="Data Abilitazione" type="date" value={form.hr_details?.data_abilitazione} onChange={v => updateHR("data_abilitazione", v)} />
              <HRField label="Posizione (Inq.)" value={form.hr_details?.posizione_inq} onChange={v => updateHR("posizione_inq", v)} />
              <HRField label="Assunzione" type="date" value={form.hr_details?.assunzione} onChange={v => updateHR("assunzione", v)} />
              <HRField label="Livello" value={form.hr_details?.livello} onChange={v => updateHR("livello", v)} />
              <HRField label="Contratto" value={form.hr_details?.contratto} onChange={v => updateHR("contratto", v)} />
              <HRField label="Scadenza Contratto" type="date" value={form.hr_details?.scadenza_contratto} onChange={v => updateHR("scadenza_contratto", v)} />
              <HRField label="Team" value={form.hr_details?.team} onChange={v => updateHR("team", v)} />
              <HRField label="Disciplina" value={form.hr_details?.disciplina} onChange={v => updateHR("disciplina", v)} />
              <HRField label="Presenza (%)" value={form.hr_details?.presenza} onChange={v => updateHR("presenza", v)} />
              <HRField label="Smart Working" value={form.hr_details?.smart_working} onChange={v => updateHR("smart_working", v)} />
            </div>
          )}

          {modalTab === "finance" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <HRField label="RAL (€)" type="number" value={form.hr_details?.ral} onChange={v => updateHR("ral", v)} />
              <HRField label="Lordo Azienda (€)" type="number" value={form.hr_details?.lordo_azienda} onChange={v => updateHR("lordo_azienda", v)} />
              <HRField label="Una Tantum" value={form.hr_details?.una_tantum} onChange={v => updateHR("una_tantum", v)} />
              <HRField label="Auto / Benefits" value={form.hr_details?.auto} onChange={v => updateHR("auto", v)} />
              <HRField label="Carta Carburante" value={form.hr_details?.carburante} onChange={v => updateHR("carburante", v)} />
              <HRField label="Welfare" value={form.hr_details?.welfare} onChange={v => updateHR("welfare", v)} />
              <HRField label="Buoni Pasto" value={form.hr_details?.buoni_pasto} onChange={v => updateHR("buoni_pasto", v)} />
              <HRField label="Totale Annuo Lordo" type="number" value={form.hr_details?.totale_annuo} onChange={v => updateHR("totale_annuo", v)} />
            </div>
          )}

          {modalTab === "safe" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <HRField label="Corsi Sicurezza" value={form.hr_details?.corsi_sic} onChange={v => updateHR("corsi_sic", v)} />
              <HRField label="Scadenza Corsi" type="date" value={form.hr_details?.scadenza_corsi} onChange={v => updateHR("scadenza_corsi", v)} />
              <HRField label="Visita Medica" value={form.hr_details?.visita_medica} onChange={v => updateHR("visita_medica", v)} />
              <HRField label="Scadenza Visita" type="date" value={form.hr_details?.scadenza_visita} onChange={v => updateHR("scadenza_visita", v)} />
            </div>
          )}

          {modalTab === "skills" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
              {["Italiano", "Inglese", "Francese", "Spagnolo", "Tedesco", "Portoghese", "Arabo", "Russo", "Turco"].map(L => (
                <div key={L} style={{ border: "1px solid #F3F4F6", padding: 8, borderRadius: 8 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF" }}>{L}</label>
                  <select value={form.hr_details?.[`lang_${L}`] || "N/A"} onChange={e => updateHR(`lang_${L}`, e.target.value)} style={{ width: "100%", border: "none", fontSize: 13, background: "transparent" }}>
                    <option value="N/A">-</option>
                    <option value="A1">A1 (Breakthrough)</option>
                    <option value="A2">A2 (Waystage)</option>
                    <option value="B1">B1 (Threshold)</option>
                    <option value="B2">B2 (Vantage)</option>
                    <option value="C1">C1 (Effective Efficiency)</option>
                    <option value="C2">C2 (Mastery)</option>
                    <option value="Native">Native</option>
                  </select>
                </div>
              ))}
            </div>
          )}

          {modalTab === "training" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#F3F4F6", borderRadius: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: "#374151" }}>SELECT YEAR:</label>
                <select value={tyear} onChange={e => setTyear(parseInt(e.target.value))} style={{ padding: "6px 12px", borderRadius: 8, border: "1.5px solid #D1D5DB", fontWeight: 700, fontSize: 14 }}>
                  {trainingYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <span style={{ fontSize: 12, color: "#6B7280" }}>Historical or future training data</span>
              </div>

              <div style={{ border: "2px solid #E5E7EB", padding: 24, borderRadius: 16 }}>
                <h4 style={{ margin: "0 0 16px 0", fontSize: 16, fontWeight: 800, color: "#111827", display: "flex", alignItems: "center", gap: 8 }}>
                  🎯 Training Details for {tyear}
                  {tyear === new Date().getFullYear() && <span style={{ background: "#2563EB", color: "#fff", fontSize: 10, padding: "2px 6px", borderRadius: 4 }}>CURRENT</span>}
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
                  <HRField label="Courses / Objectives" value={form.hr_details?.[`form_${tyear}`]} onChange={v => updateHR(`form_${tyear}`, v)} />
                  <HRField label="Total Hours" type="number" value={form.hr_details?.[`ore_${tyear}`]} onChange={v => updateHR(`ore_${tyear}`, v)} />
                </div>
                <div style={{ marginTop: 20 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 8 }}>QUARTERLY PROGRESS ({tyear})</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
                    <HRField label="Q1" value={form.hr_details?.[`q1_${tyear}`]} onChange={v => updateHR(`q1_${tyear}`, v)} />
                    <HRField label="Q2" value={form.hr_details?.[`q2_${tyear}`]} onChange={v => updateHR(`q2_${tyear}`, v)} />
                    <HRField label="Q3" value={form.hr_details?.[`q3_${tyear}`]} onChange={v => updateHR(`q3_${tyear}`, v)} />
                    <HRField label="Q4" value={form.hr_details?.[`q4_${tyear}`]} onChange={v => updateHR(`q4_${tyear}`, v)} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: "24px 32px", borderTop: "1px solid #F3F4F6", display: "flex", gap: 12 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 12, background: "#F3F4F6", border: "none", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
          <button onClick={onSave} disabled={saving} style={{ flex: 2, padding: 12, borderRadius: 12, background: "#2563EB", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer" }}>{saving ? "Saving..." : "Save Profile & Details"}</button>
        </div>
      </div>
    </div>
  );
}
