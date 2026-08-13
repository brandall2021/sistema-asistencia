"""Autorización por perfiles: User.id != Teacher.id != Student.id.

Los JWT identifican un ``User``; las comisiones y clases se resuelven a través
del perfil ``Teacher``/``Student`` del usuario, nunca comparando el id de usuario
contra ``Commission.teacher_id`` o ``Enrollment.student_id``.
"""

from contextlib import contextmanager

import pytest
from starlette.websockets import WebSocketDisconnect

from app.db.session import SessionLocal
from app.models.student import Student
from app.models.teacher import Teacher
from app.models.user import User


def _login(client, identifier, password):
    r = client.post("/api/v1/auth/login", json={"identifier": identifier, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@contextmanager
def _open(client, url):
    try:
        with client.websocket_connect(url) as ws:
            yield ws
    except WebSocketDisconnect:
        return


def _expect_error(client, url):
    with _open(client, url) as ws:
        data = ws.receive_json()
        assert data["event"] == "error"
        assert data["detail"] == "NO_AUTORIZADO"


@pytest.fixture()
def other_scenario(client, admin_headers, seed_data):
    """Segunda comisión de otro docente con una clase propia."""
    r = client.post("/api/v1/teachers", headers=admin_headers, json={
        "email": "docente2@universidad.edu", "username": "docente2",
        "password": "Docente123!", "full_name": "Prof. Jorge Díaz",
        "employee_number": "LEG-002", "department": "Matemática"})
    assert r.status_code == 201, r.text
    other_teacher_id = r.json()["id"]

    r = client.post("/api/v1/commissions", headers=admin_headers, json={
        "name": "Comisión B", "code": "IS-PROG2-B", "subject_id": seed_data["subject_id"],
        "career_id": seed_data["career_id"], "teacher_id": other_teacher_id,
        "year": 2026, "period": "1"})
    assert r.status_code == 201, r.text
    other_commission_id = r.json()["id"]

    r = client.post("/api/v1/classes", headers=admin_headers, json={
        "commission_id": other_commission_id, "date": "2026-09-20"})
    assert r.status_code == 201, r.text
    other_class_id = r.json()["id"]

    return {
        "other_teacher_id": other_teacher_id,
        "other_commission_id": other_commission_id,
        "other_class_id": other_class_id,
    }


@pytest.fixture()
def teacher2_headers(client, other_scenario):
    token = _login(client, "docente2@universidad.edu", "Docente123!")
    return _auth(token)


def test_profile_ids_are_distinct_from_user_ids(client, seed_data):
    with SessionLocal() as db:
        teacher = db.get(Teacher, seed_data["teacher_id"])
        student = db.get(Student, seed_data["student_id"])
        assert teacher is not None and student is not None
        assert teacher.id != teacher.user_id
        assert student.id != student.user_id
        assert teacher.id != student.id
        assert db.get(User, teacher.user_id).id != teacher.id
        assert db.get(User, student.user_id).id != student.id


def test_teacher_can_list_own_commissions(client, teacher_headers, seed_data, other_scenario):
    r = client.get("/api/v1/commissions", headers=teacher_headers)
    assert r.status_code == 200, r.text
    codes = [c["code"] for c in r.json()]
    assert "IS-PROG2-A" in codes
    assert "IS-PROG2-B" not in codes


def test_teacher_cannot_list_other_commissions(client, teacher_headers, other_scenario):
    r = client.get("/api/v1/commissions", headers=teacher_headers)
    assert r.status_code == 200
    assert "IS-PROG2-B" not in [c["code"] for c in r.json()]
    r = client.get(f"/api/v1/commissions/{other_scenario['other_commission_id']}", headers=teacher_headers)
    assert r.status_code == 403


def test_teacher_can_manage_own_class(client, teacher_headers, seed_data):
    r = client.post("/api/v1/classes", headers=teacher_headers, json={
        "commission_id": seed_data["commission_id"], "date": "2026-10-05"})
    assert r.status_code == 201, r.text
    class_id = r.json()["id"]
    assert client.post(f"/api/v1/classes/{class_id}/start", headers=teacher_headers).status_code == 200
    assert client.post(f"/api/v1/classes/{class_id}/finish", headers=teacher_headers).status_code == 200


def test_teacher_cannot_manage_other_class(client, teacher_headers, other_scenario):
    other_class = other_scenario["other_class_id"]
    r = client.patch(f"/api/v1/classes/{other_class}", headers=teacher_headers,
                     json={"title": "Intento de edición"})
    assert r.status_code == 403
    assert client.post(f"/api/v1/classes/{other_class}/start", headers=teacher_headers).status_code == 403
    assert client.post(f"/api/v1/classes/{other_class}/finish", headers=teacher_headers).status_code == 403
    r = client.post("/api/v1/classes", headers=teacher_headers, json={
        "commission_id": other_scenario["other_commission_id"], "date": "2026-10-06"})
    assert r.status_code == 403


def test_student_can_list_enrolled_classes(client, student_headers, seed_data, active_class):
    r = client.get("/api/v1/classes", headers=student_headers)
    assert r.status_code == 200, r.text
    assert active_class in [c["id"] for c in r.json()]


def test_student_cannot_access_unenrolled_class(client, student_headers, other_scenario):
    r = client.get(f"/api/v1/classes/{other_scenario['other_class_id']}", headers=student_headers)
    assert r.status_code == 403


def test_enrolled_student_can_connect_websocket(client, student_headers, seed_data, active_class):
    token = _login(client, "alumno@universidad.edu", "Alumno123!")
    with _open(client, f"/api/v1/ws/classes/{active_class}?token={token}") as ws:
        ws.send_text("ping")
        assert ws.receive_json()["event"] == "pong"


def test_teacher_can_connect_to_owned_class_websocket(client, teacher_headers, seed_data, active_class):
    token = _login(client, "docente@universidad.edu", "Docente123!")
    with _open(client, f"/api/v1/ws/classes/{active_class}?token={token}") as ws:
        ws.send_text("ping")
        assert ws.receive_json()["event"] == "pong"


def test_teacher_cannot_connect_to_foreign_class_websocket(client, teacher2_headers, seed_data, active_class):
    token = _login(client, "docente2@universidad.edu", "Docente123!")
    _expect_error(client, f"/api/v1/ws/classes/{active_class}?token={token}")


def test_teacher_can_connect_to_own_second_class_websocket(client, teacher2_headers, other_scenario):
    token = _login(client, "docente2@universidad.edu", "Docente123!")
    with _open(client, f"/api/v1/ws/classes/{other_scenario['other_class_id']}?token={token}") as ws:
        ws.send_text("ping")
        assert ws.receive_json()["event"] == "pong"


def test_auditor_cannot_modify_class(client, admin_headers, seed_data, active_class):
    r = client.post("/api/v1/users", headers=admin_headers, json={
        "email": "auditor@universidad.edu", "username": "auditor",
        "password": "Auditor123!", "full_name": "Auditor Uno", "roles": ["AUDITOR"]})
    assert r.status_code == 201, r.text
    token = _login(client, "auditor@universidad.edu", "Auditor123!")
    headers = _auth(token)

    assert client.post("/api/v1/classes", headers=headers, json={
        "commission_id": seed_data["commission_id"], "date": "2026-10-07"}).status_code == 403
    assert client.patch(f"/api/v1/classes/{active_class}", headers=headers,
                        json={"title": "x"}).status_code == 403
    assert client.post(f"/api/v1/classes/{active_class}/start", headers=headers).status_code == 403
    assert client.post(f"/api/v1/classes/{active_class}/finish", headers=headers).status_code == 403
    assert client.get(f"/api/v1/classes/{active_class}/attendance", headers=headers).status_code == 403
    assert client.get(f"/api/v1/classes", headers=headers).status_code == 403
    assert client.get("/api/v1/reports/attendance", headers=headers).status_code == 200
