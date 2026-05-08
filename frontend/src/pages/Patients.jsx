import { useState, useEffect } from "react";
import API from "../api";

const EMPTY = {
  nom: "",
  prenom: "",
  date_naissance: "",
  telephone: "",
  email: "",
  adresse: "",
  groupe_sanguin: "",
  allergies: "",
  antecedents: "",
};
const GROUPES = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const load = () =>
    API.get("/patients")
      .then((r) => setPatients(r.data))
      .finally(() => setLoading(false));
  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      editing
        ? await API.put(`/patients/${editing}`, form)
        : await API.post("/patients", form);
      setMsg(editing ? "✅ Patient modifié !" : "✅ Patient ajouté !");
      setForm(EMPTY);
      setEditing(null);
      setShowModal(false);
      load();
    } catch (err) {
      setMsg("❌ " + (err.response?.data?.detail || "Erreur"));
    }
    setTimeout(() => setMsg(""), 3000);
  };

  const openEdit = (p) => {
    setForm({
      nom: p.nom,
      prenom: p.prenom,
      date_naissance: p.date_naissance || "",
      telephone: p.telephone || "",
      email: p.email || "",
      adresse: p.adresse || "",
      groupe_sanguin: p.groupe_sanguin || "",
      allergies: p.allergies || "",
      antecedents: p.antecedents || "",
    });
    setEditing(p.id);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer ce patient ?")) return;
    await API.delete(`/patients/${id}`);
    setMsg("🗑️ Patient supprimé");
    load();
    setTimeout(() => setMsg(""), 3000);
  };

  const filtered = patients.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.nom.toLowerCase().includes(q) ||
      p.prenom.toLowerCase().includes(q) ||
      p.telephone?.includes(q)
    );
  });

  const groupeColor = (g) => {
    if (!g) return null;
    return (
      <span
        className="badge badge-red"
        style={{ fontFamily: "var(--mono)", fontSize: "0.7rem" }}
      >
        {g}
      </span>
    );
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">👤 Patients</h1>
          <p className="page-subtitle">
            {patients.length} patient(s) enregistré(s)
          </p>
        </div>
        <button
          className="btn btn-primary btn-lg"
          onClick={() => {
            setShowModal(true);
            setEditing(null);
            setForm(EMPTY);
          }}
        >
          + Nouveau patient
        </button>
      </div>

      {msg && (
        <div
          className={`alert ${msg.startsWith("✅") || msg.startsWith("🗑️") ? "alert-success" : "alert-error"}`}
        >
          {msg}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="modal" style={{ maxWidth: 620 }}>
            <div className="modal-header">
              <span className="modal-title">
                {editing ? "✏️ Modifier le patient" : "👤 Nouveau patient"}
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
                    placeholder="Diallo"
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
                    placeholder="Aminata"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Date de naissance</label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.date_naissance}
                    onChange={(e) =>
                      setForm({ ...form, date_naissance: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Téléphone</label>
                  <input
                    className="form-input"
                    value={form.telephone}
                    onChange={(e) =>
                      setForm({ ...form, telephone: e.target.value })
                    }
                    placeholder="+227 XX XX XX XX"
                  />
                </div>
                <div className="form-group">
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
                <div className="form-group">
                  <label className="form-label">Groupe sanguin</label>
                  <select
                    className="form-input"
                    value={form.groupe_sanguin}
                    onChange={(e) =>
                      setForm({ ...form, groupe_sanguin: e.target.value })
                    }
                  >
                    <option value="">-- Sélectionner --</option>
                    {GROUPES.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group span2">
                  <label className="form-label">Adresse</label>
                  <input
                    className="form-input"
                    value={form.adresse}
                    onChange={(e) =>
                      setForm({ ...form, adresse: e.target.value })
                    }
                    placeholder="Quartier, ville..."
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Allergies</label>
                  <input
                    className="form-input"
                    value={form.allergies}
                    onChange={(e) =>
                      setForm({ ...form, allergies: e.target.value })
                    }
                    placeholder="Pénicilline..."
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Antécédents médicaux</label>
                  <input
                    className="form-input"
                    value={form.antecedents}
                    onChange={(e) =>
                      setForm({ ...form, antecedents: e.target.value })
                    }
                    placeholder="Diabète, HTA..."
                  />
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

      {/* Search + Table */}
      <div className="card">
        <div
          style={{
            padding: "1rem 1.5rem",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            gap: "1rem",
            alignItems: "center",
          }}
        >
          <div className="search-bar" style={{ maxWidth: "100%", flex: 1 }}>
            <span style={{ color: "var(--text3)" }}>🔍</span>
            <input
              placeholder="Rechercher par nom ou téléphone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span
            style={{
              color: "var(--text3)",
              fontSize: "0.82rem",
              whiteSpace: "nowrap",
            }}
          >
            {filtered.length} résultat(s)
          </span>
        </div>
        <div className="table-wrap">
          {loading ? (
            <div className="loading">
              <div className="spinner" /> Chargement...
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👤</div>
              <p>Aucun patient trouvé</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Téléphone</th>
                  <th>Groupe</th>
                  <th>Allergies</th>
                  <th>Antécédents</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.7rem",
                        }}
                      >
                        <div
                          className="avatar"
                          style={{
                            background:
                              "linear-gradient(135deg,#2563eb,#7c3aed)",
                            fontSize: "0.78rem",
                          }}
                        >
                          {p.prenom[0]}
                          {p.nom[0]}
                        </div>
                        <div>
                          <div
                            style={{ fontWeight: 600, color: "var(--text)" }}
                          >
                            {p.prenom} {p.nom}
                          </div>
                          {p.email && (
                            <div
                              style={{
                                fontSize: "0.75rem",
                                color: "var(--text3)",
                              }}
                            >
                              {p.email}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      {p.telephone || (
                        <span style={{ color: "var(--text3)" }}>—</span>
                      )}
                    </td>
                    <td>
                      {groupeColor(p.groupe_sanguin) || (
                        <span style={{ color: "var(--text3)" }}>—</span>
                      )}
                    </td>
                    <td>
                      {p.allergies ? (
                        <span className="badge badge-yellow">
                          ⚠️ {p.allergies}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text3)" }}>—</span>
                      )}
                    </td>
                    <td style={{ maxWidth: 160 }}>
                      <span
                        style={{
                          display: "block",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: 150,
                          fontSize: "0.82rem",
                        }}
                      >
                        {p.antecedents || (
                          <span style={{ color: "var(--text3)" }}>—</span>
                        )}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => openEdit(p)}
                        >
                          ✏️
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(p.id)}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
