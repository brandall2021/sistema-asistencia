"""Autorización horizontal reutilizable.

Los JWT identifican a un registro de ``User``; las entidades de negocio
(``Commission.teacher_id``, ``Enrollment.student_id``) referencian perfiles
``Teacher``/``Student`` con identificadores propios. Nunca se compara el id de
usuario contra esos campos.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.academic import Commission
from app.models.class_entity import ClassSession
from app.models.enrollment import Enrollment
from app.models.enums import RoleName
from app.models.student import Student
from app.models.teacher import Teacher
from app.models.user import User


def commission_ids_for_user(db: Session, actor: User) -> list[str]:
    """Comisiones que el usuario puede ver.

    - ADMIN: ``[]`` = todas (quien llama lo interpreta como "sin filtro").
    - DOCENTE: solo las asignadas a su perfil Teacher.
    - ALUMNO: solo las de inscripciones activas de su perfil Student.
    - Otro rol: ninguna.
    """
    if actor.has_role(RoleName.ADMIN):
        return []
    if actor.has_role(RoleName.DOCENTE):
        teacher = db.execute(
            select(Teacher).where(Teacher.user_id == actor.id)
        ).scalar_one_or_none()
        if teacher is None:
            return []
        return [
            str(c.id)
            for c in db.execute(
                select(Commission).where(Commission.teacher_id == teacher.id)
            ).scalars()
        ]
    if actor.has_role(RoleName.ALUMNO):
        student = db.execute(
            select(Student).where(Student.user_id == actor.id)
        ).scalar_one_or_none()
        if student is None:
            return []
        return [
            str(e.commission_id)
            for e in db.execute(
                select(Enrollment).where(
                    Enrollment.student_id == student.id,
                    Enrollment.status == "ACTIVE",
                )
            ).scalars()
        ]
    return []


def can_access_class(db: Session, actor: User, cls: ClassSession) -> bool:
    """ADMIN/AUDITOR acceden a todo; DOCENTE/ALUMNO solo a lo propio."""
    if actor.has_role(RoleName.ADMIN, RoleName.AUDITOR):
        return True
    return str(cls.commission_id) in commission_ids_for_user(db, actor)


def can_manage_class(db: Session, actor: User, cls: ClassSession) -> bool:
    """Solo ADMIN o el docente dueño de la comisión pueden gestionar la clase."""
    if actor.has_role(RoleName.ADMIN):
        return True
    if not actor.has_role(RoleName.DOCENTE):
        return False
    teacher = db.execute(
        select(Teacher).where(Teacher.user_id == actor.id)
    ).scalar_one_or_none()
    if teacher is None:
        return False
    commission = db.get(Commission, cls.commission_id)
    return commission is not None and commission.teacher_id == teacher.id
