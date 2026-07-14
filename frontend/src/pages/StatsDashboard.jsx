// src/pages/StatsDashboard.jsx
// Installer : npm install recharts
// Importer dans App.jsx et ajouter la route /stats

import { useState, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const PERIODES = [
  { key: "jour",    label: "Aujourd'hui" },
  { key: "semaine", label: "Cette semaine" },
  { key: "mois",    label: "Ce mois" },
];

const COLORS_DONUT = ["#2a78d6", "#1baf7a", "#e34948"];
const STATUT_LABELS = { planifie: "Planifiés", confirme: "Confirmés", annule: "Annulés" };

// ── Composant KPI card ────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, delta, deltaPct }) {
  const isUp   = delta > 0;
  const isDown = delta < 0;
  return (
    <div style={{
      background: "var(--surface-1, #f5f5f3)",
      borderRadius: 8, padding: "1rem",
    }}>
      <p style={{ fontSize: 12, color: "var(--text-muted, #898781)", marginBottom: 6 }}>
        {icon} {label}
      </p>
      <p style={{ fontSize: 28, fontWeight: 500, lineHeight: 1 }}>
        {value?.toLocaleString("fr-FR") ?? "—"}
      </p>
      {delta !== undefined && (
        <p style={{
          fontSize: 12, marginTop: 4,
          color: isUp ? "#1baf7a" : isDown ? "#e34948" : "var(--text-muted,#898781)"
        }}>
          {isUp ? "+" : ""}{delta} ({deltaPct > 0 ? "+" : ""}{deltaPct}%) vs période préc.
        </p>
      )}
    </div>
  );
}

