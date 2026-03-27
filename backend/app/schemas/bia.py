from datetime import datetime, date
from pydantic import BaseModel


class BiaUpsert(BaseModel):
    availability_score: int | None = None
    integrity_score: int | None = None
    confidentiality_score: int | None = None

    b1_score: int | None = None
    b1_arg: str | None = None
    b2_score: int | None = None
    b2_arg: str | None = None
    b3_score: int | None = None
    b3_arg: str | None = None
    b4_score: int | None = None
    b4_arg: str | None = None
    b5_score: int | None = None
    b5_arg: str | None = None
    b6_score: int | None = None
    b6_arg: str | None = None
    b7_score: int | None = None
    b7_arg: str | None = None
    b8_score: int | None = None
    b8_arg: str | None = None

    i1_score: int | None = None
    i1_arg: str | None = None
    i2_score: int | None = None
    i2_arg: str | None = None
    i3_score: int | None = None
    i3_arg: str | None = None
    i4_score: int | None = None
    i4_arg: str | None = None
    i5_score: int | None = None
    i5_arg: str | None = None
    i6_score: int | None = None
    i6_arg: str | None = None
    i7_score: int | None = None
    i7_arg: str | None = None

    v1_score: int | None = None
    v1_arg: str | None = None
    v2_score: int | None = None
    v2_arg: str | None = None
    v3_score: int | None = None
    v3_arg: str | None = None
    v4_score: int | None = None
    v4_arg: str | None = None
    v5_score: int | None = None
    v5_arg: str | None = None
    v6_score: int | None = None
    v6_arg: str | None = None
    v7_score: int | None = None
    v7_arg: str | None = None

    interviewer_name: str | None = None
    interview_date: date | None = None
    general_description: str | None = None
    chain_dependencies: str | None = None
    owner_deviation_motivation: str | None = None
    notes: str | None = None


class BiaResponse(BiaUpsert):
    id: int
    process_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
