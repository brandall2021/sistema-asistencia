import asyncio

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select

from app.core.audit import audit
from app.core.authz import can_manage_class, commission_ids_for_user
from app.core.deps import CurrentStudent, CurrentUser, DbDep, require_roles
from app.models.attendance import Attendance, Justification
from app.models.class_entity import ClassSession
from app.models.enrollment import Enrollment
from app.models.user import User
from app.models.enums import AttendanceStatus, JustificationStatus, RoleName
from app.schemas.attendance import (
    AttendanceOut,
    AttendanceUpdate,
    CheckInRequest,
    CheckInResponse,
    JustificationCreate,
    JustificationReview,
)
from app.schemas.common import Message, Page
from app.services import attendance as attendance_service
from app.services.ws import manager

router = APIRouter(prefix="/attendance", tags=["Asistencia"])

Staff = require_roles(RoleName.ADMIN, RoleName.DOCENTE)


@router.post("/check-in", response_model=CheckInResponse)
async def check_in(
    payload: CheckInRequest,
    request: Request,
    db: DbDep,
    student: CurrentStudent,
):
    record, message = attendance_service.check_in(
        db, student, payload.token, payload.latitude, payload.longitude, payload.accuracy
    )
    audit(db, action="attendance_check_in", entity="attendance", entity_id=str(record.id),
          user_id=str(student.user_id), username=student.user.username, request=request,
          details={"class_id": str(record.class_id), "status": record.status,
                   "distance_meters": record.distance_meters})
    asyncio.create_task(manager.notify_attendance(str(record.class_id), {
        "attendance_id": str(record.id),
        "student_id": str(record.student_id),
        "student_name": student.user.full_name,
        "status": record.status,
        "check_in_at": record.check_in_at.isoformat() if record.check_in_at else None,
    }))
    return CheckInResponse(
        success=True,
        status=record.status,
        message=message,
        attendance=AttendanceOut.from_attendance(record),
    )


@router.get("/me", response_model=Page)
def my_attendance(db: DbDep, student: CurrentStudent, page: int = 1, page_size: int = 20):
    query = select(Attendance).where(Attendance.student_id == student.id)
    total = db.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    rows = db.execute(
        query.order_by(Attendance.check_in_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()
    return Page(
        items=[AttendanceOut.from_attendance(a) for a in rows],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.get("/class/{class_id}", response_model=Page)
def class_attendance_paged(
    class_id: str,
    db: DbDep,
    actor: User = Depends(Staff),
    page: int = 1,
    page_size: int = 100,
):
    cls = db.get(ClassSession, class_id)
    if cls is None:
        raise HTTPException(status_code=404, detail="Clase no encontrada")
    if not can_manage_class(db, actor, cls):
        raise HTTPException(status_code=403, detail="No tiene permisos sobre esta clase")
    query = select(Attendance).where(Attendance.class_id == class_id)
    total = db.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    rows = db.execute(
        query.order_by(Attendance.check_in_at).offset((page - 1) * page_size).limit(page_size)
    ).scalars().all()
    return Page(
        items=[AttendanceOut.from_attendance(a) for a in rows],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.patch("/{attendance_id}/status", response_model=AttendanceOut)
def update_attendance_status(
    attendance_id: str,
    payload: AttendanceUpdate,
    request: Request,
    db: DbDep,
    actor: User = Depends(Staff),
):
    record = db.get(Attendance, attendance_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Asistencia no encontrada")
    cls = db.get(ClassSession, record.class_id)
    if cls is None or not can_manage_class(db, actor, cls):
        raise HTTPException(status_code=403, detail="No tiene permisos sobre esta asistencia")
    record = attendance_service.change_status(
        db, attendance_id, payload.status, actor, payload.review_reason
    )
    audit(db, action="attendance_status_change", entity="attendance", entity_id=str(record.id),
          user_id=str(actor.id), username=actor.username, request=request,
          details={"status": record.status})
    return AttendanceOut.from_attendance(record)


@router.post("/justify", response_model=Message)
def create_justification(
    payload: JustificationCreate,
    request: Request,
    db: DbDep,
    student: CurrentStudent,
):
    just = attendance_service.request_justification(
        db, student, payload.attendance_id, payload.reason, payload.document_url
    )
    audit(db, action="justification_request", entity="justification", entity_id=str(just.id),
          user_id=str(student.user_id), username=student.user.username, request=request,
          details={"attendance_id": payload.attendance_id})
    return Message(message="Justificación enviada", detail=str(just.id))


@router.get("/justifications", response_model=Page)
def list_justifications(
    db: DbDep,
    actor: User = Depends(Staff),
    status: JustificationStatus | None = None,
    page: int = 1,
    page_size: int = 20,
):
    query = select(Justification)
    if not actor.has_role(RoleName.ADMIN):
        ids = commission_ids_for_user(db, actor)
        query = (
            query.join(Attendance, Justification.attendance_id == Attendance.id)
            .join(ClassSession, Attendance.class_id == ClassSession.id)
            .where(ClassSession.commission_id.in_(ids))
        )
    if status:
        query = query.where(Justification.status == status.value)
    total = db.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    rows = db.execute(
        query.order_by(Justification.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()
    items = []
    for j in rows:
        record = db.get(Attendance, j.attendance_id)
        items.append({
            "id": str(j.id),
            "attendance_id": str(j.attendance_id),
            "student_name": j.student.user.full_name if j.student else None,
            "registration_number": j.student.registration_number if j.student else None,
            "reason": j.reason,
            "document_url": j.document_url,
            "status": j.status,
            "created_at": j.created_at,
            "class_title": record.class_session.title if record and record.class_session else None,
        })
    return Page(items=items, total=total, page=page, page_size=page_size,
                pages=(total + page_size - 1) // page_size)


@router.post("/justifications/{justification_id}/review", response_model=Message)
def review_justification(
    justification_id: str,
    payload: JustificationReview,
    request: Request,
    db: DbDep,
    actor: User = Depends(Staff),
):
    just = db.get(Justification, justification_id)
    if just is None:
        raise HTTPException(status_code=404, detail="Justificación no encontrada")
    cls = db.get(ClassSession, just.attendance.class_id) if just.attendance else None
    if not actor.has_role(RoleName.ADMIN) and (cls is None or not can_manage_class(db, actor, cls)):
        raise HTTPException(status_code=403, detail="No tiene permisos sobre esta justificación")
    just = attendance_service.review_justification(
        db, justification_id, payload.status, actor, payload.review_notes
    )
    audit(db, action="justification_review", entity="justification", entity_id=str(just.id),
          user_id=str(actor.id), username=actor.username, request=request,
          details={"status": just.status})
    return Message(message="Justificación revisada")
