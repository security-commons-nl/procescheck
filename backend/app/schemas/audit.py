from datetime import datetime
from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: int
    entity_type: str
    entity_id: int | None = None
    entity_label: str | None = None
    process_id: int | None = None
    action: str
    changes: dict | None = None
    user_email: str | None = None
    user_name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
