from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models.academic import Career, Commission, Subject
from app.models.enrollment import Enrollment
from app.models.enums import RoleName
from app.models.student import Student
from app.models.teacher import Teacher
from app.models.user import Role, User

ROLES = [
    (RoleName.ADMIN, "Administrador del sistema con acceso total."),
    (RoleName.DOCENTE, "Docente: gestiona clases y asistencia de sus comisiones."),
    (RoleName.ALUMNO, "Alumno: registra asistencia mediante QR."),
    (RoleName.AUDITOR, "Auditor: consulta reportes y auditoría (solo lectura)."),
]

# Cuentas de ejemplo (solo se crean si no existen). Contraseña para todas: "Ejemplo123!"
EXAMPLE_ACCOUNTS = [
    {
        "email": "docente@universidad.edu",
        "username": "docente",
        "full_name": "Dra. Elena Rojas",
        "password": "Ejemplo123!",
        "role": RoleName.DOCENTE,
        "teacher": {"employee_number": "EMP-1001", "title": "Dra.", "department": "Ciencias de la Computación"},
    },
    {
        "email": "alumno@universidad.edu",
        "username": "alumno",
        "full_name": "Lucas Fernández",
        "password": "Ejemplo123!",
        "role": RoleName.ALUMNO,
        "student": {"registration_number": "ALU-2026-001", "dni": "40123456", "year": 1},
    },
    {
        "email": "auditor@universidad.edu",
        "username": "auditor",
        "full_name": "Ing. Marta Peralta",
        "password": "Ejemplo123!",
        "role": RoleName.AUDITOR,
    },
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


def _ensure_user(db: Session, account: dict) -> User:
    email = account["email"]
    existing = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if existing is not None:
        return existing
    user = User(
        email=email,
        username=account["username"],
        full_name=account["full_name"],
        password_hash=hash_password(account["password"]),
        is_active=True,
    )
    db.add(user)
    db.flush()
    role = db.execute(
        select(Role).where(Role.name == account["role"].value)
    ).scalar_one_or_none()
    if role is not None:
        user.roles.append(role)
    db.commit()
    return user


def _ensure_teacher(db: Session, user: User, data: dict) -> Teacher | None:
    existing = db.execute(select(Teacher).where(Teacher.user_id == user.id)).scalar_one_or_none()
    if existing is not None:
        return existing
    teacher = Teacher(user_id=user.id, **data)
    db.add(teacher)
    db.commit()
    return teacher


def _ensure_student(db: Session, user: User, data: dict) -> Student | None:
    existing = db.execute(select(Student).where(Student.user_id == user.id)).scalar_one_or_none()
    if existing is not None:
        return existing
    student = Student(user_id=user.id, **data)
    db.add(student)
    db.commit()
    return student


def _ensure_career(db: Session) -> Career:
    existing = db.execute(
        select(Career).where(Career.code == "ING-INF")
    ).scalar_one_or_none()
    if existing is not None:
        return existing
    career = Career(
        name="Ingeniería en Informática",
        code="ING-INF",
        description="Carrera de ejemplo para demostración.",
        active=True,
    )
    db.add(career)
    db.commit()
    return career


def _ensure_subject(db: Session, career: Career) -> Subject:
    existing = db.execute(
        select(Subject).where(Subject.code == "POO-101")
    ).scalar_one_or_none()
    if existing is not None:
        return existing
    subject = Subject(
        name="Programación Orientada a Objetos",
        code="POO-101",
        career_id=career.id,
        semester=1,
        credits=6,
        active=True,
    )
    db.add(subject)
    db.commit()
    return subject


def _ensure_commission(db: Session, subject: Subject, career: Career, teacher: Teacher) -> Commission:
    existing = db.execute(
        select(Commission).where(Commission.code == "POO-101-C1")
    ).scalar_one_or_none()
    if existing is not None:
        return existing
    commission = Commission(
        name="Comisión 1 - Turno Mañana",
        code="POO-101-C1",
        subject_id=subject.id,
        career_id=career.id,
        teacher_id=teacher.id,
        year=2026,
        period="1",
        capacity=60,
        active=True,
    )
    db.add(commission)
    db.commit()
    return commission


def _ensure_enrollment(db: Session, student: Student, commission: Commission) -> None:
    existing = db.execute(
        select(Enrollment).where(
            Enrollment.student_id == student.id,
            Enrollment.commission_id == commission.id,
        )
    ).scalar_one_or_none()
    if existing is not None:
        return
    db.add(
        Enrollment(
            student_id=student.id,
            commission_id=commission.id,
            status="ACTIVE",
        )
    )
    db.commit()


def seed_examples(db: Session) -> None:
    """Crea cuentas de ejemplo (docente, alumno, auditor) con estructura académica básica."""
    teacher_user = student_user = None
    for account in EXAMPLE_ACCOUNTS:
        user = _ensure_user(db, account)
        if account["role"] == RoleName.DOCENTE:
            teacher_user = _ensure_teacher(db, user, account["teacher"])
        elif account["role"] == RoleName.ALUMNO:
            student_user = _ensure_student(db, user, account["student"])

    if teacher_user is None or student_user is None:
        return

    career = _ensure_career(db)
    subject = _ensure_subject(db, career)
    commission = _ensure_commission(db, subject, career, teacher_user)
    _ensure_enrollment(db, student_user, commission)


def seed(db: Session) -> User:
    seed_roles(db)
    admin = ensure_admin(db)
    seed_examples(db)
    return admin
