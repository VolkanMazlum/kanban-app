import { useState, useEffect, useRef } from "react";
import * as api from "../api";

export default function AiAssistant({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Ciao! Sono l'Assistente HR di Tekser. Chiedimi i dati di fatturato, oppure chiedimi esplicitamente di creare qualcosa (ad es: 'aggiungi task', 'crea commessa', 'nuova offerta')." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeForm, setActiveForm] = useState(null);
  const [formData, setFormData] = useState({});
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeForm]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = { role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setActiveForm(null); 

    const txt = input.toLowerCase();
    let triggeredForm = null;
    
    const actionWords = ["crea", "nuov", "aggiung", "ekle", "yeni", "olustur", "oluştur"];
    const hasAction = actionWords.some(w => txt.includes(w));

    if (txt.includes("task") && hasAction) triggeredForm = "task";
    else if ((txt.includes("commessa") || txt.includes("komessa")) && hasAction) triggeredForm = "commessa";
    else if ((txt.includes("offerta") || txt.includes("oferta")) && hasAction) triggeredForm = "offerta";

    if (triggeredForm) {
      setTimeout(() => {
        setMessages(prev => [...prev, { role: "assistant", content: `Certo, ecco il modulo per aggiungere il nuovo record (${triggeredForm}):` }]);
        setActiveForm({ type: triggeredForm });
        setFormData(triggeredForm === "offerta" ? { tipo: "P", anno: new Date().getFullYear() } : { status: "new" });
      }, 300);
      return;
    }

    setLoading(true);

    try {
      let contextDate = null;
      const monthMatch = input.match(/(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})/i);
      if (monthMatch) {
         const monthsMap = { gennaio: '01', febbraio: '02', marzo: '03', aprile: '04', maggio: '05', giugno: '06', luglio: '07', agosto: '08', settembre: '09', ottobre: '10', novembre: '11', dicembre: '12' };
         contextDate = `${monthMatch[2]}-${monthsMap[monthMatch[1].toLowerCase()]}`;
      }

      const res = await api.chatWithAI([...messages, userMsg], contextDate);
      
      let cleanContent = res.message.content.replace(/\[\[REQUEST_FORM:.*?\]\]/g, "").trim();
      setMessages(prev => [...prev, { role: "assistant", content: cleanContent }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "Mi dispiace, non riesco a connettermi ora. Riprova più tardi." }]);
    } finally {
      setLoading(false);
    }
  };

  const submitForm = async () => {
    if (!activeForm) return;
    setActiveForm(prev => ({ ...prev, loading: true }));
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
          status: formData.status || "new" 
        });
        setMessages(prev => [...prev, { role: "assistant", content: `Task creato con successo: **${formData.title}**` }]);
      } else if (activeForm.type === "commessa") {
        if (!formData.comm_number || !formData.name) throw new Error("Numero e Nome sono obbligatori");
        await api.createFatturato({ 
          comm_number: formData.comm_number, 
          name: formData.name,
          notes: formData.notes
        });
        setMessages(prev => [...prev, { role: "assistant", content: `Commessa creata con successo: **${formData.comm_number} - ${formData.name}**` }]);
      } else if (activeForm.type === "offerta") {
        if (!formData.oggetto || !formData.anno || !formData.tipo) throw new Error("Campi obbligatori mancanti '*'");
        await api.createOfferta({ 
          oggetto: formData.oggetto, 
          anno: formData.anno,
          tipo: formData.tipo,
          cliente: formData.cliente, 
          destinazione_uso: formData.destinazione_uso,
          status: 'aperta' 
        });
        setMessages(prev => [...prev, { role: "assistant", content: `Offerta creata con successo: **${formData.oggetto}**` }]);
      }
      setActiveForm(null);
    } catch (err) {
      alert("Errore: " + err.message);
    } finally {
      if (activeForm) setActiveForm(prev => ({ ...prev, loading: false }));
    }
  };

  if (user.role !== 'hr') return null;

  const inputStyle = { width: "100%", padding: "8px 12px", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 8 };

  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 1000, display: "flex", flexDirection: "column", alignItems: "flex-end", fontFamily: "'Inter', sans-serif" }}>
      {isOpen && (
        <div style={{
          width: 380, height: 500, background: "rgba(255, 255, 255, 0.95)", backdropFilter: "blur(10px)",
          borderRadius: 20, boxShadow: "0 12px 40px rgba(0,0,0,0.15)", border: "1px solid rgba(255,255,255,0.3)",
          display: "flex", flexDirection: "column", marginBottom: 16, overflow: "hidden", animation: "slideIn 0.3s ease-out"
        }}>
          {/* Header */}
          <div style={{ padding: "16px 20px", background: "linear-gradient(135deg, #2563EB, #4F46E5)", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, background: "rgba(255,255,255,0.2)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🤖</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>TEKSER AI</div>
                <div style={{ fontSize: 10, opacity: 0.8 }}>Assistente HR</div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 20 }}>×</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            {messages.map((m, i) => (
              m.content.trim() !== "" && (
              <div key={i} style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "85%",
                padding: "10px 14px",
                borderRadius: m.role === "user" ? "18px 18px 2px 18px" : "18px 18px 18px 2px",
                background: m.role === "user" ? "#2563EB" : "#F3F4F6",
                color: m.role === "user" ? "#fff" : "#1F2937",
                fontSize: 13,
                lineHeight: 1.5,
                boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                whiteSpace: "pre-wrap"
              }}>
                {m.content}
              </div>
              )
            ))}
            
            {/* Dynamic Form UI */}
            {activeForm && (
                <div style={{ alignSelf: "flex-start", width: "85%", background: "#FFF", padding: 16, borderRadius: "18px 18px 18px 2px", border: "1px solid #E5E7EB", animation: "slideIn 0.3s ease-out" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 12, textTransform: "capitalize" }}>
                    Nuovo {activeForm.type}
                  </div>
                  
                  {activeForm.type === "task" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <label style={{ fontSize: 10, fontWeight: 600, color: "#6B7280" }}>TITOLO *</label>
                      <input placeholder="Titolo del Task..." style={{...inputStyle, marginBottom: 0}} value={formData.title || ""} onChange={e => setFormData({...formData, title: e.target.value})} />
                      
                      <label style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", marginTop: 4 }}>PROJECT TYPE</label>
                      <select style={{...inputStyle, marginBottom: 0}} value={formData.label || ""} onChange={e => setFormData({...formData, label: e.target.value})}>
                        <option value="">-- Seleziona --</option>
                        <option value="Residential">Residential</option>
                        <option value="Health">Health</option>
                        <option value="Industrial">Industrial</option>
                        <option value="Sports">Sports</option>
                        <option value="Offices">Offices</option>
                        <option value="Hotel">Hotel</option>
                        <option value="Student Housing">Student Housing</option>
                        <option value="Data Center">Data Center</option>
                        <option value="Education">Education</option>
                        <option value="Retail">Retail</option>
                        <option value="Public">Public</option>
                      </select>

                      <label style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", marginTop: 4 }}>DESCRIZIONE</label>
                      <textarea placeholder="Descrizione..." style={{ ...inputStyle, resize: "vertical", minHeight: 50, marginBottom: 0 }} value={formData.description || ""} onChange={e => setFormData({...formData, description: e.target.value})} />
                      
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 600, color: "#6B7280" }}>SCADENZA</label>
                          <input type="date" style={{...inputStyle, marginBottom: 0}} value={formData.deadline || ""} onChange={e => setFormData({...formData, deadline: e.target.value})} />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 600, color: "#6B7280" }}>STATO</label>
                          <select style={{ ...inputStyle, marginBottom: 0 }} value={formData.status || "new"} onChange={e => setFormData({...formData, status: e.target.value})}>
                            <option value="new">New</option>
                            <option value="process">In Process</option>
                            <option value="blocked">Blocked</option>
                            <option value="done">Done</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 600, color: "#6B7280" }}>INIZIO PIAN.</label>
                          <input type="date" style={{...inputStyle, marginBottom: 0}} value={formData.planned_start || ""} onChange={e => setFormData({...formData, planned_start: e.target.value})} />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 600, color: "#6B7280" }}>FINE PIAN.</label>
                          <input type="date" style={{...inputStyle, marginBottom: 0}} value={formData.planned_end || ""} onChange={e => setFormData({...formData, planned_end: e.target.value})} />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {activeForm.type === "commessa" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <label style={{ fontSize: 10, fontWeight: 600, color: "#6B7280" }}>NUMERO (es: 26-001) *</label>
                      <input style={{...inputStyle, marginBottom: 0}} value={formData.comm_number || ""} onChange={e => setFormData({...formData, comm_number: e.target.value})} />
                      
                      <label style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", marginTop: 4 }}>NOME PROGETTO *</label>
                      <input style={{...inputStyle, marginBottom: 0}} value={formData.name || ""} onChange={e => setFormData({...formData, name: e.target.value})} />
                      
                      <label style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", marginTop: 4 }}>NOTE</label>
                      <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 60, marginBottom: 0 }} value={formData.notes || ""} onChange={e => setFormData({...formData, notes: e.target.value})} />
                    </div>
                  )}

                  {activeForm.type === "offerta" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 600, color: "#6B7280" }}>ANNO *</label>
                          <input type="number" style={{...inputStyle, marginBottom: 0}} value={formData.anno || ""} onChange={e => setFormData({...formData, anno: Number(e.target.value)})} />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 600, color: "#6B7280" }}>TIPO *</label>
                          <select style={{ ...inputStyle, marginBottom: 0 }} value={formData.tipo || "P"} onChange={e => setFormData({...formData, tipo: e.target.value})}>
                            <option value="P">Preventivo (P)</option>
                            <option value="G">Gara (G)</option>
                          </select>
                        </div>
                      </div>

                      <label style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", marginTop: 4 }}>OGGETTO *</label>
                      <input style={{...inputStyle, marginBottom: 0}} value={formData.oggetto || ""} onChange={e => setFormData({...formData, oggetto: e.target.value})} />
                      
                      <label style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", marginTop: 4 }}>CLIENTE</label>
                      <input style={{...inputStyle, marginBottom: 0}} value={formData.cliente || ""} onChange={e => setFormData({...formData, cliente: e.target.value})} />
                      
                      <label style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", marginTop: 4 }}>DESTINAZIONE D'USO</label>
                      <input style={{...inputStyle, marginBottom: 0}} value={formData.destinazione_uso || ""} onChange={e => setFormData({...formData, destinazione_uso: e.target.value})} />
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                    <button onClick={() => setActiveForm(null)} style={{ flex: 1, padding: "8px", background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 8, cursor: "pointer", color: "#6B7280", fontWeight: 600 }}>Annulla</button>
                    <button onClick={submitForm} disabled={activeForm.loading} style={{ flex: 1, padding: "8px", background: "#4F46E5", border: "none", borderRadius: 8, cursor: "pointer", color: "#fff", fontWeight: 600, opacity: activeForm.loading ? 0.7 : 1 }}>
                      {activeForm.loading ? "Salvataggio..." : "Salva"}
                    </button>
                  </div>
                </div>
            )}

            {loading && (
              <div style={{ alignSelf: "flex-start", background: "#F3F4F6", padding: "10px 14px", borderRadius: "18px 18px 18px 2px", display: "flex", gap: 4 }}>
                <div style={{ width: 6, height: 6, background: "#9CA3AF", borderRadius: "50%", animation: "pulse 1s infinite" }}></div>
                <div style={{ width: 6, height: 6, background: "#9CA3AF", borderRadius: "50%", animation: "pulse 1s infinite 0.2s" }}></div>
                <div style={{ width: 6, height: 6, background: "#9CA3AF", borderRadius: "50%", animation: "pulse 1s infinite 0.4s" }}></div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: 16, borderTop: "1px solid #E5E7EB", display: "flex", gap: 10 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyPress={e => e.key === "Enter" && handleSend()}
              placeholder="Chiedi al bot, oppure scrivi 'Crea Task'..."
              style={{ flex: 1, border: "1px solid #E5E7EB", borderRadius: 20, padding: "8px 16px", fontSize: 13, outline: "none" }}
            />
            <button onClick={handleSend} style={{ width: 36, height: 36, background: "#2563EB", color: "#fff", border: "none", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              ➤
            </button>
          </div>
        </div>
      )}

      {/* Bubble Toggle */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: 56, height: 56, background: "linear-gradient(135deg, #2563EB, #4F46E5)",
          borderRadius: "50%", border: "none", color: "#fff", fontSize: 24, cursor: "pointer",
          boxShadow: "0 8px 16px rgba(37,99,235,0.3)", transition: "transform 0.2s"
        }}
        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"}
        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
      >
        {isOpen ? "↓" : "💬"}
      </button>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}
