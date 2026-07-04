"""
ai/routes.py  — VERSION OPENAI + SENTENCE-TRANSFORMERS
──────────────────────────────────────────────────────────
• Embeddings  : sentence-transformers (local, gratuit)
               modèle multilingue paraphrase-multilingual-MiniLM-L12-v2
• Chat LLM    : gpt-4o-mini via OpenAI (rapide, économique)
• Fallback    : si pgvector vide → requête SQL directe + OpenAI sans RAG
• Migration   : Anthropic → OpenAI (temporaire pour dev/test)
"""

import os
import json
import subprocess
import sys

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text, create_engine
from dotenv import load_dotenv

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────

DATABASE_URL = os.getenv("DATABASE_URL", "")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    connect_args={"sslmode": "require"} if "neon.tech" in DATABASE_URL else {},
)

# ── Modèle OpenAI (remplace Claude) ──────────────────────────────────────────
OPENAI_MODEL      = "gpt-4o-mini"          # rapide + économique (remplace claude-haiku)
EMBED_MODEL_NAME  = "paraphrase-multilingual-MiniLM-L12-v2"  # 384 dims, multilingue
TOP_K             = 5
SIMILARITY_CUTOFF = 0.25

ai_router = APIRouter(prefix="/ai", tags=["IA"])

# ── Client OpenAI (remplace Anthropic) ───────────────────────────────────────

def get_openai_client():
    from openai import OpenAI
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="OPENAI_API_KEY manquante dans le fichier .env",
        )
    return OpenAI(api_key=api_key)


# ── Embeddings locaux (sentence-transformers) ─────────────────────────────────

_embed_model = None

def get_embed_model():
    """Charge le modèle d'embedding une seule fois (lazy loading)."""
    global _embed_model
    if _embed_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _embed_model = SentenceTransformer(EMBED_MODEL_NAME)
        except ImportError:
            raise HTTPException(
                status_code=503,
                detail=(
                    "sentence-transformers non installé. "
                    "Exécutez : pip install sentence-transformers"
                ),
            )
    return _embed_model


def get_embedding(text_input: str) -> list[float]:
    """Génère un embedding local (384 dimensions)."""
    model = get_embed_model()
    vec = model.encode(text_input.replace("\n", " ").strip(), normalize_embeddings=True)
    return vec.tolist()


# ── Schémas Pydantic ──────────────────────────────────────────────────────────

class QuestionRequest(BaseModel):
    question:    str
    filter_type: str | None = None  # "patient" | "consultation" | "ordonnance" | None
    context:     str | None = None

class SummarizeRequest(BaseModel):
    texte: str

class SuggestRequest(BaseModel):
    symptomes:   str
    antecedents: str | None = None

class IngestRequest(BaseModel):
    type: str = "all"


# ── Helpers RAG ───────────────────────────────────────────────────────────────

def vector_search(query: str, filter_type: str | None = None, top_k: int = TOP_K) -> list[dict]:
    """Recherche sémantique dans medical_embeddings via pgvector."""
    embedding  = get_embedding(query)
    vector_str = "[" + ",".join(str(v) for v in embedding) + "]"

    type_filter = ""
    params: dict = {"vec": vector_str, "limit": top_k}
    if filter_type:
        type_filter = "AND source_type = :filter_type"
        params["filter_type"] = filter_type

    sql = text(f"""
        SELECT source_type, source_id, content,
               1 - (embedding <=> :vec::vector) AS similarity
        FROM medical_embeddings
        WHERE 1=1 {type_filter}
        ORDER BY embedding <=> :vec::vector
        LIMIT :limit
    """)

    with engine.connect() as conn:
        rows = conn.execute(sql, params).mappings().all()

    return [
        {
            "source_type": r["source_type"],
            "source_id":   r["source_id"],
            "content":     r["content"],
            "similarity":  round(float(r["similarity"]), 4),
        }
        for r in rows
        if float(r["similarity"]) >= SIMILARITY_CUTOFF
    ]


