from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, GUID, TimestampMixin, uuid_pk, utcnow

if TYPE_CHECKING:
    from app.models.academic import Commission
    from app.models.student import Student


class Enrollment(Base, TimestampMixin):
    __tablename__ = "enrollments"
    __table_args__ = (UniqueConstraint("student_id", "commission_id"),)

    id = uuid_pk()
    student_id: Mapped[str] = mapped_column(
        GUID, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    commission_id: Mapped[str] = mapped_column(
        GUID, ForeignKey("commissions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE", nullable=False)
    enrolled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    student: Mapped["Student"] = relationship(back_populates="enrollments")
    commission: Mapped["Commission"] = relationship(back_populates="enrollments")
