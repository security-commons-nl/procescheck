from datetime import datetime, date
from pydantic import BaseModel


class ProcessBase(BaseModel):
    name: str
    description: str | None = None
    objective: str | None = None
    owner: str | None = None
    department: str | None = None
    is_critical: bool = True
    critical_reason: str | None = None
    notes: str | None = None


class ProcessCreate(ProcessBase):
    # code is optional; backend auto-generates KP-NNN if not provided
    code: str | None = None


class ProcessUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    description: str | None = None
    objective: str | None = None
    owner: str | None = None
    department: str | None = None
    is_critical: bool | None = None
    critical_reason: str | None = None
    notes: str | None = None
    # last_assessment_date is server-managed; not accepted from client


class ApplicationSummary(BaseModel):
    id: int
    code: str
    name: str

    model_config = {"from_attributes": True}


class ProcessResponse(ProcessBase):
    id: int
    code: str
    last_assessment_date: date | None = None
    created_at: datetime
    updated_at: datetime
    applications: list[ApplicationSummary] = []
    has_bia: bool = False
    has_rto_rpo: bool = False
    has_business_context: bool = False

    model_config = {"from_attributes": True}