def sql_fallback_context(filter_type: str | None = None) -> str:
    """
    Fallback si pgvector est vide : récupère les données brutes via SQL
    et les formate en texte pour l'IA.
    """
    try:
        with engine.connect() as conn:
            # Patients
            if not filter_type or filter_type == "patient":
                patients = conn.execute(text(
                    "SELECT prenom, nom, date_naissance, groupe_sanguin, allergies, antecedents "
                    "FROM patient LIMIT 20"
                )).mappings().all()
            else:
                patients = []

            # Consultations
            if not filter_type or filter_type == "consultation":
                consultations = conn.execute(text("""
                    SELECT c.date, c.diagnostic, c.traitement, c.notes,
                           p.prenom || ' ' || p.nom AS patient,
                           m.prenom || ' ' || m.nom AS medecin
                    FROM consultation c
                    LEFT JOIN patient p ON p.id = c.patient_id
                    LEFT JOIN medecin m ON m.id = c.medecin_id
                    ORDER BY c.date DESC LIMIT 20
                """)).mappings().all()
            else:
                consultations = []

            # Ordonnances
            if not filter_type or filter_type == "ordonnance":
                ordonnances = conn.execute(text("""
                    SELECT o.date, o.diagnostic, o.medicaments, o.instructions,
                           p.prenom || ' ' || p.nom AS patient
                    FROM ordonnance o
                    LEFT JOIN patient p ON p.id = o.patient_id
                    ORDER BY o.date DESC LIMIT 20
                """)).mappings().all()
            else:
                ordonnances = []

        lines = []
        if patients:
            lines.append("=== PATIENTS ===")
            for p in patients:
                lines.append(
                    f"• {p['prenom']} {p['nom']} — né(e) {p['date_naissance']} — "
                    f"groupe {p['groupe_sanguin']} — allergies: {p['allergies'] or 'aucune'} — "
                    f"antécédents: {p['antecedents'] or 'aucun'}"
                )

        if consultations:
            lines.append("\n=== CONSULTATIONS ===")
            for c in consultations:
                lines.append(
                    f"• {str(c['date'])[:10]} | Patient: {c['patient']} | Médecin: {c['medecin']}\n"
                    f"  Diagnostic: {c['diagnostic'] or 'N/A'} | Traitement: {c['traitement'] or 'N/A'}\n"
                    f"  Notes: {c['notes'] or 'aucune'}"
                )

        if ordonnances:
            lines.append("\n=== ORDONNANCES ===")
            for o in ordonnances:
                try:
                    meds = json.loads(o["medicaments"])
                    meds_str = ", ".join(
                        f"{m.get('nom','')} {m.get('dosage','')}".strip() for m in meds
                    )
                except Exception:
                    meds_str = str(o["medicaments"])
                lines.append(
                    f"• {str(o['date'])[:10]} | Patient: {o['patient']}\n"
                    f"  Diagnostic: {o['diagnostic'] or 'N/A'} | Médicaments: {meds_str}"
                )

        return "\n".join(lines) if lines else "Aucune donnée disponible en base."
    except Exception as e:
        return f"Erreur SQL : {e}"


def build_system_prompt(context_block: str) -> str:
    return f"""Tu es l'assistant IA d'une clinique médicale.
Tu réponds UNIQUEMENT à partir des données médicales fournies ci-dessous.
Si l'information n'est pas dans le contexte, dis-le clairement sans inventer.
Réponds en français, de manière concise et professionnelle.

=== DONNÉES MÉDICALES ===
{context_block}
=== FIN DES DONNÉES ===

Réponds à la question du médecin en te basant exclusivement sur ces données."""


def openai_chat(system: str, user: str, max_tokens: int = 1024) -> str:
    """Appel OpenAI gpt-4o-mini — remplace claude_chat()."""
    client = get_openai_client()
    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        max_tokens=max_tokens,
        temperature=0.2,
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
    )
    return response.choices[0].message.content


# ── GET /ai/status ────────────────────────────────────────────────────────────

