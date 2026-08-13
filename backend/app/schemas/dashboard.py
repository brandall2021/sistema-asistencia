from datetime import date, datetime

from pydantic import BaseModel


class UpcomingClassOut(BaseModel):
    id: str
    title: str
    subject: str
    commission: str
    classroom: str | None = None
    date: date
    starts_at: datetime | None = None
    status: str


class RecentAttendanceOut(BaseModel):
    id: str
    student_name: str
    class_title: str
    date: date
    status: str
    check_in_at: datetime | None = None


class SubjectRiskOut(BaseModel):
    subject: str
    commission: str
    attendance_pct: float


class AuditEventOut(BaseModel):
    id: str
    action: str
    username: str | None = None
    created_at: datetime


class DashboardSummary(BaseModel):
    classes_today: int
    active_classes: int
    attendance_rate_today: float | None = None
    pending_justifications: int
    low_attendance_students: int
    upcoming_classes: list[UpcomingClassOut] = []
    next_class: UpcomingClassOut | None = None
    recent_attendance: list[RecentAttendanceOut] = []
    subjects_at_risk: list[SubjectRiskOut] = []
    recent_audit: list[AuditEventOut] = []
