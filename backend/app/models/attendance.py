from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, GUID, TimestampMixin, uuid_pk, utcnow

if TYPE_CHECKING:
    from app.models.class_entity import ClassSession
    from app.models.student import Student
    from app.models.user import User


class Attendance(Base, TimestampMixin):
    __tablename__ = "attendance"
    __table_args__ = (UniqueConstraint("class_id", "student_id"),)

    id = uuid_pk()
    class_id: Mapped[str] = mapped_column(
        GUID, ForeignKey("classes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id: Mapped[str] = mapped_column(
        GUID, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(20), default="PRESENT", nullable=False)
    check_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    accuracy: Mapped[float | None] = mapped_column(Float)
    distance_meters: Mapped[float | None] = mapped_column(Float)
    method: Mapped[str] = mapped_column(String(20), default="QR", nullable=False)
    review_reason: Mapped[str | None] = mapped_column(String(500))

    class_session: Mapped["ClassSession"] = relationship(back_populates="attendance_records")
    student: Mapped["Student"] = relationship(lazy="joined")
    events: Mapped[list["AttendanceEvent"]] = relationship(
        back_populates="attendance", cascade="all, delete-orphan"
    )


class AttendanceEvent(Base):
    __tablename__ = "attendance_events"

    id = uuid_pk()
    attendance_id: Mapped[str] = mapped_column(
        GUID, ForeignKey("attendance.id", ondelete="CASCADE"), nullable=False, index=True
    )
    class_id: Mapped[str | None] = mapped_column(
        GUID, ForeignKey("classes.id", ondelete="CASCADE"), nullable=True, index=True
    )
    student_id: Mapped[str | None] = mapped_column(
        GUID, ForeignKey("students.id", ondelete="CASCADE"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    previous_status: Mapped[str | None] = mapped_column(String(20))
    new_status: Mapped[str | None] = mapped_column(String(20))
    detail: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[str | None] = mapped_column(
        GUID, ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    attendance: Mapped["Attendance"] = relationship(back_populates="events")
    actor: Mapped["User | None"] = relationship(foreign_keys=[created_by])


class Justification(Base, TimestampMixin):
    __tablename__ = "justifications"

    id = uuid_pk()
    attendance_id: Mapped[str] = mapped_column(
        GUID, ForeignKey("attendance.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id: Mapped[str] = mapped_column(
        GUID, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    document_url: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(20), default="PENDING", nullable=False)
    reviewed_by: Mapped[str | None] = mapped_column(
        GUID, ForeignKey("users.id"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    review_notes: Mapped[str | None] = mapped_column(Text)

    attendance: Mapped["Attendance"] = relationship()
    student: Mapped["Student"] = relationship()
    reviewer: Mapped["User | None"] = relationship(foreign_keys=[reviewed_by])
