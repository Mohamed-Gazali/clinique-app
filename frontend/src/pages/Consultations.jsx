import { useState, useEffect } from "react";
import API from "../api";

const EMPTY = {
  patient_id: "",
  medecin_id: "",
  rendez_vous_id: "",
  diagnostic: "",
  traitement: "",
  notes: "",
};

export default function Consultations() {
  const [consultations, setConsultations] = useState([]);
  const [patients, setPatients] = useState([]);
  const [medecins, setMedecins] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const load = () => {
    Promise.all([
      API.get("/consultations"),
      API.get("/patients"),
      API.get("/medecins"),
    ])
      .then(([c, p, m]) => {
        setConsultations(c.data);
        setPatients(p.data);
        setMedecins(m.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const getPatient = (id) => patients.find((p) => p.id === id);
  const getMedecin = (id) => medecins.find((m) => m.id === id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await API.post("/consultations", {
        ...form,
        patient_id: parseInt(form.patient_id),
        medecin_id: parseInt(form.medecin_id),
        rendez_vous_id: form.rendez_vous_id
          ? parseInt(form.rendez_vous_id)
          : null,
      });
      setMsg("✅ Consultation enregistrée !");
      setForm(EMPTY);
      setShowModal(false);
      load();
    } catch (err) {
      setMsg("❌ " + (err.response?.data?.detail || "Erreur"));
    }
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🩺 Consultations</h1>
          <p className="page-subtitle">
            {consultations.length} consultation(s) enregistrée(s)
          </p>
        </div>
        <button
          className="btn btn-primary btn-lg"
          onClick={() => setShowModal(true)}
        >
          + Nouvelle consultation
        </button>
      </div>

      {msg && (
        <div
          className={`alert ${msg.startsWith("✅") ? "alert-success" : "alert-error"}`}
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
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">🩺 Nouvelle consultation</span>
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
                  <label className="form-label">Patient *</label>
                  <select
                    className="form-input"
                    value={form.patient_id}
                    onChange={(e) =>
                      setForm({ ...form, patient_id: e.target.value })
                    }
                    required
                  >
                    <option value="">-- Sélectionner --</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.prenom} {p.nom}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Médecin *</label>
                  <select
                    className="form-input"
                    value={form.medecin_id}
                    onChange={(e) =>
                      setForm({ ...form, medecin_id: e.target.value })
                    }
                    required
                  >
                    <option value="">-- Sélectionner --</option>
                    {medecins.map((m) => (
                      <option key={m.id} value={m.id}>
                        Dr. {m.prenom} {m.nom}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group span2">
                  <label className="form-label">Diagnostic</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={form.diagnostic}
                    onChange={(e) =>
                      setForm({ ...form, diagnostic: e.target.value })
                    }
                    placeholder="Diagnostic médical..."
                    style={{ resize: "vertical" }}
                  />
                </div>
                <div className="form-group span2">
                  <label className="form-label">Traitement prescrit</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={form.traitement}
                    onChange={(e) =>
                      setForm({ ...form, traitement: e.target.value })
                    }
                    placeholder="Médicaments, posologie..."
                    style={{ resize: "vertical" }}
                  />
                </div>
                <div className="form-group span2">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={form.notes}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                    placeholder="Observations complémentaires..."
                    style={{ resize: "vertical" }}
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
                  💾 Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <div className="loading">
              <div className="spinner" /> Chargement...
            </div>
          ) : consultations.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🩺</div>
              <p>Aucune consultation enregistrée</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Patient</th>
                  <th>Médecin</th>
                  <th>Diagnostic</th>
                  <th>Traitement</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {consultations.map((c) => {
                  const p = getPatient(c.patient_id);
                  const m = getMedecin(c.medecin_id);
                  return (
                    <tr key={c.id}>
                      <td
                        style={{
                          fontFamily: "var(--mono)",
                          color: "var(--text3)",
                          fontSize: "0.78rem",
                        }}
                      >
                        #{c.id}
                      </td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.6rem",
                          }}
                        >
                          <div
                            className="avatar"
                            style={{
                              background:
                                "linear-gradient(135deg,#2563eb,#7c3aed)",
                              width: 32,
                              height: 32,
                              fontSize: "0.72rem",
                            }}
                          >
                            {p ? `${p.prenom[0]}${p.nom[0]}` : "?"}
                          </div>
                          <span
                            style={{ fontWeight: 600, color: "var(--text)" }}
                          >
                            {p ? `${p.prenom} ${p.nom}` : "Inconnu"}
                          </span>
                        </div>
                      </td>
                      <td style={{ color: "var(--text2)" }}>
                        {m ? `Dr. ${m.prenom} ${m.nom}` : "Inconnu"}
                      </td>
                      <td style={{ maxWidth: 200 }}>
                        <span
                          style={{
                            display: "block",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: 180,
                          }}
                        >
                          {c.diagnostic || (
                            <span style={{ color: "var(--text3)" }}>—</span>
                          )}
                        </span>
                      </td>
                      <td style={{ maxWidth: 160 }}>
                        <span
                          style={{
                            display: "block",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: 140,
                          }}
                        >
                          {c.traitement || (
                            <span style={{ color: "var(--text3)" }}>—</span>
                          )}
                        </span>
                      </td>
                      <td
                        style={{
                          color: "var(--text3)",
                          fontSize: "0.82rem",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {new Date(c.date).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
