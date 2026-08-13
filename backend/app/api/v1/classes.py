from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select

from app.core.audit import audit
from app.core.authz import can_manage_class, commission_ids_for_user
from app.core.deps import CurrentUser, DbDep, get_teacher_profile, require_roles
from app.models.academic import Commission
from app.models.attendance import Attendance
from app.models.class_entity import ClassSession
from app.models.enrollment import Enrollment
from app.models.enums import ClassStatus, RoleName
from app.models.user import User
from app.schemas.attendance import AttendanceOut
from app.schemas.class_ import ClassCreate, ClassOut, ClassUpdate
from app.schemas.qr import QRResponse
from app.services.qr import create_qr_session

router = APIRouter(prefix="/classes", tags=["Clases"])

Staff = require_roles(RoleName.ADMIN, RoleName.DOCENTE)
Anyone = require_roles(RoleName.ADMIN, RoleName.DOCENTE, RoleName.ALUMNO)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _get_class(db: DbDep, class_id: str) -> ClassSession:
    cls = db.get(ClassSession, class_id)
    if cls is None:
        raise HTTPException(status_code=404, detail="Clase no encontrada")
    return cls


def _require_manageable(db: DbDep, actor: CurrentUser, class_id: str) -> ClassSession:
    cls = _get_class(db, class_id)
    if not can_manage_class(db, actor, cls):
        raise HTTPException(status_code=403, detail="No tiene permisos sobre esta clase")
    return cls


def _with_counts(db, cls: ClassSession) -> ClassOut:
    total = db.execute(
        select(func.count()).select_from(Enrollment).where(
            Enrollment.commission_id == cls.commission_id,
            Enrollment.status == "ACTIVE",
        )
    ).scalar_one()
    present = db.execute(
        select(func.count()).select_from(Attendance).where(Attendance.class_id == cls.id)
    ).scalar_one()
    return ClassOut.from_class(cls, attendance_count=present, total_students=total)


@router.get("", response_model=list[ClassOut])
def list_classes(db: DbDep, actor: User = Depends(Anyone), commission_id: str | None = None):
    query = select(ClassSession)
    if commission_id:
        query = query.where(ClassSession.commission_id == commission_id)
    else:
        ids = commission_ids_for_user(db, actor)
        if ids:
            query = query.where(ClassSession.commission_id.in_(ids))
        elif not actor.has_role(RoleName.ADMIN):
            query = query.where(False)
    rows = db.execute(query.order_by(ClassSession.date.desc(), ClassSession.created_at.desc()).limit(200)).scalars().all()
    return [_with_counts(db, c) for c in rows]


@router.post("", response_model=ClassOut, status_code=201)
def create_class(payload: ClassCreate, request: Request, db: DbDep, actor: User = Depends(Staff)):
    commission = db.get(Commission, payload.commission_id)
    if commission is None:
        raise HTTPException(status_code=404, detail="Comisión no encontrada")
    if not actor.has_role(RoleName.ADMIN) and commission.teacher_id != get_teacher_profile(db, actor).id:
        raise HTTPException(status_code=403, detail="No puede crear clases para esta comisión")

    classroom_id = payload.classroom_id
    if classroom_id is None and payload.schedule_id is not None:
        from app.models.schedule import Schedule
        schedule = db.get(Schedule, payload.schedule_id)
        if schedule is not None:
            classroom_id = str(schedule.classroom_id)

    title = payload.title or (commission.subject.name if commission.subject else f"Clase {payload.date.isoformat()}")
    cls = ClassSession(
        commission_id=payload.commission_id,
        schedule_id=payload.schedule_id,
        classroom_id=classroom_id,
        teacher_id=str(commission.teacher_id) if commission.teacher_id else None,
        created_by=actor.id,
        title=title,
        date=payload.date,
        status=ClassStatus.SCHEDULED.value,
        late_grace_minutes=payload.late_grace_minutes,
    )
    db.add(cls)
    db.commit()
    db.refresh(cls)
    audit(db, action="class_create", entity="class", entity_id=str(cls.id),
          user_id=str(actor.id), username=actor.username, request=request,
          details={"commission_id": payload.commission_id, "date": payload.date.isoformat()})
    return _with_counts(db, cls)


