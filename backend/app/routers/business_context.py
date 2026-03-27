from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.deps import get_db
from app.models import Process
from app.models.business_context import BusinessContext
from app.schemas.business_context import BusinessContextUpsert, BusinessContextResponse

router = APIRouter(prefix="/business-context", tags=["business-context"])


@router.get("/{process_id}", response_model=BusinessContextResponse)
def get_business_context(process_id: int, db: Session = Depends(get_db)):
    if not db.get(Process, process_id):
        raise HTTPException(404, "Process not found")
    bc = db.query(BusinessContext).filter(BusinessContext.process_id == process_id).first()
    if not bc:
        raise HTTPException(404, "Business context not yet created")
    return bc


@router.put("/{process_id}", response_model=BusinessContextResponse)
def upsert_business_context(process_id: int, body: BusinessContextUpsert, db: Session = Depends(get_db)):
    if not db.get(Process, process_id):
        raise HTTPException(404, "Process not found")
    bc = db.query(BusinessContext).filter(BusinessContext.process_id == process_id).first()
    if bc:
        for k, v in body.model_dump().items():
            setattr(bc, k, v)
    else:
        bc = BusinessContext(process_id=process_id, **body.model_dump())
        db.add(bc)
    db.commit()
    db.refresh(bc)
    return bc


@router.delete("/{process_id}", status_code=204)
def delete_business_context(process_id: int, db: Session = Depends(get_db)):
    bc = db.query(BusinessContext).filter(BusinessContext.process_id == process_id).first()
    if bc:
        db.delete(bc)
        db.commit()
