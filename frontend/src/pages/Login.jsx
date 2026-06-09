import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";

export default function Login() {
  const [mode, setMode]       = useState("login"); // "login" | "register"
  const [form, setForm]       = useState({ name: "", password: "", confirm: "", role: "secretaire", email: "" });
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate              = useNavigate();

  const reset = () => {
    setForm({ name: "", password: "", confirm: "", role: "secretaire", email: "" });
    setError("");
    setSuccess("");
  };

  const switchMode = (m) => { setMode(m); reset(); };

  /* ─────────────── LOGIN ─────────────── */
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      // 👇 Décommente pour débugger l'URL si ça ne marche toujours pas
      // console.log("🔗 API base URL:", API.defaults.baseURL);
      const res = await API.post("/login", {
        name:     form.name.trim(),
        password: form.password,
      });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user",  res.data.name);
      localStorage.setItem("role",  res.data.role);
      navigate("/");
    } catch (err) {
      // Affiche le vrai message FastAPI (validation Pydantic, 401, etc.)
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map((d) => d.msg).join(" | "));
      } else {
        setError(detail || err.message || "Identifiants incorrects");
      }
      console.error("❌ Login error:", err.response?.status, err.response?.data);
    } finally {
      setLoading(false);
    }
  };

  /* ─────────────── REGISTER ─────────────── */
  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (form.password !== form.confirm) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }
    if (form.password.length < 6) {
      setError("Mot de passe trop court (6 caractères minimum)");
      return;
    }
    setLoading(true);
    try {
      await API.post("/users/public", {
        name:     form.name.trim(),
        password: form.password,
        role:     form.role,
        email:    form.email.trim() || undefined,
      });
      setSuccess("✅ Compte créé ! Tu peux maintenant te connecter.");
      setTimeout(() => { setMode("login"); reset(); }, 2000);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map((d) => d.msg).join(" | "));
      } else {
        setError(detail || err.message || "Erreur lors de la création du compte");
      }
      console.error("❌ Register error:", err.response?.status, err.response?.data);
    } finally {
      setLoading(false);
    }
  };

  /* ─────────────── RENDER ─────────────── */
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg,#0a0f1e 0%,#1a237e 50%,#0d1320 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "1rem",
    }}>
      {/* Blobs décoratifs */}
      <div style={{ position:"fixed", width:500, height:500, borderRadius:"50%", background:"#2563eb", filter:"blur(120px)", opacity:0.08, top:-100, right:-100, pointerEvents:"none" }} />
      <div style={{ position:"fixed", width:350, height:350, borderRadius:"50%", background:"#7c3aed", filter:"blur(120px)", opacity:0.08, bottom:-100, left:-100, pointerEvents:"none" }} />

      <div style={{
        background: "rgba(255,255,255,0.03)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20, padding: "2.5rem",
        width: "100%", maxWidth: 440,
        boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        position: "relative", zIndex: 1,
      }}>

        {/* ── Header ── */}
        <div style={{ textAlign:"center", marginBottom:"2rem" }}>
          <div style={{
            width:56, height:56, borderRadius:16, margin:"0 auto 1rem",
            background:"linear-gradient(135deg,#2563eb,#1d4ed8)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:"1.6rem", boxShadow:"0 4px 20px rgba(37,99,235,0.4)",
          }}>🏥</div>
          <h1 style={{ color:"#fff", fontWeight:800, fontSize:"1.4rem", letterSpacing:"-0.02em" }}>CliniqueApp</h1>
          <p style={{ color:"rgba(255,255,255,0.4)", fontSize:"0.82rem", marginTop:"0.3rem" }}>
            Système de gestion de clinique
          </p>
        </div>

        {/* ── Toggle Se connecter / Créer un compte ── */}
        <div style={{
          display:"flex", background:"rgba(255,255,255,0.05)", borderRadius:10,
          padding:"0.25rem", marginBottom:"1.8rem",
          border:"1px solid rgba(255,255,255,0.07)",
        }}>
          {[
            { key:"login",    label:"🔐 Se connecter"   },
            { key:"register", label:"✨ Créer un compte" },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"                      /* ← évite submit accidentel */
              onClick={() => switchMode(key)}
              style={{
                flex:1, padding:"0.55rem", border:"none", borderRadius:8,
                cursor:"pointer", fontWeight:600, fontSize:"0.85rem",
                transition:"all 0.2s",
                background: mode === key ? "#2563eb"              : "transparent",
                color:      mode === key ? "#fff"                 : "rgba(255,255,255,0.45)",
                boxShadow:  mode === key ? "0 2px 8px rgba(37,99,235,0.4)" : "none",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Messages erreur / succès ── */}
        {error && (
          <div style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", color:"#fca5a5", padding:"0.75rem 1rem", borderRadius:9, fontSize:"0.85rem", marginBottom:"1rem" }}>
            ❌ {error}
          </div>
        )}
        {success && (
          <div style={{ background:"rgba(16,185,129,0.1)", border:"1px solid rgba(16,185,129,0.3)", color:"#6ee7b7", padding:"0.75rem 1rem", borderRadius:9, fontSize:"0.85rem", marginBottom:"1rem" }}>
            {success}
          </div>
        )}

        {/* ══════════════ FORMULAIRE LOGIN ══════════════ */}
        {mode === "login" && (
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom:"1rem" }}>
              <label style={labelStyle}>NOM D'UTILISATEUR</label>
              <input
                type="text" placeholder="admin" value={form.name} required
                autoComplete="username"
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom:"1.5rem" }}>
              <label style={labelStyle}>MOT DE PASSE</label>
              <input
                type="password" placeholder="••••••••" value={form.password} required
                autoComplete="current-password"
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                style={inputStyle}
              />
            </div>
            <button type="submit" disabled={loading} style={btnStyle(loading)}>
              {loading ? "Connexion en cours..." : "Se connecter →"}
            </button>
            <div style={{ textAlign:"center", marginTop:"1.2rem", color:"rgba(255,255,255,0.25)", fontSize:"0.75rem" }}>
              🔒 Connexion sécurisée — JWT + bcrypt
            </div>
          </form>
        )}

        {/* ══════════════ FORMULAIRE REGISTER ══════════════ */}
        {mode === "register" && (
          <form onSubmit={handleRegister}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.8rem", marginBottom:"0.8rem" }}>

              <div style={{ gridColumn:"span 2" }}>
                <label style={labelStyle}>NOM D'UTILISATEUR *</label>
                <input
                  type="text" placeholder="ex: dr.diallo" value={form.name} required
                  autoComplete="username"
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div style={{ gridColumn:"span 2" }}>
                <label style={labelStyle}>EMAIL</label>
                <input
                  type="email" placeholder="email@clinique.com" value={form.email}
                  autoComplete="email"
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>MOT DE PASSE *</label>
                <input
                  type="password" placeholder="••••••" value={form.password} required
                  autoComplete="new-password"
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>CONFIRMER *</label>
                <input
                  type="password" placeholder="••••••" value={form.confirm} required
                  autoComplete="new-password"
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div style={{ gridColumn:"span 2" }}>
                <label style={labelStyle}>RÔLE</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  style={inputStyle}
                >
                  <option value="secretaire">Secrétaire</option>
                  <option value="medecin">Médecin</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

            </div>
            <button type="submit" disabled={loading} style={btnStyle(loading)}>
              {loading ? "Création en cours..." : "Créer mon compte →"}
            </button>
            <div style={{ textAlign:"center", marginTop:"1rem", color:"rgba(255,255,255,0.25)", fontSize:"0.75rem" }}>
              Le compte doit être approuvé par un admin
            </div>
          </form>
        )}

      </div>
    </div>
  );
}

/* ─────────────── Styles partagés ─────────────── */
const inputStyle = {
  width: "100%", padding: "0.7rem 0.9rem",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 9, fontSize: "0.88rem",
  color: "#e8edf5", outline: "none",
  boxSizing: "border-box", fontFamily: "inherit",
  transition: "border-color 0.2s",
};

const labelStyle = {
  display: "block", fontSize: "0.72rem", fontWeight: 600,
  color: "rgba(255,255,255,0.5)", marginBottom: "0.35rem",
  letterSpacing: "0.06em",
};

const btnStyle = (loading) => ({
  width: "100%", padding: "0.85rem",
  background: loading ? "#475569" : "linear-gradient(135deg,#2563eb,#1d4ed8)",
  color: "#fff", border: "none", borderRadius: 9,
  fontSize: "0.95rem", fontWeight: 700,
  cursor: loading ? "not-allowed" : "pointer",
  transition: "all 0.2s",
  boxShadow: loading ? "none" : "0 4px 16px rgba(37,99,235,0.4)",
  fontFamily: "inherit",
});