import uuid
from datetime import timedelta

import jwt as pyjwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import or_, select

from app.core.audit import audit
from app.core.authz import can_access_class
from app.core.config import settings
from app.core.deps import CurrentUser, DbDep, rate_limit
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.core.ticket_store import ticket_store
from app.core.token_store import token_store
from app.models.class_entity import ClassSession
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    RefreshRequest,
    TokenResponse,
    WSTicketRequest,
    WSTicketResponse,
)
from app.schemas.common import Message
from app.schemas.user import UserOut

router = APIRouter(prefix="/auth", tags=["Autenticación"])

_login_limit = Depends(rate_limit("login", settings.RATE_LIMIT_LOGIN, settings.RATE_LIMIT_PERIOD_SECONDS))


def _set_refresh_cookie(response: Response, refresh_token: str, max_age: int) -> None:
    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=refresh_token,
        max_age=max_age,
        path=settings.REFRESH_COOKIE_PATH,
        domain=settings.REFRESH_COOKIE_DOMAIN,
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        path=settings.REFRESH_COOKIE_PATH,
        domain=settings.REFRESH_COOKIE_DOMAIN,
    )


def _refresh_token_from(request: Request, payload: RefreshRequest) -> str | None:
    if payload.refresh_token:
        return payload.refresh_token
    return request.cookies.get(settings.REFRESH_COOKIE_NAME)


@router.post("/login", response_model=LoginResponse, dependencies=[_login_limit])
def login(payload: LoginRequest, request: Request, db: DbDep, response: Response) -> LoginResponse:
    user = db.execute(
        select(User).where(
            or_(User.email == payload.identifier, User.username == payload.identifier)
        )
    ).scalar_one_or_none()

    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Usuario desactivado")

    access = create_access_token(str(user.id), user.role_names())
    refresh_jti = uuid.uuid4().hex
    refresh = create_refresh_token(str(user.id), refresh_jti)
    _set_refresh_cookie(response, refresh, settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400)
    audit(db, action="login", entity="user", entity_id=str(user.id),
          user_id=str(user.id), username=user.username, request=request,
          details={"roles": user.role_names()})
    return LoginResponse(
        access_token=access,
        refresh_token=refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserOut.from_user(user),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, request: Request, db: DbDep, response: Response) -> TokenResponse:
    raw = _refresh_token_from(request, payload)
    if not raw:
        raise HTTPException(status_code=401, detail="Refresh token no proporcionado")
    try:
        data = decode_token(raw, expected_type="refresh")
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expirado")
    except pyjwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Refresh token inválido")

    jti = data.get("jti")
    if not jti or token_store.is_revoked(jti):
        raise HTTPException(status_code=401, detail="Refresh token revocado")

    user = db.get(User, data.get("sub"))
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuario inválido o desactivado")

    token_store.revoke(jti, settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400)
    new_access = create_access_token(str(user.id), user.role_names())
    new_jti = uuid.uuid4().hex
    new_refresh = create_refresh_token(str(user.id), new_jti)
    _set_refresh_cookie(response, new_refresh, settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400)
    audit(db, action="token_refresh", entity="user", entity_id=str(user.id),
          user_id=str(user.id), username=user.username, request=request)
    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/logout", response_model=Message)
def logout(payload: RefreshRequest, request: Request, db: DbDep, user: CurrentUser,
           response: Response) -> Message:
    raw = _refresh_token_from(request, payload)
    if raw:
        try:
            data = decode_token(raw, expected_type="refresh")
            jti = data.get("jti")
            if jti:
                token_store.revoke(jti, settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400)
        except pyjwt.PyJWTError:
            pass
    _clear_refresh_cookie(response)
    audit(db, action="logout", entity="user", entity_id=str(user.id),
          user_id=str(user.id), username=user.username, request=request)
    return Message(message="Sesión cerrada correctamente")


@router.post("/ws-ticket", response_model=WSTicketResponse)
def ws_ticket(payload: WSTicketRequest, request: Request, db: DbDep, user: CurrentUser) -> WSTicketResponse:
    cls = db.get(ClassSession, payload.class_id)
    if cls is None:
        raise HTTPException(status_code=404, detail="Clase no encontrada")
    if not can_access_class(db, user, cls):
        raise HTTPException(status_code=403, detail="No tiene acceso a esta clase")
    ticket, expires_in = ticket_store.issue(str(cls.id), str(user.id))
    audit(db, action="ws_ticket_issue", entity="class", entity_id=str(cls.id),
          user_id=str(user.id), username=user.username, request=request)
    return WSTicketResponse(ticket=ticket, expires_in=expires_in)


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> UserOut:
    return UserOut.from_user(user)


@router.post("/change-password", response_model=Message)
def change_password(payload: ChangePasswordRequest, request: Request, db: DbDep, user: CurrentUser) -> Message:
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Contraseña actual incorrecta")
    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    db.commit()
    audit(db, action="change_password", entity="user", entity_id=str(user.id),
          user_id=str(user.id), username=user.username, request=request)
    return Message(message="Contraseña actualizada")
