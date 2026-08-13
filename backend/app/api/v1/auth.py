import uuid
from datetime import timedelta

import jwt as pyjwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import or_, select

from app.core.audit import audit
from app.core.config import settings
from app.core.deps import CurrentUser, DbDep, rate_limit
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.core.token_store import token_store
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    RefreshRequest,
    TokenResponse,
)
from app.schemas.common import Message
from app.schemas.user import UserOut

router = APIRouter(prefix="/auth", tags=["Autenticación"])

_login_limit = Depends(rate_limit("login", settings.RATE_LIMIT_LOGIN, settings.RATE_LIMIT_PERIOD_SECONDS))


@router.post("/login", response_model=LoginResponse, dependencies=[_login_limit])
def login(payload: LoginRequest, request: Request, db: DbDep) -> LoginResponse:
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
def refresh(payload: RefreshRequest, request: Request, db: DbDep) -> TokenResponse:
    try:
        data = decode_token(payload.refresh_token, expected_type="refresh")
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
    audit(db, action="token_refresh", entity="user", entity_id=str(user.id),
          user_id=str(user.id), username=user.username, request=request)
    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/logout", response_model=Message)
def logout(payload: RefreshRequest, request: Request, db: DbDep, user: CurrentUser) -> Message:
    try:
        data = decode_token(payload.refresh_token, expected_type="refresh")
        jti = data.get("jti")
        if jti:
            token_store.revoke(jti, settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400)
    except pyjwt.PyJWTError:
        pass
    audit(db, action="logout", entity="user", entity_id=str(user.id),
          user_id=str(user.id), username=user.username, request=request)
    return Message(message="Sesión cerrada correctamente")


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
