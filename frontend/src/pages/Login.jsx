import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";

export default function Login() {
  const [form, setForm] = useState({ name: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await API.post("/login", form);
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", res.data.name);
      localStorage.setItem("role", res.data.role);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Identifiants incorrects");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg, #1a237e 0%, #283593 50%, #1565c0 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          padding: "3rem 2.5rem",
          width: "100%",
          maxWidth: 420,
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>🏥</div>
          <h1
            style={{
              fontSize: "1.6rem",
              fontWeight: 800,
              color: "#1a237e",
              margin: 0,
            }}
          >
            CliniqueApp
          </h1>
          <p
            style={{
              color: "#64748b",
              fontSize: "0.9rem",
              marginTop: "0.4rem",
            }}
          >
            Système de gestion de clinique
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1.2rem" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "#374151",
                marginBottom: "0.4rem",
              }}
            >
              Nom d'utilisateur
            </label>
            <input
              type="text"
              placeholder="admin"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                fontSize: "0.95rem",
                outline: "none",
                boxSizing: "border-box",
                transition: "border 0.2s",
              }}
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "#374151",
                marginBottom: "0.4rem",
              }}
            >
              Mot de passe
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                fontSize: "0.95rem",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#dc2626",
                padding: "0.75rem 1rem",
                borderRadius: 8,
                fontSize: "0.85rem",
                marginBottom: "1rem",
              }}
            >
              ❌ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "0.85rem",
              background: loading
                ? "#94a3b8"
                : "linear-gradient(135deg, #1a237e, #1565c0)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: "1rem",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.2s",
            }}
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <div
          style={{
            textAlign: "center",
            marginTop: "1.5rem",
            color: "#94a3b8",
            fontSize: "0.78rem",
          }}
        >
          🔒 Connexion sécurisée — JWT + bcrypt
        </div>
      </div>
    </div>
  );
}
