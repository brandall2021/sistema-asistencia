from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, GUID, TimestampMixin, uuid_pk

if TYPE_CHECKING:
    from app.models.user import User


class Teacher(Base, TimestampMixin):
    __tablename__ = "teachers"

    id = uuid_pk()
    user_id: Mapped[str] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    employee_number: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )
    title: Mapped[str | None] = mapped_column(String(100), nullable=True)
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)

    user: Mapped["User"] = relationship(foreign_keys=[user_id], lazy="joined")
