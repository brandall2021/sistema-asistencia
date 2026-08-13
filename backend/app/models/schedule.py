from typing import TYPE_CHECKING
from datetime import time

from sqlalchemy import Boolean, ForeignKey, Integer, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, GUID, TimestampMixin, uuid_pk

if TYPE_CHECKING:
    from app.models.academic import Commission
    from app.models.classroom import Classroom


class Schedule(Base, TimestampMixin):
    __tablename__ = "schedules"

    id = uuid_pk()
    commission_id: Mapped[str] = mapped_column(
        GUID, ForeignKey("commissions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    classroom_id: Mapped[str] = mapped_column(
        GUID, ForeignKey("classrooms.id"), nullable=False
    )
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    commission: Mapped["Commission"] = relationship(back_populates="schedules")
    classroom: Mapped["Classroom"] = relationship(lazy="joined")
