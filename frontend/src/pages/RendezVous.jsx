import { useState, useEffect } from "react";
import API from "../api";

const STATUTS = ["planifie", "confirme", "annule", "termine"];

const statutStyle = (s) => {
  const map = {
    planifie: {
      bg: "#eff6ff",
      color: "#1d4ed8",
      border: "#bfdbfe",
      label: "📋 Planifié",
    },
    confirme: {
      bg: "#f0fdf4",
      color: "#16a34a",
      border: "#86efac",
      label: "✅ Confirmé",
    },
    annule: {
      bg: "#fef2f2",
      color: "#dc2626",
      border: "#fecaca",
      label: "❌ Annulé",
    },
    termine: {
      bg: "#f8fafc",
      color: "#475569",
      border: "#cbd5e1",
      label: "🏁 Terminé",
    },
  };
  return map[s] || map["planifie"];
};

const inputStyle = {
  width: "100%",
  padding: "0.6rem 0.8rem",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  fontSize: "0.88rem",
  outline: "none",
  boxSizing: "border-box",
};
const labelStyle = {
  display: "block",
  fontSize: "0.78rem",
  fontWeight: 600,
  color: "#374151",
  marginBottom: "0.3rem",
};

export default function RendezVous() {
  const [rdvs, setRdvs] = useState([]);
  const [patients, setPatients] = useState([]);
  const [medecins, setMedecins] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState("tous");
  const [form, setForm] = useState({
    patient_id: "",
    medecin_id: "",
    date_heure: "",
    motif: "",
    statut: "planifie",
    notes: "",
  });

  const load = () => {
    Promise.all([
      API.get("/rendezvous"),
      API.get("/patients"),
      API.get("/medecins"),
    ])
      .then(([r, p, m]) => {
        setRdvs(r.data);
        setPatients(p.data);
        setMedecins(m.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await API.post("/rendezvous", {
        ...form,
        patient_id: parseInt(form.patient_id),
        medecin_id: parseInt(form.medecin_id),
      });
      setMsg("✅ Rendez-vous créé !");
      setForm({
        patient_id: "",
        medecin_id: "",
        date_heure: "",
        motif: "",
        statut: "planifie",
        notes: "",
      });
      setShowForm(false);
      load();
    } catch (err) {
      setMsg("❌ " + (err.response?.data?.detail || "Erreur"));
    }
    setTimeout(() => setMsg(""), 3000);
  };

  const handleStatut = async (id, statut) => {
    await API.put(`/rendezvous/${id}/statut`, { statut });
    setMsg(`✅ Statut mis à jour : ${statut}`);
    load();
    setTimeout(() => setMsg(""), 3000);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer ce rendez-vous ?")) return;
    await API.delete(`/rendezvous/${id}`);
    setMsg("🗑️ Rendez-vous supprimé");
    load();
    setTimeout(() => setMsg(""), 3000);
  };

  const filtered =
    filter === "tous" ? rdvs : rdvs.filter((r) => r.statut === filter);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.8rem",
              fontWeight: 800,
              color: "#1e293b",
              margin: 0,
            }}
          >
            📅 Rendez-vous
          </h1>
          <p style={{ color: "#64748b", margin: "0.3rem 0 0" }}>
            {rdvs.length} rendez-vous au total
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            background: "#1a237e",
            color: "#fff",
            border: "none",
            padding: "0.75rem 1.5rem",
            borderRadius: 10,
            fontWeight: 700,
            cursor: "pointer",
            fontSize: "0.9rem",
          }}
        >
          {showForm ? "✕ Fermer" : "➕ Nouveau RDV"}
        </button>
      </div>

      {msg && (
        <div
          style={{
            background: msg.startsWith("✅") ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${msg.startsWith("✅") ? "#86efac" : "#fecaca"}`,
            color: msg.startsWith("✅") ? "#16a34a" : "#dc2626",
            padding: "0.75rem 1rem",
            borderRadius: 8,
            marginBottom: "1rem",
            fontSize: "0.9rem",
          }}
        >
          {msg}
        </div>
      )}

      {/* Formulaire */}
      {showForm && (
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: "1.5rem",
            boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
            marginBottom: "1.5rem",
            border: "1px solid #e2e8f0",
          }}
        >
          <h2
            style={{
              fontSize: "1.1rem",
              fontWeight: 700,
              color: "#1e293b",
              marginBottom: "1.2rem",
            }}
          >
            ➕ Nouveau rendez-vous
          </h2>
          <form onSubmit={handleSubmit}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
                marginBottom: "1rem",
              }}
            >
              <div>
                <label style={labelStyle}>Patient *</label>
                <select
                  style={inputStyle}
                  value={form.patient_id}
                  onChange={(e) =>
                    setForm({ ...form, patient_id: e.target.value })
                  }
                  required
                >
                  <option value="">-- Sélectionner un patient --</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.prenom} {p.nom}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Médecin *</label>
                <select
                  style={inputStyle}
                  value={form.medecin_id}
                  onChange={(e) =>
                    setForm({ ...form, medecin_id: e.target.value })
                  }
                  required
                >
                  <option value="">-- Sélectionner un médecin --</option>
                  {medecins.map((m) => (
                    <option key={m.id} value={m.id}>
                      Dr. {m.prenom} {m.nom} — {m.specialite}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Date et heure *</label>
                <input
                  type="datetime-local"
                  style={inputStyle}
                  value={form.date_heure}
                  onChange={(e) =>
                    setForm({ ...form, date_heure: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>Motif</label>
                <input
                  style={inputStyle}
                  value={form.motif}
                  onChange={(e) => setForm({ ...form, motif: e.target.value })}
                  placeholder="Consultation, suivi, urgence..."
                />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={labelStyle}>Notes</label>
                <input
                  style={inputStyle}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>
            <button
              type="submit"
              style={{
                background: "#1a237e",
                color: "#fff",
                border: "none",
                padding: "0.75rem 2rem",
                borderRadius: 8,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ➕ Créer le RDV
            </button>
          </form>
        </div>
      )}

      {/* Filtres */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBottom: "1.2rem",
          flexWrap: "wrap",
        }}
      >
        {["tous", ...STATUTS].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              padding: "0.4rem 1rem",
              borderRadius: 20,
              border: "1px solid #e2e8f0",
              background: filter === s ? "#1a237e" : "#fff",
              color: filter === s ? "#fff" : "#64748b",
              fontWeight: filter === s ? 700 : 400,
              cursor: "pointer",
              fontSize: "0.82rem",
              transition: "all 0.2s",
            }}
          >
            {s === "tous" ? "Tous" : statutStyle(s).label}
          </button>
        ))}
      </div>

      {/* Liste RDV */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>
          Chargement...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>
          Aucun rendez-vous
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {filtered.map((r) => {
            const st = statutStyle(r.statut);
            return (
              <div
                key={r.id}
                style={{
                  background: "#fff",
                  borderRadius: 12,
                  padding: "1.2rem 1.5rem",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "1rem",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.8rem",
                      marginBottom: "0.4rem",
                    }}
                  >
                    <span
                      style={{
                        background: st.bg,
                        color: st.color,
                        border: `1px solid ${st.border}`,
                        padding: "0.2rem 0.7rem",
                        borderRadius: 20,
                        fontSize: "0.75rem",
                        fontWeight: 700,
                      }}
                    >
                      {st.label}
                    </span>
                    <span style={{ fontWeight: 700, color: "#1e293b" }}>
                      {new Date(r.date_heure).toLocaleString("fr-FR", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div style={{ color: "#475569", fontSize: "0.88rem" }}>
                    👤 <b>{r.patient}</b> · {r.medecin}
                    {r.specialite && (
                      <span style={{ color: "#8b5cf6" }}>
                        {" "}
                        ({r.specialite})
                      </span>
                    )}
                  </div>
                  {r.motif && (
                    <div
                      style={{
                        color: "#64748b",
                        fontSize: "0.82rem",
                        marginTop: "0.2rem",
                      }}
                    >
                      📋 {r.motif}
                    </div>
                  )}
                </div>

                {/* Actions statut */}
                <div
                  style={{
                    display: "flex",
                    gap: "0.4rem",
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                  }}
                >
                  {STATUTS.filter((s) => s !== r.statut).map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatut(r.id, s)}
                      style={{
                        background: statutStyle(s).bg,
                        color: statutStyle(s).color,
                        border: `1px solid ${statutStyle(s).border}`,
                        padding: "0.3rem 0.7rem",
                        borderRadius: 7,
                        cursor: "pointer",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                      }}
                    >
                      {statutStyle(s).label}
                    </button>
                  ))}
                  <button
                    onClick={() => handleDelete(r.id)}
                    style={{
                      background: "#fef2f2",
                      color: "#dc2626",
                      border: "1px solid #fecaca",
                      padding: "0.3rem 0.6rem",
                      borderRadius: 7,
                      cursor: "pointer",
                      fontSize: "0.82rem",
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
