from datetime import datetime, date
from pydantic import BaseModel


class ApplicationBase(BaseModel):
    code: str
    name: str
    description: str | None = None
    business_owner: str | None = None
    technical_owner: str | None = None
    notes: str | None = None
    review_date: date | None = None


class ApplicationCreate(ApplicationBase):
    pass


class ApplicationUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    description: str | None = None
    business_owner: str | None = None
    technical_owner: str | None = None
    notes: str | None = None
    review_date: date | None = None


class ProcessSummary(BaseModel):
    id: int
    code: str
    name: str

    model_config = {"from_attributes": True}


class ApplicationResponse(ApplicationBase):
    id: int
    created_at: datetime
    updated_at: datetime
    processes: list[ProcessSummary] = []

    model_config = {"from_attributes": True}
