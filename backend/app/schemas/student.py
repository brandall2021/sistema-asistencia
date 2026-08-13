from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.user import UserOut


class StudentBase(BaseModel):
    registration_number: str = Field(..., min_length=2, max_length=50)
    dni: str | None = Field(default=None, max_length=20)
    career_id: str | None = None
    year: int | None = Field(default=None, ge=1, le=10)


class StudentCreate(StudentBase):
    email: str
    username: str
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str


class StudentUpdate(BaseModel):
    registration_number: str | None = Field(default=None, min_length=2, max_length=50)
    dni: str | None = Field(default=None, max_length=20)
    career_id: str | None = None
    year: int | None = Field(default=None, ge=1, le=10)
    full_name: str | None = None
    email: str | None = None
    is_active: bool | None = None


class StudentOut(BaseModel):
    id: str
    user_id: str
    registration_number: str
    dni: str | None
    career_id: str | None
    career_name: str | None
    year: int | None
    full_name: str
    email: str
    username: str
    is_active: bool
    created_at: datetime

    @classmethod
    def from_student(cls, student: Any) -> "StudentOut":
        u = student.user
        return cls(
            id=str(student.id),
            user_id=str(student.user_id),
            registration_number=student.registration_number,
            dni=student.dni,
            career_id=str(student.career_id) if student.career_id else None,
            career_name=student.career.name if student.career else None,
            year=student.year,
            full_name=u.full_name,
            email=u.email,
            username=u.username,
            is_active=u.is_active,
            created_at=student.created_at,
        )
