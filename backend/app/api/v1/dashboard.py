"""Resumen de dashboard por rol.

Devuelve métricas acotadas al alcance del usuario: ADMIN/AUDITOR ven todo,
DOCENTE solo sus comisiones y ALUMNO solo sus inscripciones/registros.
"""

from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import and_, case, func, select

from app.core.authz import commission_ids_for_user
from app.core.deps import DbDep, find_student_profile, require_roles
from app.models.academic import Commission, Subject
from app.models.attendance import Attendance, Justification
from app.models.audit_log import AuditLog
from app.models.class_entity import ClassSession
from app.models.classroom import Classroom
from app.models.enrollment import Enrollment
from app.models.enums import RoleName
from app.models.student import Student
from app.models.user import User
from app.schemas.dashboard import (
    AuditEventOut,
    DashboardSummary,
    RecentAttendanceOut,
    SubjectRiskOut,
    UpcomingClassOut,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

DashboardAccess = Depends(
    require_roles(RoleName.ADMIN, RoleName.AUDITOR, RoleName.DOCENTE, RoleName.ALUMNO)
)


def _today() -> date:
    return datetime.now(timezone.utc).date()


def _scoped_class_ids(db, actor: User) -> set[str] | None:
    """IDs de comisiones visibles; None = sin filtro (ADMIN/AUDITOR)."""
    if actor.has_role(RoleName.ADMIN, RoleName.AUDITOR):
        return None
    return set(commission_ids_for_user(db, actor))


def _count(db, base_stmt):
    return db.execute(select(func.count()).select_from(base_stmt.subquery())).scalar_one()


@router.get("/summary", response_model=DashboardSummary)
def dashboard_summary(db: DbDep, actor: User = DashboardAccess) -> DashboardSummary:
    scope_ids = _scoped_class_ids(db, actor)
    is_student = actor.has_role(RoleName.ALUMNO)
    student = find_student_profile(db, actor) if is_student else None

    def scope_condition():
        if scope_ids is None:
            return True
        if not scope_ids:
            return False
        return ClassSession.commission_id.in_(list(scope_ids))

    # 1. Clases de hoy
    classes_today_stmt = select(ClassSession).where(ClassSession.date == _today())
    if scope_ids is not None:
        classes_today_stmt = classes_today_stmt.where(scope_condition())
    classes_today = _count(db, classes_today_stmt)

    # 2. Clases activas
    active_stmt = select(ClassSession).where(ClassSession.status == "ACTIVE")
    if scope_ids is not None:
        active_stmt = active_stmt.where(scope_condition())
    active_classes = _count(db, active_stmt)

    # 3. Tasa de asistencia de hoy
    attendance_rate_today = None
    att_q = (
        select(
            func.sum(case((Attendance.status.in_(["PRESENT", "LATE"]), 1), else_=0)).label("ok"),
            func.count(Attendance.id).label("total"),
        )
        .select_from(Attendance)
        .join(ClassSession, Attendance.class_id == ClassSession.id)
        .where(
            ClassSession.date == _today(),
            ClassSession.status.in_(["ACTIVE", "FINISHED"]),
        )
    )
    if scope_ids is not None:
        if not scope_ids:
            att_q = att_q.where(False)
        else:
            att_q = att_q.where(ClassSession.commission_id.in_(list(scope_ids)))
    if student is not None:
        att_q = att_q.where(Attendance.student_id == student.id)
    ok, total = db.execute(att_q).one()
    if total:
        attendance_rate_today = round(float(ok) / float(total) * 100, 1)

    # 4. Justificaciones pendientes
    just_q = select(Justification).where(Justification.status == "PENDING")
    if student is not None:
        just_q = just_q.join(Attendance, Justification.attendance_id == Attendance.id).where(
            Attendance.student_id == student.id
        )
    elif scope_ids is not None:
        just_q = (
            just_q.join(Attendance, Justification.attendance_id == Attendance.id)
            .join(ClassSession, Attendance.class_id == ClassSession.id)
        )
        if not scope_ids:
            just_q = just_q.where(False)
        else:
            just_q = just_q.where(ClassSession.commission_id.in_(list(scope_ids)))
    pending_justifications = _count(db, just_q)

    # 5. Alumnos con asistencia baja (< 60%)
    low_attendance_students = 0
    if scope_ids is None or actor.has_role(RoleName.DOCENTE):
        low_q = (
            select(
                Student.id,
                func.sum(case((Attendance.status.in_(["PRESENT", "LATE"]), 1), else_=0)).label("ok"),
                func.count(Attendance.id).label("total"),
            )
            .select_from(Student)
            .join(Enrollment, Enrollment.student_id == Student.id)
            .join(Commission, Enrollment.commission_id == Commission.id)
            .join(ClassSession, ClassSession.commission_id == Commission.id)
            .outerjoin(
                Attendance,
                and_(Attendance.student_id == Student.id, Attendance.class_id == ClassSession.id),
            )
            .where(Enrollment.status == "ACTIVE", ClassSession.status.in_(["ACTIVE", "FINISHED"]))
            .group_by(Student.id)
            .having(func.count(Attendance.id) > 0)
        )
        if scope_ids is not None:
            if not scope_ids:
                low_q = low_q.where(False)
            else:
                low_q = low_q.where(Commission.id.in_(list(scope_ids)))
        low_rows = db.execute(low_q).all()
        low_attendance_students = sum(1 for r in low_rows if r.total and float(r.ok) / float(r.total) < 0.6)

    # 6. Próximas clases
    upcoming_stmt = (
        select(ClassSession, Commission.name, Subject.name, Classroom.name)
        .join(Commission, ClassSession.commission_id == Commission.id)
        .join(Subject, Commission.subject_id == Subject.id)
        .outerjoin(Classroom, ClassSession.classroom_id == Classroom.id)
        .where(ClassSession.date >= _today(), ClassSession.status.in_(["SCHEDULED", "ACTIVE"]))
        .order_by(ClassSession.date.asc(), ClassSession.starts_at.asc())
        .limit(5)
    )
    if scope_ids is not None:
        if not scope_ids:
            upcoming_stmt = upcoming_stmt.where(False)
        else:
            upcoming_stmt = upcoming_stmt.where(ClassSession.commission_id.in_(list(scope_ids)))
    upcoming_rows = db.execute(upcoming_stmt).all()
    upcoming_classes = [
        UpcomingClassOut(
            id=str(c.id),
            title=c.title,
            subject=subject,
            commission=commission,
            classroom=classroom,
            date=c.date,
            starts_at=c.starts_at,
            status=c.status,
        )
        for c, commission, subject, classroom in upcoming_rows
    ]
    next_class = upcoming_classes[0] if upcoming_classes else None

    # 7. Asistencia reciente
    rec_q = (
        select(Attendance, ClassSession.title, ClassSession.date, User.full_name)
        .join(ClassSession, Attendance.class_id == ClassSession.id)
        .join(Student, Attendance.student_id == Student.id)
        .join(User, Student.user_id == User.id)
        .order_by(Attendance.created_at.desc())
        .limit(5)
    )
    if student is not None:
        rec_q = rec_q.where(Attendance.student_id == student.id)
    elif scope_ids is not None:
        if not scope_ids:
            rec_q = rec_q.where(False)
        else:
            rec_q = rec_q.where(ClassSession.commission_id.in_(list(scope_ids)))
    rec_rows = db.execute(rec_q).all()
    recent_attendance = [
        RecentAttendanceOut(
            id=str(a.id),
            student_name=full_name or "",
            class_title=title,
            date=d,
            status=a.status,
            check_in_at=a.checked_in_at,
        )
        for a, title, d, full_name in rec_rows
    ]

    # 8. Materias en riesgo (solo alumno)
    subjects_at_risk: list[SubjectRiskOut] = []
    if student is not None:
        risk_q = (
            select(
                Subject.name,
                Commission.name,
                func.sum(case((Attendance.status.in_(["PRESENT", "LATE"]), 1), else_=0)).label("ok"),
                func.count(Attendance.id).label("total"),
            )
            .select_from(Enrollment)
            .join(Commission, Enrollment.commission_id == Commission.id)
            .join(Subject, Commission.subject_id == Subject.id)
            .join(ClassSession, ClassSession.commission_id == Commission.id)
            .outerjoin(
                Attendance,
                and_(Attendance.student_id == student.id, Attendance.class_id == ClassSession.id),
            )
            .where(Enrollment.student_id == student.id, Enrollment.status == "ACTIVE")
            .group_by(Subject.name, Commission.name)
        )
        for subj, com, ok, total in db.execute(risk_q).all():
            if total and float(ok) / float(total) < 0.6:
                subjects_at_risk.append(
                    SubjectRiskOut(
                        subject=subj,
                        commission=com,
                        attendance_pct=round(float(ok) / float(total) * 100, 1),
                    )
                )

    # 9. Últimos eventos de auditoría (solo ADMIN/AUDITOR)
    recent_audit: list[AuditEventOut] = []
    if scope_ids is None:
        audit_q = (
            select(AuditLog)
            .order_by(AuditLog.created_at.desc())
            .limit(10)
        )
        recent_audit = [
            AuditEventOut(id=str(a.id), action=a.action, username=a.username, created_at=a.created_at)
            for a in db.execute(audit_q).scalars().all()
        ]

    return DashboardSummary(
        classes_today=classes_today,
        active_classes=active_classes,
        attendance_rate_today=attendance_rate_today,
        pending_justifications=pending_justifications,
        low_attendance_students=low_attendance_students,
        upcoming_classes=upcoming_classes,
        next_class=next_class,
        recent_attendance=recent_attendance,
        subjects_at_risk=subjects_at_risk,
        recent_audit=recent_audit,
    )
