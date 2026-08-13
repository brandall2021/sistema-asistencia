from fastapi import APIRouter

from app.api.v1 import (
    attendance,
    audit,
    auth,
    careers,
    classes,
    classrooms,
    commissions,
    enrollments,
    reports,
    schedules,
    students,
    subjects,
    teachers,
    users,
    ws,
)

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(students.router)
api_router.include_router(teachers.router)
api_router.include_router(careers.router)
api_router.include_router(subjects.router)
api_router.include_router(commissions.router)
api_router.include_router(enrollments.router)
api_router.include_router(classrooms.router)
api_router.include_router(schedules.router)
api_router.include_router(classes.router)
api_router.include_router(attendance.router)
api_router.include_router(reports.router)
api_router.include_router(audit.router)
api_router.include_router(ws.router)
