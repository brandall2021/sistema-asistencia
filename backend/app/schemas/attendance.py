from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.enums import AttendanceStatus, JustificationStatus


class CheckInRequest(BaseModel):
    token: str = Field(..., min_length=8, max_length=256)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    accuracy: float = Field(..., ge=0, le=5000)


class AttendanceUpdate(BaseModel):
    status: AttendanceStatus
    review_reason: str | None = Field(default=None, max_length=500)


class JustificationCreate(BaseModel):
    attendance_id: str
    reason: str = Field(..., min_length=5, max_length=2000)
    document_url: str | None = Field(default=None, max_length=500)


class JustificationReview(BaseModel):
    status: JustificationStatus
    review_notes: str | None = Field(default=None, max_length=2000)


class AttendanceOut(BaseModel):
    id: str
    class_id: str
    class_title: str | None
    subject_name: str | None
    commission_name: str | None
    date: datetime | None
    student_id: str
    student_name: str | None
    registration_number: str | None
    status: str
    check_in_at: datetime | None
    latitude: float | None
    longitude: float | None
    accuracy: float | None
    distance_meters: float | None
    method: str
    review_reason: str | None

    @classmethod
    def from_attendance(cls, a: Any) -> "AttendanceOut":
        cs = a.class_session
        return cls(
            id=str(a.id),
            class_id=str(a.class_id),
            class_title=cs.title if cs else None,
            subject_name=cs.commission.subject.name if cs and cs.commission and cs.commission.subject else None,
            commission_name=cs.commission.name if cs and cs.commission else None,
            date=cs.starts_at if cs else None,
            student_id=str(a.student_id),
            student_name=a.student.user.full_name if a.student and a.student.user else None,
            registration_number=a.student.registration_number if a.student else None,
            status=a.status,
            check_in_at=a.check_in_at,
            latitude=a.latitude,
            longitude=a.longitude,
            accuracy=a.accuracy,
            distance_meters=a.distance_meters,
            method=a.method,
            review_reason=a.review_reason,
        )


class CheckInResponse(BaseModel):
    success: bool
    status: str
    message: str
    attendance: AttendanceOut
