from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select

from app.core.audit import audit
from app.core.deps import CurrentUser, DbDep, require_roles
from app.models.academic import Career
from app.models.user import User
from app.models.enums import RoleName
from app.schemas.academic import CareerCreate, CareerOut, CareerUpdate
from app.schemas.common import Message

router = APIRouter(prefix="/careers", tags=["Carreras"])

AdminDep = Depends(require_roles(RoleName.ADMIN))


@router.get("", response_model=list[CareerOut])
def list_careers(db: DbDep, _actor: User = AdminDep):
    rows = db.execute(select(Career).order_by(Career.name)).scalars().all()
    return rows


@router.post("", response_model=CareerOut, status_code=201)
def create_career(payload: CareerCreate, request: Request, db: DbDep, actor: User = AdminDep):
    if db.execute(select(Career).where(Career.code == payload.code)).scalar_one_or_none():
        raise HTTPException(status_code=409, detail="El código de carrera ya existe")
    career = Career(**payload.model_dump())
    db.add(career)
    db.commit()
    db.refresh(career)
    audit(db, action="career_create", entity="career", entity_id=str(career.id),
          user_id=str(actor.id), username=actor.username, request=request)
    return career


@router.get("/{career_id}", response_model=CareerOut)
def get_career(career_id: str, db: DbDep, _actor: User = AdminDep):
    career = db.get(Career, career_id)
    if career is None:
        raise HTTPException(status_code=404, detail="Carrera no encontrada")
    return career


@router.patch("/{career_id}", response_model=CareerOut)
def update_career(career_id: str, payload: CareerUpdate, request: Request, db: DbDep, actor: User = AdminDep):
    career = db.get(Career, career_id)
    if career is None:
        raise HTTPException(status_code=404, detail="Carrera no encontrada")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(career, field, value)
    db.commit()
    db.refresh(career)
    audit(db, action="career_update", entity="career", entity_id=str(career.id),
          user_id=str(actor.id), username=actor.username, request=request)
    return career


@router.delete("/{career_id}", response_model=Message)
def delete_career(career_id: str, request: Request, db: DbDep, actor: User = AdminDep):
    career = db.get(Career, career_id)
    if career is None:
        raise HTTPException(status_code=404, detail="Carrera no encontrada")
    career.active = False
    db.commit()
    audit(db, action="career_deactivate", entity="career", entity_id=str(career.id),
          user_id=str(actor.id), username=actor.username, request=request)
    return Message(message="Carrera desactivada")
