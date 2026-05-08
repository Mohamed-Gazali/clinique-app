from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Field, SQLModel, create_engine, Session, select
from pydantic import BaseModel
from datetime import datetime, timedelta
from dotenv import load_dotenv
import os, bcrypt, jwt

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

# ─────────────────────────────────────────
# DATABASE
# ─────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///clinique.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
if DATABASE_URL:
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    # Neon nécessite SSL
    engine = create_engine(
        DATABASE_URL,
        connect_args={"sslmode": "require"} if "neon.tech" in DATABASE_URL else {}
    )
else:
    engine = create_engine("sqlite:///clinique.db")

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
    id:              int | None = Field(default=None, primary_key=True)
    consultation_id: int        = Field(foreign_key="consultation.id")
    patient_id:      int        = Field(foreign_key="patient.id")
    medecin_id:      int        = Field(foreign_key="medecin.id")
    medicaments:     str
    instructions:    str | None = None
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
    medicaments:     str
    instructions:    str | None = None

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
def create_ordonnance(data: OrdonnanceCreate, _: dict = Depends(get_current_user)):
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

# ─────────────────────────────────────────
# ROUTES — DASHBOARD STATS
# ─────────────────────────────────────────

@app.get("/stats")
def get_stats(_: dict = Depends(get_current_user)):
    with Session(engine) as session:
        patients      = session.exec(select(Patient)).all()
        medecins      = session.exec(select(Medecin)).all()
        rdvs          = session.exec(select(RendezVous)).all()
        consultations = session.exec(select(Consultation)).all()
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
        }