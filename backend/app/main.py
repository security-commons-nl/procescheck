from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base
import app.models  # noqa: F401 – register all models with Base

from app.routers import processes, applications, bia, rto_rpo, business_context, dashboard, export

# Create tables on startup (Alembic preferred in production, this is fine for dev)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="ProcesCheck API",
    version="1.0.0",
    description="Centrale registratie van kritieke processen, IT-middelen en bedrijfseisen",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = "/api/v1"
app.include_router(processes.router, prefix=PREFIX)
app.include_router(applications.router, prefix=PREFIX)
app.include_router(bia.router, prefix=PREFIX)
app.include_router(rto_rpo.router, prefix=PREFIX)
app.include_router(business_context.router, prefix=PREFIX)
app.include_router(dashboard.router, prefix=PREFIX)
app.include_router(export.router, prefix=PREFIX)


@app.get("/health")
def health():
    return {"status": "ok"}
