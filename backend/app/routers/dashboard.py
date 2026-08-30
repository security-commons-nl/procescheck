from datetime import date as _date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.deps import get_db
from app.models import Process, Application
from app.models.bia import BiaAssessment
from app.schemas.dashboard import (
    DashboardSummary, ProcessCompleteness, BivTopStats, BivTopItem,
    RiskOverview, BivDistribution, BivDimensionDistribution,
    CriticalProcessRisk, Coverage, CoverageStats, PrivacyExposure,
    PriorityAction, ReviewStatus, ReviewStatusItem,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

SCORE_LABELS = {1: "Vitaal", 2: "Hoog", 3: "Midden", 4: "Laag", 5: "Minimaal"}


def _has_rto_rpo(p: Process) -> bool:
    """RTO/RPO is defined when the BIA has b1_score (RTO) and b2_score (RPO) filled in."""
    return p.bia is not None and p.bia.b1_score is not None and p.bia.b2_score is not None


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
    if not _has_rto_rpo(p):
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
            has_rto_rpo=_has_rto_rpo(p),
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


@router.get("/risk-overview", response_model=RiskOverview)
def get_risk_overview(db: Session = Depends(get_db)):
    processes = db.query(Process).order_by(Process.code).all()
    total = len(processes)

    def _dim_dist(score_attr: str) -> BivDimensionDistribution:
        counts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        not_assessed = 0
        for p in processes:
            if p.bia is None:
                not_assessed += 1
            else:
                score = getattr(p.bia, score_attr, None)
                if score in counts:
                    counts[score] += 1
                else:
                    not_assessed += 1
        return BivDimensionDistribution(
            vitaal=counts[1], hoog=counts[2], midden=counts[3],
            laag=counts[4], minimaal=counts[5], not_assessed=not_assessed,
        )

    biv_dist = BivDistribution(
        availability=_dim_dist("availability_score"),
        integrity=_dim_dist("integrity_score"),
        confidentiality=_dim_dist("confidentiality_score"),
    )

    # Critical processes with risk info
    critical_list: list[CriticalProcessRisk] = []
    for p in processes:
        if not p.is_critical:
            continue
        _, missing = _check_completeness(p)
        critical_list.append(CriticalProcessRisk(
            id=p.id,
            code=p.code,
            name=p.name,
            availability_score=p.bia.availability_score if p.bia else None,
            integrity_score=p.bia.integrity_score if p.bia else None,
            confidentiality_score=p.bia.confidentiality_score if p.bia else None,
            has_bia=p.bia is not None,
            has_rto_rpo=_has_rto_rpo(p),
            missing_fields=missing,
        ))

    # Coverage
    def _cov(done_fn) -> CoverageStats:
        done = sum(1 for p in processes if done_fn(p))
        pct = round(done / total * 100) if total > 0 else 0
        return CoverageStats(done=done, total=total, pct=pct)

    coverage = Coverage(
        bia=_cov(lambda p: p.bia is not None),
        rto_rpo=_cov(lambda p: _has_rto_rpo(p)),
        business_context=_cov(lambda p: p.business_context is not None),
        applications=_cov(lambda p: len(p.applications) > 0),
    )

    # Privacy exposure + coverage (% processen met persoonsgegevens)
    privacy = PrivacyExposure(
        personal_data=sum(
            1 for p in processes
            if p.business_context and p.business_context.personal_data
        ),
        special_personal_data=sum(
            1 for p in processes
            if p.business_context and p.business_context.special_personal_data
        ),
    )
    privacy_coverage = _cov(
        lambda p: bool(p.business_context and p.business_context.personal_data)
    )

    # Procescompleetheid: Eigenaar, Afdeling, Beschrijving, Doelstelling,
    # en Reden kritisch (alleen als het proces kritisch is)
    def _fields_complete(p: Process) -> bool:
        if not p.owner:
            return False
        if not p.department:
            return False
        if not p.description:
            return False
        if not p.objective:
            return False
        if p.is_critical and not p.critical_reason:
            return False
        return True

    process_fields_coverage = _cov(_fields_complete)

    # High risk count: score 1 or 2 in any BIV dimension
    def _is_high_risk(p: Process) -> bool:
        if p.bia is None:
            return False
        for attr in ("availability_score", "integrity_score", "confidentiality_score"):
            s = getattr(p.bia, attr, None)
            if s is not None and s <= 2:
                return True
        return False

    high_risk_count = sum(1 for p in processes if _is_high_risk(p))

    # Priority actions — sorted: critical-no-BIA first, then high-risk-no-rto, then rest incomplete
    actions: list[PriorityAction] = []
    for p in processes:
        _, missing = _check_completeness(p)
        if not missing:
            continue
        if p.is_critical and p.bia is None:
            priority = "critical"
            reason = "Informatie ontbreekt"
        elif _is_high_risk(p) and not _has_rto_rpo(p):
            priority = "high"
            reason = "Hoog risico: geen RTO/RPO gedefinieerd"
        elif p.is_critical:
            priority = "high"
            reason = "Kritisch proces — onvolledig gedocumenteerd"
        elif len(missing) >= 4:
            priority = "medium"
            reason = f"{len(missing)} velden ontbreken"
        else:
            priority = "medium"
            reason = f"{len(missing)} veld(en) ontbreken"

        actions.append(PriorityAction(
            id=p.id,
            code=p.code,
            name=p.name,
            is_critical=p.is_critical,
            priority=priority,
            reason=reason,
            missing_fields=missing,
        ))

    # Sort: critical first, then high, then medium
    order = {"critical": 0, "high": 1, "medium": 2}
    actions.sort(key=lambda a: order[a.priority])

    return RiskOverview(
        biv_distribution=biv_dist,
        critical_processes=critical_list,
        coverage=coverage,
        privacy_exposure=privacy,
        privacy_coverage=privacy_coverage,
        process_fields_coverage=process_fields_coverage,
        high_risk_count=high_risk_count,
        priority_actions=actions,
    )


@router.get("/review-status", response_model=ReviewStatus)
def get_review_status(db: Session = Depends(get_db)):
    today = _date.today()
    try:
        cutoff = today.replace(year=today.year - 1)
    except ValueError:
        cutoff = _date(today.year - 1, 2, 28)

    def on_time(d) -> bool:
        return d is not None and d >= cutoff

    def _item(done: int, total: int) -> ReviewStatusItem:
        pct = round(done / total * 100) if total > 0 else 0
        return ReviewStatusItem(on_time=done, total=total, pct=pct)

    processes = db.query(Process).all()
    total_proc = len(processes)

    proc_done = sum(1 for p in processes if on_time(p.last_assessment_date))
    bia_done  = sum(1 for p in processes if p.bia is not None and on_time(p.bia.interview_date))
    bc_done   = sum(1 for p in processes if p.business_context is not None and on_time(p.business_context.review_date))

    applications = db.query(Application).all()
    total_apps = len(applications)
    apps_done = sum(1 for a in applications if on_time(a.review_date))

    return ReviewStatus(
        processes=_item(proc_done, total_proc),
        applications=_item(apps_done, total_apps),
        bia=_item(bia_done, total_proc),
        business_context=_item(bc_done, total_proc),
    )
