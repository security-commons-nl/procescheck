from datetime import datetime, date
from typing import Annotated
from pydantic import BaseModel, StringConstraints, field_validator

NonEmptyStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class ProcessBase(BaseModel):
    name: NonEmptyStr
    description: str | None = None
    objective: str | None = None
    owner: str | None = None
    department: str | None = None
    is_critical: bool = True
    critical_reason: str | None = None
    last_assessment_date: date | None = None
    notes: str | None = None


class ProcessCreate(ProcessBase):
    # code is optional; backend auto-generates KP-NNN if not provided
    code: str | None = None

    @field_validator("code")
    @classmethod
    def _empty_code_is_none(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


class ProcessUpdate(BaseModel):
    code: NonEmptyStr | None = None
    name: NonEmptyStr | None = None
    description: str | None = None
    objective: str | None = None
    owner: str | None = None
    department: str | None = None
    is_critical: bool | None = None
    critical_reason: str | None = None
    last_assessment_date: date | None = None
    notes: str | None = None


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
