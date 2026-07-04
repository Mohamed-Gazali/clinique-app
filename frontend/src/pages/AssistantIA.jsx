import { useState, useEffect, useRef } from "react";
import API from "../api";

const SUGGESTIONS = [
  "Quels sont les antécédents médicaux de mes patients ?",
  "Y a-t-il des patients allergiques à la pénicilline ?",
  "Résume les dernières consultations",
  "Quelles ordonnances ont été prescrites cette semaine ?",
  "Quel patient a le groupe sanguin O+ ?",
];

const FILTER_OPTIONS = [
  { value: "",              label: "🔍 Toute la base" },
  { value: "patient",       label: "👤 Patients uniquement" },
  { value: "consultation",  label: "🩺 Consultations uniquement" },
  { value: "ordonnance",    label: "💊 Ordonnances uniquement" },
];

function SourceBadge({ source }) {
  const icons = { patient: "👤", consultation: "🩺", ordonnance: "💊" };
  const colors = {
    patient:      { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
    consultation: { bg: "#f0fdf4", color: "#16a34a", border: "#86efac" },
    ordonnance:   { bg: "#fdf4ff", color: "#9333ea", border: "#e9d5ff" },
  };
  const c = colors[source.type] || colors.patient;
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 8,
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: 8, padding: "6px 10px", fontSize: 12,
    }}>
      <span>{icons[source.type]} <strong style={{ color: c.color }}>
        {source.type} #{source.id}
      </strong></span>
      <span style={{ color: "#64748b", flex: 1, lineHeight: 1.4 }}>
        {source.content}
      </span>
      <span style={{
        background: c.border, color: c.color,
        borderRadius: 99, padding: "1px 6px", fontSize: 11, whiteSpace: "nowrap",
      }}>
        {Math.round(source.similarity * 100)}%
      </span>
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === "user";
  const [showSources, setShowSources] = useState(false);

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: isUser ? "flex-end" : "flex-start",
      marginBottom: 16,
    }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, maxWidth: "80%" }}>
        {!isUser && (
          <div style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            background: "linear-gradient(135deg,#2563eb,#7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16,
          }}>🤖</div>
        )}
        <div style={{
          background: isUser
            ? "linear-gradient(135deg,#2563eb,#1d4ed8)"
            : "var(--surface, #f8fafc)",
          color: isUser ? "#fff" : "var(--text, #1e293b)",
          border: isUser ? "none" : "1px solid var(--border, #e2e8f0)",
          borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          padding: "12px 16px",
          fontSize: 14, lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}>
          {msg.content}
        </div>
        {isUser && (
          <div style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            background: "linear-gradient(135deg,#0ea5e9,#2563eb)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, color: "#fff", fontWeight: 700,
          }}>
            {(localStorage.getItem("user") || "U")[0].toUpperCase()}
          </div>
        )}
      </div>

      {/* Sources */}
      {!isUser && msg.sources?.length > 0 && (
        <div style={{ maxWidth: "80%", marginLeft: 40, marginTop: 6 }}>
          <button
            onClick={() => setShowSources(!showSources)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 12, color: "#64748b", padding: "2px 0",
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            {showSources ? "▾" : "▸"} {msg.sources.length} source{msg.sources.length > 1 ? "s" : ""} utilisée{msg.sources.length > 1 ? "s" : ""}
          </button>
          {showSources && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
              {msg.sources.map((s, i) => <SourceBadge key={i} source={s} />)}
            </div>
          )}
        </div>
      )}

      <span style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, paddingLeft: isUser ? 0 : 40, paddingRight: isUser ? 40 : 0 }}>
        {msg.time}
      </span>
    </div>
  );
}

