from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from apscheduler.schedulers.background import BackgroundScheduler
from agents import generate_search_terms, filter_papers
from scraper import search_papers
import json
import os

FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "surgify-mvp", "dist")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store: surgeon profiles and their latest digests
surgeon_profiles: dict[str, dict] = {}
latest_digests: dict[str, dict] = {}

STORE_FILE = "store.json"


def _load_store():
    if os.path.exists(STORE_FILE):
        with open(STORE_FILE) as f:
            data = json.load(f)
            surgeon_profiles.update(data.get("profiles", {}))
            latest_digests.update(data.get("digests", {}))


def _save_store():
    with open(STORE_FILE, "w") as f:
        json.dump({"profiles": surgeon_profiles, "digests": latest_digests}, f)


def run_analysis_for(profile: dict) -> dict:
    terms = generate_search_terms(profile)
    papers = search_papers(terms, max_per_term=3, recent_only=profile.get("recent_only", True))
    digest = filter_papers(papers, profile)
    return {"search_terms": terms, "total_found": len(papers), "digest": digest}


def weekly_job():
    print(f"Running weekly digest for {len(surgeon_profiles)} surgeons...")
    for name, profile in surgeon_profiles.items():
        try:
            result = run_analysis_for(profile)
            latest_digests[name] = result
            print(f"  Done: {name} — {len(result['digest'])} relevant papers")
        except Exception as e:
            print(f"  Failed for {name}: {e}")
    _save_store()


scheduler = BackgroundScheduler()
scheduler.add_job(weekly_job, "interval", weeks=1, id="weekly_digest")
scheduler.start()


@app.on_event("startup")
def startup():
    _load_store()


@app.get("/api/status")
def root():
    return {"status": "Surgify API running", "surgeons_registered": len(surgeon_profiles)}


class SurgeonProfile(BaseModel):
    # Identity
    title: str = "Dr"
    name: str
    institution: str = ""
    country: str = ""
    # Specialty
    specialty: str
    subspecialty: str = ""
    experience_years: int
    # Procedures
    primary_procedures: list[str] = []
    secondary_procedures: list[str] = []
    learning_procedures: list[str] = []
    procedures: list[str] = []          # legacy / combined fallback
    # Techniques & technology
    approaches: list[str] = []          # open, laparoscopic, robotic etc.
    techniques: list[str] = []
    devices: list[str] = []
    # Research preferences
    study_types: list[str] = []         # RCT, Meta-analysis, Review, etc.
    clinical_interests: list[str] = []
    cpd_logging: bool = False
    # Search config
    recent_only: bool = True


@app.post("/register")
def register(profile: SurgeonProfile):
    try:
        surgeon_profiles[profile.name] = profile.dict()
        _save_store()
        return {"message": f"{profile.name} registered. Weekly digest will run automatically."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/digest/{name}")
def get_digest(name: str):
    if name not in latest_digests:
        raise HTTPException(status_code=404, detail="No digest yet. Run /analyze first.")
    return latest_digests[name]


@app.get("/surgeons")
def list_surgeons():
    return {"surgeons": list(surgeon_profiles.keys())}


@app.post("/analyze")
async def analyze(profile: SurgeonProfile):
    try:
        surgeon_profiles[profile.name] = profile.dict()
        result = run_analysis_for(profile.dict())
        latest_digests[profile.name] = result
        _save_store()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Serve the React frontend — must come AFTER all API routes
FRONTEND_HTML = os.path.join(os.path.dirname(__file__), "..", "frontend", "index.html")

if os.path.exists(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    @app.get("/onboard")
    async def serve_onboard():
        return FileResponse(FRONTEND_HTML)

    @app.get("/")
    @app.get("/app")
    @app.get("/app/{full_path:path}")
    async def serve_frontend(full_path: str = ""):
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
