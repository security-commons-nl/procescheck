from datetime import datetime, date
from typing import Annotated
from pydantic import BaseModel, StringConstraints

NonEmptyStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class ApplicationBase(BaseModel):
    code: NonEmptyStr
    name: NonEmptyStr
    description: str | None = None
    business_owner: str | None = None
    technical_owner: str | None = None
    notes: str | None = None
    review_date: date | None = None


class ApplicationCreate(ApplicationBase):
    pass


class ApplicationUpdate(BaseModel):
    code: NonEmptyStr | None = None
    name: NonEmptyStr | None = None
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
