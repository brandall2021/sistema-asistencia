from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, or_, select

from app.core.audit import audit
from app.core.deps import CurrentUser, DbDep, require_roles
from app.core.security import hash_password
from app.models.enums import RoleName
from app.models.user import Role, User
from app.schemas.common import Message, Page
from app.schemas.user import UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["Usuarios"])

AdminDep = require_roles(RoleName.ADMIN)


@router.get("", response_model=Page)
def list_users(
    db: DbDep,
    _actor: User = Depends(AdminDep),
    q: str = "",
    page: int = 1,
    page_size: int = 20,
):
    query = select(User)
    if q:
        like = f"%{q}%"
        query = query.where(or_(User.email.ilike(like), User.username.ilike(like), User.full_name.ilike(like)))
    total = db.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    rows = db.execute(
        query.order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()
    return Page(
        items=[UserOut.from_user(u) for u in rows],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.post("", response_model=UserOut, status_code=201)
def create_user(payload: UserCreate, request: Request, db: DbDep, actor: User = Depends(AdminDep)):
    if db.execute(select(User).where(User.email == payload.email)).scalar_one_or_none():
        raise HTTPException(status_code=409, detail="El email ya está registrado")
    if db.execute(select(User).where(User.username == payload.username)).scalar_one_or_none():
        raise HTTPException(status_code=409, detail="El nombre de usuario ya existe")
    user = User(
        email=payload.email,
        username=payload.username,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
    )
    roles = db.execute(select(Role).where(Role.name.in_([r.value for r in payload.roles]))).scalars().all()
    user.roles = list(roles)
    db.add(user)
    db.commit()
    db.refresh(user)
    audit(db, action="user_create", entity="user", entity_id=str(user.id),
          user_id=str(actor.id), username=actor.username, request=request,
          details={"roles": [r.name for r in user.roles]})
    return UserOut.from_user(user)


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: str, db: DbDep, _actor: User = Depends(AdminDep)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return UserOut.from_user(user)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: str, payload: UserUpdate, request: Request, db: DbDep, actor: User = Depends(AdminDep)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    data = payload.model_dump(exclude_unset=True)
    password = data.pop("password", None)
    if password:
        user.password_hash = hash_password(password)
    roles = data.pop("roles", None)
    if roles is not None:
        role_objs = db.execute(select(Role).where(Role.name.in_([r.value for r in roles]))).scalars().all()
        user.roles = list(role_objs)
    for field, value in data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    audit(db, action="user_update", entity="user", entity_id=str(user.id),
          user_id=str(actor.id), username=actor.username, request=request)
    return UserOut.from_user(user)


@router.delete("/{user_id}", response_model=Message)
def delete_user(user_id: str, request: Request, db: DbDep, actor: User = Depends(AdminDep)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.id == actor.id:
        raise HTTPException(status_code=400, detail="No puede eliminarse a sí mismo")
    user.is_active = False
    db.commit()
    audit(db, action="user_deactivate", entity="user", entity_id=str(user.id),
          user_id=str(actor.id), username=actor.username, request=request)
    return Message(message="Usuario desactivado")
