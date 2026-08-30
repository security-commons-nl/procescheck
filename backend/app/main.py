from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings
from app.auth import get_current_user
import app.models  # noqa: F401 – register all models with Base
import app.audit  # noqa: F401 – register audit-trail event listeners

from app.routers import processes, applications, bia, rto_rpo, business_context, dashboard, export, audit

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
    expose_headers=["Content-Disposition"],
)

_auth = [Depends(get_current_user)]

PREFIX = "/api/v1"
app.include_router(processes.router, prefix=PREFIX, dependencies=_auth)
app.include_router(applications.router, prefix=PREFIX, dependencies=_auth)
app.include_router(bia.router, prefix=PREFIX, dependencies=_auth)
app.include_router(rto_rpo.router, prefix=PREFIX, dependencies=_auth)
app.include_router(business_context.router, prefix=PREFIX, dependencies=_auth)
app.include_router(dashboard.router, prefix=PREFIX, dependencies=_auth)
app.include_router(export.router, prefix=PREFIX, dependencies=_auth)
app.include_router(audit.router, prefix=PREFIX, dependencies=_auth)


@app.get(f"{PREFIX}/me")
def me(user: dict = Depends(get_current_user)):
    """Ingelogde gebruiker inclusief rol (voor de frontend-UI)."""
    return {
        "email": user.get("email"),
        "name": user.get("name"),
        "role": user.get("role", "beheerder"),
        "rbac_enforced": settings.rbac_enforced,
    }


@app.get("/health")
def health():
    """Liveness/readiness-probe: controleert ook de databaseverbinding."""
    from sqlalchemy import text
    from app.database import engine
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        return JSONResponse(status_code=503, content={"status": "error", "database": "unreachable"})
    return {"status": "ok", "database": "ok"}
