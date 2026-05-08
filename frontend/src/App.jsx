import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import Sidebar       from "./components/Sidebar";
import Login         from "./pages/Login";
import Dashboard     from "./pages/Dashboard";
import Patients      from "./pages/Patients";
import Medecins      from "./pages/Medecins";
import RendezVous    from "./pages/RendezVous";
import Consultations from "./pages/Consultations";
import API           from "./api";

function PrivateRoute({ children }) {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" replace />;
}

function Layout({ children }) {
  const [counts, setCounts] = useState({});

  useEffect(() => {
    // Badge compteurs pour la sidebar
    Promise.all([
      API.get("/rendezvous").catch(() => ({ data: [] })),
    ]).then(([rdvRes]) => {
      const rdvPlanifies = rdvRes.data.filter((r) => r.statut === "planifie").length;
      setCounts({ "/rendezvous": rdvPlanifies });
    });
  }, []);

  return (
    <div className="app-layout">
      <Sidebar counts={counts} />
      <main className="main-content">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
        <Route path="/patients" element={<PrivateRoute><Layout><Patients /></Layout></PrivateRoute>} />
        <Route path="/medecins" element={<PrivateRoute><Layout><Medecins /></Layout></PrivateRoute>} />
        <Route path="/rendezvous" element={<PrivateRoute><Layout><RendezVous /></Layout></PrivateRoute>} />
        <Route path="/consultations" element={<PrivateRoute><Layout><Consultations /></Layout></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}