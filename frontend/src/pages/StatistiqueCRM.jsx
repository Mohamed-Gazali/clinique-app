// src/pages/StatistiqueCRM.jsx
import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import API from "../api";

const STAR_FULL  = "★";
const STAR_EMPTY = "☆";

const COLORS_NOTES  = ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#10b981"]; // 1★ -> 5★
const COLORS_BREAKDOWN = ["#10b981", "#f59e0b", "#ef4444"]; // Satisfaits / Neutres / Insatisfaits
const COLORS_COUVERTURE = ["#8b5cf6", "#e2e8f0"]; // Avec avis / Sans avis

function Stars({ value, size = 14 }) {
  if (value === null || value === undefined) {
    return <span style={{ color: "var(--text3)", fontSize: size }}>Aucun avis</span>;
  }
  const rounded = Math.round(value);
  return (
    <span style={{ fontSize: size, letterSpacing: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ color: i <= rounded ? "#f59e0b" : "#e2e8f0" }}>
          {i <= rounded ? STAR_FULL : STAR_EMPTY}
        </span>
      ))}
      <span style={{ fontSize: size * 0.8, color: "var(--text3)", marginLeft: 6 }}>
        {value.toFixed(1)}
      </span>
    </span>
  );
}

function OverviewCard({ icon, label, value, color, bg }) {
  return (
    <div className="stat-card" style={{ borderTop: `3px solid ${color}` }}>
      <div className="stat-icon" style={{ background: bg }}>
        <span>{icon}</span>
      </div>
      <div className="stat-value" style={{ color }}>{value ?? "—"}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return "Jamais venu(e)";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch {
    return "—";
  }
}

// ── Panneau latéral : historique + ajout de note pour un patient ────────────
function PatientCrmPanel({ patient, onClose, onNoteAdded }) {
  const [notes, setNotes]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote]       = useState(5);
  const [commentaire, setCommentaire] = useState("");
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState(null);

  const loadNotes = () => {
    setLoading(true);
    API.get(`/crm/satisfaction/patient/${patient.id}`)
      .then((r) => setNotes(r.data))
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadNotes(); }, [patient.id]);

  const submit = async () => {
    setSaving(true);
    setErr(null);
    try {
      await API.post("/crm/satisfaction", {
        patient_id: patient.id,
        note,
        commentaire: commentaire.trim() || null,
      });
      setCommentaire("");
      setNote(5);
      loadNotes();
      onNoteAdded?.();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0, width: "min(420px, 100vw)",
      background: "var(--card, #fff)", boxShadow: "-8px 0 24px rgba(0,0,0,0.12)",
      zIndex: 100, display: "flex", flexDirection: "column",
    }}>
      <div style={{
        padding: "1.2rem", borderBottom: "1px solid var(--border)",
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      }}>
        <div>
          <h2 style={{ fontSize: "1.05rem", fontWeight: 700 }}>
            {patient.prenom} {patient.nom}
          </h2>
          <p style={{ fontSize: "0.78rem", color: "var(--text3)" }}>
            {patient.telephone || "Pas de téléphone"} {patient.email ? `· ${patient.email}` : ""}
          </p>
        </div>
        <button onClick={onClose} style={{
          border: "none", background: "transparent", fontSize: "1.3rem", cursor: "pointer",
          color: "var(--text3)", lineHeight: 1,
        }}>×</button>
      </div>

      <div style={{ padding: "1.2rem", overflowY: "auto", flex: 1 }}>
        {/* Résumé */}
        <div style={{ display: "flex", gap: 12, marginBottom: "1.2rem" }}>
          <div style={{ flex: 1, background: "var(--bg)", borderRadius: 10, padding: "0.8rem", textAlign: "center" }}>
            <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{patient.nb_rdv}</div>
            <div style={{ fontSize: "0.7rem", color: "var(--text3)" }}>Rendez-vous</div>
          </div>
          <div style={{ flex: 1, background: "var(--bg)", borderRadius: 10, padding: "0.8rem", textAlign: "center" }}>
            <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{patient.nb_consultations}</div>
            <div style={{ fontSize: "0.7rem", color: "var(--text3)" }}>Consultations</div>
          </div>
        </div>

        {/* Formulaire nouvelle note */}
        <div style={{
          background: "var(--bg)", borderRadius: 10, padding: "1rem", marginBottom: "1.3rem",
          border: "1px solid var(--border)",
        }}>
          <p style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 8 }}>
            Ajouter une note de satisfaction
          </p>
          <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                onClick={() => setNote(i)}
                style={{
                  fontSize: "1.4rem", background: "none", border: "none", cursor: "pointer",
                  color: i <= note ? "#f59e0b" : "#e2e8f0", padding: 0, lineHeight: 1,
                }}
                aria-label={`${i} étoile(s)`}
              >
                {i <= note ? STAR_FULL : STAR_EMPTY}
              </button>
            ))}
          </div>
          <textarea
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            placeholder="Commentaire (optionnel) — ressenti du patient, remarque, suivi à prévoir..."
            rows={3}
            style={{
              width: "100%", borderRadius: 8, border: "1px solid var(--border)",
              padding: "0.5rem 0.6rem", fontSize: "0.82rem", resize: "vertical",
              fontFamily: "inherit", marginBottom: 8,
            }}
          />
          {err && <p style={{ color: "#ef4444", fontSize: "0.75rem", marginBottom: 8 }}>{err}</p>}
          <button
            onClick={submit}
            disabled={saving}
            style={{
              width: "100%", padding: "0.55rem", borderRadius: 8, border: "none",
              background: "#2563eb", color: "#fff", fontSize: "0.85rem", fontWeight: 600,
              cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Enregistrement..." : "Enregistrer la note"}
          </button>
        </div>

        {/* Historique */}
        <p style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 8 }}>
          Historique des avis ({notes.length})
        </p>
        {loading ? (
          <p style={{ fontSize: "0.8rem", color: "var(--text3)" }}>Chargement...</p>
        ) : notes.length === 0 ? (
          <p style={{ fontSize: "0.8rem", color: "var(--text3)" }}>Aucun avis enregistré pour ce patient.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {notes.map((n) => (
              <div key={n.id} style={{
                border: "1px solid var(--border)", borderRadius: 10, padding: "0.7rem 0.85rem",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <Stars value={n.note} size={13} />
                  <span style={{ fontSize: "0.7rem", color: "var(--text3)" }}>{formatDate(n.date)}</span>
                </div>
                {n.commentaire && (
                  <p style={{ fontSize: "0.82rem", color: "var(--text2)", marginBottom: 4 }}>{n.commentaire}</p>
                )}
                <p style={{ fontSize: "0.7rem", color: "var(--text3)" }}>
                  {n.auteur ? `Saisi par ${n.auteur}` : ""} {n.medecin ? `· ${n.medecin}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function StatistiqueCRM() {
  const [overview, setOverview] = useState(null);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [sortBy, setSortBy]     = useState("recent"); // recent | satisfaction | visites
  const [selected, setSelected] = useState(null);

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      API.get("/crm/overview"),
      API.get("/crm/patients"),
    ])
      .then(([o, p]) => { setOverview(o.data); setPatients(p.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, []);

  // ── Données graphiques (mémoïsées) ──
  const notesData = useMemo(() => {
    const rep = overview?.repartition_notes || {};
    return [1, 2, 3, 4, 5].map((i) => ({
      note: `${i}★`,
      value: rep[String(i)] ?? 0,
    }));
  }, [overview]);

  const breakdownData = useMemo(() => {
    if (!overview) return [];
    const rep = overview.repartition_notes || {};
    const satisfaits   = (rep["4"] ?? 0) + (rep["5"] ?? 0);
    const neutres      = rep["3"] ?? 0;
    const insatisfaits = overview.insatisfaits ?? 0;
    return [
      { name: "Satisfaits (4-5★)", value: satisfaits },
      { name: "Neutres (3★)",      value: neutres },
      { name: "Insatisfaits (≤2★)", value: insatisfaits },
    ];
  }, [overview]);

  const couvertureData = useMemo(() => {
    if (!overview) return [];
    const avecAvis = overview.patients_avec_avis ?? 0;
    const sansAvis = Math.max((overview.total_patients ?? 0) - avecAvis, 0);
    return [
      { name: "Avec avis", value: avecAvis },
      { name: "Sans avis", value: sansAvis },
    ];
  }, [overview]);

  const breakdownTotal   = breakdownData.reduce((s, d) => s + (d.value || 0), 0);
  const couvertureTotal  = couvertureData.reduce((s, d) => s + (d.value || 0), 0);

  const filtered = useMemo(() => {
    let list = patients;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        `${p.prenom} ${p.nom}`.toLowerCase().includes(q) ||
        (p.telephone && p.telephone.includes(q))
      );
    }
    const sorted = [...list];
    if (sortBy === "satisfaction") {
      sorted.sort((a, b) => (b.satisfaction_moyenne ?? -1) - (a.satisfaction_moyenne ?? -1));
    } else if (sortBy === "visites") {
      sorted.sort((a, b) => (b.nb_rdv + b.nb_consultations) - (a.nb_rdv + a.nb_consultations));
    } else {
      sorted.sort((a, b) => (b.dernier_passage || "").localeCompare(a.dernier_passage || ""));
    }
    return sorted;
  }, [patients, search, sortBy]);

  if (loading && !overview) {
    return (
      <div className="loading">
        <div className="spinner" /> Chargement du CRM...
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📇 Statistique et CRM</h1>
          <p className="page-subtitle">Suivi de la relation patient et de la satisfaction</p>
        </div>
      </div>

      {/* KPI satisfaction globaux */}
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <OverviewCard icon="⭐" label="Note moyenne globale"
          value={overview?.moyenne_globale ? `${overview.moyenne_globale} / 5` : "—"}
          color="#f59e0b" bg="#fffbeb" />
        <OverviewCard icon="💬" label="Avis collectés"
          value={overview?.total_avis} color="#2563eb" bg="#eff6ff" />
        <OverviewCard icon="🙂" label="Taux de satisfaction"
          value={overview?.taux_satisfaction != null ? `${overview.taux_satisfaction}%` : "—"}
          color="#10b981" bg="#f0fdf4" />
        <OverviewCard icon="⚠️" label="Avis négatifs (≤2★)"
          value={overview?.insatisfaits} color="#ef4444" bg="#fef2f2" />
        <OverviewCard icon="👥" label="Patients avec avis"
          value={overview ? `${overview.patients_avec_avis}/${overview.total_patients}` : "—"}
          color="#8b5cf6" bg="#f5f3ff" />
      </div>

      {/* ── Graphiques de satisfaction ── */}
      <div style={{
        display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: "1.5rem",
        marginTop: "1.5rem", marginBottom: "1.5rem",
      }}>

        {/* Distribution des notes (1 à 5 étoiles) */}
        <div className="card card-p">
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)", marginBottom: "1rem" }}>
            ⭐ Répartition des notes
          </h2>
          {breakdownTotal === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">⭐</div>
              <p>Aucun avis pour le moment</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={notesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis dataKey="note" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }} />
                <Bar dataKey="value" name="Avis" radius={[4, 4, 0, 0]}>
                  {notesData.map((_, i) => (
                    <Cell key={i} fill={COLORS_NOTES[i % COLORS_NOTES.length]} />
                  ))}
                  <LabelList dataKey="value" position="top" style={{ fontSize: 10, fill: "#64748b" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Satisfaits / Neutres / Insatisfaits */}
        <div className="card card-p">
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)", marginBottom: "1rem" }}>
            🙂 Satisfaction
          </h2>
          {breakdownTotal === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🙂</div>
              <p>Aucune donnée</p>
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={breakdownData} cx="50%" cy="50%" innerRadius={48} outerRadius={78}
                    dataKey="value" paddingAngle={2}>
                    {breakdownData.map((_, i) => (
                      <Cell key={i} fill={COLORS_BREAKDOWN[i % COLORS_BREAKDOWN.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{
                position: "absolute", top: "42%", left: "50%",
                transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "none",
              }}>
                <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text)" }}>{breakdownTotal}</div>
                <div style={{ fontSize: "0.6rem", color: "var(--text3)" }}>avis</div>
              </div>
            </div>
          )}
        </div>

        {/* Couverture patients (avec / sans avis) */}
        <div className="card card-p">
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)", marginBottom: "1rem" }}>
            👥 Couverture des avis
          </h2>
          {couvertureTotal === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <p>Aucun patient</p>
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={couvertureData} cx="50%" cy="50%" innerRadius={48} outerRadius={78}
                    dataKey="value" paddingAngle={2}>
                    {couvertureData.map((_, i) => (
                      <Cell key={i} fill={COLORS_COUVERTURE[i % COLORS_COUVERTURE.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{
                position: "absolute", top: "42%", left: "50%",
                transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "none",
              }}>
                <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text)" }}>
                  {overview?.total_patients ?? couvertureTotal}
                </div>
                <div style={{ fontSize: "0.6rem", color: "var(--text3)" }}>patients</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Barre recherche + tri */}
      <div className="card card-p" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Rechercher un patient (nom, téléphone)..."
            style={{
              flex: 1, minWidth: 220, padding: "0.55rem 0.9rem", borderRadius: 8,
              border: "1px solid var(--border)", fontSize: "0.85rem",
            }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { key: "recent",       label: "Dernier passage" },
              { key: "satisfaction", label: "Satisfaction" },
              { key: "visites",      label: "Nb visites" },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => setSortBy(s.key)}
                style={{
                  padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: "0.78rem",
                  border: "1px solid",
                  borderColor: sortBy === s.key ? "#2563eb" : "var(--border)",
                  background:  sortBy === s.key ? "#2563eb" : "var(--bg)",
                  color:       sortBy === s.key ? "#fff"    : "var(--text2)",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table CRM patients */}
      <div className="card card-p">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📇</div>
            <p>Aucun patient trouvé</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr>
                  {["Patient", "Contact", "Visites", "Dernier passage", "Satisfaction", "Dernier commentaire", ""].map((h) => (
                    <th key={h} style={{
                      textAlign: "left", padding: "8px 10px", color: "var(--text3)",
                      fontWeight: 500, fontSize: "0.75rem",
                      borderBottom: "1px solid var(--border)",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setSelected(p)}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "10px", borderBottom: "1px solid var(--border)", fontWeight: 600 }}>
                      {p.prenom} {p.nom}
                    </td>
                    <td style={{ padding: "10px", borderBottom: "1px solid var(--border)", color: "var(--text3)" }}>
                      {p.telephone || "—"}
                    </td>
                    <td style={{ padding: "10px", borderBottom: "1px solid var(--border)" }}>
                      {p.nb_rdv + p.nb_consultations}
                    </td>
                    <td style={{ padding: "10px", borderBottom: "1px solid var(--border)", color: "var(--text3)" }}>
                      {formatDate(p.dernier_passage)}
                    </td>
                    <td style={{ padding: "10px", borderBottom: "1px solid var(--border)" }}>
                      <Stars value={p.satisfaction_moyenne} />
                    </td>
                    <td style={{
                      padding: "10px", borderBottom: "1px solid var(--border)", color: "var(--text3)",
                      maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {p.dernier_commentaire || "—"}
                    </td>
                    <td style={{ padding: "10px", borderBottom: "1px solid var(--border)", color: "#2563eb", fontSize: "0.8rem" }}>
                      Voir →
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <PatientCrmPanel
          patient={selected}
          onClose={() => setSelected(null)}
          onNoteAdded={loadAll}
        />
      )}
    </div>
  );
}