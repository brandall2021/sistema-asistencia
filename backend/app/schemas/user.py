from typing import Any

from pydantic import BaseModel, Field

from app.models.enums import RoleName
from app.schemas.common import ORMModel


class UserCreate(BaseModel):
    email: str
    username: str
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str
    roles: list[RoleName] = Field(default_factory=lambda: [RoleName.ALUMNO])


class UserUpdate(BaseModel):
    email: str | None = None
    username: str | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
    full_name: str | None = None
    is_active: bool | None = None
    roles: list[RoleName] | None = None


class UserBase(ORMModel):
    id: str
    email: str
    username: str
    full_name: str
    is_active: bool
    roles: list[str]


class UserOut(UserBase):
    @classmethod
    def from_user(cls, user: Any) -> "UserOut":
        return cls(
            id=str(user.id),
            email=user.email,
            username=user.username,
            full_name=user.full_name,
            is_active=user.is_active,
            roles=user.role_names(),
        )
