from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class AttendanceReportItem(BaseModel):
    student_id: str
    registration_number: str | None
    student_name: str | None
    total_classes: int
    present: int
    late: int
    absent: int
    justified: int
    review: int
    attendance_rate: float

    @classmethod
    def from_counts(cls, row: Any) -> "AttendanceReportItem":
        total = row.get("total", 0)
        present = row.get("PRESENT", 0)
        late = row.get("LATE", 0)
        absent = row.get("ABSENT", 0)
        justified = row.get("JUSTIFIED", 0)
        review = row.get("REVIEW", 0)
        rate = (present + late + justified) / total * 100 if total else 0.0
        return cls(
            student_id=row.get("student_id"),
            registration_number=row.get("registration_number"),
            student_name=row.get("student_name"),
            total_classes=total,
            present=present,
            late=late,
            absent=absent,
            justified=justified,
            review=review,
            attendance_rate=round(rate, 2),
        )


class SummaryReport(BaseModel):
    dimension: str
    key: str
    label: str | None
    total_classes: int
    present: int
    late: int
    absent: int
    justified: int
    attendance_rate: float
