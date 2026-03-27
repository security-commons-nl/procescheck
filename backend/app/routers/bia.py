from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.deps import get_db
from app.models import Process
from app.models.bia import BiaAssessment
from app.schemas.bia import BiaUpsert, BiaResponse

router = APIRouter(prefix="/bia", tags=["bia"])


@router.get("/{process_id}", response_model=BiaResponse)
def get_bia(process_id: int, db: Session = Depends(get_db)):
    if not db.get(Process, process_id):
        raise HTTPException(404, "Process not found")
    bia = db.query(BiaAssessment).filter(BiaAssessment.process_id == process_id).first()
    if not bia:
        raise HTTPException(404, "BIA not yet created for this process")
    return bia


@router.put("/{process_id}", response_model=BiaResponse)
def upsert_bia(process_id: int, body: BiaUpsert, db: Session = Depends(get_db)):
    if not db.get(Process, process_id):
        raise HTTPException(404, "Process not found")
    bia = db.query(BiaAssessment).filter(BiaAssessment.process_id == process_id).first()
    if bia:
        for k, v in body.model_dump().items():
            setattr(bia, k, v)
    else:
        bia = BiaAssessment(process_id=process_id, **body.model_dump())
        db.add(bia)
    db.commit()
    db.refresh(bia)
    return bia


@router.delete("/{process_id}", status_code=204)
def delete_bia(process_id: int, db: Session = Depends(get_db)):
    bia = db.query(BiaAssessment).filter(BiaAssessment.process_id == process_id).first()
    if bia:
        db.delete(bia)
        db.commit()
