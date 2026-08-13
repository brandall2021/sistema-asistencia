import ipaddress
from collections.abc import Callable
from typing import Annotated

import jwt as pyjwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.rate_limit import rate_limiter
from app.core.security import decode_token
from app.db.session import get_db
from app.models.enums import RoleName
from app.models.student import Student
from app.models.teacher import Teacher
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)

DbDep = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DbDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autenticado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_token(credentials.credentials, expected_type="access")
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except pyjwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

    user = db.get(User, payload.get("sub"))
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuario inválido o desactivado")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: RoleName) -> Callable:
    async def _checker(user: CurrentUser) -> User:
        if not user.has_role(*roles):
            raise HTTPException(status_code=403, detail="No tiene permisos para esta operación")
        return user

    return _checker


def find_teacher_profile(db: Session, user: User) -> Teacher | None:
    """Perfil Teacher asociado al usuario, o None si no existe."""
    return db.execute(select(Teacher).where(Teacher.user_id == user.id)).scalar_one_or_none()


def find_student_profile(db: Session, user: User) -> Student | None:
    """Perfil Student asociado al usuario, o None si no existe."""
    return db.execute(select(Student).where(Student.user_id == user.id)).scalar_one_or_none()


def get_teacher_profile(db: Session, user: User) -> Teacher:
    teacher = find_teacher_profile(db, user)
    if teacher is None:
        raise HTTPException(status_code=403, detail="El usuario no tiene perfil docente")
    return teacher


def get_student_profile(db: Session, user: User) -> Student:
    student = find_student_profile(db, user)
    if student is None:
        raise HTTPException(status_code=403, detail="El usuario no tiene perfil de alumno")
    return student


def get_current_student(db: DbDep, user: CurrentUser) -> Student:
    if not user.has_role(RoleName.ALUMNO):
        raise HTTPException(status_code=403, detail="Se requiere perfil de alumno")
    return get_student_profile(db, user)


CurrentStudent = Annotated[Student, Depends(get_current_student)]


def get_current_teacher(db: DbDep, user: CurrentUser) -> Teacher:
    if not user.has_role(RoleName.DOCENTE):
        raise HTTPException(status_code=403, detail="Se requiere perfil de docente")
    return get_teacher_profile(db, user)


CurrentTeacher = Annotated[Teacher, Depends(get_current_teacher)]


_TRUSTED_CIDRS = []
for _entry in settings.trusted_proxy_list:
    try:
        _TRUSTED_CIDRS.append(ipaddress.ip_network(_entry, strict=False))
    except ValueError:
        pass


def _is_trusted_proxy(peer: str) -> bool:
    try:
        ip = ipaddress.ip_address(peer)
    except ValueError:
        return False
    return any(ip in net for net in _TRUSTED_CIDRS)


def _client_ip(request: Request) -> str:
    """IP del cliente para rate limiting.

    ``X-Forwarded-For`` solo se acepta si la conexión directa proviene de un
    proxy incluido en ``TRUSTED_PROXIES``; en otro caso se usa
    ``request.client.host``, de modo que un cliente no puede evadir el límite
    cambiando la cabecera arbitrariamente.
    """
    peer = request.client.host if request.client else "unknown"
    if _is_trusted_proxy(peer):
        forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        if forwarded:
            return forwarded
    return peer


def rate_limit(key_prefix: str, limit: int, period: int) -> Callable:
    def _limiter(request: Request) -> None:
        key = f"rl:{key_prefix}:{_client_ip(request)}"
        if not rate_limiter.allow(key, limit, period):
            raise HTTPException(status_code=429, detail="Demasiadas solicitudes. Intente más tarde")

    return _limiter
