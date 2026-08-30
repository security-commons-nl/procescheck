from datetime import datetime, date
from typing import Annotated
from pydantic import BaseModel, Field

# BIA-scores zijn altijd 1 (Catastrofaal) t/m 5 (Verwaarloosbaar)
Score = Annotated[int, Field(ge=1, le=5)]


class BiaUpsert(BaseModel):
    availability_score: Score | None = None
    integrity_score: Score | None = None
    confidentiality_score: Score | None = None

    b1_score: Score | None = None
    b1_arg: str | None = None
    b2_score: Score | None = None
    b2_arg: str | None = None
    b3_score: Score | None = None
    b3_arg: str | None = None
    b4_score: Score | None = None
    b4_arg: str | None = None
    b5_score: Score | None = None
    b5_arg: str | None = None
    b6_score: Score | None = None
    b6_arg: str | None = None
    b7_score: Score | None = None
    b7_arg: str | None = None
    b8_score: Score | None = None
    b8_arg: str | None = None

    i1_score: Score | None = None
    i1_arg: str | None = None
    i2_score: Score | None = None
    i2_arg: str | None = None
    i3_score: Score | None = None
    i3_arg: str | None = None
    i4_score: Score | None = None
    i4_arg: str | None = None
    i5_score: Score | None = None
    i5_arg: str | None = None
    i6_score: Score | None = None
    i6_arg: str | None = None
    i7_score: Score | None = None
    i7_arg: str | None = None

    v1_score: Score | None = None
    v1_arg: str | None = None
    v2_score: Score | None = None
    v2_arg: str | None = None
    v3_score: Score | None = None
    v3_arg: str | None = None
    v4_score: Score | None = None
    v4_arg: str | None = None
    v5_score: Score | None = None
    v5_arg: str | None = None
    v6_score: Score | None = None
    v6_arg: str | None = None
    v7_score: Score | None = None
    v7_arg: str | None = None

    interviewer_name: str | None = None
    interview_date: date | None = None
    general_description: str | None = None
    chain_dependencies: str | None = None
    owner_deviation_motivation: str | None = None
    notes: str | None = None

    # Optimistic locking: de updated_at die de client als laatste zag.
    # Wijkt die af van de huidige waarde, dan heeft iemand anders intussen
    # opgeslagen en antwoordt de API met 409.
    expected_updated_at: datetime | None = None


class BiaResponse(BiaUpsert):
    id: int
    process_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
