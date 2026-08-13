from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, GUID, TimestampMixin, uuid_pk, utcnow

if TYPE_CHECKING:
    from app.models.class_entity import ClassSession
    from app.models.user import User


class QRSession(Base, TimestampMixin):
    __tablename__ = "qr_sessions"

    id = uuid_pk()
    class_id: Mapped[str] = mapped_column(
        GUID, ForeignKey("classes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    created_by: Mapped[str | None] = mapped_column(
        GUID, ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    class_session: Mapped["ClassSession"] = relationship(back_populates="qr_sessions")
    creator: Mapped["User | None"] = relationship(foreign_keys=[created_by])
