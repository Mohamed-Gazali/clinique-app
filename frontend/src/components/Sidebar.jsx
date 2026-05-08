import { useNavigate, useLocation } from "react-router-dom";

const NAV = [
  { path: "/",           icon: "📊", label: "Dashboard"    },
  { path: "/patients",   icon: "👤", label: "Patients"     },
  { path: "/medecins",   icon: "👨‍⚕️", label: "Médecins"    },
  { path: "/rendezvous", icon: "📅", label: "Rendez-vous"  },
  { path: "/consultations", icon: "🩺", label: "Consultations" },
];

export default function Sidebar({ counts = {} }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const user      = localStorage.getItem("user") || "Admin";
  const role      = localStorage.getItem("role") || "admin";
  const initials  = user.slice(0, 2).toUpperCase();

  const logout = () => { localStorage.clear(); navigate("/login"); };

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🏥</div>
        <h2>CliniqueApp</h2>
        <p>Système de gestion</p>
      </div>

      {/* Navigation */}
      <div className="sidebar-section-label">Menu principal</div>
      <nav className="sidebar-nav">
        {NAV.map(({ path, icon, label }) => (
          <button
            key={path}
            className={`nav-item ${location.pathname === path ? "active" : ""}`}
            onClick={() => navigate(path)}
          >
            <span className="nav-icon">{icon}</span>
            <span style={{ flex: 1 }}>{label}</span>
            {counts[path] > 0 && (
              <span className="nav-badge">{counts[path]}</span>
            )}
          </button>
        ))}
      </nav>

      {/* User */}
      <div className="sidebar-user">
        <div className="user-avatar">{initials}</div>
        <div className="user-info">
          <div className="user-name">{user}</div>
          <div className="user-role">{role}</div>
        </div>
        <button className="logout-btn" onClick={logout} title="Déconnexion">
          ↩
        </button>
      </div>
    </aside>
  );
}