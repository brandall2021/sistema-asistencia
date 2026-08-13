from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import ensure_aware
from app.models.attendance import Attendance, AttendanceEvent, Justification
from app.models.enums import AttendanceStatus, CheckInMethod, JustificationStatus
from app.models.student import Student
from app.models.user import User
from app.services.geo import validate_gps
from app.services.qr import is_valid, resolve_qr


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _fail(detail: str) -> HTTPException:
    return HTTPException(status_code=400, detail=detail)


def check_in(db: Session, student: Student, token: str, latitude: float, longitude: float, accuracy: float) -> tuple[Attendance, str]:
    qr = resolve_qr(db, token)
    if qr is None:
        raise _fail("QR_INVALIDO")

    valid, reason = is_valid(db, qr)
    if not valid:
        raise _fail(reason)

    class_session = qr.class_session
    if class_session.commission is None:
        raise _fail("COMISION_NO_ENCONTRADA")

    _enrolled_ok = any(
        e.commission_id == class_session.commission_id and e.status == "ACTIVE"
        for e in student.enrollments
    )
    if not _enrolled_ok:
        raise _fail("ALUMNO_NO_INSCRIPTO")

    classroom = class_session.classroom
    if classroom is None:
        raise _fail("AULA_SIN_UBICACION")

    geo = validate_gps(
        latitude, longitude, accuracy,
        classroom.latitude, classroom.longitude, classroom.radius_meters,
    )
    if not geo.valid:
        if geo.reason == "GPS_IMPRECISO":
            raise _fail("GPS_IMPRECISO")
        raise _fail("FUERA_DEL_AULA")

    existing = db.execute(
        select(Attendance).where(
            Attendance.class_id == class_session.id,
            Attendance.student_id == student.id,
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise _fail("ASISTENCIA_YA_REGISTRADA")

    status = AttendanceStatus.PRESENT.value
    if class_session.starts_at:
        grace = timedelta(minutes=class_session.late_grace_minutes)
        if _now() > ensure_aware(class_session.starts_at) + grace:
            status = AttendanceStatus.LATE.value

    record = Attendance(
        class_id=class_session.id,
        student_id=student.id,
        status=status,
        check_in_at=_now(),
        latitude=latitude,
        longitude=longitude,
        accuracy=accuracy,
        distance_meters=round(geo.distance_meters, 2),
        method=CheckInMethod.QR.value,
    )
    db.add(record)
    db.flush()
    db.add(AttendanceEvent(
        attendance_id=record.id,
        class_id=class_session.id,
        student_id=student.id,
        action="CHECKED_IN",
        new_status=status,
        detail=f"Check-in por QR (distancia {round(geo.distance_meters, 2)}m, precisión {accuracy}m)",
    ))
    db.commit()
    db.refresh(record)

    message = (
        "Asistencia registrada correctamente"
        if status == AttendanceStatus.PRESENT.value
        else "Asistencia registrada como tarde"
    )
    return record, message


def change_status(
    db: Session,
    attendance_id: str,
    new_status: AttendanceStatus,
    actor: User,
    reason: str | None = None,
) -> Attendance:
    record = db.get(Attendance, attendance_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Asistencia no encontrada")

    previous = record.status
    record.status = new_status.value
    if reason:
        record.review_reason = reason
    db.add(AttendanceEvent(
        attendance_id=record.id,
        class_id=record.class_id,
        student_id=record.student_id,
        action="STATUS_CHANGED",
        previous_status=previous,
        new_status=new_status.value,
        detail=reason,
        created_by=actor.id,
    ))
    db.commit()
    db.refresh(record)
    return record


def request_justification(
    db: Session,
    student: Student,
    attendance_id: str,
    reason: str,
    document_url: str | None,
) -> Justification:
    record = db.get(Attendance, attendance_id)
    if record is None or record.student_id != student.id:
        raise HTTPException(status_code=404, detail="Asistencia no encontrada")

    just = Justification(
        attendance_id=record.id,
        student_id=student.id,
        reason=reason,
        document_url=document_url,
        status=JustificationStatus.PENDING.value,
    )
    db.add(just)
    db.flush()
    db.add(AttendanceEvent(
        attendance_id=record.id,
        class_id=record.class_id,
        student_id=record.student_id,
        action="JUSTIFICATION_REQUESTED",
        new_status=AttendanceStatus.REVIEW.value,
        detail=reason,
    ))
    record.status = AttendanceStatus.REVIEW.value
    db.commit()
    db.refresh(just)
    return just


def review_justification(
    db: Session,
    justification_id: str,
    new_status: JustificationStatus,
    reviewer: User,
    notes: str | None,
) -> Justification:
    just = db.get(Justification, justification_id)
    if just is None:
        raise HTTPException(status_code=404, detail="Justificación no encontrada")

    just.status = new_status.value
    just.reviewed_by = reviewer.id
    just.reviewed_at = _now()
    just.review_notes = notes

    record = db.get(Attendance, just.attendance_id)
    if record is not None:
        target = AttendanceStatus.JUSTIFIED.value if new_status == JustificationStatus.APPROVED else AttendanceStatus.REJECTED.value
        previous = record.status
        record.status = target
        db.add(AttendanceEvent(
            attendance_id=record.id,
            class_id=record.class_id,
            student_id=record.student_id,
            action="JUSTIFICATION_REVIEWED",
            previous_status=previous,
            new_status=target,
            detail=notes,
            created_by=reviewer.id,
        ))
    db.commit()
    db.refresh(just)
    return just
