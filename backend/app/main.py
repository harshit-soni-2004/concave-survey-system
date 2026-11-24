import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base
from app.core.seed import seed_database
import app.models
from app.routers import health, auth, surveys, respondent, dashboard_export, analytics

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        # Run programmatic migration and seed
        from alembic.config import Config
        from alembic import command
        try:
            alembic_cfg = Config("alembic.ini")
            command.upgrade(alembic_cfg, "head")
        except Exception as ae:
            Base.metadata.create_all(bind=engine)
            
        seed_database()
    except Exception as e:
        print(f"Startup initialization notice: {e}")
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url="/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix=settings.API_V1_STR)
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(surveys.router, prefix=settings.API_V1_STR)
app.include_router(dashboard_export.router, prefix=settings.API_V1_STR)
app.include_router(respondent.router, prefix=settings.API_V1_STR)
app.include_router(analytics.router, prefix=settings.API_V1_STR)

def get_frontend_dist():
    candidates = [
        os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist", "concave-survey-frontend"),
        os.path.join(os.path.dirname(__file__), "..", "static"),
        os.path.join(os.getcwd(), "static"),
        os.path.join(os.getcwd(), "backend", "static"),
        os.path.join(os.getcwd(), "frontend", "dist", "concave-survey-frontend"),
    ]
    for p in candidates:
        if os.path.isdir(p) and os.path.exists(os.path.join(p, "index.html")):
            return os.path.abspath(p)
    return None

@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    if full_path.startswith("api/") or full_path == "api" or full_path.startswith("docs") or full_path.startswith("openapi.json"):
        return {"error": "API route not found"}
    dist = get_frontend_dist()
    if dist:
        target_file = os.path.join(dist, full_path)
        if full_path and os.path.isfile(target_file):
            return FileResponse(target_file)
        return FileResponse(os.path.join(dist, "index.html"))
    return {
        "message": "Welcome to Concave Insights Custom Survey System API",
        "docs": f"{settings.API_V1_STR}/docs"
    }
