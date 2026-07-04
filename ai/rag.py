"""
ai/rag.py
RAG (Retrieval-Augmented Generation) médical.
1. Transforme la question en vecteur (OpenAI embeddings)
2. Cherche les passages les plus proches dans medical_embeddings (pgvector)
3. Envoie le contexte + la question à GPT-4o-mini
4. Retourne la réponse + les sources utilisées
"""

import os
from openai import OpenAI
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    connect_args={"sslmode": "require"} if "neon.tech" in DATABASE_URL else {},
)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
EMBED_MODEL = "text-embedding-3-small"
CHAT_MODEL  = "gpt-4o-mini"
TOP_K       = 5   # nombre de passages récupérés


# ── Embedding de la question ───────────────────────────────────────────────────

def embed_query(question: str) -> list[float]:
    resp = client.embeddings.create(
        input=[question.replace("\n", " ")],
        model=EMBED_MODEL,
    )
    return resp.data[0].embedding


# ── Recherche vectorielle ──────────────────────────────────────────────────────

def retrieve_context(question: str, top_k: int = TOP_K, filter_type: str | None = None):
    """
    Retourne les `top_k` passages les plus proches de la question.
    filter_type : 'patient' | 'consultation' | 'ordonnance' | None (tout)
    """
    vector = embed_query(question)
    vector_str = "[" + ",".join(str(v) for v in vector) + "]"

    where = "WHERE source_type = :ftype" if filter_type else ""
    params = {"vec": vector_str, "k": top_k}
    if filter_type:
        params["ftype"] = filter_type

    with engine.connect() as conn:
        rows = conn.execute(text(f"""
            SELECT source_type, source_id, content,
                   1 - (embedding <=> :vec::vector) AS similarity
            FROM medical_embeddings
            {where}
            ORDER BY embedding <=> :vec::vector
            LIMIT :k
        """), params).mappings().all()

    return [dict(r) for r in rows]


# ── Génération de la réponse ───────────────────────────────────────────────────

SYSTEM_PROMPT = """
Tu es un assistant médical IA intégré à un logiciel de gestion de clinique.
Tu as accès au dossier médical des patients via une recherche vectorielle.
Tu réponds en français, de manière claire, structurée et professionnelle.
Tu cites toujours tes sources (Patient, Consultation ou Ordonnance + numéro).
Si l'information n'est pas dans le contexte fourni, dis-le clairement.
Ne fais jamais de diagnostic médical — tu fournis de l'information, pas un avis médical.
""".strip()


def ask(question: str, filter_type: str | None = None) -> dict:
    """
    Pose une question au système RAG et retourne :
    {
        "answer": str,
        "sources": [{"type": str, "id": int, "content": str, "similarity": float}],
        "question": str
    }
    """
    # 1. Récupérer le contexte
    passages = retrieve_context(question, filter_type=filter_type)

    if not passages:
        return {
            "answer": "Aucune information médicale disponible dans la base. Veuillez d'abord ingérer les données via /ai/ingest.",
            "sources": [],
            "question": question,
        }

    # 2. Construire le contexte pour le prompt
    context_parts = []
    for i, p in enumerate(passages, 1):
        label = f"[Source {i} — {p['source_type'].upper()} #{p['source_id']} (similarité: {p['similarity']:.2f})]"
        context_parts.append(f"{label}\n{p['content']}")
    context = "\n\n".join(context_parts)

    # 3. Appeler GPT
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"""
Contexte médical récupéré depuis la base de données :

{context}

---

Question : {question}
""".strip()},
    ]

    completion = client.chat.completions.create(
        model=CHAT_MODEL,
        messages=messages,
        temperature=0.2,   # réponses déterministes et fiables
        max_tokens=800,
    )

    answer = completion.choices[0].message.content

    return {
        "answer": answer,
        "sources": [
            {
                "type":       p["source_type"],
                "id":         p["source_id"],
                "content":    p["content"][:200] + "…" if len(p["content"]) > 200 else p["content"],
                "similarity": round(p["similarity"], 3),
            }
            for p in passages
        ],
        "question": question,
    }