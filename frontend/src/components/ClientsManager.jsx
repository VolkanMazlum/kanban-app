import { useState, useEffect } from "react";
import * as api from "../api";
import { downloadAuthenticatedFile } from "../utils/downloadUtils";
import { inpStyle } from "../constants/costConstants.js";

const EMPTY_CLIENT = {
  name: "", ragione_sociale: "", vat_number: "", codice_fiscale: "", codice_univoco: "",
  codice_ateco: "", codice_inarcassa: "", contact_email: "", phone: "", fax: "",
  address: "", localita: "", cap: "", province: "", stato: "",
  contabilita_prefix: "Sig.", contabilita_name: "", contabilita_email: "", contabilita_phone: "",
  notes: "",
  // New fields
  forma_giuridica: "", obsoleto: false,
  contributo: "", pagamento: "", codice_iva: "", split_payment: false,
  conto: "", listino: "", banca: "", iban: "", swift: "",
  pec_fe: "", estero: false, lingua: "Italiano",
  indirizzo_numero: "", sede_tipo: "Legale", sede_principale: true,
  telefono_2: "", telefono_3: "", email_pec: "", indirizzo_web: ""
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
      notes: client.notes || "",
      // New fields
      forma_giuridica: client.forma_giuridica || "",
      obsoleto: client.obsoleto || false,
      contributo: client.contributo || "",
      pagamento: client.pagamento || "",
      codice_iva: client.codice_iva || "",
      split_payment: client.split_payment || false,
      conto: client.conto || "",
      listino: client.listino || "",
      banca: client.banca || "",
      iban: client.iban || "",
      swift: client.swift || "",
      pec_fe: client.pec_fe || "",
      estero: client.estero || false,
      lingua: client.lingua || "Italiano",
      indirizzo_numero: client.indirizzo_numero || "",
      sede_tipo: client.sede_tipo || "Legale",
      sede_principale: client.sede_principale !== undefined ? client.sede_principale : true,
      telefono_2: client.telefono_2 || "",
      telefono_3: client.telefono_3 || "",
      email_pec: client.email_pec || "",
      indirizzo_web: client.indirizzo_web || ""
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

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => downloadAuthenticatedFile("/reports/clients", `Clients_List_${new Date().toISOString().split('T')[0]}.xlsx`)} style={{ background: "#F3F4F6", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "10px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            📥 Export
          </button>
          <button onClick={openNewClient} style={{ background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            + Add New Client
          </button>
        </div>
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

                <SectionTitle title="Anagrafica / General Information" />
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>FORMA GIURIDICA</label>
                  <select value={clientForm.forma_giuridica} onChange={e => setClientForm({ ...clientForm, forma_giuridica: e.target.value })} style={inpStyle}>
                    <option value="">— Seleziona —</option>
                    <option value="Privato">Privato</option>
                    <option value="Ditta Individuale">Ditta Individuale</option>
                    <option value="Azienda">Azienda</option>
                    <option value="Lavoratore Autonomo/Professionista">Lavoratore Autonomo/Professionista</option>
                    <option value="Ente Pubblico">Ente Pubblico</option>
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 20 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="checkbox" checked={clientForm.obsoleto} onChange={e => setClientForm({ ...clientForm, obsoleto: e.target.checked })} />
                    OBSOLETO
                  </label>
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>RAGIONE SOCIALE *</label>
                  <input required value={clientForm.name} onChange={e => setClientForm({ ...clientForm, name: e.target.value })} style={inpStyle} placeholder="e.g. 967 ARCHITETTI ASSOCIATI" />
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>RAGIONE SOCIALE (ESTESA)</label>
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

                <SectionTitle title="Fiscale / Tax & Electronic Invoicing" />
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>CODICE FISCALE</label>
                  <input value={clientForm.codice_fiscale} onChange={e => setClientForm({ ...clientForm, codice_fiscale: e.target.value })} style={inpStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>PARTITA IVA</label>
                  <input value={clientForm.vat_number} onChange={e => setClientForm({ ...clientForm, vat_number: e.target.value })} style={inpStyle} placeholder="e.g. 12954630153" />
                </div>

                <SectionTitle title="Pagamento & Contributo" />
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>CONTRIBUTO</label>
                  <select value={clientForm.contributo} onChange={e => setClientForm({ ...clientForm, contributo: e.target.value })} style={inpStyle}>
                    <option value="">— Seleziona —</option>
                    <option value="Non gestito">Non gestito</option>
                    <option value="ENASARCO">ENASARCO</option>
                    <option value="INPS">INPS</option>
                    <option value="ENPAM">ENPAM</option>
                    <option value="Altro">Altro</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>PAGAMENTO</label>
                  <input value={clientForm.pagamento} onChange={e => setClientForm({ ...clientForm, pagamento: e.target.value })} style={inpStyle} placeholder="e.g. BONIFICO BANCARIO 60 gg. f.m." />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>CODICE IVA</label>
                  <input value={clientForm.codice_iva} onChange={e => setClientForm({ ...clientForm, codice_iva: e.target.value })} style={inpStyle} placeholder="e.g. 22 - Aliquota 22%" />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 20 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="checkbox" checked={clientForm.split_payment} onChange={e => setClientForm({ ...clientForm, split_payment: e.target.checked })} />
                    SPLIT PAYMENT
                  </label>
                </div>

                <SectionTitle title="Banca / Banking" />
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>CONTO</label>
                  <input value={clientForm.conto} onChange={e => setClientForm({ ...clientForm, conto: e.target.value })} style={inpStyle} placeholder="e.g. INTESA SAN PAOLO" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>LISTINO</label>
                  <input value={clientForm.listino} onChange={e => setClientForm({ ...clientForm, listino: e.target.value })} style={inpStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>BANCA</label>
                  <input value={clientForm.banca} onChange={e => setClientForm({ ...clientForm, banca: e.target.value })} style={inpStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>IBAN</label>
                  <input value={clientForm.iban} onChange={e => setClientForm({ ...clientForm, iban: e.target.value })} style={inpStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>SWIFT</label>
                  <input value={clientForm.swift} onChange={e => setClientForm({ ...clientForm, swift: e.target.value })} style={inpStyle} />
                </div>

                <SectionTitle title="Fatturazione Elettronica" />
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>CODICE DESTINATARIO FE (SDI)</label>
                  <input value={clientForm.codice_univoco} onChange={e => setClientForm({ ...clientForm, codice_univoco: e.target.value })} style={inpStyle} placeholder="e.g. M5UXCR1" />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 20 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="checkbox" checked={clientForm.estero} onChange={e => setClientForm({ ...clientForm, estero: e.target.checked })} />
                    ESTERO
                  </label>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>INDIRIZZO PEC FE</label>
                  <input value={clientForm.pec_fe} onChange={e => setClientForm({ ...clientForm, pec_fe: e.target.value })} style={inpStyle} placeholder="pec@example.it" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>LINGUA</label>
                  <select value={clientForm.lingua} onChange={e => setClientForm({ ...clientForm, lingua: e.target.value })} style={inpStyle}>
                    <option value="Italiano">Italiano</option>
                    <option value="English">English</option>
                    <option value="Français">Français</option>
                    <option value="Deutsch">Deutsch</option>
                    <option value="Español">Español</option>
                  </select>
                </div>

                <SectionTitle title="Sede / Address & Location" />
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>TIPO SEDE</label>
                  <select value={clientForm.sede_tipo} onChange={e => setClientForm({ ...clientForm, sede_tipo: e.target.value })} style={inpStyle}>
                    <option value="Legale">Legale</option>
                    <option value="Operativa">Operativa</option>
                    <option value="Amministrativa">Amministrativa</option>
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 20 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="checkbox" checked={clientForm.sede_principale} onChange={e => setClientForm({ ...clientForm, sede_principale: e.target.checked })} />
                    SEDE PRINCIPALE
                  </label>
                </div>
                <div style={{ gridColumn: "span 2", display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>INDIRIZZO</label>
                    <input value={clientForm.address} onChange={e => setClientForm({ ...clientForm, address: e.target.value })} style={inpStyle} placeholder="Via Rutilia" />
                  </div>
                  <div style={{ flex: "0 0 80px" }}>
                    <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>N°</label>
                    <input value={clientForm.indirizzo_numero} onChange={e => setClientForm({ ...clientForm, indirizzo_numero: e.target.value })} style={{ ...inpStyle, width: 80 }} placeholder="10/8" />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>LOCALITÀ</label>
                  <input value={clientForm.localita} onChange={e => setClientForm({ ...clientForm, localita: e.target.value })} style={inpStyle} placeholder="MILANO" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>PROV.</label>
                  <input value={clientForm.province} onChange={e => setClientForm({ ...clientForm, province: e.target.value })} style={inpStyle} placeholder="MI" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>C.A.P.</label>
                  <input value={clientForm.cap} onChange={e => setClientForm({ ...clientForm, cap: e.target.value })} style={inpStyle} placeholder="20141" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>NAZIONE</label>
                  <input value={clientForm.stato} onChange={e => setClientForm({ ...clientForm, stato: e.target.value })} style={inpStyle} placeholder="ITA" />
                </div>

                <SectionTitle title="Contatti / Contacts" />
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>TELEFONO</label>
                  <input value={clientForm.phone} onChange={e => setClientForm({ ...clientForm, phone: e.target.value })} style={inpStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>TELEFONO 2</label>
                  <input value={clientForm.telefono_2} onChange={e => setClientForm({ ...clientForm, telefono_2: e.target.value })} style={inpStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>TELEFONO 3</label>
                  <input value={clientForm.telefono_3} onChange={e => setClientForm({ ...clientForm, telefono_3: e.target.value })} style={inpStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>FAX</label>
                  <input value={clientForm.fax} onChange={e => setClientForm({ ...clientForm, fax: e.target.value })} style={inpStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>e@MAIL</label>
                  <input type="email" value={clientForm.contact_email} onChange={e => setClientForm({ ...clientForm, contact_email: e.target.value })} style={inpStyle} placeholder="info@company.it" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>e@MAIL PEC</label>
                  <input type="email" value={clientForm.email_pec} onChange={e => setClientForm({ ...clientForm, email_pec: e.target.value })} style={inpStyle} placeholder="pec@company.it" />
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>INDIRIZZO WEB</label>
                  <input value={clientForm.indirizzo_web} onChange={e => setClientForm({ ...clientForm, indirizzo_web: e.target.value })} style={inpStyle} placeholder="https://www.example.com" />
                </div>

                <SectionTitle title="Contabilità / Accounting" />
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
                  <label style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block", marginTop: 10 }}>NOTE AGGIUNTIVE</label>
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
