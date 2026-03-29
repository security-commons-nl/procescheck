from pydantic import BaseModel


class DashboardSummary(BaseModel):
    total_processes: int
    critical_processes: int
    complete_count: int
    attention_count: int   # 1–3 missing
    incomplete_count: int  # 4+ missing


class ProcessCompleteness(BaseModel):
    id: int
    code: str
    name: str
    is_critical: bool
    has_bia: bool
    has_rto_rpo: bool
    has_business_context: bool
    app_count: int
    is_complete: bool
    missing_fields: list[str]


class BivTopItem(BaseModel):
    process_id: int
    process_code: str
    process_name: str
    score: int
    label: str


class BivTopStats(BaseModel):
    availability: list[BivTopItem]
    integrity: list[BivTopItem]
    confidentiality: list[BivTopItem]


# ── Risk Overview ──────────────────────────────────────────────────────────────

class BivDimensionDistribution(BaseModel):
    vitaal: int    # score 1
    hoog: int      # score 2
    midden: int    # score 3
    laag: int      # score 4
    minimaal: int  # score 5
    not_assessed: int


class BivDistribution(BaseModel):
    availability: BivDimensionDistribution
    integrity: BivDimensionDistribution
    confidentiality: BivDimensionDistribution


class CriticalProcessRisk(BaseModel):
    id: int
    code: str
    name: str
    availability_score: int | None
    integrity_score: int | None
    confidentiality_score: int | None
    has_bia: bool
    has_rto_rpo: bool
    rto_value: float | None
    rto_unit: str | None
    missing_fields: list[str]


class CoverageStats(BaseModel):
    done: int
    total: int
    pct: int


class Coverage(BaseModel):
    bia: CoverageStats
    rto_rpo: CoverageStats
    business_context: CoverageStats
    applications: CoverageStats


class PrivacyExposure(BaseModel):
    personal_data: int
    special_personal_data: int


class PriorityAction(BaseModel):
    id: int
    code: str
    name: str
    is_critical: bool
    priority: str   # "critical", "high", "medium"
    reason: str
    missing_fields: list[str]


class RiskOverview(BaseModel):
    biv_distribution: BivDistribution
    critical_processes: list[CriticalProcessRisk]
    coverage: Coverage
    privacy_exposure: PrivacyExposure
    privacy_coverage: CoverageStats
    process_fields_coverage: CoverageStats
    high_risk_count: int
    priority_actions: list[PriorityAction]
