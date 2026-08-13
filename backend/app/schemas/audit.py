from datetime import datetime
from typing import Any

from pydantic import BaseModel


class AuditOut(BaseModel):
    id: str
    username: str | None
    action: str
    entity: str
    entity_id: str | None
    ip: str | None
    user_agent: str | None
    details: str | None
    created_at: datetime

    @classmethod
    def from_log(cls, log: Any) -> "AuditOut":
        return cls(
            id=str(log.id),
            username=log.username,
            action=log.action,
            entity=log.entity,
            entity_id=log.entity_id,
            ip=log.ip,
            user_agent=log.user_agent,
            details=log.details,
            created_at=log.created_at,
        )
