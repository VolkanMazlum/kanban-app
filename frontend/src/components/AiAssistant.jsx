import { useState, useEffect, useRef } from "react";
import * as api from "../api";

/* ─────────────── helpers ─────────────── */
const fmt = (n) =>
  "€" + Number(n || 0).toLocaleString("it-IT", { minimumFractionDigits: 0 });

const NOW_YEAR = new Date().getFullYear();

/* ─────────────── inline styles ─────────────── */
const S = {
  label: {
    display: "block",
    fontSize: 10,
    fontWeight: 700,
    color: "#64748B",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  input: {
    width: "100%",
    padding: "9px 12px",
    border: "1.5px solid #E2E8F0",
    borderRadius: 8,
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    background: "#F8FAFC",
    color: "#1E293B",
    transition: "border-color 0.2s",
    fontFamily: "inherit",
  },
  select: {
    width: "100%",
    padding: "9px 12px",
    border: "1.5px solid #E2E8F0",
    borderRadius: 8,
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    background: "#F8FAFC",
    color: "#1E293B",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  textarea: {
    width: "100%",
    padding: "9px 12px",
    border: "1.5px solid #E2E8F0",
    borderRadius: 8,
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    background: "#F8FAFC",
    color: "#1E293B",
    resize: "vertical",
    minHeight: 60,
    fontFamily: "inherit",
  },
  fieldGroup: { display: "flex", flexDirection: "column", gap: 4 },
};

/* ─────────────── FormField helper ─────────────── */
function Field({ label, children }) {
  return (
    <div style={S.fieldGroup}>
      <label style={S.label}>{label}</label>
      {children}
    </div>
  );
}

/* ─────────────── Message bubble ─────────────── */
function Bubble({ m }) {
  const isUser = m.role === "user";
  return (
    <div
      style={{
        alignSelf: isUser ? "flex-end" : "flex-start",
        maxWidth: "88%",
        padding: "10px 14px",
        borderRadius: isUser ? "18px 18px 4px 18px" : "4px 18px 18px 18px",
        background: isUser
          ? "linear-gradient(135deg,#6366F1,#4F46E5)"
          : "#F1F5F9",
        color: isUser ? "#fff" : "#334155",
        fontSize: 13,
        lineHeight: 1.65,
        boxShadow: isUser
          ? "0 4px 12px rgba(99,102,241,0.3)"
          : "0 1px 4px rgba(0,0,0,0.08)",
        border: isUser ? "none" : "1px solid #E2E8F0",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {m.content}
    </div>
  );
}

/* ─────────────── Typing indicator ─────────────── */
function TypingDots() {
  return (
    <div
      style={{
        alignSelf: "flex-start",
        display: "flex",
        gap: 5,
        padding: "12px 16px",
        background: "#F1F5F9",
        borderRadius: "4px 18px 18px 18px",
        border: "1px solid #E2E8F0",
      }}
    >
      {[0, 0.2, 0.4].map((d, i) => (
        <div
          key={i}
          style={{
            width: 7,
            height: 7,
            background: "#6366F1",
            borderRadius: "50%",
            animation: `typingBounce 1s ${d}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════ MAIN COMPONENT ═══════════════ */
export default function AiAssistant({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Ciao! Sono l'Assistente AI di Tekser S.R.L. 🏗️\n\nPosso aiutarti con:\n• Dati di fatturato e commesse\n• Informazioni su clienti\n• Creare task, commesse e offerte\n• Domande sul sistema o sull'azienda\n\nChiedimi pure!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeForm, setActiveForm] = useState(null);
  const [formData, setFormData] = useState({});
  const [clients, setClients] = useState([]);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  /* fetch clients once on mount */
  useEffect(() => {
    api.getClients().then(setClients).catch(() => {});
  }, []);

  /* scroll to bottom */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeForm, loading]);

  /* focus input when chat opens */
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  /* ─── handle send ─── */
  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setActiveForm(null);

    const txt = input.toLowerCase();
    const actionWords = ["crea", "nuov", "aggiung", "ekle", "yeni", "olustur", "oluştur", "add", "new"];
    const hasAction = actionWords.some((w) => txt.includes(w));

    if (txt.includes("task") && hasAction) {
      return triggerForm("task");
    }
    if ((txt.includes("commessa") || txt.includes("komessa")) && hasAction) {
      return triggerForm("commessa");
    }
    if ((txt.includes("offerta") || txt.includes("oferta") || txt.includes("teklif")) && hasAction) {
      return triggerForm("offerta");
    }

    setLoading(true);
    try {
      let contextDate = null;
      const monthMatch = input.match(
        /(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})/i
      );
      if (monthMatch) {
        const mm = {
          gennaio: "01", febbraio: "02", marzo: "03", aprile: "04",
          maggio: "05", giugno: "06", luglio: "07", agosto: "08",
          settembre: "09", ottobre: "10", novembre: "11", dicembre: "12",
        };
        contextDate = `${monthMatch[2]}-${mm[monthMatch[1].toLowerCase()]}`;
      }

      const res = await api.chatWithAI([...messages, userMsg], contextDate);
      const clean = res.message.content.replace(/\[\[REQUEST_FORM:.*?\]\]/g, "").trim();
      setMessages((prev) => [...prev, { role: "assistant", content: clean }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Mi dispiace, non riesco a connettermi ora. Riprova più tardi." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const triggerForm = (type) => {
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Perfetto! Compila il modulo qui sotto per creare ${type === "task" ? "un nuovo Task" : type === "commessa" ? "una nuova Commessa" : "una nuova Offerta"}:` },
      ]);
      setActiveForm({ type });
      setFormData(
        type === "offerta"
          ? { tipo: "P", anno: NOW_YEAR }
          : { status: "new" }
      );
    }, 250);
  };

  /* ─── submit form ─── */
  const submitForm = async () => {
    if (!activeForm) return;
    setActiveForm((p) => ({ ...p, loading: true }));
    try {
      if (activeForm.type === "task") {
        if (!formData.title) throw new Error("Il titolo è obbligatorio");
        await api.createTask({
          title: formData.title,
          description: formData.description,
          label: formData.label,
          deadline: formData.deadline,
          planned_start: formData.planned_start,
          planned_end: formData.planned_end,
          status: formData.status || "new",
        });
        setMessages((p) => [...p, { role: "assistant", content: `✅ Task creato con successo:\n**${formData.title}**` }]);
      } else if (activeForm.type === "commessa") {
        if (!formData.comm_number || !formData.name) throw new Error("Numero e Nome sono obbligatori");
        await api.createFatturato({
          comm_number: formData.comm_number,
          name: formData.name,
          notes: formData.notes,
          clients: formData.client_id
            ? [{ client_id: formData.client_id, lines: [] }]
            : [],
        });
        setMessages((p) => [...p, { role: "assistant", content: `✅ Commessa creata:\n**${formData.comm_number} — ${formData.name}**` }]);
      } else if (activeForm.type === "offerta") {
        if (!formData.oggetto || !formData.anno || !formData.tipo)
          throw new Error("I campi contrassegnati con * sono obbligatori");
        await api.createOfferta({
          oggetto: formData.oggetto,
          anno: formData.anno,
          tipo: formData.tipo,
          cliente: formData.cliente,
          destinazione_uso: formData.destinazione_uso,
          status: "aperta",
        });
        setMessages((p) => [...p, { role: "assistant", content: `✅ Offerta creata:\n**${formData.oggetto}**` }]);
      }
      setActiveForm(null);
    } catch (err) {
      setMessages((p) => [...p, { role: "assistant", content: `❌ Errore: ${err.message}` }]);
      setActiveForm((p) => p && { ...p, loading: false });
    }
  };

  /* guard */
  if (user.role !== "hr") return null;

  /* ─────────── RENDER ─────────── */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes typingBounce {
          0%,60%,100%{transform:translateY(0);opacity:0.4}
          30%{transform:translateY(-6px);opacity:1}
        }
        @keyframes chatSlideUp {
          from{opacity:0;transform:translateY(20px) scale(0.97)}
          to{opacity:1;transform:translateY(0) scale(1)}
        }
        @keyframes bubblePop {
          from{opacity:0;transform:scale(0.95)}
          to{opacity:1;transform:scale(1)}
        }
        .ai-input:focus { border-color: #6366F1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
        .ai-send-btn:hover { background: linear-gradient(135deg,#818CF8,#6366F1) !important; transform: scale(1.07); }
        .ai-cancel-btn:hover { background: #E9EEF6 !important; }
        .ai-submit-btn:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
        .ai-toggle:hover { transform: scale(1.12) !important; box-shadow: 0 12px 28px rgba(99,102,241,0.55) !important; }
        .ai-close:hover { background: rgba(255,255,255,0.25) !important; }
        .ai-form-input:focus { border-color: #6366F1 !important; }
        /* custom scrollbar */
        .ai-messages::-webkit-scrollbar{width:4px}
        .ai-messages::-webkit-scrollbar-track{background:transparent}
        .ai-messages::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:4px}
      `}</style>

      <div
        style={{
          position: "fixed",
          bottom: 28,
          right: 28,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {/* ── Chat Panel ── */}
        {isOpen && (
          <div
            style={{
              width: 400,
              height: 580,
              background: "#FFFFFF",
              borderRadius: 24,
              boxShadow:
                "0 24px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(99,102,241,0.12)",
              display: "flex",
              flexDirection: "column",
              marginBottom: 18,
              overflow: "hidden",
              animation: "chatSlideUp 0.35s cubic-bezier(.22,.68,0,1.2)",
            }}
          >
            {/* ── Header ── */}
            <div
              style={{
                padding: "14px 18px",
                background: "linear-gradient(135deg,#4338CA,#6366F1)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    background: "rgba(255,255,255,0.15)",
                    backdropFilter: "blur(8px)",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    border: "1px solid rgba(255,255,255,0.2)",
                  }}
                >
                  🤖
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", letterSpacing: "0.02em" }}>
                    TEKSER AI
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80", display: "inline-block" }} />
                    Assistente HR Online
                  </div>
                </div>
              </div>
              <button
                className="ai-close"
                onClick={() => setIsOpen(false)}
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "none",
                  color: "#fff",
                  cursor: "pointer",
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  fontSize: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.2s",
                }}
              >
                ✕
              </button>
            </div>

            {/* ── Messages ── */}
            <div
              className="ai-messages"
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "18px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                background: "#FAFBFF",
              }}
            >
              {messages.map(
                (m, i) =>
                  m.content.trim() !== "" && (
                    <div key={i} style={{ animation: "bubblePop 0.25s ease", display: "flex", flexDirection: "column" }}>
                      {m.role === "assistant" && (
                        <div style={{ fontSize: 9, color: "#94A3B8", marginBottom: 3, paddingLeft: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          Tekser AI
                        </div>
                      )}
                      <Bubble m={m} />
                    </div>
                  )
              )}

              {/* ── Inline Form ── */}
              {activeForm && (
                <div
                  style={{
                    alignSelf: "flex-start",
                    width: "95%",
                    background: "#FFFFFF",
                    padding: "16px 14px",
                    borderRadius: "4px 16px 16px 16px",
                    border: "1px solid rgba(99,102,241,0.18)",
                    boxShadow: "0 2px 12px rgba(99,102,241,0.08)",
                    animation: "bubblePop 0.3s ease",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#6366F1",
                      marginBottom: 14,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>
                      {activeForm.type === "task" ? "📋" : activeForm.type === "commessa" ? "🏗️" : "📄"}
                    </span>
                    Nuovo{" "}
                    {activeForm.type === "task" ? "Task" : activeForm.type === "commessa" ? "Commessa" : "Offerta"}
                  </div>

                  {/* TASK FORM */}
                  {activeForm.type === "task" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <Field label="Titolo *">
                        <input
                          className="ai-form-input"
                          style={S.input}
                          placeholder="Titolo del task..."
                          value={formData.title || ""}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        />
                      </Field>
                      <Field label="Tipo Progetto">
                        <select
                          style={S.select}
                          value={formData.label || ""}
                          onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                        >
                          <option value="">-- Seleziona --</option>
                          {["Residential","Health","Industrial","Sports","Offices","Hotel","Student Housing","Data Center","Education","Retail","Public"].map((l) => (
                            <option key={l} value={l}>{l}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Descrizione">
                        <textarea
                          style={S.textarea}
                          placeholder="Descrizione..."
                          value={formData.description || ""}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                      </Field>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <Field label="Scadenza">
                          <input type="date" style={S.input} value={formData.deadline || ""} onChange={(e) => setFormData({ ...formData, deadline: e.target.value })} />
                        </Field>
                        <Field label="Stato">
                          <select style={S.select} value={formData.status || "new"} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                            <option value="new">New</option>
                            <option value="process">In Process</option>
                            <option value="blocked">Blocked</option>
                            <option value="done">Done</option>
                          </select>
                        </Field>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <Field label="Inizio Pianif.">
                          <input type="date" style={S.input} value={formData.planned_start || ""} onChange={(e) => setFormData({ ...formData, planned_start: e.target.value })} />
                        </Field>
                        <Field label="Fine Pianif.">
                          <input type="date" style={S.input} value={formData.planned_end || ""} onChange={(e) => setFormData({ ...formData, planned_end: e.target.value })} />
                        </Field>
                      </div>
                    </div>
                  )}

                  {/* COMMESSA FORM */}
                  {activeForm.type === "commessa" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <Field label="Numero (es: 26-001) *">
                        <input
                          className="ai-form-input"
                          style={S.input}
                          placeholder="26-001"
                          value={formData.comm_number || ""}
                          onChange={(e) => setFormData({ ...formData, comm_number: e.target.value })}
                        />
                      </Field>
                      <Field label="Nome Progetto *">
                        <input
                          className="ai-form-input"
                          style={S.input}
                          placeholder="Nome del progetto..."
                          value={formData.name || ""}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                      </Field>
                      <Field label="Cliente">
                        <select
                          style={S.select}
                          value={formData.client_id || ""}
                          onChange={(e) => setFormData({ ...formData, client_id: e.target.value || null })}
                        >
                          <option value="">-- Nessun cliente --</option>
                          {clients
                            .filter((c) => !c.obsoleto)
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                        </select>
                      </Field>
                      <Field label="Note">
                        <textarea
                          style={S.textarea}
                          placeholder="Note aggiuntive..."
                          value={formData.notes || ""}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        />
                      </Field>
                    </div>
                  )}

                  {/* OFFERTA FORM */}
                  {activeForm.type === "offerta" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <Field label="Anno *">
                          <input
                            type="number"
                            style={S.input}
                            value={formData.anno || ""}
                            onChange={(e) => setFormData({ ...formData, anno: Number(e.target.value) })}
                          />
                        </Field>
                        <Field label="Tipo *">
                          <select style={S.select} value={formData.tipo || "P"} onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}>
                            <option value="P">Preventivo (P)</option>
                            <option value="G">Gara (G)</option>
                          </select>
                        </Field>
                      </div>
                      <Field label="Oggetto *">
                        <input
                          className="ai-form-input"
                          style={S.input}
                          placeholder="Oggetto dell'offerta..."
                          value={formData.oggetto || ""}
                          onChange={(e) => setFormData({ ...formData, oggetto: e.target.value })}
                        />
                      </Field>
                      <Field label="Cliente">
                        <input
                          style={S.input}
                          placeholder="Nome cliente..."
                          value={formData.cliente || ""}
                          onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                        />
                      </Field>
                      <Field label="Destinazione d'Uso">
                        <input
                          style={S.input}
                          placeholder="es. Residenziale, Commerciale..."
                          value={formData.destinazione_uso || ""}
                          onChange={(e) => setFormData({ ...formData, destinazione_uso: e.target.value })}
                        />
                      </Field>
                    </div>
                  )}

                  {/* Form Actions */}
                  <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                    <button
                      className="ai-cancel-btn"
                      onClick={() => setActiveForm(null)}
                      style={{
                        flex: 1,
                        padding: "9px",
                        background: "#F1F5F9",
                        border: "1px solid #E2E8F0",
                        borderRadius: 10,
                        cursor: "pointer",
                        color: "#64748B",
                        fontWeight: 600,
                        fontSize: 13,
                        fontFamily: "inherit",
                        transition: "background 0.2s",
                      }}
                    >
                      Annulla
                    </button>
                    <button
                      className="ai-submit-btn"
                      onClick={submitForm}
                      disabled={activeForm.loading}
                      style={{
                        flex: 1,
                        padding: "9px",
                        background: "linear-gradient(135deg,#6366F1,#4338CA)",
                        border: "none",
                        borderRadius: 10,
                        cursor: activeForm.loading ? "wait" : "pointer",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: 13,
                        fontFamily: "inherit",
                        opacity: activeForm.loading ? 0.7 : 1,
                        boxShadow: "0 4px 14px rgba(99,102,241,0.4)",
                        transition: "filter 0.2s, transform 0.2s",
                      }}
                    >
                      {activeForm.loading ? "Salvataggio..." : "💾 Salva"}
                    </button>
                  </div>
                </div>
              )}

              {loading && <TypingDots />}
              <div ref={chatEndRef} />
            </div>

            {/* ── Quick Suggestions ── */}
            {messages.length <= 1 && !activeForm && (
              <div
                style={{
                  padding: "0 14px 10px",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  flexShrink: 0,
                  background: "#FAFBFF",
                }}
              >
                {[
                  "Chi siete?",
                  "Cos'è questo sistema?",
                  "Crea commessa",
                  "Crea offerta",
                  "Crea task",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setInput(s);
                      setTimeout(() => inputRef.current?.focus(), 50);
                    }}
                    style={{
                      padding: "5px 10px",
                      background: "rgba(99,102,241,0.07)",
                      border: "1px solid rgba(99,102,241,0.2)",
                      borderRadius: 20,
                      color: "#6366F1",
                      fontSize: 11,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      transition: "background 0.2s",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* ── Input Bar ── */}
            <div
              style={{
                padding: "12px 14px",
                borderTop: "1px solid #F1F5F9",
                display: "flex",
                gap: 10,
                alignItems: "center",
                flexShrink: 0,
                background: "#FFFFFF",
              }}
            >
              <input
                ref={inputRef}
                className="ai-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Scrivi un messaggio..."
                style={{
                  flex: 1,
                  border: "1.5px solid #E2E8F0",
                  borderRadius: 14,
                  padding: "10px 16px",
                  fontSize: 13,
                  outline: "none",
                  background: "#F8FAFC",
                  color: "#1E293B",
                  fontFamily: "inherit",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
              />
              <button
                className="ai-send-btn"
                onClick={handleSend}
                disabled={loading || !input.trim()}
                style={{
                  minWidth: 40,
                  height: 40,
                  background: "linear-gradient(135deg,#6366F1,#4338CA)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 12px rgba(99,102,241,0.4)",
                  fontSize: 16,
                  opacity: loading || !input.trim() ? 0.5 : 1,
                  transition: "transform 0.2s, background 0.2s",
                  flexShrink: 0,
                }}
              >
                ➤
              </button>
            </div>
          </div>
        )}

        {/* ── Bubble Toggle ── */}
        <button
          className="ai-toggle"
          onClick={() => setIsOpen((o) => !o)}
          style={{
            width: 58,
            height: 58,
            background: isOpen
              ? "linear-gradient(135deg,#4338CA,#6366F1)"
              : "linear-gradient(135deg,#6366F1,#818CF8)",
            borderRadius: "50%",
            border: "none",
            color: "#fff",
            fontSize: 26,
            cursor: "pointer",
            boxShadow: "0 8px 24px rgba(99,102,241,0.45)",
            transition: "transform 0.25s cubic-bezier(.22,.68,0,1.5), box-shadow 0.25s, background 0.3s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isOpen ? "✕" : "💬"}
        </button>
      </div>
    </>
  );
}