@router.get("/{class_id}", response_model=ClassOut)
def get_class(class_id: str, db: DbDep, actor: User = Depends(Anyone)):
    cls = _get_class(db, class_id)
    ids = commission_ids_for_user(db, actor)
    if actor.has_role(RoleName.ADMIN) or cls.commission_id in ids:
        return _with_counts(db, cls)
    raise HTTPException(status_code=403, detail="No tiene acceso a esta clase")


@router.patch("/{class_id}", response_model=ClassOut)
def update_class(class_id: str, payload: ClassUpdate, request: Request, db: DbDep, actor: User = Depends(Staff)):
    cls = _require_manageable(db, actor, class_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "status":
            value = value.value
        setattr(cls, field, value)
    db.commit()
    db.refresh(cls)
    audit(db, action="class_update", entity="class", entity_id=str(cls.id),
          user_id=str(actor.id), username=actor.username, request=request)
    return _with_counts(db, cls)


@router.post("/{class_id}/start", response_model=ClassOut)
def start_class(class_id: str, request: Request, db: DbDep, actor: User = Depends(Staff)):
    cls = _require_manageable(db, actor, class_id)
    if cls.status == ClassStatus.ACTIVE.value:
        return _with_counts(db, cls)
    if cls.status not in (ClassStatus.SCHEDULED.value, ClassStatus.FINISHED.value):
        raise HTTPException(status_code=400, detail="La clase no puede iniciarse")
    cls.starts_at = _now()
    cls.status = ClassStatus.ACTIVE.value
    db.commit()
    db.refresh(cls)
    audit(db, action="class_start", entity="class", entity_id=str(cls.id),
          user_id=str(actor.id), username=actor.username, request=request,
          details={"starts_at": cls.starts_at.isoformat()})
    return _with_counts(db, cls)


@router.post("/{class_id}/finish", response_model=ClassOut)
def finish_class(class_id: str, request: Request, db: DbDep, actor: User = Depends(Staff)):
    cls = _require_manageable(db, actor, class_id)
    if cls.status != ClassStatus.ACTIVE.value:
        raise HTTPException(status_code=400, detail="La clase no está activa")
    cls.ends_at = _now()
    cls.status = ClassStatus.FINISHED.value
    for qr in cls.qr_sessions:
        if qr.revoked_at is None:
            qr.revoked_at = _now()
    db.commit()
    db.refresh(cls)
    audit(db, action="class_finish", entity="class", entity_id=str(cls.id),
          user_id=str(actor.id), username=actor.username, request=request,
          details={"ends_at": cls.ends_at.isoformat()})
    return _with_counts(db, cls)


@router.get("/{class_id}/attendance", response_model=list[AttendanceOut])
def class_attendance(
    class_id: str,
    db: DbDep,
    actor: User = Depends(require_roles(RoleName.ADMIN, RoleName.DOCENTE)),
):
    cls = _require_manageable(db, actor, class_id)
    rows = db.execute(
        select(Attendance).where(Attendance.class_id == cls.id).order_by(Attendance.check_in_at)
    ).scalars().all()
    return [AttendanceOut.from_attendance(a) for a in rows]


@router.post("/{class_id}/qr", response_model=QRResponse)
def generate_qr(class_id: str, request: Request, db: DbDep, actor: User = Depends(Staff)):
    cls = _require_manageable(db, actor, class_id)
    if cls.status != ClassStatus.ACTIVE.value:
        raise HTTPException(status_code=400, detail="La clase debe estar activa para generar un QR")
    qr, raw, expires_at = create_qr_session(db, cls, created_by=actor.id)
    audit(db, action="qr_generate", entity="qr_session", entity_id=str(qr.id),
          user_id=str(actor.id), username=actor.username, request=request,
          details={"class_id": str(cls.id)})
    from app.core.config import settings
    return QRResponse(token=raw, class_id=str(cls.id), expires_at=expires_at, ttl_seconds=settings.QR_TOKEN_TTL_SECONDS)
