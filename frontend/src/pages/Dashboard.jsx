import { useState, useEffect } from "react";
import API from "../api";

function StatCard({ icon, label, value, color, bg, trend }) {
  return (
    <div className="stat-card" style={{ borderTop: `3px solid ${color}` }}>
      <div className="stat-icon" style={{ background: bg }}>
        <span>{icon}</span>
      </div>
      <div className="stat-value" style={{ color }}>
        {value ?? "—"}
      </div>
      <div className="stat-label">{label}</div>
      {trend && (
        <div className="stat-trend" style={{ background: bg, color }}>
          {trend}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [rdvs, setRdvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const user = localStorage.getItem("user");

  useEffect(() => {
    Promise.all([API.get("/stats"), API.get("/rendezvous")])
      .then(([s, r]) => {
        setStats(s.data);
        setRdvs(r.data.slice(0, 6));
      })
      .finally(() => setLoading(false));
  }, []);

  const statutBadge = (s) => {
    const map = {
      planifie: ["badge-blue", "Planifié"],
      confirme: ["badge-green", "Confirmé"],
      annule: ["badge-red", "Annulé"],
      termine: ["badge-gray", "Terminé"],
    };
    return map[s] || ["badge-gray", s];
  };

  if (loading)
    return (
      <div className="loading">
        <div className="spinner" /> Chargement du dashboard...
      </div>
    );

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Bonjour, {user} 👋</h1>
          <p className="page-subtitle">
            {new Date().toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <StatCard
          icon="👤"
          label="Patients enregistrés"
          value={stats?.total_patients}
          color="#2563eb"
          bg="#eff6ff"
          trend={`Total`}
        />
        <StatCard
          icon="👨‍⚕️"
          label="Médecins actifs"
          value={stats?.total_medecins}
          color="#8b5cf6"
          bg="#f5f3ff"
        />
        <StatCard
          icon="📅"
          label="RDV aujourd'hui"
          value={stats?.rdv_aujourd_hui}
          color="#f59e0b"
          bg="#fffbeb"
          trend="Aujourd'hui"
        />
        <StatCard
          icon="🩺"
          label="Consultations totales"
          value={stats?.total_consultations}
          color="#10b981"
          bg="#f0fdf4"
        />
      </div>

      {/* 2 colonnes */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1.5rem",
        }}
      >
        {/* RDV récents */}
        <div className="card card-p">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.2rem",
            }}
          >
            <h2
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                color: "var(--text)",
              }}
            >
              📅 Rendez-vous récents
            </h2>
            <span className="badge badge-blue">
              {stats?.rdv_planifies ?? 0} planifiés
            </span>
          </div>
          {rdvs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📅</div>
              <p>Aucun rendez-vous</p>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.8rem",
              }}
            >
              {rdvs.map((r) => {
                const [cls, lbl] = statutBadge(r.statut);
                return (
                  <div
                    key={r.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.8rem",
                      padding: "0.75rem",
                      borderRadius: 10,
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div
                      className="avatar"
                      style={{
                        background: "linear-gradient(135deg,#2563eb,#7c3aed)",
                        fontSize: "0.78rem",
                      }}
                    >
                      {r.patient
                        ?.split(" ")
                        .map((w) => w[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: "0.85rem",
                          color: "var(--text)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {r.patient}
                      </div>
                      <div
                        style={{ fontSize: "0.75rem", color: "var(--text3)" }}
                      >
                        {r.medecin} ·{" "}
                        {new Date(r.date_heure).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <span className={`badge ${cls}`}>{lbl}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Statuts RDV */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="card card-p">
            <h2
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                color: "var(--text)",
                marginBottom: "1.2rem",
              }}
            >
              📊 Statuts des rendez-vous
            </h2>
            {[
              {
                label: "Planifiés",
                value: stats?.rdv_planifies,
                color: "#2563eb",
                bg: "#eff6ff",
              },
              {
                label: "Confirmés",
                value: stats?.rdv_confirmes,
                color: "#10b981",
                bg: "#f0fdf4",
              },
              {
                label: "Annulés",
                value: stats?.rdv_annules,
                color: "#ef4444",
                bg: "#fef2f2",
              },
            ].map(({ label, value, color, bg }) => (
              <div key={label} style={{ marginBottom: "0.9rem" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "0.3rem",
                  }}
                >
                  <span style={{ fontSize: "0.82rem", color: "var(--text2)" }}>
                    {label}
                  </span>
                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color }}>
                    {value ?? 0}
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    background: "#f1f5f9",
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 10,
                      background: color,
                      width: `${Math.min(((value ?? 0) / Math.max(stats?.total_rdv || 1, 1)) * 100, 100)}%`,
                      transition: "width 1s ease",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="card card-p">
            <h2
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                color: "var(--text)",
                marginBottom: "1rem",
              }}
            >
              ⚡ Actions rapides
            </h2>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.6rem",
              }}
            >
              {[
                { label: "Nouveau patient", icon: "👤", path: "/patients" },
                { label: "Nouveau RDV", icon: "📅", path: "/rendezvous" },
                {
                  label: "Nouvelle consultation",
                  icon: "🩺",
                  path: "/consultations",
                },
              ].map(({ label, icon, path }) => (
                <a
                  key={path}
                  href={path}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.7rem",
                    padding: "0.65rem 0.9rem",
                    borderRadius: 9,
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    textDecoration: "none",
                    color: "var(--text2)",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.borderColor = "#2563eb")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.borderColor = "var(--border)")
                  }
                >
                  <span>{icon}</span>
                  {label}
                  <span style={{ marginLeft: "auto", color: "var(--text3)" }}>
                    →
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