export default function AssistantIA() {
  const [messages, setMessages]     = useState([]);
  const [input, setInput]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [filterType, setFilterType] = useState("");
  const [status, setStatus]         = useState(null);
  const [ingesting, setIngesting]   = useState(false);
  const [ingestMsg, setIngestMsg]   = useState("");
  const bottomRef                   = useRef(null);

  // Charger le statut des embeddings
  const loadStatus = () =>
    API.get("/ai/status")
      .then((r) => setStatus(r.data))
      .catch(() => setStatus(null));

  useEffect(() => {
    loadStatus();
    // Message d'accueil
    setMessages([{
      role: "assistant",
      content: "Bonjour 👋 Je suis l'assistant IA de la clinique.\nPosez-moi une question sur vos patients, consultations ou ordonnances — je cherche directement dans votre base médicale.",
      sources: [],
      time: now(),
    }]);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const now = () => new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  const handleSend = async (question) => {
    const q = (question || input).trim();
    if (!q || loading) return;
    setInput("");

    const userMsg = { role: "user", content: q, time: now() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await API.post("/ai/ask", {
        question:    q,
        filter_type: filterType || null,
      });
      setMessages((prev) => [...prev, {
        role:    "assistant",
        content: res.data.answer,
        sources: res.data.sources || [],
        time:    now(),
      }]);
    } catch (err) {
      const detail = err.response?.data?.detail || "Erreur de connexion à l'IA.";
      setMessages((prev) => [...prev, {
        role:    "assistant",
        content: `❌ ${detail}`,
        sources: [],
        time:    now(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleIngest = async () => {
    setIngesting(true);
    setIngestMsg("");
    try {
      await API.post("/ai/ingest", { type: "all" });
      setIngestMsg("✅ Ingestion lancée ! Patientez 30–60 secondes puis réessayez.");
      setTimeout(() => { loadStatus(); setIngestMsg(""); }, 8000);
    } catch (err) {
      setIngestMsg("❌ " + (err.response?.data?.detail || "Erreur"));
    } finally {
      setIngesting(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 80px)", maxHeight: 900 }}>

      {/* ── En-tête ── */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 16,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.7rem", fontWeight: 800, color: "var(--text, #1e293b)" }}>
            🤖 Assistant IA
          </h1>
          <p style={{ margin: "0.3rem 0 0", color: "#64748b", fontSize: 14 }}>
            Posez des questions sur vos données médicales
          </p>
        </div>

        {/* Statut embeddings */}
        {status && (
          <div style={{
            background: status.ready ? "#f0fdf4" : "#fefce8",
            border: `1px solid ${status.ready ? "#86efac" : "#fde68a"}`,
            borderRadius: 10, padding: "8px 14px", fontSize: 13,
            display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end",
          }}>
            <span style={{ fontWeight: 700, color: status.ready ? "#16a34a" : "#92400e" }}>
              {status.ready ? "✅ Base IA prête" : "⚠️ Base IA vide"}
            </span>
            {status.ready && (
              <span style={{ color: "#64748b", fontSize: 12 }}>
                {status.embeddings.patients}👤 {status.embeddings.consultations}🩺 {status.embeddings.ordonnances}💊
              </span>
            )}
            {!status.ready && (
              <button
                onClick={handleIngest}
                disabled={ingesting}
                style={{
                  marginTop: 4, padding: "4px 10px", borderRadius: 6, border: "none",
                  background: "#f59e0b", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600,
                }}
              >
                {ingesting ? "En cours…" : "⚡ Ingérer les données"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bandeau ingest */}
      {ingestMsg && (
        <div style={{
          background: ingestMsg.startsWith("✅") ? "#f0fdf4" : "#fef2f2",
          border: `1px solid ${ingestMsg.startsWith("✅") ? "#86efac" : "#fecaca"}`,
          color: ingestMsg.startsWith("✅") ? "#16a34a" : "#dc2626",
          padding: "8px 14px", borderRadius: 9, marginBottom: 12, fontSize: 13,
        }}>
          {ingestMsg}
        </div>
      )}

      {/* ── Filtre + Suggestions ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{
            padding: "6px 12px", borderRadius: 8,
            border: "1px solid var(--border, #e2e8f0)",
            background: "var(--surface, #f8fafc)",
            color: "var(--text, #1e293b)",
            fontSize: 13, cursor: "pointer",
          }}
        >
          {FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button
          onClick={handleIngest}
          disabled={ingesting}
          style={{
            padding: "6px 12px", borderRadius: 8,
            border: "1px solid #e2e8f0", background: "var(--surface, #f8fafc)",
            color: "#64748b", cursor: "pointer", fontSize: 13,
          }}
          title="Re-ingérer toutes les données dans la base IA"
        >
          {ingesting ? "⏳ Ingestion…" : "🔄 Mettre à jour l'IA"}
        </button>
      </div>

      {/* Suggestions */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {SUGGESTIONS.map((s, i) => (
          <button
            key={i}
            onClick={() => handleSend(s)}
            disabled={loading}
            style={{
              padding: "5px 12px", borderRadius: 99,
              border: "1px solid var(--border, #e2e8f0)",
              background: "var(--surface, #f8fafc)",
              color: "#475569", fontSize: 12, cursor: "pointer",
              transition: "all 0.15s",
              opacity: loading ? 0.5 : 1,
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* ── Zone de messages ── */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "16px",
        background: "var(--bg, #ffffff)",
        border: "1px solid var(--border, #e2e8f0)",
        borderRadius: 16, marginBottom: 12,
      }}>
        {messages.map((msg, i) => <Message key={i} msg={msg} />)}

        {/* Indicateur de frappe */}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: "linear-gradient(135deg,#2563eb,#7c3aed)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
            }}>🤖</div>
            <div style={{
              background: "var(--surface, #f8fafc)",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: "18px 18px 18px 4px",
              padding: "12px 16px", display: "flex", gap: 6, alignItems: "center",
            }}>
              {[0,1,2].map((i) => (
                <div key={i} style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: "#94a3b8",
                  animation: `pulse 1.2s ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Zone de saisie ── */}
      <div style={{
        display: "flex", gap: 10, alignItems: "flex-end",
        background: "var(--surface, #f8fafc)",
        border: "1px solid var(--border, #e2e8f0)",
        borderRadius: 14, padding: "10px 14px",
      }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Posez votre question médicale… (Entrée pour envoyer, Shift+Entrée pour sauter une ligne)"
          rows={2}
          disabled={loading}
          style={{
            flex: 1, border: "none", background: "transparent", outline: "none",
            resize: "none", fontSize: 14, lineHeight: 1.5,
            color: "var(--text, #1e293b)", fontFamily: "inherit",
          }}
        />
        <button
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
          style={{
            width: 44, height: 44, borderRadius: 12, border: "none",
            background: loading || !input.trim()
              ? "#e2e8f0"
              : "linear-gradient(135deg,#2563eb,#1d4ed8)",
            color: loading || !input.trim() ? "#94a3b8" : "#fff",
            cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s", flexShrink: 0,
          }}
        >
          ↑
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}