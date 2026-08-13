import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.base import ensure_aware
from app.models.class_entity import ClassSession
from app.models.qr_session import QRSession


def _now() -> datetime:
    return datetime.now(timezone.utc)


def generate_raw_token() -> str:
    """Token criptográficamente seguro (48 bytes aleatorios)."""
    return secrets.token_urlsafe(48)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_qr_session(
    db: Session,
    class_session: ClassSession,
    created_by: str | None = None,
) -> tuple[QRSession, str, datetime]:
    """Crea una sesión QR válida (revocando las anteriores de la clase)."""
    for previous in db.execute(
        select(QRSession).where(
            QRSession.class_id == class_session.id,
            QRSession.revoked_at.is_(None),
        )
    ).scalars():
        previous.revoked_at = _now()

    raw = generate_raw_token()
    ttl = settings.QR_TOKEN_TTL_SECONDS
    expires_at = _now() + timedelta(seconds=ttl)
    session = QRSession(
        class_id=class_session.id,
        token_hash=hash_token(raw),
        created_by=created_by,
        expires_at=expires_at,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session, raw, expires_at


def resolve_qr(db: Session, raw_token: str) -> QRSession | None:
    """Resuelve la clase a partir del token (nunca confía en class_id del cliente)."""
    token_hash = hash_token(raw_token)
    return db.execute(
        select(QRSession).where(QRSession.token_hash == token_hash)
    ).scalar_one_or_none()


def is_valid(db: Session, qr: QRSession) -> tuple[bool, str]:
    now = _now()
    if qr.revoked_at is not None:
        return False, "QR_INVALIDO"
    if ensure_aware(qr.expires_at) <= now:
        return False, "QR_EXPIRADO"
    class_session = qr.class_session
    if class_session.status != "ACTIVE":
        return False, "CLASE_NO_ACTIVA"
    return True, ""
