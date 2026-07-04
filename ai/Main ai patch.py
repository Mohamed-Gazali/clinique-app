# ════════════════════════════════════════════════════════════
# PATCH À APPLIQUER DANS TON main.py
# Ajoute ces 3 lignes après la création de `app = FastAPI(...)`
# ════════════════════════════════════════════════════════════

# 1. Import du router IA — ajouter en haut du fichier avec les autres imports
from ai.routes import ai_router

# 2. Enregistrer le router — ajouter juste après app.add_middleware(...)
app.include_router(ai_router)

# ════════════════════════════════════════════════════════════
# MIGRATION SQL — À exécuter UNE FOIS dans Neon (SQL Editor)
# Si la table existe déjà mais sans contrainte UNIQUE, relancez ceci :
# ════════════════════════════════════════════════════════════
"""
-- Ajouter la contrainte UNIQUE pour l'upsert dans ingest.py
ALTER TABLE medical_embeddings
ADD CONSTRAINT medical_embeddings_source_unique
UNIQUE (source_type, source_id);
"""

# ════════════════════════════════════════════════════════════
# VARIABLES D'ENVIRONNEMENT à ajouter dans .env
# ════════════════════════════════════════════════════════════
"""
OPENAI_API_KEY=your-key-here
"""

# ════════════════════════════════════════════════════════════
# DÉPENDANCES à installer (requirements.txt)
# ════════════════════════════════════════════════════════════
"""
openai>=1.0.0
pgvector
"""