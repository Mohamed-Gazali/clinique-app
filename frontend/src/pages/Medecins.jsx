import { useState, useEffect } from "react";
import API from "../api";

const EMPTY = {
  nom: "",
  prenom: "",
  specialite: "",
  telephone: "",
  email: "",
  disponible: true,
};
const SPECIALITES = [
  "Médecine générale",
  "Pédiatrie",
  "Gynécologie",
  "Cardiologie",
  "Dermatologie",
  "Ophtalmologie",
  "ORL",
  "Chirurgie",
  "Radiologie",
  "Neurologie",
  "Autre",
];

export default function Medecins() {
  const [medecins, setMedecins] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const role = localStorage.getItem("role");

  const load = () =>
    API.get("/medecins")
      .then((r) => setMedecins(r.data))
      .finally(() => setLoading(false));
  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      editing
        ? await API.put(`/medecins/${editing}`, form)
        : await API.post("/medecins", form);
      setMsg(editing ? "✅ Médecin modifié !" : "✅ Médecin ajouté !");
      setForm(EMPTY);
      setEditing(null);
      setShowModal(false);
      load();
    } catch (err) {
      setMsg("❌ " + (err.response?.data?.detail || "Accès refusé"));
    }
    setTimeout(() => setMsg(""), 3000);
  };

  const openEdit = (m) => {
    setForm({
      nom: m.nom,
      prenom: m.prenom,
      specialite: m.specialite,
      telephone: m.telephone || "",
      email: m.email || "",
      disponible: m.disponible,
    });
    setEditing(m.id);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer ce médecin ?")) return;
    try {
      await API.delete(`/medecins/${id}`);
      setMsg("🗑️ Médecin supprimé");
      load();
    } catch {
      setMsg("❌ Accès refusé");
    }
    setTimeout(() => setMsg(""), 3000);
  };

  const specialiteColor = (s) => {
    const map = {
      Pédiatrie: "badge-blue",
      Gynécologie: "badge-purple",
      Cardiologie: "badge-red",
      Dermatologie: "badge-yellow",
      "Médecine générale": "badge-green",
    };
    return map[s] || "badge-gray";
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">👨‍⚕️ Médecins</h1>
          <p className="page-subtitle">
            {medecins.length} médecin(s) ·{" "}
            {medecins.filter((m) => m.disponible).length} disponible(s)
          </p>
        </div>
        {role === "admin" && (
          <button
            className="btn btn-primary btn-lg"
            onClick={() => {
              setShowModal(true);
              setEditing(null);
              setForm(EMPTY);
            }}
          >
            + Nouveau médecin
          </button>
        )}
      </div>

      {msg && (
        <div
          className={`alert ${msg.startsWith("✅") || msg.startsWith("🗑️") ? "alert-success" : "alert-error"}`}
        >
          {msg}
        </div>
      )}

      {/* Modal */}
      {showModal && role === "admin" && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">
                {editing ? "✏️ Modifier le médecin" : "👨‍⚕️ Nouveau médecin"}
              </span>
              <button
                className="modal-close"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Nom *</label>
                  <input
                    className="form-input"
                    value={form.nom}
                    onChange={(e) => setForm({ ...form, nom: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Prénom *</label>
                  <input
                    className="form-input"
                    value={form.prenom}
                    onChange={(e) =>
                      setForm({ ...form, prenom: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Spécialité *</label>
                  <select
                    className="form-input"
                    value={form.specialite}
                    onChange={(e) =>
                      setForm({ ...form, specialite: e.target.value })
                    }
                    required
                  >
                    <option value="">-- Sélectionner --</option>
                    {SPECIALITES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Téléphone</label>
                  <input
                    className="form-input"
                    value={form.telephone}
                    onChange={(e) =>
                      setForm({ ...form, telephone: e.target.value })
                    }
                  />
                </div>
                <div className="form-group span2">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                  />
                </div>
                <div
                  className="form-group span2"
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: "0.8rem",
                  }}
                >
                  <input
                    type="checkbox"
                    id="dispo"
                    checked={form.disponible}
                    onChange={(e) =>
                      setForm({ ...form, disponible: e.target.checked })
                    }
                    style={{ width: 18, height: 18, cursor: "pointer" }}
                  />
                  <label
                    htmlFor="dispo"
                    className="form-label"
                    style={{ margin: 0, cursor: "pointer" }}
                  >
                    Disponible pour les consultations
                  </label>
                </div>
              </div>
              <div className="divider" />
              <div
                style={{
                  display: "flex",
                  gap: "0.8rem",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowModal(false)}
                >
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  {editing ? "💾 Modifier" : "➕ Ajouter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cards Grid */}
      {loading ? (
        <div className="loading">
          <div className="spinner" /> Chargement...
        </div>
      ) : medecins.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👨‍⚕️</div>
          <p>Aucun médecin enregistré</p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1.2rem",
          }}
        >
          {medecins.map((m) => (
            <div
              key={m.id}
              className="card card-p"
              style={{ transition: "transform 0.2s, box-shadow 0.2s" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.transform = "translateY(-3px)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.transform = "translateY(0)")
              }
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "1rem",
                }}
              >
                <div
                  className="avatar"
                  style={{
                    background: "linear-gradient(135deg,#8b5cf6,#6d28d9)",
                    width: 50,
                    height: 50,
                    fontSize: "1rem",
                    borderRadius: 14,
                  }}
                >
                  {m.prenom[0]}
                  {m.nom[0]}
                </div>
                <span
                  className={`badge ${m.disponible ? "badge-green" : "badge-red"}`}
                >
                  {m.disponible ? "✅ Disponible" : "❌ Indisponible"}
                </span>
              </div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "1rem",
                  color: "var(--text)",
                  marginBottom: "0.3rem",
                }}
              >
                Dr. {m.prenom} {m.nom}
              </div>
              <div style={{ marginBottom: "0.8rem" }}>
                <span className={`badge ${specialiteColor(m.specialite)}`}>
                  {m.specialite}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.3rem",
                  marginBottom: "1rem",
                }}
              >
                {m.telephone && (
                  <div style={{ fontSize: "0.82rem", color: "var(--text2)" }}>
                    📞 {m.telephone}
                  </div>
                )}
                {m.email && (
                  <div style={{ fontSize: "0.82rem", color: "var(--text2)" }}>
                    ✉️ {m.email}
                  </div>
                )}
              </div>
              {role === "admin" && (
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    paddingTop: "0.8rem",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => openEdit(m)}
                  >
                    ✏️ Modifier
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(m.id)}
                  >
                    🗑️
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
