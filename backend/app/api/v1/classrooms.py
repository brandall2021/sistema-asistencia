from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import or_, select

from app.core.audit import audit
from app.core.deps import CurrentUser, DbDep, require_roles
from app.models.classroom import Classroom
from app.models.user import User
from app.models.enums import RoleName
from app.schemas.classroom import ClassroomCreate, ClassroomOut, ClassroomUpdate
from app.schemas.common import Message

router = APIRouter(prefix="/classrooms", tags=["Aulas"])

AdminDep = Depends(require_roles(RoleName.ADMIN))
StaffDep = Depends(require_roles(RoleName.ADMIN, RoleName.DOCENTE))


@router.get("", response_model=list[ClassroomOut])
def list_classrooms(db: DbDep, _actor: User = StaffDep):
    rows = db.execute(select(Classroom).order_by(Classroom.name)).scalars().all()
    return [ClassroomOut.from_classroom(c) for c in rows]


@router.post("", response_model=ClassroomOut, status_code=201)
def create_classroom(payload: ClassroomCreate, request: Request, db: DbDep, actor: User = AdminDep):
    if db.execute(select(Classroom).where(Classroom.code == payload.code)).scalar_one_or_none():
        raise HTTPException(status_code=409, detail="El código de aula ya existe")
    classroom = Classroom(**payload.model_dump())
    db.add(classroom)
    db.commit()
    db.refresh(classroom)
    audit(db, action="classroom_create", entity="classroom", entity_id=str(classroom.id),
          user_id=str(actor.id), username=actor.username, request=request)
    return ClassroomOut.from_classroom(classroom)


@router.get("/{classroom_id}", response_model=ClassroomOut)
def get_classroom(classroom_id: str, db: DbDep, _actor: User = StaffDep):
    classroom = db.get(Classroom, classroom_id)
    if classroom is None:
        raise HTTPException(status_code=404, detail="Aula no encontrada")
    return ClassroomOut.from_classroom(classroom)


@router.patch("/{classroom_id}", response_model=ClassroomOut)
def update_classroom(classroom_id: str, payload: ClassroomUpdate, request: Request, db: DbDep, actor: User = AdminDep):
    classroom = db.get(Classroom, classroom_id)
    if classroom is None:
        raise HTTPException(status_code=404, detail="Aula no encontrada")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(classroom, field, value)
    db.commit()
    db.refresh(classroom)
    audit(db, action="classroom_update", entity="classroom", entity_id=str(classroom.id),
          user_id=str(actor.id), username=actor.username, request=request)
    return ClassroomOut.from_classroom(classroom)


@router.delete("/{classroom_id}", response_model=Message)
def delete_classroom(classroom_id: str, request: Request, db: DbDep, actor: User = AdminDep):
    classroom = db.get(Classroom, classroom_id)
    if classroom is None:
        raise HTTPException(status_code=404, detail="Aula no encontrada")
    classroom.active = False
    db.commit()
    audit(db, action="classroom_deactivate", entity="classroom", entity_id=str(classroom.id),
          user_id=str(actor.id), username=actor.username, request=request)
    return Message(message="Aula desactivada")
