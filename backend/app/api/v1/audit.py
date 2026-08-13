from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DbDep, require_roles
from app.models.audit_log import AuditLog
from app.models.user import User
from app.models.enums import RoleName
from app.schemas.audit import AuditOut
from app.schemas.common import Page

router = APIRouter(prefix="/audit", tags=["Auditoría"])

AuditDep = Depends(require_roles(RoleName.ADMIN, RoleName.AUDITOR))


@router.get("", response_model=Page)
def list_audit_logs(
    db: DbDep,
    _actor: User = AuditDep,
    action: str | None = None,
    entity: str | None = None,
    username: str | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    page: int = 1,
    page_size: int = 50,
):
    query = select(AuditLog)
    if action:
        query = query.where(AuditLog.action == action)
    if entity:
        query = query.where(AuditLog.entity == entity)
    if username:
        query = query.where(AuditLog.username.ilike(f"%{username}%"))
    if from_date:
        query = query.where(AuditLog.created_at >= from_date)
    if to_date:
        query = query.where(AuditLog.created_at <= to_date.replace(hour=23, minute=59, second=59))
    total = db.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    rows = db.execute(
        query.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()
    return Page(
        items=[AuditOut.from_log(a) for a in rows],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )
