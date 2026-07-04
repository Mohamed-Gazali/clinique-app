// src/pages/RoutesIA.jsx
// Page affichant les routes IA disponibles dans la clinique

export default function RoutesIA() {
  return (
    <div className="page-container">
      <h1>Routes IA</h1>
      <p>Cette page liste les routes et fonctionnalités IA disponibles.</p>

      <ul>
        <li>
          <strong>POST /api/ai/ask</strong> — Poser une question à l'assistant IA
        </li>
        <li>
          <strong>POST /api/ai/summarize</strong> — Résumer une consultation
        </li>
        <li>
          <strong>POST /api/ai/suggest</strong> — Suggestions de traitement
        </li>
      </ul>
    </div>
  );
}