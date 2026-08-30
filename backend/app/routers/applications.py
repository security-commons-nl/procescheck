import re
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.auth import require_editor, require_admin
from app.deps import get_db
from app.models import Application
from app.schemas.application import ApplicationCreate, ApplicationUpdate, ApplicationResponse

router = APIRouter(prefix="/applications", tags=["applications"])


def _generate_next_code(db: Session) -> str:
    codes = db.query(Application.code).all()
    highest = 0
    for (code,) in codes:
        m = re.fullmatch(r"KAPP-(\d+)", code or "")
        if m:
            highest = max(highest, int(m.group(1)))
    return f"KAPP-{highest + 1:03d}"


@router.get("/next-code")
def get_next_code(db: Session = Depends(get_db)):
    return {"code": _generate_next_code(db)}


@router.get("", response_model=list[ApplicationResponse])
def list_applications(
    search: str | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Application)
    if search:
        q = q.filter(Application.name.ilike(f"%{search}%") | Application.code.ilike(f"%{search}%"))
    return q.order_by(Application.code).all()


@router.post("", response_model=ApplicationResponse, status_code=201, dependencies=[Depends(require_editor)])
def create_application(body: ApplicationCreate, db: Session = Depends(get_db)):
    if db.query(Application).filter(Application.code == body.code).first():
        raise HTTPException(400, f"Application code '{body.code}' already exists")
    a = Application(**body.model_dump())
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


@router.get("/{app_id}", response_model=ApplicationResponse)
def get_application(app_id: int, db: Session = Depends(get_db)):
    a = db.get(Application, app_id)
    if not a:
        raise HTTPException(404, "Application not found")
    return a


@router.put("/{app_id}", response_model=ApplicationResponse, dependencies=[Depends(require_editor)])
def update_application(app_id: int, body: ApplicationUpdate, db: Session = Depends(get_db)):
    a = db.get(Application, app_id)
    if not a:
        raise HTTPException(404, "Application not found")
    data = body.model_dump(exclude_unset=True)
    new_code = data.get("code")
    if new_code and new_code != a.code and db.query(Application).filter(
        Application.code == new_code, Application.id != app_id
    ).first():
        raise HTTPException(400, f"Applicatiecode '{new_code}' bestaat al")
    for k, v in data.items():
        setattr(a, k, v)
    a.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(a)
    return a


@router.delete("/{app_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_application(app_id: int, db: Session = Depends(get_db)):
    a = db.get(Application, app_id)
    if not a:
        raise HTTPException(404, "Application not found")
    db.delete(a)
    db.commit()
