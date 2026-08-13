import json

import jwt as pyjwt
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.core.security import decode_token
from app.db.session import SessionLocal
from app.models.class_entity import ClassSession
from app.models.enrollment import Enrollment
from app.models.enums import RoleName
from app.models.student import Student
from app.models.teacher import Teacher
from app.models.user import User
from app.services.ws import manager

router = APIRouter(tags=["WebSocket"])


def _authorize(token: str, class_id: str) -> bool:
    try:
        payload = decode_token(token, expected_type="access")
    except pyjwt.PyJWTError:
        return False
    with SessionLocal() as db:
        user = db.get(User, payload.get("sub"))
        if user is None or not user.is_active:
            return False
        cls = db.get(ClassSession, class_id)
        if cls is None:
            return False
        if user.has_role(RoleName.ADMIN, RoleName.AUDITOR):
            return True
        if user.has_role(RoleName.DOCENTE):
            teacher = db.execute(
                select(Teacher).where(Teacher.user_id == user.id)
            ).scalar_one_or_none()
            commission = cls.commission
            return (
                teacher is not None
                and commission is not None
                and commission.teacher_id == teacher.id
            )
        if user.has_role(RoleName.ALUMNO):
            student = db.execute(
                select(Student).where(Student.user_id == user.id)
            ).scalar_one_or_none()
            if student is None:
                return False
            enrollment = db.execute(
                select(Enrollment).where(
                    Enrollment.student_id == student.id,
                    Enrollment.commission_id == cls.commission_id,
                    Enrollment.status == "ACTIVE",
                )
            ).scalar_one_or_none()
            return enrollment is not None
        return False


@router.websocket("/ws/classes/{class_id}")
async def class_ws(websocket: WebSocket, class_id: str, token: str = Query(default="")):
    await websocket.accept()
    if not token or not _authorize(token, class_id):
        await websocket.send_text(json.dumps({"event": "error", "detail": "NO_AUTORIZADO"}))
        await websocket.close(code=4401)
        return
    await manager.subscribe(class_id, websocket)
    try:
        while True:
            message = await websocket.receive_text()
            if message == "ping":
                await websocket.send_text('{"event":"pong"}')
    except WebSocketDisconnect:
        await manager.disconnect(class_id, websocket)
