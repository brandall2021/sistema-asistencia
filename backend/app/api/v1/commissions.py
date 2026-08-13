from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import or_, select

from app.core.audit import audit
from app.core.deps import CurrentUser, DbDep, require_roles
from app.models.academic import Commission
from app.models.user import User
from app.models.enums import RoleName
from app.schemas.academic import CommissionCreate, CommissionOut, CommissionUpdate
from app.schemas.common import Message

router = APIRouter(prefix="/commissions", tags=["Comisiones"])

AdminDep = Depends(require_roles(RoleName.ADMIN))


def _scope(db: DbDep, actor: CurrentUser):
    """ADMIN ve todas; DOCENTE ve solo las propias (acceso horizontal)."""
    query = select(Commission).order_by(Commission.name)
    if not actor.has_role(RoleName.ADMIN):
        teacher_id = str(actor.id)
        query = query.where(Commission.teacher_id == teacher_id)
    return query


@router.get("", response_model=list[CommissionOut])
def list_commissions(db: DbDep, actor: User = Depends(require_roles(RoleName.ADMIN, RoleName.DOCENTE))):
    rows = db.execute(_scope(db, actor)).scalars().all()
    return [CommissionOut.from_commission(c) for c in rows]


@router.post("", response_model=CommissionOut, status_code=201)
def create_commission(payload: CommissionCreate, request: Request, db: DbDep, actor: User = AdminDep):
    if db.execute(select(Commission).where(Commission.code == payload.code)).scalar_one_or_none():
        raise HTTPException(status_code=409, detail="El código de comisión ya existe")
    commission = Commission(**payload.model_dump())
    db.add(commission)
    db.commit()
    db.refresh(commission)
    audit(db, action="commission_create", entity="commission", entity_id=str(commission.id),
          user_id=str(actor.id), username=actor.username, request=request)
    return CommissionOut.from_commission(commission)


@router.get("/{commission_id}", response_model=CommissionOut)
def get_commission(commission_id: str, db: DbDep, actor: User = Depends(require_roles(RoleName.ADMIN, RoleName.DOCENTE))):
    commission = db.get(Commission, commission_id)
    if commission is None:
        raise HTTPException(status_code=404, detail="Comisión no encontrada")
    if not actor.has_role(RoleName.ADMIN) and commission.teacher_id != actor.id:
        raise HTTPException(status_code=403, detail="No tiene acceso a esta comisión")
    return CommissionOut.from_commission(commission)


@router.patch("/{commission_id}", response_model=CommissionOut)
def update_commission(commission_id: str, payload: CommissionUpdate, request: Request, db: DbDep, actor: User = AdminDep):
    commission = db.get(Commission, commission_id)
    if commission is None:
        raise HTTPException(status_code=404, detail="Comisión no encontrada")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(commission, field, value)
    db.commit()
    db.refresh(commission)
    audit(db, action="commission_update", entity="commission", entity_id=str(commission.id),
          user_id=str(actor.id), username=actor.username, request=request)
    return CommissionOut.from_commission(commission)


@router.delete("/{commission_id}", response_model=Message)
def delete_commission(commission_id: str, request: Request, db: DbDep, actor: User = AdminDep):
    commission = db.get(Commission, commission_id)
    if commission is None:
        raise HTTPException(status_code=404, detail="Comisión no encontrada")
    commission.active = False
    db.commit()
    audit(db, action="commission_deactivate", entity="commission", entity_id=str(commission.id),
          user_id=str(actor.id), username=actor.username, request=request)
    return Message(message="Comisión desactivada")
