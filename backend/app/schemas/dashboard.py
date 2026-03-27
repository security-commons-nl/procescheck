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
