from datetime import datetime
from sqlalchemy import Float, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class RtoRpo(Base):
    __tablename__ = "rto_rpo"

    id: Mapped[int] = mapped_column(primary_key=True)
    process_id: Mapped[int] = mapped_column(ForeignKey("processes.id", ondelete="CASCADE"), unique=True, nullable=False)

    rto_value: Mapped[float | None] = mapped_column(Float)
    rto_unit: Mapped[str | None] = mapped_column(String(50))
    rpo_value: Mapped[float | None] = mapped_column(Float)
    rpo_unit: Mapped[str | None] = mapped_column(String(50))
    explanation: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    process: Mapped["Process"] = relationship("Process", back_populates="rto_rpo")  # noqa: F821
