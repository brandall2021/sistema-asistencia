from pydantic import BaseModel, Field

from app.schemas.user import UserOut


class LoginRequest(BaseModel):
    identifier: str = Field(..., min_length=1, max_length=255, description="Email o nombre de usuario")
    password: str = Field(..., min_length=1, max_length=255)


class RefreshRequest(BaseModel):
    refresh_token: str | None = Field(
        default=None,
        description="Puede omitirse si se envía en la cookie HttpOnly",
    )


class WSTicketRequest(BaseModel):
    class_id: str


class WSTicketResponse(BaseModel):
    ticket: str
    expires_in: int


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class LoginResponse(TokenResponse):
    user: UserOut


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)
