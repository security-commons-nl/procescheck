from datetime import datetime, date
from sqlalchemy import SmallInteger, Text, String, Date, DateTime, ForeignKey, func, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


def _score_col(name: str) -> Mapped[int | None]:
    return mapped_column(SmallInteger, CheckConstraint(f"{name} BETWEEN 1 AND 5"), nullable=True)


class BiaAssessment(Base):
    __tablename__ = "bia_assessments"

    id: Mapped[int] = mapped_column(primary_key=True)
    process_id: Mapped[int] = mapped_column(ForeignKey("processes.id", ondelete="CASCADE"), unique=True, nullable=False)

    # Final BIV classification (owner confirmed)
    availability_score: Mapped[int | None] = mapped_column(SmallInteger)
    integrity_score: Mapped[int | None] = mapped_column(SmallInteger)
    confidentiality_score: Mapped[int | None] = mapped_column(SmallInteger)

    # Beschikbaarheid (B1–B8)
    b1_score: Mapped[int | None] = mapped_column(SmallInteger)
    b1_arg: Mapped[str | None] = mapped_column(Text)
    b2_score: Mapped[int | None] = mapped_column(SmallInteger)
    b2_arg: Mapped[str | None] = mapped_column(Text)
    b3_score: Mapped[int | None] = mapped_column(SmallInteger)
    b3_arg: Mapped[str | None] = mapped_column(Text)
    b4_score: Mapped[int | None] = mapped_column(SmallInteger)
    b4_arg: Mapped[str | None] = mapped_column(Text)
    b5_score: Mapped[int | None] = mapped_column(SmallInteger)
    b5_arg: Mapped[str | None] = mapped_column(Text)
    b6_score: Mapped[int | None] = mapped_column(SmallInteger)
    b6_arg: Mapped[str | None] = mapped_column(Text)
    b7_score: Mapped[int | None] = mapped_column(SmallInteger)
    b7_arg: Mapped[str | None] = mapped_column(Text)
    b8_score: Mapped[int | None] = mapped_column(SmallInteger)
    b8_arg: Mapped[str | None] = mapped_column(Text)

    # Integriteit (I1–I7)
    i1_score: Mapped[int | None] = mapped_column(SmallInteger)
    i1_arg: Mapped[str | None] = mapped_column(Text)
    i2_score: Mapped[int | None] = mapped_column(SmallInteger)
    i2_arg: Mapped[str | None] = mapped_column(Text)
    i3_score: Mapped[int | None] = mapped_column(SmallInteger)
    i3_arg: Mapped[str | None] = mapped_column(Text)
    i4_score: Mapped[int | None] = mapped_column(SmallInteger)
    i4_arg: Mapped[str | None] = mapped_column(Text)
    i5_score: Mapped[int | None] = mapped_column(SmallInteger)
    i5_arg: Mapped[str | None] = mapped_column(Text)
    i6_score: Mapped[int | None] = mapped_column(SmallInteger)
    i6_arg: Mapped[str | None] = mapped_column(Text)
    i7_score: Mapped[int | None] = mapped_column(SmallInteger)
    i7_arg: Mapped[str | None] = mapped_column(Text)

    # Vertrouwelijkheid (V1–V7)
    v1_score: Mapped[int | None] = mapped_column(SmallInteger)
    v1_arg: Mapped[str | None] = mapped_column(Text)
    v2_score: Mapped[int | None] = mapped_column(SmallInteger)
    v2_arg: Mapped[str | None] = mapped_column(Text)
    v3_score: Mapped[int | None] = mapped_column(SmallInteger)
    v3_arg: Mapped[str | None] = mapped_column(Text)
    v4_score: Mapped[int | None] = mapped_column(SmallInteger)
    v4_arg: Mapped[str | None] = mapped_column(Text)
    v5_score: Mapped[int | None] = mapped_column(SmallInteger)
    v5_arg: Mapped[str | None] = mapped_column(Text)
    v6_score: Mapped[int | None] = mapped_column(SmallInteger)
    v6_arg: Mapped[str | None] = mapped_column(Text)
    v7_score: Mapped[int | None] = mapped_column(SmallInteger)
    v7_arg: Mapped[str | None] = mapped_column(Text)

    # Algemene BIA-info
    interviewer_name: Mapped[str | None] = mapped_column(String(255))
    interview_date: Mapped[date | None] = mapped_column(Date)
    general_description: Mapped[str | None] = mapped_column(Text)
    chain_dependencies: Mapped[str | None] = mapped_column(Text)
    owner_deviation_motivation: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    process: Mapped["Process"] = relationship("Process", back_populates="bia")  # noqa: F821