// ── Dashboard principal ───────────────────────────────────────────────────────
export default function StatsDashboard() {
  const [periode, setPeriode] = useState("mois");
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const token = localStorage.getItem("token");

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API}/stats/dashboard?periode=${periode}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Erreur ${r.status}`);
        return r.json();
      })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [periode]);

  // Données pour le donut (statuts RDV)
  const donutData = data
    ? Object.entries(data.rdv_statuts).map(([k, v]) => ({
        name: STATUT_LABELS[k] ?? k,
        value: v,
      }))
    : [];

  // Données pour le graphique linéaire
  const lineData = data?.activite
    ? data.activite.labels.map((label, i) => ({
        label,
        "Rendez-vous":   data.activite.rendez_vous[i],
        "Consultations": data.activite.consultations[i],
        "Ordonnances":   data.activite.ordonnances[i],
      }))
    : [];

  // Données pour le bar chart (nouveaux patients)
  const barData = data?.activite
    ? data.activite.labels.map((label, i) => ({
        label,
        "Nouveaux patients": data.activite.nouveaux_patients[i],
      }))
    : [];

  const kpi = data?.kpi;

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1100, margin: "0 auto" }}>
      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500 }}>Statistiques</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {PERIODES.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriode(p.key)}
              style={{
                padding: "6px 16px", borderRadius: 8, cursor: "pointer",
                border: "0.5px solid",
                borderColor: periode === p.key ? "transparent" : "var(--border-strong, #c3c2b7)",
                background: periode === p.key ? "var(--text-primary, #0b0b0b)" : "transparent",
                color: periode === p.key ? "var(--surface-2, #fff)" : "var(--text-secondary, #52514e)",
                fontSize: 13,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ background: "var(--bg-danger,#fcebeb)", color: "var(--text-danger,#a32d2d)", padding: "0.75rem 1rem", borderRadius: 8, marginBottom: "1rem", fontSize: 14 }}>
          {error}
        </div>
      )}

      {loading && (
        <p style={{ color: "var(--text-muted,#898781)", fontSize: 14 }}>Chargement...</p>
      )}

      {!loading && data && (
        <>
          {/* KPI row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: "1.5rem" }}>
            <KpiCard icon="👤" label="Patients total"      value={kpi.patients_total} />
            <KpiCard icon="🩺" label="Médecins"            value={kpi.medecins_total} />
            <KpiCard icon="📅" label="Rendez-vous"         value={kpi.rendez_vous.valeur}     delta={kpi.rendez_vous.delta}     deltaPct={kpi.rendez_vous.delta_pct} />
            <KpiCard icon="📋" label="Consultations"       value={kpi.consultations.valeur}   delta={kpi.consultations.delta}   deltaPct={kpi.consultations.delta_pct} />
            <KpiCard icon="💊" label="Ordonnances"         value={kpi.ordonnances.valeur}     delta={kpi.ordonnances.delta}     deltaPct={kpi.ordonnances.delta_pct} />
            <KpiCard icon="🆕" label="Nouveaux patients"   value={kpi.nouveaux_patients.valeur} delta={kpi.nouveaux_patients.delta} deltaPct={kpi.nouveaux_patients.delta_pct} />
          </div>

          {/* Graphique linéaire — activité */}
          <div style={{ background: "var(--surface-1,#f5f5f3)", borderRadius: 12, padding: "1.25rem", marginBottom: 16 }}>
            <p style={{ fontWeight: 500, fontSize: 14, marginBottom: 4 }}>Activité de la clinique</p>
            <p style={{ fontSize: 12, color: "var(--text-muted,#898781)", marginBottom: "1rem" }}>
              Rendez-vous, consultations et ordonnances
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(130,128,120,0.15)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#898781" }} />
                <YAxis tick={{ fontSize: 11, fill: "#898781" }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Rendez-vous"   stroke="#2a78d6" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Consultations" stroke="#1baf7a" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Ordonnances"   stroke="#eda100" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 2e ligne : donut + bar */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Donut — statuts RDV */}
            <div style={{ background: "var(--surface-1,#f5f5f3)", borderRadius: 12, padding: "1.25rem" }}>
              <p style={{ fontWeight: 500, fontSize: 14, marginBottom: 4 }}>Statuts des rendez-vous</p>
              <p style={{ fontSize: 12, color: "var(--text-muted,#898781)", marginBottom: "1rem" }}>Répartition par statut</p>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={2}>
                    {donutData.map((_, i) => (
                      <Cell key={i} fill={COLORS_DONUT[i % COLORS_DONUT.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Bar — nouveaux patients */}
            <div style={{ background: "var(--surface-1,#f5f5f3)", borderRadius: 12, padding: "1.25rem" }}>
              <p style={{ fontWeight: 500, fontSize: 14, marginBottom: 4 }}>Nouveaux patients</p>
              <p style={{ fontSize: 12, color: "var(--text-muted,#898781)", marginBottom: "1rem" }}>Inscrits sur la période</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(130,128,120,0.15)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#898781" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#898781" }} />
                  <Tooltip />
                  <Bar dataKey="Nouveaux patients" fill="#4a3aa7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top médecins */}
          {data.top_medecins?.length > 0 && (
            <div style={{ background: "var(--surface-1,#f5f5f3)", borderRadius: 12, padding: "1.25rem", marginTop: 16 }}>
              <p style={{ fontWeight: 500, fontSize: 14, marginBottom: "1rem" }}>Top médecins — consultations</p>
              <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Médecin", "Spécialité", "Consultations"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: "var(--text-muted,#898781)", fontWeight: 400, borderBottom: "0.5px solid var(--border,rgba(11,11,11,0.10))" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.top_medecins.map((m, i) => (
                    <tr key={i}>
                      <td style={{ padding: "8px 8px", borderBottom: "0.5px solid var(--border,rgba(11,11,11,0.08))" }}>Dr. {m.nom}</td>
                      <td style={{ padding: "8px 8px", color: "var(--text-secondary,#52514e)", borderBottom: "0.5px solid var(--border,rgba(11,11,11,0.08))" }}>{m.specialite}</td>
                      <td style={{ padding: "8px 8px", fontWeight: 500, borderBottom: "0.5px solid var(--border,rgba(11,11,11,0.08))" }}>{m.consultations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}