@ai_router.get("/status")
def status():
    """État de la base d'embeddings — format exact attendu par le frontend."""
    try:
        with engine.connect() as conn:
            row = conn.execute(text("""
                SELECT
                    COUNT(*) FILTER (WHERE source_type = 'patient')      AS patients,
                    COUNT(*) FILTER (WHERE source_type = 'consultation')  AS consultations,
                    COUNT(*) FILTER (WHERE source_type = 'ordonnance')    AS ordonnances,
                    COUNT(*)                                              AS total
                FROM medical_embeddings
            """)).mappings().one()
        total = int(row["total"])
        return {
            "ready": total > 0,
            "embeddings": {
                "patients":      int(row["patients"]),
                "consultations": int(row["consultations"]),
                "ordonnances":   int(row["ordonnances"]),
                "total":         total,
            },
        }
    except Exception as e:
        return {
            "ready": False,
            "embeddings": {"patients": 0, "consultations": 0, "ordonnances": 0, "total": 0},
            "error": str(e),
        }


# ── POST /ai/ask ──────────────────────────────────────────────────────────────

@ai_router.post("/ask")
async def ask(body: QuestionRequest):
    """
    RAG complet : embeddings locaux → pgvector → OpenAI.
    Fallback automatique sur SQL direct si la table est vide.
    """
    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="La question est vide.")

    sources: list[dict] = []
    context_block: str  = ""

    # 1. Tentative RAG via pgvector
    try:
        sources = vector_search(question, filter_type=body.filter_type)
        if sources:
            lines = []
            for i, c in enumerate(sources, 1):
                lines.append(
                    f"[Source {i} — {c['source_type']} #{c['source_id']} "
                    f"(similarité {c['similarity']:.0%})]"
                )
                lines.append(c["content"])
                lines.append("")
            context_block = "\n".join(lines)
    except Exception:
        pass  # pgvector indisponible → on passe au fallback

    # 2. Fallback SQL si pgvector vide ou indisponible
    if not context_block:
        context_block = sql_fallback_context(filter_type=body.filter_type)

    # 3. Appel OpenAI
    system_prompt = build_system_prompt(context_block)
    try:
        answer = openai_chat(system_prompt, question)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Erreur OpenAI : {e}")

    return {"answer": answer, "sources": sources}


# ── POST /ai/summarize ────────────────────────────────────────────────────────

@ai_router.post("/summarize")
async def summarize(body: SummarizeRequest):
    if not body.texte.strip():
        raise HTTPException(status_code=400, detail="Le texte est vide.")
    try:
        resume = openai_chat(
            system=(
                "Tu es un assistant médical. Résume le texte suivant de façon concise, "
                "en français, en conservant les informations cliniques importantes."
            ),
            user=body.texte,
            max_tokens=512,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Erreur OpenAI : {e}")
    return {"resume": resume}


# ── POST /ai/suggest ──────────────────────────────────────────────────────────

@ai_router.post("/suggest")
async def suggest(body: SuggestRequest):
    if not body.symptomes.strip():
        raise HTTPException(status_code=400, detail="Les symptômes sont vides.")
    user_content = f"Symptômes : {body.symptomes}"
    if body.antecedents:
        user_content += f"\nAntécédents : {body.antecedents}"
    try:
        suggestion = openai_chat(
            system=(
                "Tu es un assistant d'aide à la décision médicale. "
                "Propose des pistes diagnostiques et thérapeutiques à partir des symptômes fournis. "
                "Rappelle toujours que ces suggestions ne remplacent pas le jugement clinique du médecin."
            ),
            user=user_content,
            max_tokens=768,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Erreur OpenAI : {e}")
    return {"suggestion": suggestion}


# ── POST /ai/ingest ───────────────────────────────────────────────────────────

@ai_router.post("/ingest")
async def ingest(body: IngestRequest):
    """Lance ai/ingest.py en arrière-plan."""
    ingest_type = body.type if body.type in ("all", "patient", "consultation", "ordonnance") else "all"
    try:
        subprocess.Popen(
            [sys.executable, "-m", "ai.ingest", "--type", ingest_type],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return {"message": f"Ingestion '{ingest_type}' lancée en arrière-plan.", "type": ingest_type}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Impossible de lancer l'ingestion : {e}")