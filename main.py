from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Field, SQLModel, create_engine, Session, select
from pydantic import BaseModel
from datetime import datetime, timedelta
from collections import defaultdict
from dotenv import load_dotenv
import os, bcrypt, jwt
from ai.routes import ai_router



load_dotenv()

SECRET_KEY         = os.getenv("SECRET_KEY", "clinique-secret-key-32-caracteres-min!")
ALGORITHM          = "HS256"
TOKEN_EXPIRE_HOURS = 8

app    = FastAPI(title="Clinique API", version="1.0")
bearer = HTTPBearer()

# ─────────────────────────────────────────
# CORS — autorise React en local et Vercel
# ─────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000",
                   "https://*.vercel.app", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai_router)

# ─────────────────────────────────────────
# DATABASE
# ─────────────────────────────────────────
# ─── DATABASE avec pool Neon ───────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///clinique.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,      # reconnexion automatique si connexion morte
    pool_recycle=300,        # recycle toutes les 5 min (Neon coupe à ~5min)
    pool_size=5,
    max_overflow=10,
    connect_args={"sslmode": "require", "connect_timeout": 10} if "neon.tech" in DATABASE_URL else {}
)

# ─────────────────────────────────────────
# MODÈLES
# ─────────────────────────────────────────

class User(SQLModel, table=True):
    id:       int | None = Field(default=None, primary_key=True)
    name:     str        = Field(unique=True, index=True)
    password: str
    role:     str        = "secretaire"
    email:    str | None = None

class Patient(SQLModel, table=True):
    id:             int | None = Field(default=None, primary_key=True)
    nom:            str
    prenom:         str
    date_naissance: str | None = None
    telephone:      str | None = None
    email:          str | None = None
    adresse:        str | None = None
    groupe_sanguin: str | None = None
    allergies:      str | None = None
    antecedents:    str | None = None
    created_at:     str = Field(default_factory=lambda: datetime.now().isoformat())

class Medecin(SQLModel, table=True):
    id:         int | None = Field(default=None, primary_key=True)
    nom:        str
    prenom:     str
    specialite: str
    telephone:  str | None = None
    email:      str | None = None
    disponible: bool       = True

class RendezVous(SQLModel, table=True):
    id:         int | None = Field(default=None, primary_key=True)
    patient_id: int        = Field(foreign_key="patient.id")
    medecin_id: int        = Field(foreign_key="medecin.id")
    date_heure: str
    motif:      str | None = None
    statut:     str        = "planifie"
    notes:      str | None = None
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())

class Consultation(SQLModel, table=True):
    id:             int | None = Field(default=None, primary_key=True)
    patient_id:     int        = Field(foreign_key="patient.id")
    medecin_id:     int        = Field(foreign_key="medecin.id")
    rendez_vous_id: int | None = Field(default=None, foreign_key="rendezvous.id")
    diagnostic:     str | None = None
    traitement:     str | None = None
    notes:          str | None = None
    date:           str = Field(default_factory=lambda: datetime.now().isoformat())

class Ordonnance(SQLModel, table=True):
    id:               int | None = Field(default=None, primary_key=True)
    consultation_id:  int        = Field(foreign_key="consultation.id")
    patient_id:       int        = Field(foreign_key="patient.id")
    medecin_id:       int        = Field(foreign_key="medecin.id")
    medicaments:      str
    instructions:     str | None = None
    diagnostic:       str | None = None        # nouveau
    duree_traitement: str | None = None        # nouveau
    prochain_rdv:     str | None = None        # nouveau
    date:             str = Field(default_factory=lambda: datetime.now().isoformat())

class SatisfactionNote(SQLModel, table=True):
    """Note de satisfaction + commentaire libre laissés au sujet d'un patient (CRM)."""
    id:              int | None = Field(default=None, primary_key=True)
    patient_id:      int        = Field(foreign_key="patient.id")
    medecin_id:      int | None = Field(default=None, foreign_key="medecin.id")
    rendez_vous_id:  int | None = Field(default=None, foreign_key="rendezvous.id")
    note:            int                          # 1 à 5
    commentaire:     str | None = None
    auteur:          str | None = None             # nom de l'utilisateur connecté qui a saisi la note
    date:            str = Field(default_factory=lambda: datetime.now().isoformat())

# ─────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────

class UserCreate(BaseModel):
    name:     str
    password: str
    role:     str        = "secretaire"
    email:    str | None = None

class PatientCreate(BaseModel):
    nom:            str
    prenom:         str
    date_naissance: str | None = None
    telephone:      str | None = None
    email:          str | None = None
    adresse:        str | None = None
    groupe_sanguin: str | None = None
    allergies:      str | None = None
    antecedents:    str | None = None

