from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, GUID, TimestampMixin, uuid_pk

if TYPE_CHECKING:
    from app.models.enrollment import Enrollment
    from app.models.schedule import Schedule


class Career(Base, TimestampMixin):
    __tablename__ = "careers"

    id = uuid_pk()
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    subjects: Mapped[list["Subject"]] = relationship(
        back_populates="career", cascade="all, delete-orphan"
    )


class Subject(Base, TimestampMixin):
    __tablename__ = "subjects"

    id = uuid_pk()
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    career_id: Mapped[str] = mapped_column(GUID, ForeignKey("careers.id"), nullable=False)
    semester: Mapped[int | None] = mapped_column(Integer)
    credits: Mapped[int | None] = mapped_column(Integer)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    career: Mapped["Career"] = relationship(back_populates="subjects")
    commissions: Mapped[list["Commission"]] = relationship(
        back_populates="subject", cascade="all, delete-orphan"
    )


class Commission(Base, TimestampMixin):
    __tablename__ = "commissions"

    id = uuid_pk()
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    subject_id: Mapped[str] = mapped_column(GUID, ForeignKey("subjects.id"), nullable=False)
    career_id: Mapped[str] = mapped_column(GUID, ForeignKey("careers.id"), nullable=False)
    teacher_id: Mapped[str | None] = mapped_column(
        GUID, ForeignKey("teachers.id"), nullable=True
    )
    year: Mapped[int] = mapped_column(Integer, nullable=False, default=2026)
    period: Mapped[str] = mapped_column(String(20), nullable=False, default="1")
    capacity: Mapped[int | None] = mapped_column(Integer)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    subject: Mapped["Subject"] = relationship(back_populates="commissions")
    career: Mapped["Career"] = relationship(lazy="joined")
    teacher: Mapped["Teacher | None"] = relationship(lazy="joined")
    schedules: Mapped[list["Schedule"]] = relationship(
        back_populates="commission", cascade="all, delete-orphan"
    )
    enrollments: Mapped[list["Enrollment"]] = relationship(
        back_populates="commission", cascade="all, delete-orphan"
    )
