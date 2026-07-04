// src/pages/Parametres.jsx
import { useState, useEffect } from "react";
import API from "../api";

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const DEVISES = ["FCFA", "EUR", "USD", "MAD", "XOF", "XAF"];

const TABS = [
  { key: "general",    label: "🏥 Clinique" },
  { key: "rdv",         label: "📅 Rendez-vous" },
  { key: "utilisateurs", label: "👥 Utilisateurs" },
  { key: "compte",      label: "🔐 Mon compte" },
  { key: "apparence",   label: "🎨 Apparence" },
];

function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text2)", marginBottom: 6 }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: 4 }}>{hint}</p>}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "0.55rem 0.75rem", borderRadius: 8,
  border: "1px solid var(--border)", fontSize: "0.85rem",
  fontFamily: "inherit", background: "var(--card, #fff)", color: "var(--text)",
};

function Toast({ msg, type }) {
  if (!msg) return null;
  const color = type === "error" ? "#ef4444" : "#10b981";
  const bg    = type === "error" ? "#fef2f2" : "#f0fdf4";
  return (
    <div style={{
      padding: "0.6rem 0.9rem", borderRadius: 8, background: bg, color,
      fontSize: "0.82rem", fontWeight: 600, marginBottom: "1rem",
    }}>
      {type === "error" ? "⚠️ " : "✅ "}{msg}
    </div>
  );
}

