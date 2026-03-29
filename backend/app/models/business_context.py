from datetime import datetime, date
from sqlalchemy import Text, Boolean, DateTime, Date, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class BusinessContext(Base):
    __tablename__ = "business_contexts"

    id: Mapped[int] = mapped_column(primary_key=True)
    process_id: Mapped[int] = mapped_column(ForeignKey("processes.id", ondelete="CASCADE"), unique=True, nullable=False)

    key_partners: Mapped[str | None] = mapped_column(Text)
    key_activities: Mapped[str | None] = mapped_column(Text)
    key_resources: Mapped[str | None] = mapped_column(Text)
    value_proposition: Mapped[str | None] = mapped_column(Text)
    customer_relationships: Mapped[str | None] = mapped_column(Text)
    channels: Mapped[str | None] = mapped_column(Text)
    customer_segments: Mapped[str | None] = mapped_column(Text)
    cost_structure: Mapped[str | None] = mapped_column(Text)
    revenue_streams: Mapped[str | None] = mapped_column(Text)
    legal_basis: Mapped[str | None] = mapped_column(Text)
    stakeholders: Mapped[str | None] = mapped_column(Text)
    chain_position: Mapped[str | None] = mapped_column(Text)
    continuity_requirements: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    key_aspects: Mapped[str | None] = mapped_column(Text)
    personal_data: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    special_personal_data: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    review_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    process: Mapped["Process"] = relationship("Process", back_populates="business_context")  # noqa: F821
