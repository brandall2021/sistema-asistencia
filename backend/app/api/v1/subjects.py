from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select

from app.core.audit import audit
from app.core.deps import CurrentUser, DbDep, require_roles
from app.models.academic import Subject
from app.models.user import User
from app.models.enums import RoleName
from app.schemas.academic import SubjectCreate, SubjectOut, SubjectUpdate
from app.schemas.common import Message

router = APIRouter(prefix="/subjects", tags=["Materias"])

AdminDep = Depends(require_roles(RoleName.ADMIN))


@router.get("", response_model=list[SubjectOut])
def list_subjects(db: DbDep, _actor: User = AdminDep, career_id: str | None = None):
    query = select(Subject).order_by(Subject.name)
    if career_id:
        query = query.where(Subject.career_id == career_id)
    rows = db.execute(query).scalars().all()
    return [SubjectOut.from_subject(s) for s in rows]


@router.post("", response_model=SubjectOut, status_code=201)
def create_subject(payload: SubjectCreate, request: Request, db: DbDep, actor: User = AdminDep):
    if db.execute(select(Subject).where(Subject.code == payload.code)).scalar_one_or_none():
        raise HTTPException(status_code=409, detail="El código de materia ya existe")
    subject = Subject(**payload.model_dump())
    db.add(subject)
    db.commit()
    db.refresh(subject)
    audit(db, action="subject_create", entity="subject", entity_id=str(subject.id),
          user_id=str(actor.id), username=actor.username, request=request)
    return SubjectOut.from_subject(subject)


@router.get("/{subject_id}", response_model=SubjectOut)
def get_subject(subject_id: str, db: DbDep, _actor: User = AdminDep):
    subject = db.get(Subject, subject_id)
    if subject is None:
        raise HTTPException(status_code=404, detail="Materia no encontrada")
    return SubjectOut.from_subject(subject)


@router.patch("/{subject_id}", response_model=SubjectOut)
def update_subject(subject_id: str, payload: SubjectUpdate, request: Request, db: DbDep, actor: User = AdminDep):
    subject = db.get(Subject, subject_id)
    if subject is None:
        raise HTTPException(status_code=404, detail="Materia no encontrada")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(subject, field, value)
    db.commit()
    db.refresh(subject)
    audit(db, action="subject_update", entity="subject", entity_id=str(subject.id),
          user_id=str(actor.id), username=actor.username, request=request)
    return SubjectOut.from_subject(subject)


@router.delete("/{subject_id}", response_model=Message)
def delete_subject(subject_id: str, request: Request, db: DbDep, actor: User = AdminDep):
    subject = db.get(Subject, subject_id)
    if subject is None:
        raise HTTPException(status_code=404, detail="Materia no encontrada")
    subject.active = False
    db.commit()
    audit(db, action="subject_deactivate", entity="subject", entity_id=str(subject.id),
          user_id=str(actor.id), username=actor.username, request=request)
    return Message(message="Materia desactivada")
