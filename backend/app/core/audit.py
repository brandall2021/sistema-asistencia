import json
from typing import Any

from fastapi import Request
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def _request_context(request: Request | None) -> tuple[str, str]:
    if request is None:
        return "", ""
    forwarded = request.headers.get("x-forwarded-for")
    ip = forwarded.split(",")[0].strip() if forwarded else request.client.host if request.client else ""
    user_agent = request.headers.get("user-agent", "")
    return ip, user_agent


def audit(
    db: Session,
    *,
    action: str,
    entity: str,
    entity_id: str | None = None,
    details: dict[str, Any] | None = None,
    user_id: str | None = None,
    username: str | None = None,
    request: Request | None = None,
) -> AuditLog:
    ip, user_agent = _request_context(request)
    entry = AuditLog(
        user_id=user_id,
        username=username,
        action=action,
        entity=entity,
        entity_id=entity_id,
        ip=ip,
        user_agent=user_agent,
        details=json.dumps(details, ensure_ascii=False, default=str) if details else None,
    )
    db.add(entry)
    db.commit()
    return entry
