from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.deps import get_db
from app.models.audit import AuditLog
from app.schemas.audit import AuditLogResponse

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=list[AuditLogResponse])
def list_audit_log(
    entity_type: str | None = Query(None),
    entity_id: int | None = Query(None),
    process_id: int | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    q = db.query(AuditLog)
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if entity_id is not None:
        q = q.filter(AuditLog.entity_id == entity_id)
    if process_id is not None:
        q = q.filter(AuditLog.process_id == process_id)
    return q.order_by(AuditLog.id.desc()).offset(offset).limit(limit).all()
