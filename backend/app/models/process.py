from datetime import datetime, date
from sqlalchemy import String, Text, Boolean, Date, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Process(Base):
    __tablename__ = "processes"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    objective: Mapped[str | None] = mapped_column(Text)
    owner: Mapped[str | None] = mapped_column(String(255))
    department: Mapped[str | None] = mapped_column(String(255))
    is_critical: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    critical_reason: Mapped[str | None] = mapped_column(Text)
    last_assessment_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    applications: Mapped[list["Application"]] = relationship(  # noqa: F821
        "Application", secondary="process_applications", back_populates="processes"
    )
    bia: Mapped["BiaAssessment | None"] = relationship(  # noqa: F821
        "BiaAssessment", back_populates="process", uselist=False, cascade="all, delete-orphan"
    )
    rto_rpo: Mapped["RtoRpo | None"] = relationship(  # noqa: F821
        "RtoRpo", back_populates="process", uselist=False, cascade="all, delete-orphan"
    )
    business_context: Mapped["BusinessContext | None"] = relationship(  # noqa: F821
        "BusinessContext", back_populates="process", uselist=False, cascade="all, delete-orphan"
    )
