import re
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.auth import require_editor, require_admin
from app.deps import get_db
from app.models import Process, Application
from app.schemas.process import ProcessCreate, ProcessUpdate, ProcessResponse

router = APIRouter(prefix="/processes", tags=["processes"])


class LinkApplicationRequest(BaseModel):
    application_id: int


def _generate_next_code(db: Session) -> str:
    """Return the next available KP-NNN code."""
    codes = db.query(Process.code).all()
    highest = 0
    for (code,) in codes:
        m = re.fullmatch(r"KP-(\d+)", code or "")
        if m:
            highest = max(highest, int(m.group(1)))
    return f"KP-{highest + 1:03d}"


def _to_response(p: Process) -> ProcessResponse:
    return ProcessResponse(
        **{c: getattr(p, c) for c in [
            "id", "code", "name", "description", "objective", "owner",
            "department", "is_critical", "critical_reason",
            "last_assessment_date", "notes", "created_at", "updated_at",
        ]},
        applications=p.applications,
        has_bia=p.bia is not None,
        has_rto_rpo=p.rto_rpo is not None,
        has_business_context=p.business_context is not None,
    )


@router.get("/next-code")
def get_next_code(db: Session = Depends(get_db)):
    return {"code": _generate_next_code(db)}


@router.get("", response_model=list[ProcessResponse])
def list_processes(
    is_critical: bool | None = Query(None),
    department: str | None = Query(None),
    search: str | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Process)
    if is_critical is not None:
        q = q.filter(Process.is_critical == is_critical)
    if department:
        q = q.filter(Process.department == department)
    if search:
        pattern = f"%{search}%"
        q = q.filter(
            Process.name.ilike(pattern)
            | Process.code.ilike(pattern)
            | Process.owner.ilike(pattern)
            | Process.department.ilike(pattern)
        )
    return [_to_response(p) for p in q.order_by(Process.code).all()]


@router.post("", response_model=ProcessResponse, status_code=201, dependencies=[Depends(require_editor)])
def create_process(body: ProcessCreate, db: Session = Depends(get_db)):
    code = body.code or _generate_next_code(db)
    if db.query(Process).filter(Process.code == code).first():
        raise HTTPException(400, f"Procescode '{code}' bestaat al")
    data = body.model_dump(exclude={"code"})
    p = Process(code=code, **data)
    db.add(p)
    db.commit()
    db.refresh(p)
    return _to_response(p)


@router.get("/{process_id}", response_model=ProcessResponse)
def get_process(process_id: int, db: Session = Depends(get_db)):
    p = db.get(Process, process_id)
    if not p:
        raise HTTPException(404, "Proces niet gevonden")
    return _to_response(p)


@router.put("/{process_id}", response_model=ProcessResponse, dependencies=[Depends(require_editor)])
def update_process(process_id: int, body: ProcessUpdate, db: Session = Depends(get_db)):
    p = db.get(Process, process_id)
    if not p:
        raise HTTPException(404, "Proces niet gevonden")
    data = body.model_dump(exclude_unset=True)
    new_code = data.get("code")
    if new_code and new_code != p.code and db.query(Process).filter(
        Process.code == new_code, Process.id != process_id
    ).first():
        raise HTTPException(400, f"Procescode '{new_code}' bestaat al")
    for k, v in data.items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return _to_response(p)


@router.delete("/{process_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_process(process_id: int, db: Session = Depends(get_db)):
    p = db.get(Process, process_id)
    if not p:
        raise HTTPException(404, "Proces niet gevonden")
    db.delete(p)
    db.commit()


@router.get("/{process_id}/applications", response_model=list)
def get_process_applications(process_id: int, db: Session = Depends(get_db)):
    p = db.get(Process, process_id)
    if not p:
        raise HTTPException(404, "Proces niet gevonden")
    return [{"id": a.id, "code": a.code, "name": a.name} for a in p.applications]


@router.post("/{process_id}/applications", status_code=204, dependencies=[Depends(require_editor)])
def link_application(process_id: int, body: LinkApplicationRequest, db: Session = Depends(get_db)):
    p = db.get(Process, process_id)
    if not p:
        raise HTTPException(404, "Proces niet gevonden")
    app = db.get(Application, body.application_id)
    if not app:
        raise HTTPException(404, "Applicatie niet gevonden")
    if app not in p.applications:
        p.applications.append(app)
        db.commit()


@router.delete("/{process_id}/applications/{app_id}", status_code=204, dependencies=[Depends(require_editor)])
def unlink_application(process_id: int, app_id: int, db: Session = Depends(get_db)):
    p = db.get(Process, process_id)
    if not p:
        raise HTTPException(404, "Proces niet gevonden")
    app = db.get(Application, app_id)
    if app and app in p.applications:
        p.applications.remove(app)
        db.commit()
