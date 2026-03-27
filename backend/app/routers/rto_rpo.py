from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.deps import get_db
from app.models import Process
from app.models.rto_rpo import RtoRpo
from app.schemas.rto_rpo import RtoRpoUpsert, RtoRpoResponse

router = APIRouter(prefix="/rto-rpo", tags=["rto-rpo"])


@router.get("/{process_id}", response_model=RtoRpoResponse)
def get_rto_rpo(process_id: int, db: Session = Depends(get_db)):
    if not db.get(Process, process_id):
        raise HTTPException(404, "Process not found")
    rr = db.query(RtoRpo).filter(RtoRpo.process_id == process_id).first()
    if not rr:
        raise HTTPException(404, "RTO/RPO not yet created")
    return rr


@router.put("/{process_id}", response_model=RtoRpoResponse)
def upsert_rto_rpo(process_id: int, body: RtoRpoUpsert, db: Session = Depends(get_db)):
    if not db.get(Process, process_id):
        raise HTTPException(404, "Process not found")
    rr = db.query(RtoRpo).filter(RtoRpo.process_id == process_id).first()
    if rr:
        for k, v in body.model_dump().items():
            setattr(rr, k, v)
    else:
        rr = RtoRpo(process_id=process_id, **body.model_dump())
        db.add(rr)
    db.commit()
    db.refresh(rr)
    return rr


@router.delete("/{process_id}", status_code=204)
def delete_rto_rpo(process_id: int, db: Session = Depends(get_db)):
    rr = db.query(RtoRpo).filter(RtoRpo.process_id == process_id).first()
    if rr:
        db.delete(rr)
        db.commit()
