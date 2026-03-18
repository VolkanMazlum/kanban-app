import { useState, useEffect } from "react";
import * as api from "../api";
import { inpStyle } from "../constants/costConstants.js";

const EMPTY_CLIENT = {
  name: "", ragione_sociale: "", vat_number: "", codice_fiscale: "", codice_univoco: "",
  codice_ateco: "", codice_inarcassa: "", contact_email: "", phone: "", fax: "",
  address: "", localita: "", cap: "", province: "", stato: "",
  contabilita_prefix: "Sig.", contabilita_name: "", contabilita_email: "", contabilita_phone: "",
  notes: ""
};

export default function ClientsManager({ isHR }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [clientForm, setClientForm] = useState(EMPTY_CLIENT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isHR) return;
    loadClients();
  }, [isHR]);

  const loadClients = async () => {
    setLoading(true);
    try {
      const data = await api.getClients();
      setClients(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isHR) {
    return <div style={{ padding: 40, textAlign: "center", color: "#6B7280" }}>Unauthorized access. HR privileges required.</div>;
  }

  const openNewClient = () => {
    setEditingClient(null);
    setClientForm(EMPTY_CLIENT);
    setShowModal(true);
  };

  const openEditClient = (client) => {
    setEditingClient(client);
    setClientForm({
      name: client.name || "",
      ragione_sociale: client.ragione_sociale || "",
      vat_number: client.vat_number || "",
      codice_fiscale: client.codice_fiscale || "",
      codice_univoco: client.codice_univoco || "",
      codice_ateco: client.codice_ateco || "",
      codice_inarcassa: client.codice_inarcassa || "",
      contact_email: client.contact_email || "",
      phone: client.phone || "",
      fax: client.fax || "",
      address: client.address || "",
      localita: client.localita || "",
      cap: client.cap || "",
      province: client.province || "",
      stato: client.stato || "",
      contabilita_prefix: client.contabilita_prefix || "Sig.",
      contabilita_name: client.contabilita_name || "",
      contabilita_email: client.contabilita_email || "",
      contabilita_phone: client.contabilita_phone || "",
      notes: client.notes || ""
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!clientForm.name.trim()) return;
    setSaving(true);
    try {
      if (editingClient) {
        await api.updateClient(editingClient.id, clientForm);
      } else {
        await api.createClient(clientForm);
      }
      await loadClients();
      setShowModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this client?")) return;
    try {
      await api.deleteClient(id);
      await loadClients();
    } catch (err) {
      console.error(err);
      alert("Failed to delete client. They might be linked to existing Commesse.");
    }
  };

  const SectionTitle = ({ title }) => (
    <div style={{
      gridColumn: "span 2", padding: "8px 0", borderBottom: "1px solid #F3F4F6",
      marginBottom: 8, marginTop: 16, fontSize: 11, fontWeight: 800, color: "#2563EB", letterSpacing: "0.05em"
    }}>
      {title.toUpperCase()}
    </div>
  );

  return (
    <div style={{ padding: "28px 32px", overflowY: "auto", height: "100%", fontFamily: "'Inter',sans-serif", background: "#F9FAFB" }}>

      {/* HEADER */}
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>Client Directory</h2>
          </div>
          <p style={{ color: "#6B7280", margin: 0, fontSize: 14 }}>Manage client profiles, tax information, and contacts</p>
        </div>

        <button onClick={openNewClient} style={{ background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
          + Add New Client
        </button>
      </div>

      {/* DATA TABLE */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", overflowX: "auto" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6B7280", fontSize: 13 }}>Loading clients...</div>
        ) : clients.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>No clients found. Click "Add New Client" to create one.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000 }}>
            <thead>
              <tr style={{ background: "#F9FAFB" }}>
                {["Client Name", "VAT / Tax ID", "Accounting Contact", "Phone", "Location", "Actions"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700, color: "#6B7280", textAlign: "left", borderBottom: "2px solid #E5E7EB" }}>
                    {h.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} style={{ borderBottom: "1px solid #F3F4F6", transition: "background 0.15s" }} onMouseEnter={(e) => e.currentTarget.style.background = "#F9FAFB"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ fontWeight: 600, color: "#111827" }}>{client.name}</div>
                    <div style={{ fontSize: 11, color: "#6B7280" }}>{client.ragione_sociale}</div>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ color: "#4B5563", fontSize: 12, fontFamily: "monospace" }}>{client.vat_number || "—"}</div>
                    <div style={{ color: "#9CA3AF", fontSize: 11 }}>{client.codice_fiscale}</div>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ color: "#4B5563", fontSize: 13 }}>{client.contabilita_name ? `${client.contabilita_prefix || ''} ${client.contabilita_name}` : "—"}</div>
                    <div style={{ color: "#2563EB", fontSize: 11 }}>{client.contabilita_email}</div>
                  </td>
                  <td style={{ padding: "14px 16px", color: "#4B5563", fontSize: 13 }}>{client.phone || "—"}</td>
                  <td style={{ padding: "14px 16px", color: "#6B7280", fontSize: 12, maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {client.address && `${client.address}, `}{client.localita} {client.province}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => openEditClient(client)} style={{ background: "#F3F4F6", border: "1px solid #D1D5DB", borderRadius: 6, padding: "6px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", color: "#374151" }}>Edit</button>
                      <button onClick={() => handleDelete(client.id)} style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 6, padding: "6px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* CLIENT MODAL */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 700, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{editingClient ? "Edit Client" : "Add New Client"}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}>✕</button>
            </div>

            <form onSubmit={handleSave}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

                <SectionTitle title="General Information" />
                <div style={{ gridColumn: "span 2" }}>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>CLIENT DISPLAY NAME *</label>
                  <input required value={clientForm.name} onChange={e => setClientForm({ ...clientForm, name: e.target.value })} style={inpStyle} placeholder="e.g. Comune di Milano" />
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>RAGIONE SOCIALE</label>
                  <input value={clientForm.ragione_sociale} onChange={e => setClientForm({ ...clientForm, ragione_sociale: e.target.value })} style={inpStyle} placeholder="Complete Company Name" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>CODICE ATECO</label>
                  <input value={clientForm.codice_ateco} onChange={e => setClientForm({ ...clientForm, codice_ateco: e.target.value })} style={inpStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>CODICE INARCASSA</label>
                  <input value={clientForm.codice_inarcassa} onChange={e => setClientForm({ ...clientForm, codice_inarcassa: e.target.value })} style={inpStyle} />
                </div>

                <SectionTitle title="Tax & Electronic Invoicing" />
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>PARTITA I.V.A.</label>
                  <input value={clientForm.vat_number} onChange={e => setClientForm({ ...clientForm, vat_number: e.target.value })} style={inpStyle} placeholder="IT..." />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>CODICE FISCALE</label>
                  <input value={clientForm.codice_fiscale} onChange={e => setClientForm({ ...clientForm, codice_fiscale: e.target.value })} style={inpStyle} />
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>CODICE UNIVOCO (SDI)</label>
                  <input value={clientForm.codice_univoco} onChange={e => setClientForm({ ...clientForm, codice_univoco: e.target.value })} style={inpStyle} placeholder="7-character code" />
                </div>

                <SectionTitle title="Address & Location" />
                <div style={{ gridColumn: "span 2" }}>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>ADDRESS</label>
                  <input value={clientForm.address} onChange={e => setClientForm({ ...clientForm, address: e.target.value })} style={inpStyle} placeholder="Via Roma, 1..." />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>LOCALITÀ</label>
                  <input value={clientForm.localita} onChange={e => setClientForm({ ...clientForm, localita: e.target.value })} style={inpStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>C.A.P.</label>
                  <input value={clientForm.cap} onChange={e => setClientForm({ ...clientForm, cap: e.target.value })} style={inpStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>PROVINCE</label>
                  <input value={clientForm.province} onChange={e => setClientForm({ ...clientForm, province: e.target.value })} style={inpStyle} placeholder="e.g. MI" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>STATO</label>
                  <input value={clientForm.stato} onChange={e => setClientForm({ ...clientForm, stato: e.target.value })} style={inpStyle} placeholder="e.g. Italia" />
                </div>

                <SectionTitle title="Administrative Contacts" />
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>GENERAL EMAIL</label>
                  <input type="email" value={clientForm.contact_email} onChange={e => setClientForm({ ...clientForm, contact_email: e.target.value })} style={inpStyle} placeholder="contact@client.com" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>GENERAL PHONE</label>
                  <input value={clientForm.phone} onChange={e => setClientForm({ ...clientForm, phone: e.target.value })} style={inpStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>FAX</label>
                  <input value={clientForm.fax} onChange={e => setClientForm({ ...clientForm, fax: e.target.value })} style={inpStyle} />
                </div>

                <SectionTitle title="Accounting / Contabilità" />
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: "0 0 80px" }}>
                    <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>PREFIX</label>
                    <select value={clientForm.contabilita_prefix} onChange={e => setClientForm({ ...clientForm, contabilita_prefix: e.target.value })} style={inpStyle}>
                      <option value="Sig.">Sig.</option>
                      <option value="Sig.ra">Sig.ra</option>
                      <option value="Ing.">Ing.</option>
                      <option value="Arch.">Arch.</option>
                      <option value="Dott.">Dott.</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>CONTABILITÀ NAME</label>
                    <input value={clientForm.contabilita_name} onChange={e => setClientForm({ ...clientForm, contabilita_name: e.target.value })} style={inpStyle} placeholder="Name Surname" />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>CONTABILITÀ EMAIL</label>
                  <input type="email" value={clientForm.contabilita_email} onChange={e => setClientForm({ ...clientForm, contabilita_email: e.target.value })} style={inpStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>CONTABILITÀ PHONE</label>
                  <input value={clientForm.contabilita_phone} onChange={e => setClientForm({ ...clientForm, contabilita_phone: e.target.value })} style={inpStyle} />
                </div>

                <div style={{ gridColumn: "span 2" }}>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block", marginTop: 10 }}>ADDITIONAL NOTES</label>
                  <textarea value={clientForm.notes} onChange={e => setClientForm({ ...clientForm, notes: e.target.value })} style={{ ...inpStyle, minHeight: 60, resize: "vertical" }} placeholder="Additional information..." />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 32 }}>
                <button type="submit" disabled={saving} style={{ flex: 1, padding: 12, background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", transition: "background 0.2s" }}>
                  {saving ? "Saving..." : "Save Client"}
                </button>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: 12, background: "#F9FAFB", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
