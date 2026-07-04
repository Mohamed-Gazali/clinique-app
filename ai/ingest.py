"""
ai/ingest.py
Génère les embeddings OpenAI pour patients, consultations et ordonnances
et les stocke dans la table medical_embeddings (pgvector).

Usage :
    python -m ai.ingest            # ingestion complète
    python -m ai.ingest --type patient
"""

import os, sys, json, argparse
from datetime import datetime
from sqlmodel import Session, select, create_engine, SQLModel, Field
from sqlalchemy import text
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# ── Connexion DB ──────────────────────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL", "")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    connect_args={"sslmode": "require"} if "neon.tech" in DATABASE_URL else {},
)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

EMBED_MODEL = "text-embedding-3-small"  # 1536 dimensions, rapide et économique


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_embedding(text_input: str) -> list[float]:
    """Appelle l'API OpenAI et retourne le vecteur."""
    text_input = text_input.replace("\n", " ").strip()
    resp = client.embeddings.create(input=[text_input], model=EMBED_MODEL)
    return resp.data[0].embedding


def upsert_embedding(session, source_type: str, source_id: int, content: str):
    """Insère ou met à jour un embedding dans medical_embeddings."""
    vector = get_embedding(content)
    vector_str = "[" + ",".join(str(v) for v in vector) + "]"

    session.exec(text("""
        INSERT INTO medical_embeddings (source_type, source_id, content, embedding, created_at)
        VALUES (:stype, :sid, :content, :vec::vector, :now)
        ON CONFLICT (source_type, source_id)
        DO UPDATE SET content = EXCLUDED.content,
                      embedding = EXCLUDED.embedding,
                      created_at = EXCLUDED.created_at
    """), {
        "stype":   source_type,
        "sid":     source_id,
        "content": content,
        "vec":     vector_str,
        "now":     datetime.utcnow().isoformat(),
    })
    session.commit()


# ── Ingestion par type ─────────────────────────────────────────────────────────

def ingest_patients(session):
    rows = session.exec(text("SELECT * FROM patient")).mappings().all()
    print(f"📋 {len(rows)} patients à ingérer…")
    for p in rows:
        content = (
            f"Patient: {p['prenom']} {p['nom']}. "
            f"Né(e) le {p['date_naissance'] or 'inconnu'}. "
            f"Téléphone: {p['telephone'] or 'N/A'}. "
            f"Email: {p['email'] or 'N/A'}. "
            f"Groupe sanguin: {p['groupe_sanguin'] or 'inconnu'}. "
            f"Allergies: {p['allergies'] or 'aucune'}. "
            f"Antécédents médicaux: {p['antecedents'] or 'aucun'}."
        )
        upsert_embedding(session, "patient", p["id"], content)
        print(f"  ✅ Patient #{p['id']} — {p['prenom']} {p['nom']}")


def ingest_consultations(session):
    rows = session.exec(text("""
        SELECT c.*, p.nom as pnom, p.prenom as pprenom,
               m.nom as mnom, m.prenom as mprenom, m.specialite
        FROM consultation c
        LEFT JOIN patient p ON p.id = c.patient_id
        LEFT JOIN medecin m ON m.id = c.medecin_id
    """)).mappings().all()
    print(f"🩺 {len(rows)} consultations à ingérer…")
    for c in rows:
        content = (
            f"Consultation #{c['id']} du {c['date'][:10]}. "
            f"Patient: {c['pprenom']} {c['pnom']}. "
            f"Médecin: Dr. {c['mprenom']} {c['mnom']} ({c['specialite']}). "
            f"Diagnostic: {c['diagnostic'] or 'non renseigné'}. "
            f"Traitement: {c['traitement'] or 'non renseigné'}. "
            f"Notes: {c['notes'] or 'aucune'}."
        )
        upsert_embedding(session, "consultation", c["id"], content)
        print(f"  ✅ Consultation #{c['id']}")


def ingest_ordonnances(session):
    rows = session.exec(text("""
        SELECT o.*, p.nom as pnom, p.prenom as pprenom,
               m.nom as mnom, m.prenom as mprenom
        FROM ordonnance o
        LEFT JOIN patient p ON p.id = o.patient_id
        LEFT JOIN medecin m ON m.id = o.medecin_id
    """)).mappings().all()
    print(f"💊 {len(rows)} ordonnances à ingérer…")
    for o in rows:
        try:
            meds = json.loads(o["medicaments"])
            meds_str = ", ".join(
                f"{m.get('nom','')} {m.get('dosage','')} {m.get('frequence','')}".strip()
                for m in meds
            )
        except Exception:
            meds_str = o["medicaments"]

        content = (
            f"Ordonnance #{o['id']} du {o['date'][:10]}. "
            f"Patient: {o['pprenom']} {o['pnom']}. "
            f"Médecin: Dr. {o['mprenom']} {o['mnom']}. "
            f"Diagnostic: {o['diagnostic'] or 'non renseigné'}. "
            f"Médicaments: {meds_str}. "
            f"Instructions: {o['instructions'] or 'aucune'}. "
            f"Durée: {o['duree_traitement'] or 'non précisée'}."
        )
        upsert_embedding(session, "ordonnance", o["id"], content)
        print(f"  ✅ Ordonnance #{o['id']}")


# ── Entrée principale ──────────────────────────────────────────────────────────

def run(ingest_type: str = "all"):
    with Session(engine) as session:
        if ingest_type in ("all", "patient"):
            ingest_patients(session)
        if ingest_type in ("all", "consultation"):
            ingest_consultations(session)
        if ingest_type in ("all", "ordonnance"):
            ingest_ordonnances(session)
    print("\n🎉 Ingestion terminée !")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--type", default="all", choices=["all","patient","consultation","ordonnance"])
    args = parser.parse_args()
    run(args.type)