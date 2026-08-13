
from datetime import date as date_type, datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.enums import ClassStatus


class ClassCreate(BaseModel):
    commission_id: str
    schedule_id: str | None = None
    classroom_id: str | None = None
    title: str | None = Field(default=None, max_length=255)
    date: date_type
    late_grace_minutes: int = Field(default=10, ge=0, le=120)


class ClassUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    schedule_id: str | None = None
    classroom_id: str | None = None
    date: date_type | None = None
    late_grace_minutes: int | None = Field(default=None, ge=0, le=120)
    status: ClassStatus | None = None


class ClassOut(BaseModel):
    id: str
    commission_id: str
    commission_name: str | None
    subject_name: str | None
    career_name: str | None
    schedule_id: str | None
    classroom_id: str | None
    classroom_name: str | None
    classroom_code: str | None
    teacher_id: str | None
    teacher_name: str | None
    created_by: str | None
    title: str
    date: date_type
    starts_at: datetime | None
    ends_at: datetime | None
    status: str
    late_grace_minutes: int
    attendance_count: int = 0
    total_students: int = 0

    @classmethod
    def from_class(
        cls,
        c: Any,
        attendance_count: int | None = None,
        total_students: int | None = None,
    ) -> "ClassOut":
        return cls(
            id=str(c.id),
            commission_id=str(c.commission_id),
            commission_name=c.commission.name if c.commission else None,
            subject_name=c.commission.subject.name if c.commission and c.commission.subject else None,
            career_name=c.commission.career.name if c.commission and c.commission.career else None,
            schedule_id=str(c.schedule_id) if c.schedule_id else None,
            classroom_id=str(c.classroom_id) if c.classroom_id else None,
            classroom_name=c.classroom.name if c.classroom else None,
            classroom_code=c.classroom.code if c.classroom else None,
            teacher_id=str(c.teacher_id) if c.teacher_id else None,
            teacher_name=c.teacher.user.full_name if c.teacher and c.teacher.user else None,
            created_by=str(c.created_by) if c.created_by else None,
            title=c.title,
            date=c.date,
            starts_at=c.starts_at,
            ends_at=c.ends_at,
            status=c.status,
            late_grace_minutes=c.late_grace_minutes,
            attendance_count=attendance_count if attendance_count is not None else 0,
            total_students=total_students if total_students is not None else 0,
        )
