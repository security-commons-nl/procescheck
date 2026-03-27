from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.deps import get_db
from app.models import Process
from app.models.bia import BiaAssessment
from app.schemas.dashboard import (
    DashboardSummary, ProcessCompleteness, BivTopStats, BivTopItem,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

SCORE_LABELS = {1: "Vitaal", 2: "Hoog", 3: "Midden", 4: "Laag", 5: "Minimaal"}


def _check_completeness(p: Process) -> tuple[bool, list[str]]:
    """Return (is_complete, missing_fields) for a process."""
    missing: list[str] = []
    if not p.description:
        missing.append("Beschrijving")
    if not p.objective:
        missing.append("Doelstelling")
    if not p.owner:
        missing.append("Eigenaar")
    if not p.department:
        missing.append("Afdeling")
    if not p.last_assessment_date:
        missing.append("Laatste beoordelingsdatum")
    if p.is_critical and not p.critical_reason:
        missing.append("Reden kritiek")
    if not p.applications:
        missing.append("Gekoppelde applicaties")
    if p.bia is None:
        missing.append("BIA / BIV")
    if p.rto_rpo is None:
        missing.append("RTO / RPO")
    if p.business_context is None:
        missing.append("Business context")
    return len(missing) == 0, missing


@router.get("/summary", response_model=DashboardSummary)
def get_summary(db: Session = Depends(get_db)):
    processes = db.query(Process).all()
    total = len(processes)
    critical = sum(1 for p in processes if p.is_critical)
    complete = 0
    attention = 0
    incomplete = 0
    for p in processes:
        _, missing = _check_completeness(p)
        n = len(missing)
        if n == 0:
            complete += 1
        elif n <= 3:
            attention += 1
        else:
            incomplete += 1
    return DashboardSummary(
        total_processes=total,
        critical_processes=critical,
        complete_count=complete,
        attention_count=attention,
        incomplete_count=incomplete,
    )


@router.get("/completeness", response_model=list[ProcessCompleteness])
def get_completeness(db: Session = Depends(get_db)):
    processes = db.query(Process).order_by(Process.code).all()
    result = []
    for p in processes:
        is_complete, missing = _check_completeness(p)
        result.append(ProcessCompleteness(
            id=p.id,
            code=p.code,
            name=p.name,
            is_critical=p.is_critical,
            has_bia=p.bia is not None,
            has_rto_rpo=p.rto_rpo is not None,
            has_business_context=p.business_context is not None,
            app_count=len(p.applications),
            is_complete=is_complete,
            missing_fields=missing,
        ))
    return result


@router.get("/biv-top", response_model=BivTopStats)
def get_biv_top(limit: int = 5, db: Session = Depends(get_db)):
    def _top(field):
        rows = (
            db.query(Process, field)
            .join(BiaAssessment, BiaAssessment.process_id == Process.id)
            .filter(field.isnot(None))
            .order_by(field.asc())
            .limit(limit)
            .all()
        )
        return [
            BivTopItem(
                process_id=p.id,
                process_code=p.code,
                process_name=p.name,
                score=score,
                label=SCORE_LABELS.get(score, str(score)),
            )
            for p, score in rows
        ]

    return BivTopStats(
        availability=_top(BiaAssessment.availability_score),
        integrity=_top(BiaAssessment.integrity_score),
        confidentiality=_top(BiaAssessment.confidentiality_score),
    )
