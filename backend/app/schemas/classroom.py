from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


class ClassroomBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    code: str = Field(..., min_length=1, max_length=50)
    building: str | None = Field(default=None, max_length=100)
    floor: str | None = Field(default=None, max_length=20)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    radius_meters: float = Field(default=50.0, ge=5, le=2000)
    active: bool = True

    @field_validator("radius_meters")
    @classmethod
    def radius_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("radius_meters debe ser positivo")
        return v


class ClassroomCreate(ClassroomBase):
    pass


class ClassroomUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    code: str | None = Field(default=None, min_length=1, max_length=50)
    building: str | None = Field(default=None, max_length=100)
    floor: str | None = Field(default=None, max_length=20)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    radius_meters: float | None = Field(default=None, ge=5, le=2000)
    active: bool | None = None


class ClassroomOut(ClassroomBase):
    id: str
    created_at: datetime

    @classmethod
    def from_classroom(cls, c: Any) -> "ClassroomOut":
        return cls(
            id=str(c.id),
            name=c.name,
            code=c.code,
            building=c.building,
            floor=c.floor,
            latitude=c.latitude,
            longitude=c.longitude,
            radius_meters=c.radius_meters,
            active=c.active,
            created_at=c.created_at,
        )
