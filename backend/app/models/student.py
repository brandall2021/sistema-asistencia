from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, GUID, TimestampMixin, uuid_pk

if TYPE_CHECKING:
    from app.models.academic import Career
    from app.models.enrollment import Enrollment
    from app.models.user import User


class Student(Base, TimestampMixin):
    __tablename__ = "students"

    id = uuid_pk()
    user_id: Mapped[str] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    registration_number: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )
    career_id: Mapped[str | None] = mapped_column(
        GUID, ForeignKey("careers.id"), nullable=True
    )
    dni: Mapped[str | None] = mapped_column(String(20), nullable=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)

    user: Mapped["User"] = relationship(foreign_keys=[user_id], lazy="joined")
    career: Mapped["Career | None"] = relationship(foreign_keys=[career_id], lazy="joined")
    enrollments: Mapped[list["Enrollment"]] = relationship(
        back_populates="student", cascade="all, delete-orphan"
    )
