from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models.enums import RoleName
from app.models.user import Role, User

ROLES = [
    (RoleName.ADMIN, "Administrador del sistema con acceso total."),
    (RoleName.DOCENTE, "Docente: gestiona clases y asistencia de sus comisiones."),
    (RoleName.ALUMNO, "Alumno: registra asistencia mediante QR."),
    (RoleName.AUDITOR, "Auditor: consulta reportes y auditoría (solo lectura)."),
]


def seed_roles(db: Session) -> None:
    for role_name, description in ROLES:
        existing = db.execute(select(Role).where(Role.name == role_name.value)).scalar_one_or_none()
        if existing is None:
            db.add(Role(name=role_name.value, description=description))
    db.commit()


def ensure_admin(db: Session) -> User:
    admin = db.execute(select(User).where(User.email == settings.ADMIN_EMAIL)).scalar_one_or_none()
    if admin is None:
        admin = User(
            email=settings.ADMIN_EMAIL,
            username=settings.ADMIN_USERNAME,
            full_name=settings.ADMIN_FULL_NAME,
            password_hash=hash_password(settings.ADMIN_PASSWORD),
            is_active=True,
        )
        db.add(admin)
        db.flush()
    role = db.execute(select(Role).where(Role.name == RoleName.ADMIN.value)).scalar_one_or_none()
    if role is not None and not admin.has_role(RoleName.ADMIN):
        admin.roles.append(role)
    db.commit()
    return admin


def seed(db: Session) -> User:
    seed_roles(db)
    return ensure_admin(db)
