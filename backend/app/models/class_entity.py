from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, Integer, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, GUID, TimestampMixin, uuid_pk

if TYPE_CHECKING:
    from app.models.academic import Commission
    from app.models.attendance import Attendance
    from app.models.classroom import Classroom
    from app.models.qr_session import QRSession
    from app.models.schedule import Schedule
    from app.models.teacher import Teacher
    from app.models.user import User


class ClassSession(Base, TimestampMixin):
    __tablename__ = "classes"
    __table_args__ = ({"comment": "Instancia de clase (sesión)"},)

    id = uuid_pk()
    commission_id: Mapped[str] = mapped_column(
        GUID, ForeignKey("commissions.id"), nullable=False, index=True
    )
    schedule_id: Mapped[str | None] = mapped_column(
        GUID, ForeignKey("schedules.id"), nullable=True
    )
    classroom_id: Mapped[str | None] = mapped_column(
        GUID, ForeignKey("classrooms.id"), nullable=True
    )
    teacher_id: Mapped[str | None] = mapped_column(
        GUID, ForeignKey("teachers.id"), nullable=True
    )
    created_by: Mapped[str | None] = mapped_column(
        GUID, ForeignKey("users.id"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), default="SCHEDULED", nullable=False, index=True)
    late_grace_minutes: Mapped[int] = mapped_column(SmallInteger, default=10, nullable=False)

    commission: Mapped["Commission"] = relationship(lazy="joined")
    schedule: Mapped["Schedule | None"] = relationship(lazy="joined")
    classroom: Mapped["Classroom | None"] = relationship(lazy="joined")
    teacher: Mapped["Teacher | None"] = relationship(lazy="joined")
    qr_sessions: Mapped[list["QRSession"]] = relationship(
        back_populates="class_session", cascade="all, delete-orphan"
    )
    attendance_records: Mapped[list["Attendance"]] = relationship(
        back_populates="class_session", cascade="all, delete-orphan"
    )
