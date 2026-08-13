import uuid
from datetime import datetime
from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, PlainSerializer

StrUUID = Annotated[
    uuid.UUID,
    PlainSerializer(lambda v: str(v), return_type=str),
]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel):
    items: list[Any]
    total: int
    page: int
    page_size: int
    pages: int


class Message(BaseModel):
    message: str
    detail: str | None = None