class MedecinCreate(BaseModel):
    nom:        str
    prenom:     str
    specialite: str
    telephone:  str | None = None
    email:      str | None = None
    disponible: bool = True

class RendezVousCreate(BaseModel):
    patient_id: int
    medecin_id: int
    date_heure: str
    motif:      str | None = None
    statut:     str        = "planifie"
    notes:      str | None = None

class StatutUpdate(BaseModel):
    statut: str

class ConsultationCreate(BaseModel):
    patient_id:     int
    medecin_id:     int
    rendez_vous_id: int | None = None
    diagnostic:     str | None = None
    traitement:     str | None = None
    notes:          str | None = None

class OrdonnanceCreate(BaseModel):
    consultation_id: int
    patient_id:      int
    medecin_id:      int
    medicaments:     str        # JSON string : liste de médicaments
    instructions:    str | None = None
    diagnostic:      str | None = None   # nouveau
    duree_traitement:str | None = None   # nouveau
    prochain_rdv:    str | None = None   # nouveau

class SatisfactionCreate(BaseModel):
    patient_id:     int
    medecin_id:     int | None = None
    rendez_vous_id: int | None = None
    note:           int                    # 1 à 5
    commentaire:    str | None = None

# ─────────────────────────────────────────
# STARTUP
# ─────────────────────────────────────────

def create_db():
    SQLModel.metadata.create_all(engine)

@app.on_event("startup")
def on_startup():
    create_db()
    with Session(engine) as session:
        if not session.exec(select(User)).first():
            hashed = bcrypt.hashpw("admin123".encode(), bcrypt.gensalt()).decode()
            session.add(User(name="admin", password=hashed,
                             role="admin", email="admin@clinique.com"))
            session.commit()
            print("✅ Admin créé — user: admin / pass: admin123")

# ─────────────────────────────────────────
# JWT
# ─────────────────────────────────────────

def create_token(user_id: int, name: str, role: str) -> str:
    payload = {
        "sub":  str(user_id),
        "name": name,
        "role": role,
        "exp":  datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expirée")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalide")

def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    return decode_token(creds.credentials)

def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Accès admin requis")
    return user

# ─────────────────────────────────────────
# ROUTES — RACINE
# ─────────────────────────────────────────

@app.get("/")
def root():
    db_type = "PostgreSQL" if os.getenv("DATABASE_URL") else "SQLite"
    return {"status": "✅ Clinique API v1.0", "database": db_type}

# ─────────────────────────────────────────
# ROUTES — AUTH & USERS
# ─────────────────────────────────────────

@app.post("/login")
def login(data: UserCreate):
    with Session(engine) as session:
        user = session.exec(select(User).where(User.name == data.name)).first()
        if not user or not bcrypt.checkpw(data.password.encode(), user.password.encode()):
            raise HTTPException(status_code=401, detail="Identifiants incorrects")
        token = create_token(user.id, user.name, user.role)
        return {"success": True, "token": token, "name": user.name, "role": user.role}

@app.post("/users/public")
def register_user(data: UserCreate):
    if data.role not in ("medecin", "secretaire"):
        raise HTTPException(status_code=400, detail="Rôle non autorisé")
    with Session(engine) as session:
        if session.exec(select(User).where(User.name == data.name)).first():
            raise HTTPException(status_code=400, detail="Nom déjà pris")
        if len(data.password) < 6:
            raise HTTPException(status_code=400, detail="Mot de passe trop court")
        hashed = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
        user   = User(name=data.name, password=hashed, role=data.role, email=data.email)
        session.add(user)
        session.commit()
        session.refresh(user)
        return {"id": user.id, "name": user.name, "role": user.role}


@app.post("/users")
def create_user(data: UserCreate, _: dict = Depends(require_admin)):
    with Session(engine) as session:
        if session.exec(select(User).where(User.name == data.name)).first():
            raise HTTPException(status_code=400, detail="Nom déjà pris")
        if len(data.password) < 6:
            raise HTTPException(status_code=400, detail="Mot de passe trop court")
        hashed = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
        user   = User(name=data.name, password=hashed, role=data.role, email=data.email)
        session.add(user)
        session.commit()
        session.refresh(user)
        return {"id": user.id, "name": user.name, "role": user.role}

@app.get("/users")
def get_users(_: dict = Depends(require_admin)):
    with Session(engine) as session:
        users = session.exec(select(User)).all()
        return [{"id": u.id, "name": u.name, "role": u.role, "email": u.email} for u in users]

# ─────────────────────────────────────────
# ROUTES — PATIENTS
# ─────────────────────────────────────────

@app.post("/patients")
def create_patient(data: PatientCreate, _: dict = Depends(get_current_user)):
    with Session(engine) as session:
        patient = Patient(**data.dict())
        session.add(patient)
        session.commit()
        session.refresh(patient)
        return patient

