from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class TeacherCreate(BaseModel):
    email: str
    username: str
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str
    employee_number: str = Field(..., min_length=2, max_length=50)
    title: str | None = Field(default=None, max_length=100)
    department: str | None = Field(default=None, max_length=100)


class TeacherUpdate(BaseModel):
    full_name: str | None = None
    email: str | None = None
    is_active: bool | None = None
    employee_number: str | None = Field(default=None, min_length=2, max_length=50)
    title: str | None = Field(default=None, max_length=100)
    department: str | None = Field(default=None, max_length=100)


class TeacherOut(BaseModel):
    id: str
    user_id: str
    employee_number: str
    title: str | None
    department: str | None
    full_name: str
    email: str
    username: str
    is_active: bool
    created_at: datetime

    @classmethod
    def from_teacher(cls, teacher: Any) -> "TeacherOut":
        u = teacher.user
        return cls(
            id=str(teacher.id),
            user_id=str(teacher.user_id),
            employee_number=teacher.employee_number,
            title=teacher.title,
            department=teacher.department,
            full_name=u.full_name,
            email=u.email,
            username=u.username,
            is_active=u.is_active,
            created_at=teacher.created_at,
        )
