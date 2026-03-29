from datetime import datetime, date
from pydantic import BaseModel


class BusinessContextUpsert(BaseModel):
    key_partners: str | None = None
    key_activities: str | None = None
    key_resources: str | None = None
    value_proposition: str | None = None
    customer_relationships: str | None = None
    channels: str | None = None
    customer_segments: str | None = None
    cost_structure: str | None = None
    revenue_streams: str | None = None
    legal_basis: str | None = None
    stakeholders: str | None = None
    chain_position: str | None = None
    continuity_requirements: str | None = None
    notes: str | None = None
    key_aspects: str | None = None
    personal_data: bool = False
    special_personal_data: bool = False
    review_date: date | None = None


class BusinessContextResponse(BusinessContextUpsert):
    id: int
    process_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
