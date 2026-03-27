from sqlalchemy import Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class ProcessApplication(Base):
    __tablename__ = "process_applications"

    process_id: Mapped[int] = mapped_column(ForeignKey("processes.id", ondelete="CASCADE"), primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), primary_key=True)
