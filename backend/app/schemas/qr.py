from datetime import datetime

from pydantic import BaseModel, Field


class QRResponse(BaseModel):
    token: str
    class_id: str
    expires_at: datetime
    ttl_seconds: int


class QRValidateResponse(BaseModel):
    valid: bool
    class_id: str | None = None
    message: str = ""
