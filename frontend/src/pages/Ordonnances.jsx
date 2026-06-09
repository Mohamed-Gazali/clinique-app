import { useState, useEffect } from "react";
import API from "../api";

// ─── helpers ────────────────────────────────────────────────────────────────
function authHeader() {
  return ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });
}

const today = () => new Date().toLocaleDateString("fr-FR", {
  day: "2-digit", month: "long", year: "numeric",
});

// ─── sous-composant : formulaire de rédaction ────────────────────────────────
function FormulaireOrdonnance({ patients, medecins, consultations, onSaved, onCancel }) {
  const [form, setForm] = useState({
    patient_id: "",
    medecin_id: "",
    consultation_id: "",
    diagnostic: "",
    duree_traitement: "",
    prochain_rdv: "",
    instructions: "",
  });
  const [medicaments, setMedicaments] = useState([
    { nom: "", dosage: "", frequence: "", duree: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const updateMed = (i, field, val) => {
    const copy = [...medicaments];
    copy[i] = { ...copy[i], [field]: val };
    setMedicaments(copy);
  };
  const addMed = () =>
    setMedicaments([...medicaments, { nom: "", dosage: "", frequence: "", duree: "" }]);
  const removeMed = (i) => setMedicaments(medicaments.filter((_, j) => j !== i));

  const handleSubmit = async () => {
    if (!form.patient_id || !form.medecin_id) {
      setError("Patient et médecin obligatoires.");
      return;
    }
    if (medicaments.every((m) => !m.nom.trim())) {
      setError("Ajoutez au moins un médicament.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${API}/ordonnances`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({
          ...form,
          patient_id: Number(form.patient_id),
          medecin_id: Number(form.medecin_id),
          consultation_id: Number(form.consultation_id) || 0,
          medicaments: JSON.stringify(medicaments.filter((m) => m.nom.trim())),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || "Erreur serveur");
      }
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <span style={{ fontSize: 18, fontWeight: 500, color: "var(--color-text-primary)" }}>
          Nouvelle ordonnance
        </span>
        <button onClick={onCancel} style={styles.btnGhost}>✕ Annuler</button>
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}

      {/* Section patient / médecin */}
      <div style={styles.grid2}>
        <label style={styles.label}>
          Patient *
          <select
            value={form.patient_id}
            onChange={(e) => setForm({ ...form, patient_id: e.target.value })}
            style={styles.select}
          >
            <option value="">— sélectionner —</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.prenom} {p.nom}
              </option>
            ))}
          </select>
        </label>
        <label style={styles.label}>
          Médecin *
          <select
            value={form.medecin_id}
            onChange={(e) => setForm({ ...form, medecin_id: e.target.value })}
            style={styles.select}
          >
            <option value="">— sélectionner —</option>
            {medecins.map((m) => (
              <option key={m.id} value={m.id}>
                Dr. {m.prenom} {m.nom} — {m.specialite}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={styles.grid2}>
        <label style={styles.label}>
          Consultation liée
          <select
            value={form.consultation_id}
            onChange={(e) => setForm({ ...form, consultation_id: e.target.value })}
            style={styles.select}
          >
            <option value="">— aucune —</option>
            {consultations.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.id} — {new Date(c.date).toLocaleDateString("fr-FR")}
              </option>
            ))}
          </select>
        </label>
        <label style={styles.label}>
          Durée du traitement
          <input
            style={styles.input}
            placeholder="ex : 7 jours, 1 mois"
            value={form.duree_traitement}
            onChange={(e) => setForm({ ...form, duree_traitement: e.target.value })}
          />
        </label>
      </div>

      <label style={styles.label}>
        Diagnostic
        <input
          style={styles.input}
          placeholder="Diagnostic principal"
          value={form.diagnostic}
          onChange={(e) => setForm({ ...form, diagnostic: e.target.value })}
        />
      </label>

      {/* Médicaments */}
      <div style={styles.sectionTitle}>
        <span>Médicaments</span>
        <button onClick={addMed} style={styles.btnSmall}>+ Ajouter</button>
      </div>

      {medicaments.map((med, i) => (
        <div key={i} style={styles.medRow}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={styles.medBadge}>{i + 1}</span>
            <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Médicament {i + 1}</span>
            {medicaments.length > 1 && (
              <button onClick={() => removeMed(i)} style={styles.btnRemove}>✕</button>
            )}
          </div>
          <div style={styles.grid4}>
            <label style={styles.label}>
              Nom *
              <input
                style={styles.input}
                placeholder="Amoxicilline"
                value={med.nom}
                onChange={(e) => updateMed(i, "nom", e.target.value)}
              />
            </label>
            <label style={styles.label}>
              Dosage
              <input
                style={styles.input}
                placeholder="500 mg"
                value={med.dosage}
                onChange={(e) => updateMed(i, "dosage", e.target.value)}
              />
            </label>
            <label style={styles.label}>
              Fréquence
              <input
                style={styles.input}
                placeholder="3×/jour"
                value={med.frequence}
                onChange={(e) => updateMed(i, "frequence", e.target.value)}
              />
            </label>
            <label style={styles.label}>
              Durée
              <input
                style={styles.input}
                placeholder="7 jours"
                value={med.duree}
                onChange={(e) => updateMed(i, "duree", e.target.value)}
              />
            </label>
          </div>
        </div>
      ))}

      <label style={styles.label}>
        Instructions au patient
        <textarea
          style={{ ...styles.input, height: 72, resize: "vertical" }}
          placeholder="Prendre avant les repas, éviter l'alcool…"
          value={form.instructions}
          onChange={(e) => setForm({ ...form, instructions: e.target.value })}
        />
      </label>

      <label style={styles.label}>
        Prochain rendez-vous
        <input
          type="date"
          style={styles.input}
          value={form.prochain_rdv}
          onChange={(e) => setForm({ ...form, prochain_rdv: e.target.value })}
        />
      </label>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
        <button onClick={onCancel} style={styles.btnGhost}>Annuler</button>
        <button onClick={handleSubmit} disabled={saving} style={styles.btnPrimary}>
          {saving ? "Enregistrement…" : "Enregistrer l'ordonnance"}
        </button>
      </div>
    </div>
  );
}