function SaveButton({ onClick, saving, label = "Enregistrer" }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      style={{
        padding: "0.6rem 1.3rem", borderRadius: 8, border: "none",
        background: "#2563eb", color: "#fff", fontSize: "0.85rem", fontWeight: 600,
        cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1,
      }}
    >
      {saving ? "Enregistrement..." : label}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Onglet — Infos générales de la clinique
// ═══════════════════════════════════════════════════════════════════
function OngletGeneral({ isAdmin }) {
  const [data, setData]     = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast]   = useState({ msg: "", type: "success" });

  useEffect(() => {
    API.get("/settings/clinique").then((r) => setData(r.data));
  }, []);

  const set = (key) => (e) => setData({ ...data, [key]: e.target.value });

  const submit = async () => {
    setSaving(true);
    try {
      const r = await API.put("/settings/clinique", data);
      setData(r.data);
      setToast({ msg: "Informations de la clinique mises à jour.", type: "success" });
    } catch (e) {
      setToast({ msg: e?.response?.data?.detail || "Erreur lors de l'enregistrement", type: "error" });
    } finally {
      setSaving(false);
      setTimeout(() => setToast({ msg: "" }), 3500);
    }
  };

  if (!data) return <p style={{ color: "var(--text3)", fontSize: "0.85rem" }}>Chargement...</p>;

  return (
    <div className="card card-p">
      <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1.2rem" }}>Informations de la clinique</h2>
      <Toast {...toast} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 1.5rem" }}>
        <Field label="Nom de la clinique">
          <input style={inputStyle} value={data.nom_clinique || ""} onChange={set("nom_clinique")} disabled={!isAdmin} />
        </Field>
        <Field label="Téléphone">
          <input style={inputStyle} value={data.telephone || ""} onChange={set("telephone")} disabled={!isAdmin} />
        </Field>
        <Field label="Email">
          <input style={inputStyle} type="email" value={data.email || ""} onChange={set("email")} disabled={!isAdmin} />
        </Field>
        <Field label="Site web">
          <input style={inputStyle} value={data.site_web || ""} onChange={set("site_web")} disabled={!isAdmin} placeholder="https://..." />
        </Field>
        <Field label="Adresse" hint="Affichée sur les ordonnances et documents imprimés">
          <input style={inputStyle} value={data.adresse || ""} onChange={set("adresse")} disabled={!isAdmin} />
        </Field>
        <Field label="Logo (URL)">
          <input style={inputStyle} value={data.logo_url || ""} onChange={set("logo_url")} disabled={!isAdmin} placeholder="https://..." />
        </Field>
        <Field label="Devise">
          <select style={inputStyle} value={data.devise} onChange={set("devise")} disabled={!isAdmin}>
            {DEVISES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Fuseau horaire">
          <input style={inputStyle} value={data.fuseau_horaire || ""} onChange={set("fuseau_horaire")} disabled={!isAdmin} />
        </Field>
      </div>
      {isAdmin ? (
        <SaveButton onClick={submit} saving={saving} />
      ) : (
        <p style={{ fontSize: "0.78rem", color: "var(--text3)" }}>
          Seul un administrateur peut modifier ces informations.
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Onglet — Paramètres des rendez-vous
// ═══════════════════════════════════════════════════════════════════
function OngletRdv({ isAdmin }) {
  const [data, setData]     = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast]   = useState({ msg: "", type: "success" });

  useEffect(() => {
    API.get("/settings/clinique").then((r) => setData(r.data));
  }, []);

  const joursActifs = data ? (data.jours_ouverture || "").split(",").filter(Boolean) : [];

  const toggleJour = (j) => {
    const set = new Set(joursActifs);
    set.has(j) ? set.delete(j) : set.add(j);
    setData({ ...data, jours_ouverture: JOURS.filter((d) => set.has(d)).join(",") });
  };

  const submit = async () => {
    setSaving(true);
    try {
      const r = await API.put("/settings/clinique", data);
      setData(r.data);
      setToast({ msg: "Paramètres de rendez-vous mis à jour.", type: "success" });
    } catch (e) {
      setToast({ msg: e?.response?.data?.detail || "Erreur lors de l'enregistrement", type: "error" });
    } finally {
      setSaving(false);
      setTimeout(() => setToast({ msg: "" }), 3500);
    }
  };

  if (!data) return <p style={{ color: "var(--text3)", fontSize: "0.85rem" }}>Chargement...</p>;

  return (
    <div className="card card-p">
      <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1.2rem" }}>Horaires et rendez-vous</h2>
      <Toast {...toast} />

      <Field label="Jours d'ouverture">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {JOURS.map((j) => (
            <button
              key={j}
              disabled={!isAdmin}
              onClick={() => toggleJour(j)}
              style={{
                padding: "6px 14px", borderRadius: 8, fontSize: "0.8rem", fontWeight: 500,
                border: "1px solid", cursor: isAdmin ? "pointer" : "default",
                borderColor: joursActifs.includes(j) ? "#2563eb" : "var(--border)",
                background:  joursActifs.includes(j) ? "#2563eb" : "var(--bg)",
                color:       joursActifs.includes(j) ? "#fff"    : "var(--text2)",
              }}
            >
              {j}
            </button>
          ))}
        </div>
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 1.5rem" }}>
        <Field label="Heure d'ouverture">
          <input style={inputStyle} type="time" value={data.horaire_ouverture || ""}
            onChange={(e) => setData({ ...data, horaire_ouverture: e.target.value })} disabled={!isAdmin} />
        </Field>
        <Field label="Heure de fermeture">
          <input style={inputStyle} type="time" value={data.horaire_fermeture || ""}
            onChange={(e) => setData({ ...data, horaire_fermeture: e.target.value })} disabled={!isAdmin} />
        </Field>
        <Field label="Durée par défaut d'un rendez-vous" hint="En minutes">
          <input style={inputStyle} type="number" min={5} step={5} value={data.duree_rdv_defaut}
            onChange={(e) => setData({ ...data, duree_rdv_defaut: Number(e.target.value) })} disabled={!isAdmin} />
        </Field>
        <Field label="Délai minimum d'annulation" hint="En heures avant le rendez-vous">
          <input style={inputStyle} type="number" min={0} value={data.delai_annulation_h}
            onChange={(e) => setData({ ...data, delai_annulation_h: Number(e.target.value) })} disabled={!isAdmin} />
        </Field>
      </div>

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.8rem 1rem", background: "var(--bg)", borderRadius: 10,
        border: "1px solid var(--border)", marginBottom: "1rem",
      }}>
        <div>
          <p style={{ fontSize: "0.85rem", fontWeight: 600 }}>Rappels automatiques</p>
          <p style={{ fontSize: "0.75rem", color: "var(--text3)" }}>
            Envoyer un rappel avant chaque rendez-vous planifié
          </p>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: isAdmin ? "pointer" : "default" }}>
          <input
            type="checkbox"
            checked={!!data.rappel_rdv_actif}
            disabled={!isAdmin}
            onChange={(e) => setData({ ...data, rappel_rdv_actif: e.target.checked })}
          />
          {data.rappel_rdv_actif && (
            <input
              style={{ ...inputStyle, width: 70, padding: "0.35rem 0.5rem" }}
              type="number" min={1} value={data.rappel_rdv_heures_avant}
              disabled={!isAdmin}
              onChange={(e) => setData({ ...data, rappel_rdv_heures_avant: Number(e.target.value) })}
            />
          )}
          {data.rappel_rdv_actif && <span style={{ fontSize: "0.75rem", color: "var(--text3)" }}>h avant</span>}
        </label>
      </div>

      {isAdmin ? (
        <SaveButton onClick={submit} saving={saving} />
      ) : (
        <p style={{ fontSize: "0.78rem", color: "var(--text3)" }}>
          Seul un administrateur peut modifier ces paramètres.
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Onglet — Gestion des utilisateurs (admin uniquement)
// ═══════════════════════════════════════════════════════════════════
function OngletUtilisateurs({ currentUserId }) {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast]     = useState({ msg: "", type: "success" });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", password: "", role: "secretaire", email: "" });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    API.get("/users").then((r) => setUsers(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const notify = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "" }), 3500);
  };

  const createUser = async () => {
    if (!form.name || form.password.length < 6) {
      notify("Nom requis et mot de passe d'au moins 6 caractères", "error");
      return;
    }
    setSaving(true);
    try {
      await API.post("/users", form);
      setForm({ name: "", password: "", role: "secretaire", email: "" });
      setShowForm(false);
      load();
      notify("Utilisateur créé avec succès.");
    } catch (e) {
      notify(e?.response?.data?.detail || "Erreur lors de la création", "error");
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (id, role) => {
    try {
      await API.put(`/users/${id}`, { role });
      load();
      notify("Rôle mis à jour.");
    } catch (e) {
      notify(e?.response?.data?.detail || "Erreur", "error");
    }
  };

  const removeUser = async (id, name) => {
    if (!confirm(`Supprimer l'utilisateur "${name}" ? Cette action est irréversible.`)) return;
    try {
      await API.delete(`/users/${id}`);
      load();
      notify("Utilisateur supprimé.");
    } catch (e) {
      notify(e?.response?.data?.detail || "Erreur", "error");
    }
  };

  const roleBadge = (role) => {
    const map = {
      admin:       ["#8b5cf6", "#f5f3ff", "Administrateur"],
      medecin:     ["#10b981", "#f0fdf4", "Médecin"],
      secretaire:  ["#2563eb", "#eff6ff", "Secrétaire"],
    };
    const [color, bg, label] = map[role] || ["#6b7280", "#f3f4f6", role];
    return <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: "0.72rem", fontWeight: 600, color, background: bg }}>{label}</span>;
  };

  return (
    <div className="card card-p">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700 }}>Utilisateurs ({users.length})</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          style={{
            padding: "0.5rem 1rem", borderRadius: 8, border: "none",
            background: "#2563eb", color: "#fff", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
          }}
        >
          {showForm ? "Annuler" : "+ Nouvel utilisateur"}
        </button>
      </div>

      <Toast {...toast} />

      {showForm && (
        <div style={{
          background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10,
          padding: "1rem", marginBottom: "1.2rem",
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 1.2rem" }}>
            <Field label="Nom d'utilisateur">
              <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Email">
              <input style={inputStyle} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Mot de passe" hint="6 caractères minimum">
              <input style={inputStyle} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
            <Field label="Rôle">
              <select style={inputStyle} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="secretaire">Secrétaire</option>
                <option value="medecin">Médecin</option>
                <option value="admin">Administrateur</option>
              </select>
            </Field>
          </div>
          <SaveButton onClick={createUser} saving={saving} label="Créer l'utilisateur" />
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: "0.85rem", color: "var(--text3)" }}>Chargement...</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr>
                {["Nom", "Email", "Rôle", ""].map((h) => (
                  <th key={h} style={{
                    textAlign: "left", padding: "8px 10px", color: "var(--text3)",
                    fontWeight: 500, fontSize: "0.75rem", borderBottom: "1px solid var(--border)",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ padding: "10px", borderBottom: "1px solid var(--border)", fontWeight: 600 }}>
                    {u.name} {u.id === currentUserId && <span style={{ color: "var(--text3)", fontWeight: 400 }}>(vous)</span>}
                  </td>
                  <td style={{ padding: "10px", borderBottom: "1px solid var(--border)", color: "var(--text3)" }}>
                    {u.email || "—"}
                  </td>
                  <td style={{ padding: "10px", borderBottom: "1px solid var(--border)" }}>
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u.id, e.target.value)}
                      disabled={u.id === currentUserId}
                      style={{ ...inputStyle, width: "auto", padding: "4px 8px", fontSize: "0.78rem" }}
                    >
                      <option value="secretaire">Secrétaire</option>
                      <option value="medecin">Médecin</option>
                      <option value="admin">Administrateur</option>
                    </select>
                  </td>
                  <td style={{ padding: "10px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>
                    {u.id !== currentUserId && (
                      <button
                        onClick={() => removeUser(u.id, u.name)}
                        style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontSize: "0.8rem" }}
                      >
                        Supprimer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Onglet — Mon compte (profil + mot de passe)
// ═══════════════════════════════════════════════════════════════════
function OngletCompte({ currentUserId, userName }) {
  const [pwd, setPwd] = useState({ ancien: "", nouveau: "", confirmation: "" });
  const [saving, setSaving] = useState(false);
  const [toast, setToast]   = useState({ msg: "", type: "success" });

  const submit = async () => {
    if (pwd.nouveau.length < 6) {
      setToast({ msg: "Le nouveau mot de passe doit contenir au moins 6 caractères", type: "error" });
      return;
    }
    if (pwd.nouveau !== pwd.confirmation) {
      setToast({ msg: "Les deux mots de passe ne correspondent pas", type: "error" });
      return;
    }
    setSaving(true);
    try {
      await API.put(`/users/${currentUserId}/password`, {
        ancien_mot_de_passe: pwd.ancien,
        nouveau_mot_de_passe: pwd.nouveau,
      });
      setPwd({ ancien: "", nouveau: "", confirmation: "" });
      setToast({ msg: "Mot de passe mis à jour avec succès.", type: "success" });
    } catch (e) {
      setToast({ msg: e?.response?.data?.detail || "Erreur lors de la mise à jour", type: "error" });
    } finally {
      setSaving(false);
      setTimeout(() => setToast({ msg: "" }), 3500);
    }
  };

  return (
    <div className="card card-p">
      <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.3rem" }}>Mon compte</h2>
      <p style={{ fontSize: "0.8rem", color: "var(--text3)", marginBottom: "1.2rem" }}>
        Connecté en tant que <strong>{userName}</strong>
      </p>

      <Toast {...toast} />

      <h3 style={{ fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.8rem" }}>Changer le mot de passe</h3>
      <div style={{ maxWidth: 380 }}>
        <Field label="Mot de passe actuel">
          <input style={inputStyle} type="password" value={pwd.ancien}
            onChange={(e) => setPwd({ ...pwd, ancien: e.target.value })} />
        </Field>
        <Field label="Nouveau mot de passe" hint="6 caractères minimum">
          <input style={inputStyle} type="password" value={pwd.nouveau}
            onChange={(e) => setPwd({ ...pwd, nouveau: e.target.value })} />
        </Field>
        <Field label="Confirmer le nouveau mot de passe">
          <input style={inputStyle} type="password" value={pwd.confirmation}
            onChange={(e) => setPwd({ ...pwd, confirmation: e.target.value })} />
        </Field>
        <SaveButton onClick={submit} saving={saving} label="Mettre à jour le mot de passe" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Onglet — Apparence
// ═══════════════════════════════════════════════════════════════════
function OngletApparence() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "clair");

  const applyTheme = (t) => {
    setTheme(t);
    localStorage.setItem("theme", t);
    document.documentElement.setAttribute("data-theme", t === "sombre" ? "dark" : "light");
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme === "sombre" ? "dark" : "light");
  }, []);

  return (
    <div className="card card-p">
      <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1.2rem" }}>Apparence</h2>
      <Field label="Thème de l'interface">
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { key: "clair",  label: "☀️ Clair" },
            { key: "sombre", label: "🌙 Sombre" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => applyTheme(t.key)}
              style={{
                padding: "0.6rem 1.2rem", borderRadius: 8, cursor: "pointer", fontSize: "0.85rem",
                border: "1px solid", fontWeight: 500,
                borderColor: theme === t.key ? "#2563eb" : "var(--border)",
                background:  theme === t.key ? "#2563eb" : "var(--bg)",
                color:       theme === t.key ? "#fff"    : "var(--text2)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Field>
      <p style={{ fontSize: "0.75rem", color: "var(--text3)" }}>
        Nécessite que les variables CSS <code>--bg</code>, <code>--card</code>, <code>--text</code>, <code>--border</code>
        soient définies pour <code>[data-theme="dark"]</code> dans votre feuille de style globale.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Page principale
// ═══════════════════════════════════════════════════════════════════
export default function Parametres() {
  const [tab, setTab] = useState("general");
  const [me, setMe]   = useState(null);

  useEffect(() => {
    API.get("/users/me").then((r) => setMe(r.data)).catch(() => setMe(null));
  }, []);

  const isAdmin = me?.role === "admin";

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">⚙️ Paramètres</h1>
          <p className="page-subtitle">Configuration de la clinique et de votre compte</p>
        </div>
      </div>

      {/* Onglets */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: "1.5rem" }}>
        {TABS.filter((t) => t.key !== "utilisateurs" || isAdmin).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: "0.82rem",
              border: "1px solid", fontWeight: 500,
              borderColor: tab === t.key ? "#2563eb" : "var(--border)",
              background:  tab === t.key ? "#2563eb" : "var(--bg)",
              color:       tab === t.key ? "#fff"    : "var(--text2)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!me ? (
        <p style={{ color: "var(--text3)", fontSize: "0.85rem" }}>Chargement...</p>
      ) : (
        <>
          {tab === "general"       && <OngletGeneral isAdmin={isAdmin} />}
          {tab === "rdv"            && <OngletRdv isAdmin={isAdmin} />}
          {tab === "utilisateurs"   && isAdmin && <OngletUtilisateurs currentUserId={me.id} />}
          {tab === "compte"         && <OngletCompte currentUserId={me.id} userName={me.name} />}
          {tab === "apparence"      && <OngletApparence />}
        </>
      )}
    </div>
  );
}