from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.enums import EnrollmentStatus


class EnrollmentCreate(BaseModel):
    student_id: str
    commission_id: str
    status: EnrollmentStatus = EnrollmentStatus.ACTIVE


class EnrollmentUpdate(BaseModel):
    status: EnrollmentStatus | None = None


class EnrollmentOut(BaseModel):
    id: str
    student_id: str
    commission_id: str
    commission_name: str | None
    subject_name: str | None
    career_name: str | None
    status: str
    enrolled_at: datetime
    student_full_name: str | None
    registration_number: str | None

    @classmethod
    def from_enrollment(cls, e: Any) -> "EnrollmentOut":
        return cls(
            id=str(e.id),
            student_id=str(e.student_id),
            commission_id=str(e.commission_id),
            commission_name=e.commission.name if e.commission else None,
            subject_name=e.commission.subject.name if e.commission and e.commission.subject else None,
            career_name=e.commission.career.name if e.commission and e.commission.career else None,
            status=e.status,
            enrolled_at=e.enrolled_at,
            student_full_name=e.student.user.full_name if e.student and e.student.user else None,
            registration_number=e.student.registration_number if e.student else None,
        )