// ─── sous-composant : aperçu imprimable ─────────────────────────────────────
function AperçuOrdonnance({ ordo, patient, medecin, onClose }) {
  const meds = (() => {
    try { return JSON.parse(ordo.medicaments); }
    catch { return [{ nom: ordo.medicaments }]; }
  })();

  const imprimer = () => window.print();

  return (
    <div style={styles.overlay}>
      <div style={styles.modal} id="print-zone">
        {/* En-tête */}
        <div style={styles.printHeader}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>
              Dr. {medecin?.prenom || "—"} {medecin?.nom || ""}
            </div>
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
              {medecin?.specialite}
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 13, color: "var(--color-text-secondary)" }}>
            <div>Date : {new Date(ordo.date).toLocaleDateString("fr-FR")}</div>
            <div>N° {ordo.id}</div>
          </div>
        </div>

        <hr style={styles.divider} />

        <div style={{ fontSize: 13, marginBottom: 12 }}>
          <strong>Patient :</strong> {patient?.prenom} {patient?.nom}
        </div>

        {ordo.diagnostic && (
          <div style={styles.diagnosticBox}>
            <strong>Diagnostic :</strong> {ordo.diagnostic}
          </div>
        )}

        {/* Liste médicaments */}
        <div style={styles.medsTitle}>Prescription</div>
        <table style={styles.table}>
          <thead>
            <tr>
              {["Médicament", "Dosage", "Fréquence", "Durée"].map((h) => (
                <th key={h} style={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {meds.map((m, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? "var(--color-background-secondary)" : "transparent" }}>
                <td style={styles.td}>{m.nom || "—"}</td>
                <td style={styles.td}>{m.dosage || "—"}</td>
                <td style={styles.td}>{m.frequence || "—"}</td>
                <td style={styles.td}>{m.duree || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {ordo.instructions && (
          <div style={styles.instructionBox}>
            <strong>Instructions :</strong> {ordo.instructions}
          </div>
        )}

        {ordo.duree_traitement && (
          <div style={{ fontSize: 13, margin: "8px 0" }}>
            <strong>Durée du traitement :</strong> {ordo.duree_traitement}
          </div>
        )}

        {ordo.prochain_rdv && (
          <div style={{ fontSize: 13, margin: "8px 0" }}>
            <strong>Prochain rendez-vous :</strong>{" "}
            {new Date(ordo.prochain_rdv).toLocaleDateString("fr-FR")}
          </div>
        )}

        <div style={styles.signature}>
          <div style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>Signature du médecin</div>
          <div style={styles.signatureLine} />
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} style={styles.btnGhost}>Fermer</button>
          <button onClick={imprimer} style={styles.btnPrimary}>🖨 Imprimer</button>
        </div>
      </div>
    </div>
  );
}

// ─── composant principal ─────────────────────────────────────────────────────
export default function Ordonnances({ userRole }) {
  const [mode, setMode] = useState("liste"); // "liste" | "form" | "apercu"
  const [ordonnances, setOrdonnances] = useState([]);
  const [patients, setPatients] = useState([]);
  const [medecins, setMedecins] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const canCreate = userRole === "medecin" || userRole === "admin";

  const load = async () => {
    setLoading(true);
    try {
      const [oRes, pRes, mRes, cRes] = await Promise.all([
        fetch(`${API}/ordonnances/patient/0`, { headers: authHeader() }).catch(() => ({ json: () => [] })),
        fetch(`${API}/patients`, { headers: authHeader() }),
        fetch(`${API}/medecins`, { headers: authHeader() }),
        fetch(`${API}/consultations`, { headers: authHeader() }),
      ]);
      // /ordonnances/patient/0 peut renvoyer 404 — on charge par patient
      const pData = await pRes.json();
      const mData = await mRes.json();
      const cData = await cRes.json();
      setPatients(pData);
      setMedecins(mData);
      setConsultations(cData);

      // Charger toutes les ordonnances en parallèle par patient
      const allOrdo = await Promise.all(
        pData.map((p) =>
          fetch(`${API}/ordonnances/patient/${p.id}`, { headers: authHeader() })
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => [])
        )
      );
      setOrdonnances(allOrdo.flat());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const findPatient = (id) => patients.find((p) => p.id === id);
  const findMedecin = (id) => medecins.find((m) => m.id === id);

  const filtered = ordonnances.filter((o) => {
    const p = findPatient(o.patient_id);
    const m = findMedecin(o.medecin_id);
    const q = search.toLowerCase();
    return (
      !q ||
      `${p?.prenom} ${p?.nom}`.toLowerCase().includes(q) ||
      `${m?.prenom} ${m?.nom}`.toLowerCase().includes(q) ||
      (o.diagnostic || "").toLowerCase().includes(q)
    );
  });

  if (loading) return <div style={styles.empty}>Chargement…</div>;

  if (mode === "form")
    return (
      <div style={{ padding: "0 0 32px" }}>
        <FormulaireOrdonnance
          patients={patients}
          medecins={medecins}
          consultations={consultations}
          onSaved={() => { load(); setMode("liste"); }}
          onCancel={() => setMode("liste")}
        />
      </div>
    );

  return (
    <div style={{ padding: "0 0 32px" }}>
      {/* En-tête */}
      <div style={styles.topBar}>
        <div>
          <h2 style={styles.pageTitle}>Ordonnances</h2>
          <p style={styles.pageSub}>{filtered.length} ordonnance{filtered.length > 1 ? "s" : ""}</p>
        </div>
        {canCreate && (
          <button onClick={() => setMode("form")} style={styles.btnPrimary}>
            + Nouvelle ordonnance
          </button>
        )}
      </div>

      {/* Recherche */}
      <input
        style={{ ...styles.input, marginBottom: 16 }}
        placeholder="Rechercher par patient, médecin, diagnostic…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Liste */}
      {filtered.length === 0 ? (
        <div style={styles.empty}>Aucune ordonnance trouvée.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[...filtered].sort((a, b) => new Date(b.date) - new Date(a.date)).map((o) => {
            const p = findPatient(o.patient_id);
            const m = findMedecin(o.medecin_id);
            let meds = [];
            try { meds = JSON.parse(o.medicaments); } catch { meds = [{ nom: o.medicaments }]; }

            return (
              <div key={o.id} style={styles.ordoCard}>
                <div style={styles.ordoTop}>
                  <div>
                    <span style={styles.ordoNum}>Ordo #{o.id}</span>
                    <span style={styles.ordoDate}>
                      {new Date(o.date).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <button
                    onClick={() => { setSelected(o); setMode("apercu"); }}
                    style={styles.btnSmall}
                  >
                    Voir / Imprimer
                  </button>
                </div>

                <div style={styles.grid2} >
                  <div>
                    <div style={styles.ordoLabel}>Patient</div>
                    <div style={styles.ordoValue}>{p ? `${p.prenom} ${p.nom}` : "—"}</div>
                  </div>
                  <div>
                    <div style={styles.ordoLabel}>Médecin</div>
                    <div style={styles.ordoValue}>{m ? `Dr. ${m.prenom} ${m.nom}` : "—"}</div>
                  </div>
                </div>

                {o.diagnostic && (
                  <div style={{ marginTop: 6, fontSize: 13, color: "var(--color-text-secondary)" }}>
                    <strong>Diagnostic :</strong> {o.diagnostic}
                  </div>
                )}

                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {meds.map((med, i) => (
                    <span key={i} style={styles.medPill}>
                      {med.nom}{med.dosage ? ` ${med.dosage}` : ""}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Aperçu / impression */}
      {mode === "apercu" && selected && (
        <AperçuOrdonnance
          ordo={selected}
          patient={findPatient(selected.patient_id)}
          medecin={findMedecin(selected.medecin_id)}
          onClose={() => { setSelected(null); setMode("liste"); }}
        />
      )}

      <style>{`
        @media print {
          body > *:not(#print-zone) { display: none !important; }
          #print-zone { position: fixed; inset: 0; padding: 24px; background: white; color: black; }
          button { display: none !important; }
        }
      `}</style>
    </div>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────
const styles = {
  topBar: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  pageTitle: { margin: 0, fontSize: 22, fontWeight: 500, color: "var(--color-text-primary)" },
  pageSub: { margin: "4px 0 0", fontSize: 13, color: "var(--color-text-secondary)" },
  card: { background: "var(--color-background-secondary)", borderRadius: 12, padding: 20, border: "1px solid var(--color-border-tertiary)" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 },
  grid4: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 },
  label: { display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500 },
  input: { padding: "8px 10px", borderRadius: 8, border: "1px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" },
  select: { padding: "8px 10px", borderRadius: 8, border: "1px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", fontSize: 14, outline: "none" },
  sectionTitle: { display: "flex", justifyContent: "space-between", alignItems: "center", margin: "16px 0 10px", fontWeight: 500, color: "var(--color-text-primary)", fontSize: 14 },
  medRow: { background: "var(--color-background-primary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 8, padding: 12, marginBottom: 8 },
  medBadge: { background: "var(--color-background-info)", color: "var(--color-text-info)", borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 600 },
  btnRemove: { marginLeft: "auto", background: "none", border: "none", color: "var(--color-text-danger)", cursor: "pointer", fontSize: 13 },
  btnPrimary: { padding: "9px 18px", borderRadius: 8, border: "none", background: "var(--color-background-info)", color: "var(--color-text-info)", fontWeight: 500, cursor: "pointer", fontSize: 14 },
  btnGhost: { padding: "9px 16px", borderRadius: 8, border: "1px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-secondary)", cursor: "pointer", fontSize: 14 },
  btnSmall: { padding: "5px 12px", borderRadius: 6, border: "1px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-secondary)", cursor: "pointer", fontSize: 12 },
  errorBanner: { background: "var(--color-background-danger)", color: "var(--color-text-danger)", padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 13 },
  ordoCard: { background: "var(--color-background-secondary)", borderRadius: 12, padding: 16, border: "1px solid var(--color-border-tertiary)" },
  ordoTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  ordoNum: { fontWeight: 600, fontSize: 14, color: "var(--color-text-primary)", marginRight: 10 },
  ordoDate: { fontSize: 12, color: "var(--color-text-tertiary)" },
  ordoLabel: { fontSize: 11, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 },
  ordoValue: { fontSize: 14, color: "var(--color-text-primary)" },
  medPill: { background: "var(--color-background-info)", color: "var(--color-text-info)", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 500 },
  empty: { textAlign: "center", padding: "40px 0", color: "var(--color-text-tertiary)" },
  // Modal
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal: { background: "var(--color-background-primary)", borderRadius: 12, padding: 28, width: "min(640px, 95vw)", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" },
  printHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  divider: { border: "none", borderTop: "1px solid var(--color-border-secondary)", margin: "16px 0" },
  diagnosticBox: { background: "var(--color-background-info)", color: "var(--color-text-info)", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12 },
  medsTitle: { fontWeight: 600, fontSize: 14, margin: "16px 0 8px", color: "var(--color-text-primary)" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "6px 8px", borderBottom: "1px solid var(--color-border-secondary)", color: "var(--color-text-secondary)", fontWeight: 500, fontSize: 12 },
  td: { padding: "7px 8px", color: "var(--color-text-primary)" },
  instructionBox: { background: "var(--color-background-warning)", color: "var(--color-text-warning)", borderRadius: 8, padding: "8px 12px", fontSize: 13, margin: "12px 0" },
  signature: { marginTop: 32, textAlign: "right" },
  signatureLine: { width: 180, borderBottom: "1px solid var(--color-border-primary)", marginLeft: "auto", marginTop: 32 },
};