@app.get("/patients")
def get_patients(_: dict = Depends(get_current_user)):
    with Session(engine) as session:
        return session.exec(select(Patient)).all()

@app.get("/patients/{patient_id}")
def get_patient(patient_id: int, _: dict = Depends(get_current_user)):
    with Session(engine) as session:
        patient = session.get(Patient, patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient non trouvé")
        return patient

@app.put("/patients/{patient_id}")
def update_patient(patient_id: int, data: PatientCreate, _: dict = Depends(get_current_user)):
    with Session(engine) as session:
        patient = session.get(Patient, patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient non trouvé")
        for key, val in data.dict(exclude_unset=True).items():
            setattr(patient, key, val)
        session.add(patient)
        session.commit()
        session.refresh(patient)
        return patient

@app.delete("/patients/{patient_id}")
def delete_patient(patient_id: int, _: dict = Depends(require_admin)):
    with Session(engine) as session:
        patient = session.get(Patient, patient_id)
        if not patient: 
            raise HTTPException(status_code=404, detail="Patient non trouvé")
        session.delete(patient)
        session.commit()
        return {"message": "Patient supprimé"}

@app.get("/patients/search/{query}")
def search_patients(query: str, _: dict = Depends(get_current_user)):
    with Session(engine) as session:
        patients = session.exec(select(Patient)).all()
        q = query.lower()
        return [p for p in patients if
                q in p.nom.lower() or q in p.prenom.lower() or
                (p.telephone and q in p.telephone)]

# ─────────────────────────────────────────
# ROUTES — MÉDECINS
# ─────────────────────────────────────────

@app.post("/medecins")
def create_medecin(data: MedecinCreate, _: dict = Depends(require_admin)):
    with Session(engine) as session:
        medecin = Medecin(**data.dict())
        session.add(medecin)
        session.commit()
        session.refresh(medecin)
        return medecin

@app.get("/medecins")
def get_medecins(_: dict = Depends(get_current_user)):
    with Session(engine) as session:
        return session.exec(select(Medecin)).all()

@app.put("/medecins/{medecin_id}")
def update_medecin(medecin_id: int, data: MedecinCreate, _: dict = Depends(require_admin)):
    with Session(engine) as session:
        medecin = session.get(Medecin, medecin_id)
        if not medecin:
            raise HTTPException(status_code=404, detail="Médecin non trouvé")
        for key, val in data.dict(exclude_unset=True).items():
            setattr(medecin, key, val)
        session.add(medecin)
        session.commit()
        session.refresh(medecin)
        return medecin

@app.delete("/medecins/{medecin_id}")
def delete_medecin(medecin_id: int, _: dict = Depends(require_admin)):
    with Session(engine) as session:
        medecin = session.get(Medecin, medecin_id)
        if not medecin:
            raise HTTPException(status_code=404, detail="Médecin non trouvé")
        session.delete(medecin)
        session.commit()
        return {"message": "Médecin supprimé"}

# ─────────────────────────────────────────
# ROUTES — RENDEZ-VOUS
# ─────────────────────────────────────────

@app.post("/rendezvous")
def create_rdv(data: RendezVousCreate, _: dict = Depends(get_current_user)):
    with Session(engine) as session:
        rdv = RendezVous(**data.dict())
        session.add(rdv)
        session.commit()
        session.refresh(rdv)
        return rdv

@app.get("/rendezvous")
def get_rdv(_: dict = Depends(get_current_user)):
    with Session(engine) as session:
        rdvs     = session.exec(select(RendezVous)).all()
        patients = {p.id: p for p in session.exec(select(Patient)).all()}
        medecins = {m.id: m for m in session.exec(select(Medecin)).all()}
        result   = []
        for rdv in rdvs:
            p = patients.get(rdv.patient_id)
            m = medecins.get(rdv.medecin_id)
            result.append({
                "id":         rdv.id,
                "date_heure": rdv.date_heure,
                "motif":      rdv.motif,
                "statut":     rdv.statut,
                "notes":      rdv.notes,
                "patient":    f"{p.prenom} {p.nom}" if p else "Inconnu",
                "patient_id": rdv.patient_id,
                "medecin":    f"Dr. {m.prenom} {m.nom}" if m else "Inconnu",
                "medecin_id": rdv.medecin_id,
                "specialite": m.specialite if m else "",
            })
        return result

@app.put("/rendezvous/{rdv_id}/statut")
def update_rdv_statut(rdv_id: int, data: StatutUpdate, _: dict = Depends(get_current_user)):
    with Session(engine) as session:
        rdv = session.get(RendezVous, rdv_id)
        if not rdv:
            raise HTTPException(status_code=404, detail="Rendez-vous non trouvé")
        rdv.statut = data.statut
        session.add(rdv)
        session.commit()
        return {"message": "Statut mis à jour"}

@app.delete("/rendezvous/{rdv_id}")
def delete_rdv(rdv_id: int, _: dict = Depends(get_current_user)):
    with Session(engine) as session:
        rdv = session.get(RendezVous, rdv_id)
        if not rdv:
            raise HTTPException(status_code=404, detail="Rendez-vous non trouvé")
        session.delete(rdv)
        session.commit()
        return {"message": "Rendez-vous supprimé"}

# ─────────────────────────────────────────
# ROUTES — CONSULTATIONS
# ─────────────────────────────────────────

@app.post("/consultations")
def create_consultation(data: ConsultationCreate, _: dict = Depends(get_current_user)):
    with Session(engine) as session:
        consultation = Consultation(**data.dict())
        session.add(consultation)
        session.commit()
        session.refresh(consultation)
        return consultation

@app.get("/consultations")
def get_consultations(_: dict = Depends(get_current_user)):
    with Session(engine) as session:
        return session.exec(select(Consultation)).all()

@app.get("/consultations/patient/{patient_id}")
def get_consultations_patient(patient_id: int, _: dict = Depends(get_current_user)):
    with Session(engine) as session:
        return session.exec(
            select(Consultation).where(Consultation.patient_id == patient_id)
        ).all()

# ─────────────────────────────────────────
# ROUTES — ORDONNANCES
# ─────────────────────────────────────────

@app.post("/ordonnances")
def create_ordonnance(data: OrdonnanceCreate, user: dict = Depends(get_current_user)):
    if user.get("role") not in ("medecin", "admin"):
        raise HTTPException(status_code=403, detail="Réservé aux médecins")
    with Session(engine) as session:
        ordonnance = Ordonnance(**data.dict())
        session.add(ordonnance)
        session.commit()
        session.refresh(ordonnance)
        return ordonnance

@app.get("/ordonnances/patient/{patient_id}")
def get_ordonnances_patient(patient_id: int, _: dict = Depends(get_current_user)):
    with Session(engine) as session:
        return session.exec(
            select(Ordonnance).where(Ordonnance.patient_id == patient_id)
        ).all()

@app.get("/ordonnances/{ordonnance_id}")
def get_ordonnance(ordonnance_id: int, _: dict = Depends(get_current_user)):
    with Session(engine) as session:
        o = session.get(Ordonnance, ordonnance_id)
        if not o:
            raise HTTPException(status_code=404, detail="Ordonnance non trouvée")
        return o

@app.delete("/ordonnances/{ordonnance_id}")
def delete_ordonnance(ordonnance_id: int, _: dict = Depends(require_admin)):
    with Session(engine) as session:
        o = session.get(Ordonnance, ordonnance_id)
        if not o:
            raise HTTPException(status_code=404, detail="Ordonnance non trouvée")
        session.delete(o)
        session.commit()
        return {"message": "Ordonnance supprimée"}

# ─────────────────────────────────────────
# ROUTES — DASHBOARD STATS (simple, totaux globaux)
# ─────────────────────────────────────────

@app.get("/stats")
def get_stats(_: dict = Depends(get_current_user)):
    with Session(engine) as session:
        patients      = session.exec(select(Patient)).all()
        medecins      = session.exec(select(Medecin)).all()
        rdvs          = session.exec(select(RendezVous)).all()
        consultations = session.exec(select(Consultation)).all()
        ordonnances   = session.exec(select(Ordonnance)).all()
        today         = datetime.now().strftime("%Y-%m-%d")
        rdv_today     = [r for r in rdvs if r.date_heure.startswith(today)]
        return {
            "total_patients":      len(patients),
            "total_medecins":      len(medecins),
            "total_rdv":           len(rdvs),
            "rdv_aujourd_hui":     len(rdv_today),
            "rdv_planifies":       len([r for r in rdvs if r.statut == "planifie"]),
            "rdv_confirmes":       len([r for r in rdvs if r.statut == "confirme"]),
            "rdv_annules":         len([r for r in rdvs if r.statut == "annule"]),
            "total_consultations": len(consultations),
            "total_ordonnances":   len(ordonnances),
        }

# ─────────────────────────────────────────
# ROUTES — DASHBOARD STATS (période + tendances + graphiques)
# ─────────────────────────────────────────

def _parse_dt(s: str | None) -> datetime | None:
    """Parse une date ISO stockée en texte. Retourne None si invalide."""
    if not s:
        return None
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        try:
            return datetime.strptime(s[:19], "%Y-%m-%dT%H:%M:%S")
        except Exception:
            try:
                return datetime.strptime(s[:10], "%Y-%m-%d")
            except Exception:
                return None


def _period_bounds(periode: str):
    """Bornes de la période courante et de la période précédente équivalente."""
    now = datetime.now()
    if periode == "jour":
        cur_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        prev_start = cur_start - timedelta(days=1)
        prev_end = cur_start
    elif periode == "semaine":
        cur_start = now - timedelta(days=7)
        prev_start = cur_start - timedelta(days=7)
        prev_end = cur_start
    else:  # mois
        cur_start = now - timedelta(days=30)
        prev_start = cur_start - timedelta(days=30)
        prev_end = cur_start
    return cur_start, now, prev_start, prev_end


def _delta(curr: int, prev: int):
    delta = curr - prev
    if prev > 0:
        pct = round((delta / prev) * 100, 1)
    else:
        pct = 100.0 if curr > 0 else 0.0
    return delta, pct


def _bucket_index(periode: str, cur_start: datetime, dt: datetime | None):
    """Retourne l'index du bucket temporel (graphique) pour une date donnée, ou None."""
    if dt is None or dt < cur_start:
        return None
    if periode == "jour":
        if dt.date() != cur_start.date():
            return None
        return dt.hour  # 0-23
    elif periode == "semaine":
        delta_days = (dt.date() - cur_start.date()).days
        return delta_days if 0 <= delta_days < 7 else None
    else:  # mois -> 4 buckets hebdomadaires
        delta_days = (dt - cur_start).days
        idx = delta_days // 8
        return idx if 0 <= idx < 4 else None


def _bucket_labels(periode: str, cur_start: datetime):
    if periode == "jour":
        return [f"{h:02d}h" for h in range(24)]
    elif periode == "semaine":
        jours_fr = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
        return [jours_fr[(cur_start + timedelta(days=i)).weekday()] for i in range(7)]
    else:
        return ["Sem 1", "Sem 2", "Sem 3", "Sem 4"]


@app.get("/stats/dashboard")
def get_stats_dashboard(periode: str = "mois", _: dict = Depends(get_current_user)):
    if periode not in ("jour", "semaine", "mois"):
        periode = "mois"

    cur_start, cur_end, prev_start, prev_end = _period_bounds(periode)

    with Session(engine) as session:
        patients      = session.exec(select(Patient)).all()
        medecins      = session.exec(select(Medecin)).all()
        rdvs          = session.exec(select(RendezVous)).all()
        consultations = session.exec(select(Consultation)).all()
        ordonnances   = session.exec(select(Ordonnance)).all()

    # On associe chaque enregistrement à sa date parsée (sans muter les objets SQLModel)
    rdvs_dt  = [(r, _parse_dt(r.date_heure)) for r in rdvs]
    cons_dt  = [(c, _parse_dt(c.date)) for c in consultations]
    ord_dt   = [(o, _parse_dt(o.date)) for o in ordonnances]
    pat_dt   = [(p, _parse_dt(p.created_at)) for p in patients]

    def in_range(dt, start, end):
        return dt is not None and start <= dt <= end

    rdv_cur  = [(r, dt) for r, dt in rdvs_dt if in_range(dt, cur_start, cur_end)]
    rdv_prev = [(r, dt) for r, dt in rdvs_dt if in_range(dt, prev_start, prev_end)]
    cons_cur  = [(c, dt) for c, dt in cons_dt if in_range(dt, cur_start, cur_end)]
    cons_prev = [(c, dt) for c, dt in cons_dt if in_range(dt, prev_start, prev_end)]
    ord_cur  = [(o, dt) for o, dt in ord_dt if in_range(dt, cur_start, cur_end)]
    ord_prev = [(o, dt) for o, dt in ord_dt if in_range(dt, prev_start, prev_end)]
    pat_cur  = [(p, dt) for p, dt in pat_dt if in_range(dt, cur_start, cur_end)]
    pat_prev = [(p, dt) for p, dt in pat_dt if in_range(dt, prev_start, prev_end)]

    d_rdv, p_rdv   = _delta(len(rdv_cur), len(rdv_prev))
    d_cons, p_cons = _delta(len(cons_cur), len(cons_prev))
    d_ord, p_ord   = _delta(len(ord_cur), len(ord_prev))
    d_pat, p_pat   = _delta(len(pat_cur), len(pat_prev))

    kpi = {
        "patients_total": len(patients),
        "medecins_total": len(medecins),
        "rendez_vous":       {"valeur": len(rdv_cur),  "delta": d_rdv,  "delta_pct": p_rdv},
        "consultations":     {"valeur": len(cons_cur), "delta": d_cons, "delta_pct": p_cons},
        "ordonnances":       {"valeur": len(ord_cur),  "delta": d_ord,  "delta_pct": p_ord},
        "nouveaux_patients": {"valeur": len(pat_cur),  "delta": d_pat,  "delta_pct": p_pat},
    }

    rdv_statuts = {
        "planifie": len([1 for r, _ in rdv_cur if r.statut == "planifie"]),
        "confirme": len([1 for r, _ in rdv_cur if r.statut == "confirme"]),
        "annule":   len([1 for r, _ in rdv_cur if r.statut == "annule"]),
    }

    # ── Activité par bucket temporel (pour le graphique) ──
    labels = _bucket_labels(periode, cur_start)
    n = len(labels)
    rdv_buckets  = [0] * n
    cons_buckets = [0] * n
    ord_buckets  = [0] * n
    pat_buckets  = [0] * n

    for _, dt in rdv_cur:
        idx = _bucket_index(periode, cur_start, dt)
        if idx is not None:
            rdv_buckets[idx] += 1
    for _, dt in cons_cur:
        idx = _bucket_index(periode, cur_start, dt)
        if idx is not None:
            cons_buckets[idx] += 1
    for _, dt in ord_cur:
        idx = _bucket_index(periode, cur_start, dt)
        if idx is not None:
            ord_buckets[idx] += 1
    for _, dt in pat_cur:
        idx = _bucket_index(periode, cur_start, dt)
        if idx is not None:
            pat_buckets[idx] += 1

    # ── Top médecins (consultations sur la période) ──
    medecins_map = {m.id: m for m in medecins}
    compte = defaultdict(int)
    for c, _ in cons_cur:
        compte[c.medecin_id] += 1
    top = sorted(compte.items(), key=lambda kv: kv[1], reverse=True)[:5]
    top_medecins = [
        {
            "nom": f"{medecins_map[mid].prenom} {medecins_map[mid].nom}",
            "specialite": medecins_map[mid].specialite,
            "consultations": cnt,
        }
        for mid, cnt in top if mid in medecins_map
    ]

    return {
        "kpi": kpi,
        "rdv_statuts": rdv_statuts,
        "activite": {
            "labels": labels,
            "rendez_vous": rdv_buckets,
            "consultations": cons_buckets,
            "ordonnances": ord_buckets,
            "nouveaux_patients": pat_buckets,
        },
        "top_medecins": top_medecins,
    }

# ─────────────────────────────────────────
# ROUTES — CRM / SATISFACTION PATIENT
# ─────────────────────────────────────────

@app.post("/crm/satisfaction")
def create_satisfaction(data: SatisfactionCreate, user: dict = Depends(get_current_user)):
    if data.note < 1 or data.note > 5:
        raise HTTPException(status_code=400, detail="La note doit être comprise entre 1 et 5")
    with Session(engine) as session:
        patient = session.get(Patient, data.patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient non trouvé")
        note = SatisfactionNote(
            patient_id=data.patient_id,
            medecin_id=data.medecin_id,
            rendez_vous_id=data.rendez_vous_id,
            note=data.note,
            commentaire=data.commentaire,
            auteur=user.get("name"),
        )
        session.add(note)
        session.commit()
        session.refresh(note)
        return note

@app.get("/crm/satisfaction/patient/{patient_id}")
def get_satisfaction_patient(patient_id: int, _: dict = Depends(get_current_user)):
    with Session(engine) as session:
        notes    = session.exec(
            select(SatisfactionNote)
            .where(SatisfactionNote.patient_id == patient_id)
        ).all()
        medecins = {m.id: m for m in session.exec(select(Medecin)).all()}
        notes_sorted = sorted(notes, key=lambda n: n.date, reverse=True)
        return [
            {
                "id":          n.id,
                "note":        n.note,
                "commentaire": n.commentaire,
                "auteur":      n.auteur,
                "date":        n.date,
                "medecin":     f"Dr. {medecins[n.medecin_id].prenom} {medecins[n.medecin_id].nom}"
                               if n.medecin_id and n.medecin_id in medecins else None,
            }
            for n in notes_sorted
        ]

@app.delete("/crm/satisfaction/{note_id}")
def delete_satisfaction(note_id: int, _: dict = Depends(get_current_user)):
    with Session(engine) as session:
        note = session.get(SatisfactionNote, note_id)
        if not note:
            raise HTTPException(status_code=404, detail="Note non trouvée")
        session.delete(note)
        session.commit()
        return {"message": "Note supprimée"}

@app.get("/crm/patients")
def get_crm_patients(_: dict = Depends(get_current_user)):
    """Vue CRM agrégée : pour chaque patient — nb visites, dernier passage, moyenne satisfaction."""
    with Session(engine) as session:
        patients      = session.exec(select(Patient)).all()
        rdvs          = session.exec(select(RendezVous)).all()
        consultations = session.exec(select(Consultation)).all()
        notes         = session.exec(select(SatisfactionNote)).all()

    rdv_by_patient  = defaultdict(list)
    cons_by_patient = defaultdict(list)
    notes_by_patient = defaultdict(list)

    for r in rdvs:
        rdv_by_patient[r.patient_id].append(r)
    for c in consultations:
        cons_by_patient[c.patient_id].append(c)
    for n in notes:
        notes_by_patient[n.patient_id].append(n)

    result = []
    for p in patients:
        p_rdvs  = rdv_by_patient.get(p.id, [])
        p_cons  = cons_by_patient.get(p.id, [])
        p_notes = notes_by_patient.get(p.id, [])

        dates_passage = [
            dt for dt in (
                [_parse_dt(r.date_heure) for r in p_rdvs if r.statut == "termine"]
                + [_parse_dt(c.date) for c in p_cons]
            ) if dt is not None
        ]
        dernier_passage = max(dates_passage).isoformat() if dates_passage else None

        moyenne = round(sum(n.note for n in p_notes) / len(p_notes), 1) if p_notes else None
        dernier_commentaire = None
        if p_notes:
            derniere_note = max(p_notes, key=lambda n: n.date)
            dernier_commentaire = derniere_note.commentaire

        result.append({
            "id":                  p.id,
            "nom":                 p.nom,
            "prenom":              p.prenom,
            "telephone":           p.telephone,
            "email":               p.email,
            "nb_rdv":              len(p_rdvs),
            "nb_consultations":    len(p_cons),
            "dernier_passage":     dernier_passage,
            "satisfaction_moyenne": moyenne,
            "nb_avis":             len(p_notes),
            "dernier_commentaire": dernier_commentaire,
        })

    # Tri : dernier passage le plus récent en premier (patients jamais vus à la fin)
    result.sort(key=lambda x: x["dernier_passage"] or "", reverse=True)
    return result

@app.get("/crm/overview")
def get_crm_overview(_: dict = Depends(get_current_user)):
    """KPI globaux de satisfaction pour l'en-tête de la page Statistique et CRM."""
    with Session(engine) as session:
        notes = session.exec(select(SatisfactionNote)).all()
        total_patients = len(session.exec(select(Patient)).all())

    total_avis = len(notes)
    moyenne_globale = round(sum(n.note for n in notes) / total_avis, 2) if total_avis else None
    satisfaits = len([n for n in notes if n.note >= 4])
    insatisfaits = len([n for n in notes if n.note <= 2])
    taux_satisfaction = round((satisfaits / total_avis) * 100, 1) if total_avis else None

    repartition = {str(i): len([n for n in notes if n.note == i]) for i in range(1, 6)}

    return {
        "total_avis":          total_avis,
        "total_patients":      total_patients,
        "patients_avec_avis":  len({n.patient_id for n in notes}),
        "moyenne_globale":     moyenne_globale,
        "taux_satisfaction":   taux_satisfaction,
        "insatisfaits":        insatisfaits,
        "repartition_notes":   repartition,
    }

    # ═════════════════════════════════════════════════════════════════════════
# À AJOUTER DANS main.py — Section PARAMÈTRES
# ═════════════════════════════════════════════════════════════════════════
#
# 1) Ajoute le modèle ClinicSettings avec les autres modèles (après SatisfactionNote)
# 2) Ajoute les schémas avec les autres schémas (après SatisfactionCreate)
# 3) Ajoute les routes à la fin du fichier
# 4) Dans on_startup(), après la création de l'admin, initialise ClinicSettings
#    (voir bloc à la fin de ce fichier)


# ─────────────────────────────────────────
# MODÈLE — Paramètres généraux de la clinique (ligne unique, id=1)
# ─────────────────────────────────────────

class ClinicSettings(SQLModel, table=True):
    id:                     int | None = Field(default=None, primary_key=True)
    nom_clinique:           str         = "Ma Clinique"
    adresse:                str | None  = None
    telephone:              str | None  = None
    email:                  str | None  = None
    site_web:               str | None  = None
    logo_url:               str | None  = None
    devise:                 str         = "FCFA"
    fuseau_horaire:         str         = "Africa/Niamey"
    # Horaires d'ouverture
    horaire_ouverture:      str         = "08:00"
    horaire_fermeture:      str         = "18:00"
    jours_ouverture:        str         = "Lun,Mar,Mer,Jeu,Ven"   # liste séparée par des virgules
    # Rendez-vous
    duree_rdv_defaut:       int         = 30     # minutes
    delai_annulation_h:     int         = 24     # heures avant le RDV
    rappel_rdv_actif:       bool        = True
    rappel_rdv_heures_avant: int        = 24
    # Divers
    updated_at:             str = Field(default_factory=lambda: datetime.now().isoformat())


# ─────────────────────────────────────────
# SCHÉMAS
# ─────────────────────────────────────────

class ClinicSettingsUpdate(BaseModel):
    nom_clinique:            str | None = None
    adresse:                 str | None = None
    telephone:               str | None = None
    email:                   str | None = None
    site_web:                str | None = None
    logo_url:                str | None = None
    devise:                  str | None = None
    fuseau_horaire:          str | None = None
    horaire_ouverture:       str | None = None
    horaire_fermeture:       str | None = None
    jours_ouverture:         str | None = None
    duree_rdv_defaut:        int | None = None
    delai_annulation_h:      int | None = None
    rappel_rdv_actif:        bool | None = None
    rappel_rdv_heures_avant: int | None = None

class UserUpdate(BaseModel):
    role:  str | None = None
    email: str | None = None

class PasswordChange(BaseModel):
    ancien_mot_de_passe:   str | None = None   # requis si l'utilisateur change son propre mdp
    nouveau_mot_de_passe:  str


# ─────────────────────────────────────────
# ROUTES — PARAMÈTRES CLINIQUE
# ─────────────────────────────────────────

@app.get("/settings/clinique")
def get_clinic_settings(_: dict = Depends(get_current_user)):
    with Session(engine) as session:
        settings = session.exec(select(ClinicSettings)).first()
        if not settings:
            settings = ClinicSettings()
            session.add(settings)
            session.commit()
            session.refresh(settings)
        return settings

@app.put("/settings/clinique")
def update_clinic_settings(data: ClinicSettingsUpdate, _: dict = Depends(require_admin)):
    with Session(engine) as session:
        settings = session.exec(select(ClinicSettings)).first()
        if not settings:
            settings = ClinicSettings()
            session.add(settings)
        for key, val in data.dict(exclude_unset=True).items():
            setattr(settings, key, val)
        settings.updated_at = datetime.now().isoformat()
        session.add(settings)
        session.commit()
        session.refresh(settings)
        return settings


# ─────────────────────────────────────────
# ROUTES — GESTION DES UTILISATEURS (complète les routes /users existantes)
# ─────────────────────────────────────────

@app.put("/users/{user_id}")
def update_user(user_id: int, data: UserUpdate, _: dict = Depends(require_admin)):
    with Session(engine) as session:
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
        for key, val in data.dict(exclude_unset=True).items():
            setattr(user, key, val)
        session.add(user)
        session.commit()
        session.refresh(user)
        return {"id": user.id, "name": user.name, "role": user.role, "email": user.email}

@app.delete("/users/{user_id}")
def delete_user(user_id: int, current: dict = Depends(require_admin)):
    if int(current["sub"]) == user_id:
        raise HTTPException(status_code=400, detail="Impossible de supprimer votre propre compte")
    with Session(engine) as session:
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
        session.delete(user)
        session.commit()
        return {"message": "Utilisateur supprimé"}

@app.put("/users/{user_id}/password")
def change_password(user_id: int, data: PasswordChange, current: dict = Depends(get_current_user)):
    is_self  = int(current["sub"]) == user_id
    is_admin = current.get("role") == "admin"
    if not is_self and not is_admin:
        raise HTTPException(status_code=403, detail="Non autorisé")
    with Session(engine) as session:
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
        # Un utilisateur qui change son propre mot de passe doit fournir l'ancien
        if is_self and not is_admin:
            if not data.ancien_mot_de_passe or not bcrypt.checkpw(
                data.ancien_mot_de_passe.encode(), user.password.encode()
            ):
                raise HTTPException(status_code=400, detail="Ancien mot de passe incorrect")
        if len(data.nouveau_mot_de_passe) < 6:
            raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 6 caractères")
        user.password = bcrypt.hashpw(data.nouveau_mot_de_passe.encode(), bcrypt.gensalt()).decode()
        session.add(user)
        session.commit()
        return {"message": "Mot de passe mis à jour"}

@app.get("/users/me")
def get_me(current: dict = Depends(get_current_user)):
    with Session(engine) as session:
        user = session.get(User, int(current["sub"]))
        if not user:
            raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
        return {"id": user.id, "name": user.name, "role": user.role, "email": user.email}


# ─────────────────────────────────────────
# À AJOUTER DANS on_startup() — juste après la création de l'admin
# ─────────────────────────────────────────
#
# @app.on_event("startup")
# def on_startup():
#     create_db()
#     with Session(engine) as session:
#         if not session.exec(select(User)).first():
#             hashed = bcrypt.hashpw("admin123".encode(), bcrypt.gensalt()).decode()
#             session.add(User(name="admin", password=hashed,
#                              role="admin", email="admin@clinique.com"))
#             session.commit()
#             print("✅ Admin créé — user: admin / pass: admin123")
#
#         # ── AJOUT : initialise les paramètres de la clinique s'ils n'existent pas ──
#         if not session.exec(select(ClinicSettings)).first():
#             session.add(ClinicSettings())
#             session.commit()
#             print("✅ Paramètres clinique initialisés (valeurs par défaut)")