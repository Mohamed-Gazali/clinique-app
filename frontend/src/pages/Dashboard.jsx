import { useState, useEffect, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import API from "../api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const PERIODES = [
  { key: "jour",    label: "Aujourd'hui" },
  { key: "semaine", label: "Cette semaine" },
  { key: "mois",    label: "Ce mois" },
];
const COLORS_DONUT = ["#2563eb", "#10b981", "#ef4444"];
const COLORS_TYPE  = ["#f59e0b", "#10b981", "#8b5cf6"]; // RDV / Consultations / Ordonnances

// ── StatCard (ton composant original) ────────────────────────────────────────
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

// ── Badge statut (ton helper original) ───────────────────────────────────────
function statutBadge(s) {
  const map = {
    planifie: ["badge-blue",  "Planifié"],
    confirme: ["badge-green", "Confirmé"],
    annule:   ["badge-red",   "Annulé"],
    termine:  ["badge-gray",  "Terminé"],
  };
  return map[s] || ["badge-gray", s];
}

// ── Carte delta ───────────────────────────────────────────────────────────────
function DeltaBadge({ delta, deltaPct }) {
  if (delta === undefined) return null;
  const isUp   = delta > 0;
  const isDown = delta < 0;
  const color  = isUp ? "#10b981" : isDown ? "#ef4444" : "#6b7280";
  return (
    <span style={{ fontSize: "0.72rem", color, fontWeight: 600 }}>
      {isUp ? "▲" : isDown ? "▼" : "—"} {Math.abs(delta)} ({deltaPct > 0 ? "+" : ""}{deltaPct}%)
    </span>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [stats,       setStats]       = useState(null);   // /stats
  const [rdvs,        setRdvs]        = useState([]);
  const [periodeData, setPeriodeData] = useState(null);    // /stats/dashboard
  const [periode,     setPeriode]     = useState("mois");
  const [loading,     setLoading]     = useState(true);
  const [loadingP,    setLoadingP]    = useState(false);
  const [donutMode,   setDonutMode]   = useState("statuts"); // "statuts" | "repartition"
  const user  = localStorage.getItem("user");
  const token = localStorage.getItem("token");

  // Chargement initial (stats de base + RDV)
  useEffect(() => {
    Promise.all([API.get("/stats"), API.get("/rendezvous")])
      .then(([s, r]) => {
        setStats(s.data);
        setRdvs(r.data.slice(0, 6));
      })
      .finally(() => setLoading(false));
  }, []);

  // Chargement données par période
  useEffect(() => {
    setLoadingP(true);
    fetch(`${API_URL}/stats/dashboard?periode=${periode}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setPeriodeData(d))
      .finally(() => setLoadingP(false));
  }, [periode]);

  // ── Données graphiques (mémoïsées) ──
  const areaData = useMemo(() => (
    periodeData?.activite
      ? periodeData.activite.labels.map((label, i) => ({
          label,
          "Rendez-vous":   periodeData.activite.rendez_vous[i]   ?? 0,
          "Consultations": periodeData.activite.consultations[i] ?? 0,
          "Ordonnances":   periodeData.activite.ordonnances[i]   ?? 0,
        }))
      : []
  ), [periodeData]);

  const barData = useMemo(() => (
    periodeData?.activite
      ? periodeData.activite.labels.map((label, i) => ({
          label,
          "Nouveaux patients": periodeData.activite.nouveaux_patients[i] ?? 0,
        }))
      : []
  ), [periodeData]);

  const donutStatuts = useMemo(() => (
    periodeData?.rdv_statuts
      ? Object.entries(periodeData.rdv_statuts).map(([k, v]) => ({
          name: { planifie: "Planifiés", confirme: "Confirmés", annule: "Annulés" }[k] ?? k,
          value: v,
        }))
      : []
  ), [periodeData]);

  const kpi = periodeData?.kpi;

  const donutRepartition = useMemo(() => (
    kpi
      ? [
          { name: "Rendez-vous",   value: kpi.rendez_vous?.valeur   ?? 0 },
          { name: "Consultations", value: kpi.consultations?.valeur ?? 0 },
          { name: "Ordonnances",   value: kpi.ordonnances?.valeur   ?? 0 },
        ]
      : []
  ), [kpi]);

  const activeDonutData  = donutMode === "statuts" ? donutStatuts : donutRepartition;
  const activeDonutColors = donutMode === "statuts" ? COLORS_DONUT : COLORS_TYPE;
  const donutTotal = activeDonutData.reduce((sum, d) => sum + (d.value || 0), 0);

  const topMedecinsData = useMemo(() => (
    periodeData?.top_medecins
      ? periodeData.top_medecins.map((m) => ({
          name: `Dr. ${m.nom}`,
          consultations: m.consultations,
        }))
      : []
  ), [periodeData]);

  const totalRdv = stats?.total_rdv
    ?? ((stats?.rdv_planifies ?? 0) + (stats?.rdv_confirmes ?? 0) + (stats?.rdv_annules ?? 0));

  if (loading)
    return (
      <div className="loading">
        <div className="spinner" /> Chargement du dashboard...
      </div>
    );

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Bonjour, {user} 👋</h1>
          <p className="page-subtitle">
            {new Date().toLocaleDateString("fr-FR", {
              weekday: "long", day: "numeric",
              month: "long",  year: "numeric",
            })}
          </p>
        </div>

        {/* Sélecteur de période */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {PERIODES.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriode(p.key)}
              style={{
                padding: "6px 14px", borderRadius: 8, cursor: "pointer",
                border: "1px solid",
                borderColor: periode === p.key ? "#2563eb" : "var(--border)",
                background:  periode === p.key ? "#2563eb" : "var(--bg)",
                color:       periode === p.key ? "#fff"    : "var(--text2)",
                fontSize: "0.82rem", fontWeight: 500,
                transition: "all 0.15s",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 5 KPI globaux ── */}
      <div
        className="stats-grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
      >
        <StatCard
          icon="👤" label="Patients enregistrés"
          value={stats?.total_patients}
          color="#2563eb" bg="#eff6ff" trend="Total"
        />
        <StatCard
          icon="👨‍⚕️" label="Médecins actifs"
          value={stats?.total_medecins}
          color="#8b5cf6" bg="#f5f3ff" trend="Total"
        />
        <StatCard
          icon="📅" label="Rendez-vous"
          value={stats?.rdv_aujourd_hui}
          color="#f59e0b" bg="#fffbeb" trend="Aujourd'hui"
        />
        <StatCard
          icon="💊" label="Ordonnances"
          value={stats?.total_ordonnances ?? kpi?.ordonnances?.valeur}
          color="#06b6d4" bg="#ecfeff" trend="Total"
        />
        <StatCard
          icon="🩺" label="Consultations"
          value={stats?.total_consultations}
          color="#10b981" bg="#f0fdf4" trend="Total"
        />
      </div>

      {/* ── KPIs période (avec tendance) ── */}
      {kpi && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12, marginBottom: "1.5rem", marginTop: "1.5rem",
        }}>
          {[
            { label: "Rendez-vous",       d: kpi.rendez_vous,       icon: "📅", color: "#f59e0b", bg: "#fffbeb" },
            { label: "Consultations",     d: kpi.consultations,     icon: "🩺", color: "#10b981", bg: "#f0fdf4" },
            { label: "Ordonnances",       d: kpi.ordonnances,       icon: "💊", color: "#06b6d4", bg: "#ecfeff" },
            { label: "Nouveaux patients", d: kpi.nouveaux_patients, icon: "🆕", color: "#2563eb", bg: "#eff6ff" },
          ].map(({ label, d, icon, color, bg }) => (
            <div key={label} className="card card-p" style={{ borderTop: `3px solid ${color}` }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text3)", marginBottom: 4 }}>
                {icon} {label}
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: 700, color, lineHeight: 1 }}>
                {d?.valeur ?? "—"}
              </div>
              <div style={{ marginTop: 4 }}>
                <DeltaBadge delta={d?.delta} deltaPct={d?.delta_pct} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Graphique activité (zone empilée lisible) ── */}
      <div className="card card-p" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>
            📈 Activité de la clinique
          </h2>
          {loadingP && <span style={{ fontSize: "0.75rem", color: "var(--text3)" }}>Chargement...</span>}
        </div>
        {areaData.length === 0 && !loadingP ? (
          <div className="empty-state">
            <div className="empty-icon">📈</div>
            <p>Aucune activité sur cette période</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={areaData}>
              <defs>
                <linearGradient id="gradRdv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradConsult" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradOrdo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="Rendez-vous"   stroke="#f59e0b" strokeWidth={2} fill="url(#gradRdv)" dot={{ r: 2 }} />
              <Area type="monotone" dataKey="Consultations" stroke="#10b981" strokeWidth={2} fill="url(#gradConsult)" dot={{ r: 2 }} />
              <Area type="monotone" dataKey="Ordonnances"   stroke="#8b5cf6" strokeWidth={2} fill="url(#gradOrdo)" dot={{ r: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── 2 colonnes : RDV récents + statuts/répartition ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>

        {/* RDV récents */}
        <div className="card card-p">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>
              📅 Rendez-vous récents
            </h2>
            <span className="badge badge-blue">{stats?.rdv_planifies ?? 0} planifiés</span>
          </div>
          {rdvs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📅</div>
              <p>Aucun rendez-vous</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
              {rdvs.map((r) => {
                const [cls, lbl] = statutBadge(r.statut);
                return (
                  <div key={r.id} style={{
                    display: "flex", alignItems: "center", gap: "0.8rem",
                    padding: "0.75rem", borderRadius: 10,
                    background: "var(--bg)", border: "1px solid var(--border)",
                  }}>
                    <div className="avatar" style={{
                      background: "linear-gradient(135deg,#2563eb,#7c3aed)",
                      fontSize: "0.78rem",
                    }}>
                      {r.patient?.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: 600, fontSize: "0.85rem", color: "var(--text)",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {r.patient}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text3)" }}>
                        {r.medecin} · {new Date(r.date_heure).toLocaleString("fr-FR", {
                          day: "2-digit", month: "short",
                          hour: "2-digit", minute: "2-digit",
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

        {/* Colonne droite : donut + actions rapides */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

          {/* Statuts RDV / Répartition activité — donut + barres */}
          <div className="card card-p">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>
                📊 {donutMode === "statuts" ? "Statuts des rendez-vous" : "Répartition de l'activité"}
              </h2>
              <div style={{ display: "flex", gap: 4 }}>
                {[
                  { key: "statuts",      label: "Statuts" },
                  { key: "repartition",  label: "Répartition" },
                ].map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setDonutMode(m.key)}
                    style={{
                      padding: "3px 9px", borderRadius: 6, cursor: "pointer", fontSize: "0.7rem",
                      border: "1px solid", fontWeight: 500,
                      borderColor: donutMode === m.key ? "#2563eb" : "var(--border)",
                      background:  donutMode === m.key ? "#2563eb" : "var(--bg)",
                      color:       donutMode === m.key ? "#fff"    : "var(--text3)",
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Barres de progression — uniquement pertinentes pour les statuts globaux */}
            {donutMode === "statuts" && (
              [
                { label: "Planifiés", value: stats?.rdv_planifies, color: "#2563eb" },
                { label: "Confirmés", value: stats?.rdv_confirmes, color: "#10b981" },
                { label: "Annulés",   value: stats?.rdv_annules,   color: "#ef4444" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ marginBottom: "0.9rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                    <span style={{ fontSize: "0.82rem", color: "var(--text2)" }}>{label}</span>
                    <span style={{ fontSize: "0.82rem", fontWeight: 700, color }}>{value ?? 0}</span>
                  </div>
                  <div style={{ height: 6, background: "#f1f5f9", borderRadius: 10, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 10, background: color,
                      width: `${Math.min(((value ?? 0) / Math.max(totalRdv || 1, 1)) * 100, 100)}%`,
                      transition: "width 1s ease",
                    }} />
                  </div>
                </div>
              ))
            )}

            {/* Donut avec total au centre */}
            {activeDonutData.length > 0 && (
              <>
                <div style={{ borderTop: "1px solid var(--border)", margin: "0.75rem 0 0.5rem" }} />
                <p style={{ fontSize: "0.75rem", color: "var(--text3)", marginBottom: 4 }}>
                  Période sélectionnée
                </p>
                <div style={{ position: "relative" }}>
                  <ResponsiveContainer width="100%" height={130}>
                    <PieChart>
                      <Pie data={activeDonutData} cx="50%" cy="50%" innerRadius={34} outerRadius={54}
                        dataKey="value" paddingAngle={2}>
                        {activeDonutData.map((_, i) => (
                          <Cell key={i} fill={activeDonutColors[i % activeDonutColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ fontSize: 11 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{
                    position: "absolute", top: "44%", left: "50%",
                    transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "none",
                  }}>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text)" }}>{donutTotal}</div>
                    <div style={{ fontSize: "0.6rem", color: "var(--text3)" }}>total</div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Actions rapides */}
          <div className="card card-p">
            <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)", marginBottom: "1rem" }}>
              ⚡ Actions rapides
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {[
                { label: "Nouveau patient",       icon: "👤", path: "/patients" },
                { label: "Nouveau RDV",           icon: "📅", path: "/rendezvous" },
                { label: "Nouvelle consultation", icon: "🩺", path: "/consultations" },
              ].map(({ label, icon, path }) => (
                <a key={path} href={path} style={{
                  display: "flex", alignItems: "center", gap: "0.7rem",
                  padding: "0.65rem 0.9rem", borderRadius: 9,
                  border: "1px solid var(--border)", background: "var(--bg)",
                  textDecoration: "none", color: "var(--text2)",
                  fontSize: "0.85rem", fontWeight: 500, transition: "all 0.2s",
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#2563eb")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                >
                  <span>{icon}</span>
                  {label}
                  <span style={{ marginLeft: "auto", color: "var(--text3)" }}>→</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bar chart nouveaux patients + top médecins ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>

        {/* Bar chart nouveaux patients */}
        <div className="card card-p">
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)", marginBottom: "1rem" }}>
            🆕 Nouveaux patients
          </h2>
          {barData.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🆕</div>
              <p>Aucune donnée</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }} />
                <Bar dataKey="Nouveaux patients" fill="#2563eb" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="Nouveaux patients" position="top" style={{ fontSize: 10, fill: "#64748b" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top médecins — bar chart horizontal */}
        <div className="card card-p">
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)", marginBottom: "1rem" }}>
            🏆 Top médecins — consultations
          </h2>
          {topMedecinsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(topMedecinsData.length * 38, 160)}>
              <BarChart data={topMedecinsData} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis
                  type="category" dataKey="name" width={110}
                  tick={{ fontSize: 11, fill: "var(--text2)" }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }} />
                <Bar dataKey="consultations" radius={[0, 6, 6, 0]} barSize={16}>
                  {topMedecinsData.map((_, i) => (
                    <Cell key={i} fill={["#2563eb", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444"][i % 5]} />
                  ))}
                  <LabelList dataKey="consultations" position="right" style={{ fontSize: 11, fill: "var(--text)" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🩺</div>
              <p>Aucune donnée</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}