from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, or_, select

from app.core.audit import audit
from app.core.deps import CurrentUser, DbDep, require_roles
from app.core.security import hash_password
from app.models.enums import RoleName
from app.models.teacher import Teacher
from app.models.user import Role, User
from app.schemas.common import Message, Page
from app.schemas.teacher import TeacherCreate, TeacherOut, TeacherUpdate

router = APIRouter(prefix="/teachers", tags=["Docentes"])

AdminDep = Depends(require_roles(RoleName.ADMIN))


@router.get("", response_model=Page)
def list_teachers(db: DbDep, _actor: User = AdminDep, q: str = "", page: int = 1, page_size: int = 20):
    query = select(Teacher)
    if q:
        like = f"%{q}%"
        query = query.join(Teacher.user).where(
            or_(User.full_name.ilike(like), Teacher.employee_number.ilike(like), User.email.ilike(like))
        )
    total = db.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    rows = db.execute(
        query.order_by(Teacher.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    ).scalars().all()
    return Page(
        items=[TeacherOut.from_teacher(t) for t in rows],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.post("", response_model=TeacherOut, status_code=201)
def create_teacher(payload: TeacherCreate, request: Request, db: DbDep, actor: User = AdminDep):
    if db.execute(select(User).where(User.email == payload.email)).scalar_one_or_none():
        raise HTTPException(status_code=409, detail="El email ya está registrado")
    if db.execute(select(Teacher).where(Teacher.employee_number == payload.employee_number)).scalar_one_or_none():
        raise HTTPException(status_code=409, detail="El legajo ya existe")
    user = User(
        email=payload.email,
        username=payload.username or payload.email.split("@")[0],
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
    )
    role = db.execute(select(Role).where(Role.name == RoleName.DOCENTE.value)).scalar_one_or_none()
    if role:
        user.roles = [role]
    db.add(user)
    db.flush()
    teacher = Teacher(
        id=user.id,
        user_id=user.id,
        employee_number=payload.employee_number,
        title=payload.title,
        department=payload.department,
    )
    db.add(teacher)
    db.commit()
    db.refresh(teacher)
    audit(db, action="teacher_create", entity="teacher", entity_id=str(teacher.id),
          user_id=str(actor.id), username=actor.username, request=request,
          details={"employee_number": teacher.employee_number})
    return TeacherOut.from_teacher(teacher)


@router.get("/{teacher_id}", response_model=TeacherOut)
def get_teacher(teacher_id: str, db: DbDep, _actor: User = AdminDep):
    teacher = db.get(Teacher, teacher_id)
    if teacher is None:
        raise HTTPException(status_code=404, detail="Docente no encontrado")
    return TeacherOut.from_teacher(teacher)


@router.patch("/{teacher_id}", response_model=TeacherOut)
def update_teacher(teacher_id: str, payload: TeacherUpdate, request: Request, db: DbDep, actor: User = AdminDep):
    teacher = db.get(Teacher, teacher_id)
    if teacher is None:
        raise HTTPException(status_code=404, detail="Docente no encontrado")
    data = payload.model_dump(exclude_unset=True)
    full_name = data.pop("full_name", None)
    email = data.pop("email", None)
    is_active = data.pop("is_active", None)
    for field, value in data.items():
        setattr(teacher, field, value)
    if full_name:
        teacher.user.full_name = full_name
    if email:
        teacher.user.email = email
    if is_active is not None:
        teacher.user.is_active = is_active
    db.commit()
    db.refresh(teacher)
    audit(db, action="teacher_update", entity="teacher", entity_id=str(teacher.id),
          user_id=str(actor.id), username=actor.username, request=request)
    return TeacherOut.from_teacher(teacher)


@router.delete("/{teacher_id}", response_model=Message)
def delete_teacher(teacher_id: str, request: Request, db: DbDep, actor: User = AdminDep):
    teacher = db.get(Teacher, teacher_id)
    if teacher is None:
        raise HTTPException(status_code=404, detail="Docente no encontrado")
    teacher.user.is_active = False
    db.commit()
    audit(db, action="teacher_deactivate", entity="teacher", entity_id=str(teacher.id),
          user_id=str(actor.id), username=actor.username, request=request)
    return Message(message="Docente desactivado")
