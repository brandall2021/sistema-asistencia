import csv
import io
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser, DbDep, find_teacher_profile, require_roles
from app.models.academic import Career, Commission, Subject
from app.models.attendance import Attendance
from app.models.class_entity import ClassSession
from app.models.enums import RoleName
from app.models.student import Student
from app.models.teacher import Teacher
from app.models.user import User
from app.schemas.report import AttendanceReportItem, SummaryReport

router = APIRouter(prefix="/reports", tags=["Reportes"])

ReportDep = Depends(require_roles(RoleName.ADMIN, RoleName.AUDITOR, RoleName.DOCENTE))


def _aggs():
    present = func.sum(case((Attendance.status == "PRESENT", 1), else_=0))
    late = func.sum(case((Attendance.status == "LATE", 1), else_=0))
    absent = func.sum(case((Attendance.status == "ABSENT", 1), else_=0))
    justified = func.sum(case((Attendance.status == "JUSTIFIED", 1), else_=0))
    review = func.sum(case((Attendance.status == "REVIEW", 1), else_=0))
    return present, late, absent, justified, review


def _apply_filters(
    stmt,
    commission_id: str | None,
    career_id: str | None,
    from_date: date | None,
    to_date: date | None,
    teacher_id: str | None,
):
    stmt = stmt.where(ClassSession.status.in_(["ACTIVE", "FINISHED"]))
    if commission_id:
        stmt = stmt.where(Commission.id == commission_id)
    if career_id:
        stmt = stmt.where(Career.id == career_id)
    if from_date:
        stmt = stmt.where(ClassSession.date >= from_date)
    if to_date:
        stmt = stmt.where(ClassSession.date <= to_date)
    if teacher_id:
        stmt = stmt.where(Commission.teacher_id == teacher_id)
    return stmt


def _base_join():
    return (
        Attendance.__table__.join(ClassSession.__table__, Attendance.class_id == ClassSession.id)
        .join(Commission.__table__, ClassSession.commission_id == Commission.id)
        .join(Subject.__table__, Commission.subject_id == Subject.id)
        .join(Career.__table__, Commission.career_id == Career.id)
    )


def _dimension_group(dimension: str):
    mapping = {
        "commission": (Commission.id, Commission.name),
        "subject": (Subject.id, Subject.name),
        "career": (Career.id, Career.name),
    }
    if dimension not in mapping:
        raise HTTPException(status_code=400, detail="Dimensión inválida. Use student, commission, subject o career")
    return mapping[dimension]


def _summary_from_rows(rows, dimension: str) -> list[SummaryReport]:
    out = []
    for key, label, present_v, late_v, absent_v, justified_v, review_v in rows:
        present_v = present_v or 0
        late_v = late_v or 0
        absent_v = absent_v or 0
        justified_v = justified_v or 0
        review_v = review_v or 0
        total = present_v + late_v + absent_v + justified_v + review_v
        rate = (present_v + late_v + justified_v) / total * 100 if total else 0.0
        out.append(SummaryReport(
            dimension=dimension,
            key=str(key),
            label=label,
            total_classes=total,
            present=present_v,
            late=late_v,
            absent=absent_v,
            justified=justified_v,
            attendance_rate=round(rate, 2),
        ))
    return out


def _attendance_data(
    db: Session,
    actor: User,
    dimension: str,
    commission_id: str | None,
    career_id: str | None,
    from_date: date | None,
    to_date: date | None,
) -> list[dict]:
    teacher_id = None
    if not actor.has_role(RoleName.ADMIN, RoleName.AUDITOR):
        teacher = find_teacher_profile(db, actor)
        if teacher is None:
            raise HTTPException(status_code=403, detail="El usuario no tiene perfil docente")
        teacher_id = str(teacher.id)

    present, late, absent, justified, review = _aggs()
    if dimension == "student":
        stmt = (
            select(
                Student.id,
                Student.registration_number,
                Student.user_id,
                func.count(Attendance.id),
                present, late, absent, justified, review,
            )
            .select_from(_base_join())
            .join(Student, Attendance.student_id == Student.id)
            .group_by(Student.id, Student.registration_number, Student.user_id)
            .order_by(Student.id)
        )
        stmt = _apply_filters(stmt, commission_id, career_id, from_date, to_date, teacher_id)
        rows = db.execute(stmt).all()
        items = []
        for student_id, reg, user_id, total_v, p, l, a, j, r in rows:
            user = db.get(User, user_id)
            items.append(AttendanceReportItem.from_counts({
                "student_id": str(student_id),
                "registration_number": reg,
                "student_name": user.full_name if user else None,
                "PRESENT": p or 0,
                "LATE": l or 0,
                "ABSENT": a or 0,
                "JUSTIFIED": j or 0,
                "REVIEW": r or 0,
                "total": total_v,
            }).model_dump())
        return items

    key_col, label_col = _dimension_group(dimension)
    stmt = (
        select(key_col, label_col, present, late, absent, justified, review)
        .select_from(_base_join())
        .group_by(key_col, label_col)
        .order_by(key_col)
    )
    stmt = _apply_filters(stmt, commission_id, career_id, from_date, to_date, teacher_id)
    rows = db.execute(stmt).all()
    return [s.model_dump() for s in _summary_from_rows(rows, dimension)]


@router.get("/attendance", response_model=list[dict])
def attendance_report(
    db: DbDep,
    actor: User = ReportDep,
    dimension: str = Query(default="student", pattern="^(student|commission|subject|career)$"),
    commission_id: str | None = None,
    career_id: str | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
):
    return _attendance_data(db, actor, dimension, commission_id, career_id, from_date, to_date)


@router.get("/students/low-attendance")
def low_attendance(
    db: DbDep,
    actor: User = ReportDep,
    threshold: float = Query(default=60.0, ge=0, le=100),
    commission_id: str | None = None,
    career_id: str | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
):
    data = _attendance_data(db, actor, "student", commission_id, career_id, from_date, to_date)
    return [row for row in data if row["total_classes"] > 0 and row["attendance_rate"] < threshold]


@router.get("/attendance/export")
def export_attendance(
    db: DbDep,
    actor: User = ReportDep,
    format: str = Query(default="csv", pattern="^(csv|xlsx)$"),
    dimension: str = Query(default="student", pattern="^(student|commission|subject|career)$"),
    commission_id: str | None = None,
    career_id: str | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
):
    data = _attendance_data(db, actor, dimension, commission_id, career_id, from_date, to_date)
    filename = f"asistencia_{dimension}.{format}"

    if format == "csv":
        buffer = io.StringIO()
        if data:
            writer = csv.DictWriter(buffer, fieldnames=list(data[0].keys()))
            writer.writeheader()
            writer.writerows(data)
        return Response(
            content=buffer.getvalue(),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Asistencia"
    if data:
        ws.append(list(data[0].keys()))
        for row in data:
            ws.append(list(row.values()))
    stream = io.BytesIO()
    wb.save(stream)
    return Response(
        content=stream.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
