from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, or_, select

from app.core.audit import audit
from app.core.deps import CurrentUser, DbDep, require_roles
from app.core.security import hash_password
from app.models.enums import RoleName
from app.models.student import Student
from app.models.user import Role, User
from app.schemas.common import Message, Page
from app.schemas.student import StudentCreate, StudentOut, StudentUpdate

router = APIRouter(prefix="/students", tags=["Alumnos"])

AdminDep = Depends(require_roles(RoleName.ADMIN))


@router.get("", response_model=Page)
def list_students(db: DbDep, _actor: User = AdminDep, q: str = "", page: int = 1, page_size: int = 20):
    query = select(Student)
    if q:
        like = f"%{q}%"
        query = query.join(Student.user).where(
            or_(User.full_name.ilike(like), Student.registration_number.ilike(like), User.email.ilike(like))
        )
    total = db.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    rows = db.execute(
        query.order_by(Student.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    ).scalars().all()
    return Page(
        items=[StudentOut.from_student(s) for s in rows],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.post("", response_model=StudentOut, status_code=201)
def create_student(payload: StudentCreate, request: Request, db: DbDep, actor: User = AdminDep):
    if db.execute(select(User).where(User.email == payload.email)).scalar_one_or_none():
        raise HTTPException(status_code=409, detail="El email ya está registrado")
    if db.execute(select(Student).where(Student.registration_number == payload.registration_number)).scalar_one_or_none():
        raise HTTPException(status_code=409, detail="El número de matrícula ya existe")
    user = User(
        email=payload.email,
        username=payload.username or payload.email.split("@")[0],
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
    )
    role = db.execute(select(Role).where(Role.name == RoleName.ALUMNO.value)).scalar_one_or_none()
    if role:
        user.roles = [role]
    db.add(user)
    db.flush()
    student = Student(
        id=user.id,
        user_id=user.id,
        registration_number=payload.registration_number,
        dni=payload.dni,
        career_id=payload.career_id,
        year=payload.year,
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    audit(db, action="student_create", entity="student", entity_id=str(student.id),
          user_id=str(actor.id), username=actor.username, request=request,
          details={"registration_number": student.registration_number})
    return StudentOut.from_student(student)


@router.get("/{student_id}", response_model=StudentOut)
def get_student(student_id: str, db: DbDep, _actor: User = AdminDep):
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")
    return StudentOut.from_student(student)


@router.patch("/{student_id}", response_model=StudentOut)
def update_student(student_id: str, payload: StudentUpdate, request: Request, db: DbDep, actor: User = AdminDep):
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")
    data = payload.model_dump(exclude_unset=True)
    full_name = data.pop("full_name", None)
    email = data.pop("email", None)
    is_active = data.pop("is_active", None)
    for field, value in data.items():
        setattr(student, field, value)
    if full_name:
        student.user.full_name = full_name
    if email:
        student.user.email = email
    if is_active is not None:
        student.user.is_active = is_active
    db.commit()
    db.refresh(student)
    audit(db, action="student_update", entity="student", entity_id=str(student.id),
          user_id=str(actor.id), username=actor.username, request=request)
    return StudentOut.from_student(student)


@router.delete("/{student_id}", response_model=Message)
def delete_student(student_id: str, request: Request, db: DbDep, actor: User = AdminDep):
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")
    student.user.is_active = False
    db.commit()
    audit(db, action="student_deactivate", entity="student", entity_id=str(student.id),
          user_id=str(actor.id), username=actor.username, request=request)
    return Message(message="Alumno desactivado")
