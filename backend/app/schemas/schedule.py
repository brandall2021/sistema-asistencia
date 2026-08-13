from datetime import time
from typing import Any

from pydantic import BaseModel, Field, field_validator


class ScheduleCreate(BaseModel):
    commission_id: str
    classroom_id: str
    day_of_week: int = Field(..., ge=0, le=6)
    start_time: time
    end_time: time

    @field_validator("end_time")
    @classmethod
    def end_after_start(cls, v: time, info) -> time:
        start = info.data.get("start_time")
        if start and v <= start:
            raise ValueError("end_time debe ser posterior a start_time")
        return v


class ScheduleUpdate(BaseModel):
    classroom_id: str | None = None
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    start_time: time | None = None
    end_time: time | None = None
    active: bool | None = None


class ScheduleOut(BaseModel):
    id: str
    commission_id: str
    commission_name: str | None
    subject_name: str | None
    classroom_id: str
    classroom_name: str | None
    classroom_code: str | None
    day_of_week: int
    start_time: time
    end_time: time
    active: bool

    @classmethod
    def from_schedule(cls, s: Any) -> "ScheduleOut":
        return cls(
            id=str(s.id),
            commission_id=str(s.commission_id),
            commission_name=s.commission.name if s.commission else None,
            subject_name=s.commission.subject.name if s.commission and s.commission.subject else None,
            classroom_id=str(s.classroom_id),
            classroom_name=s.classroom.name if s.classroom else None,
            classroom_code=s.classroom.code if s.classroom else None,
            day_of_week=s.day_of_week,
            start_time=s.start_time,
            end_time=s.end_time,
            active=s.active,
        )
