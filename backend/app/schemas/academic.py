from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import StrUUID


class CareerBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    code: str = Field(..., min_length=1, max_length=50)
    description: str | None = None
    active: bool = True


class CareerCreate(CareerBase):
    pass


class CareerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    code: str | None = Field(default=None, min_length=1, max_length=50)
    description: str | None = None
    active: bool | None = None


class CareerOut(CareerBase):
    model_config = ConfigDict(from_attributes=True)

    id: StrUUID
    created_at: datetime


class SubjectBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    code: str = Field(..., min_length=1, max_length=50)
    career_id: str
    semester: int | None = Field(default=None, ge=1, le=12)
    credits: int | None = Field(default=None, ge=0, le=30)
    active: bool = True


class SubjectCreate(SubjectBase):
    pass


class SubjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    code: str | None = Field(default=None, min_length=1, max_length=50)
    career_id: str | None = None
    semester: int | None = Field(default=None, ge=1, le=12)
    credits: int | None = Field(default=None, ge=0, le=30)
    active: bool | None = None


class SubjectOut(BaseModel):
    id: str
    name: str
    code: str
    career_id: str
    career_name: str | None
    semester: int | None
    credits: int | None
    active: bool
    created_at: datetime

    @classmethod
    def from_subject(cls, subject: Any) -> "SubjectOut":
        return cls(
            id=str(subject.id),
            name=subject.name,
            code=subject.code,
            career_id=str(subject.career_id),
            career_name=subject.career.name if subject.career else None,
            semester=subject.semester,
            credits=subject.credits,
            active=subject.active,
            created_at=subject.created_at,
        )


class CommissionBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    code: str = Field(..., min_length=1, max_length=50)
    subject_id: str
    career_id: str
    teacher_id: str | None = None
    year: int = Field(default=2026, ge=2000, le=2100)
    period: str = Field(default="1", max_length=20)
    capacity: int | None = Field(default=None, ge=1)
    active: bool = True


class CommissionCreate(CommissionBase):
    pass


class CommissionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    code: str | None = Field(default=None, min_length=1, max_length=50)
    subject_id: str | None = None
    career_id: str | None = None
    teacher_id: str | None = None
    year: int | None = Field(default=None, ge=2000, le=2100)
    period: str | None = Field(default=None, max_length=20)
    capacity: int | None = Field(default=None, ge=1)
    active: bool | None = None


class CommissionOut(BaseModel):
    id: str
    name: str
    code: str
    subject_id: str
    subject_name: str | None
    career_id: str
    career_name: str | None
    teacher_id: str | None
    teacher_name: str | None
    year: int
    period: str
    capacity: int | None
    active: bool
    created_at: datetime

    @classmethod
    def from_commission(cls, c: Any) -> "CommissionOut":
        return cls(
            id=str(c.id),
            name=c.name,
            code=c.code,
            subject_id=str(c.subject_id),
            subject_name=c.subject.name if c.subject else None,
            career_id=str(c.career_id),
            career_name=c.career.name if c.career else None,
            teacher_id=str(c.teacher_id) if c.teacher_id else None,
            teacher_name=c.teacher.user.full_name if c.teacher and c.teacher.user else None,
            year=c.year,
            period=c.period,
            capacity=c.capacity,
            active=c.active,
            created_at=c.created_at,
        )
