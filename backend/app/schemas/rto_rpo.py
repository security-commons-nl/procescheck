from datetime import datetime
from pydantic import BaseModel


class RtoRpoUpsert(BaseModel):
    rto_value: float | None = None
    rto_unit: str | None = None
    rpo_value: float | None = None
    rpo_unit: str | None = None
    explanation: str | None = None


class RtoRpoResponse(RtoRpoUpsert):
    id: int
    process_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
