from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select

from app.core.audit import audit
from app.core.deps import CurrentUser, DbDep, require_roles
from app.models.user import User
from app.models.enums import RoleName
from app.models.schedule import Schedule
from app.schemas.common import Message
from app.schemas.schedule import ScheduleCreate, ScheduleOut, ScheduleUpdate

router = APIRouter(prefix="/schedules", tags=["Horarios"])

AdminDep = Depends(require_roles(RoleName.ADMIN))
StaffDep = Depends(require_roles(RoleName.ADMIN, RoleName.DOCENTE))


@router.get("", response_model=list[ScheduleOut])
def list_schedules(db: DbDep, _actor: User = StaffDep, commission_id: str | None = None):
    query = select(Schedule).order_by(Schedule.day_of_week, Schedule.start_time)
    if commission_id:
        query = query.where(Schedule.commission_id == commission_id)
    rows = db.execute(query).scalars().all()
    return [ScheduleOut.from_schedule(s) for s in rows]


@router.post("", response_model=ScheduleOut, status_code=201)
def create_schedule(payload: ScheduleCreate, request: Request, db: DbDep, actor: User = AdminDep):
    schedule = Schedule(**payload.model_dump())
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    audit(db, action="schedule_create", entity="schedule", entity_id=str(schedule.id),
          user_id=str(actor.id), username=actor.username, request=request)
    return ScheduleOut.from_schedule(schedule)


@router.get("/{schedule_id}", response_model=ScheduleOut)
def get_schedule(schedule_id: str, db: DbDep, _actor: User = StaffDep):
    schedule = db.get(Schedule, schedule_id)
    if schedule is None:
        raise HTTPException(status_code=404, detail="Horario no encontrado")
    return ScheduleOut.from_schedule(schedule)


@router.patch("/{schedule_id}", response_model=ScheduleOut)
def update_schedule(schedule_id: str, payload: ScheduleUpdate, request: Request, db: DbDep, actor: User = AdminDep):
    schedule = db.get(Schedule, schedule_id)
    if schedule is None:
        raise HTTPException(status_code=404, detail="Horario no encontrado")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(schedule, field, value)
    db.commit()
    db.refresh(schedule)
    audit(db, action="schedule_update", entity="schedule", entity_id=str(schedule.id),
          user_id=str(actor.id), username=actor.username, request=request)
    return ScheduleOut.from_schedule(schedule)


@router.delete("/{schedule_id}", response_model=Message)
def delete_schedule(schedule_id: str, request: Request, db: DbDep, actor: User = AdminDep):
    schedule = db.get(Schedule, schedule_id)
    if schedule is None:
        raise HTTPException(status_code=404, detail="Horario no encontrado")
    db.delete(schedule)
    db.commit()
    audit(db, action="schedule_delete", entity="schedule", entity_id=schedule_id,
          user_id=str(actor.id), username=actor.username, request=request)
    return Message(message="Horario eliminado")
