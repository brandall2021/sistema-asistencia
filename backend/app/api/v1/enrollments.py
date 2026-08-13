from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select

from app.core.audit import audit
from app.core.deps import CurrentUser, DbDep, require_roles
from app.models.academic import Commission
from app.models.enrollment import Enrollment
from app.models.user import User
from app.models.enums import RoleName
from app.models.student import Student
from app.schemas.common import Message, Page
from app.schemas.enrollment import EnrollmentCreate, EnrollmentOut, EnrollmentUpdate

router = APIRouter(prefix="/enrollments", tags=["Inscripciones"])

AdminDep = Depends(require_roles(RoleName.ADMIN))


@router.get("", response_model=Page)
def list_enrollments(
    db: DbDep,
    _actor: User = AdminDep,
    commission_id: str | None = None,
    student_id: str | None = None,
    page: int = 1,
    page_size: int = 20,
):
    query = select(Enrollment)
    if commission_id:
        query = query.where(Enrollment.commission_id == commission_id)
    if student_id:
        query = query.where(Enrollment.student_id == student_id)
    total = db.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    rows = db.execute(
        query.order_by(Enrollment.enrolled_at.desc()).offset((page - 1) * page_size).limit(page_size)
    ).scalars().all()
    return Page(
        items=[EnrollmentOut.from_enrollment(e) for e in rows],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.post("", response_model=EnrollmentOut, status_code=201)
def create_enrollment(payload: EnrollmentCreate, request: Request, db: DbDep, actor: User = AdminDep):
    if db.get(Student, payload.student_id) is None:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")
    if db.get(Commission, payload.commission_id) is None:
        raise HTTPException(status_code=404, detail="Comisión no encontrada")
    if db.execute(select(Enrollment).where(
        Enrollment.student_id == payload.student_id,
        Enrollment.commission_id == payload.commission_id,
    )).scalar_one_or_none():
        raise HTTPException(status_code=409, detail="El alumno ya está inscripto en esta comisión")
    enrollment = Enrollment(**payload.model_dump())
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    audit(db, action="enrollment_create", entity="enrollment", entity_id=str(enrollment.id),
          user_id=str(actor.id), username=actor.username, request=request,
          details={"student_id": payload.student_id, "commission_id": payload.commission_id})
    return EnrollmentOut.from_enrollment(enrollment)


@router.get("/{enrollment_id}", response_model=EnrollmentOut)
def get_enrollment(enrollment_id: str, db: DbDep, _actor: User = AdminDep):
    enrollment = db.get(Enrollment, enrollment_id)
    if enrollment is None:
        raise HTTPException(status_code=404, detail="Inscripción no encontrada")
    return EnrollmentOut.from_enrollment(enrollment)


@router.patch("/{enrollment_id}", response_model=EnrollmentOut)
def update_enrollment(enrollment_id: str, payload: EnrollmentUpdate, request: Request, db: DbDep, actor: User = AdminDep):
    enrollment = db.get(Enrollment, enrollment_id)
    if enrollment is None:
        raise HTTPException(status_code=404, detail="Inscripción no encontrada")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(enrollment, field, value)
    db.commit()
    db.refresh(enrollment)
    audit(db, action="enrollment_update", entity="enrollment", entity_id=str(enrollment.id),
          user_id=str(actor.id), username=actor.username, request=request)
    return EnrollmentOut.from_enrollment(enrollment)


@router.delete("/{enrollment_id}", response_model=Message)
def delete_enrollment(enrollment_id: str, request: Request, db: DbDep, actor: User = AdminDep):
    enrollment = db.get(Enrollment, enrollment_id)
    if enrollment is None:
        raise HTTPException(status_code=404, detail="Inscripción no encontrada")
    db.delete(enrollment)
    db.commit()
    audit(db, action="enrollment_delete", entity="enrollment", entity_id=enrollment_id,
          user_id=str(actor.id), username=actor.username, request=request)
    return Message(message="Inscripción eliminada")
