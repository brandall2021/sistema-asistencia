import os
import tempfile

import pytest

_TMP = tempfile.mkdtemp(prefix="sau_test_")
_DB = os.path.join(_TMP, "test.db")

os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = f"sqlite:///{_DB}"
os.environ["JWT_SECRET_KEY"] = "test-secret-key"
os.environ["QR_TOKEN_TTL_SECONDS"] = "45"
os.environ["GPS_MAX_ACCURACY"] = "25"
os.environ["RATE_LIMIT_LOGIN"] = "100"
os.environ["RATE_LIMIT_CHECKIN"] = "100"

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import *  # noqa: E402,F401,F403


@pytest.fixture(scope="session", autouse=True)
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def _clean_db():
    """Limpia la base de datos después de cada test y re-siembra el admin."""
    yield
    from app.core.rate_limit import rate_limiter
    from app.db.base import Base
    from app.db.seed import seed
    from app.db.session import SessionLocal
    rate_limiter.clear()
    with SessionLocal() as db:
        for table in reversed(Base.metadata.sorted_tables):
            db.execute(table.delete())
        db.commit()
        seed(db)


@pytest.fixture()
def admin_token(client):
    r = client.post("/api/v1/auth/login", json={
        "identifier": "admin@universidad.edu",
        "password": "Admin123!",
    })
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def admin_headers(admin_token):
    return auth(admin_token)


def _create(db, model, **kwargs):
    obj = model(**kwargs)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@pytest.fixture()
def seed_data(client, admin_headers):
    """Crea carrera, materia, comisión, docente, alumno, aula, horario e inscripción."""
    r = client.post("/api/v1/careers", headers=admin_headers, json={
        "name": "Ingeniería en Sistemas", "code": "IS", "active": True})
    assert r.status_code == 201, r.text
    career_id = r.json()["id"]

    r = client.post("/api/v1/subjects", headers=admin_headers, json={
        "name": "Programación Avanzada", "code": "PROG2", "career_id": career_id,
        "semester": 3, "credits": 8, "active": True})
    assert r.status_code == 201, r.text
    subject_id = r.json()["id"]

    r = client.post("/api/v1/teachers", headers=admin_headers, json={
        "email": "docente@universidad.edu", "username": "docente",
        "password": "Docente123!", "full_name": "Prof. Ana Torres",
        "employee_number": "LEG-001", "department": "Informática"})
    assert r.status_code == 201, r.text
    teacher_id = r.json()["id"]

    r = client.post("/api/v1/students", headers=admin_headers, json={
        "email": "alumno@universidad.edu", "username": "alumno",
        "password": "Alumno123!", "full_name": "Lucas Pérez",
        "registration_number": "MAT-001", "career_id": career_id, "year": 3})
    assert r.status_code == 201, r.text
    student_id = r.json()["id"]

    r = client.post("/api/v1/commissions", headers=admin_headers, json={
        "name": "Comisión A", "code": "IS-PROG2-A", "subject_id": subject_id,
        "career_id": career_id, "teacher_id": teacher_id, "year": 2026,
        "period": "1", "capacity": 30, "active": True})
    assert r.status_code == 201, r.text
    commission_id = r.json()["id"]

    r = client.post("/api/v1/classrooms", headers=admin_headers, json={
        "name": "Aula 101", "code": "A101", "building": "Pabellón 1", "floor": "1",
        "latitude": -26.808285, "longitude": -65.217590, "radius_meters": 100, "active": True})
    assert r.status_code == 201, r.text
    classroom_id = r.json()["id"]

    r = client.post("/api/v1/enrollments", headers=admin_headers, json={
        "student_id": student_id, "commission_id": commission_id})
    assert r.status_code == 201, r.text

    r = client.post("/api/v1/schedules", headers=admin_headers, json={
        "commission_id": commission_id, "classroom_id": classroom_id,
        "day_of_week": 1, "start_time": "08:00:00", "end_time": "10:00:00"})
    assert r.status_code == 201, r.text
    schedule_id = r.json()["id"]

    return {
        "career_id": career_id,
        "subject_id": subject_id,
        "teacher_id": teacher_id,
        "student_id": student_id,
        "commission_id": commission_id,
        "classroom_id": classroom_id,
        "schedule_id": schedule_id,
        "classroom": {"lat": -26.808285, "lon": -65.217590, "radius": 100},
    }


@pytest.fixture()
def student_headers(seed_data):
    r = TestClient(app).post("/api/v1/auth/login", json={
        "identifier": "alumno@universidad.edu", "password": "Alumno123!"})
    assert r.status_code == 200
    return auth(r.json()["access_token"])


@pytest.fixture()
def teacher_headers(seed_data):
    r = TestClient(app).post("/api/v1/auth/login", json={
        "identifier": "docente@universidad.edu", "password": "Docente123!"})
    assert r.status_code == 200
    return auth(r.json()["access_token"])


@pytest.fixture()
def active_class(client, admin_headers, seed_data):
    """Crea una clase y la inicia, devolviendo class_id."""
    r = client.post("/api/v1/classes", headers=admin_headers, json={
        "commission_id": seed_data["commission_id"],
        "classroom_id": seed_data["classroom_id"],
        "schedule_id": seed_data["schedule_id"],
        "date": "2026-08-13",
        "late_grace_minutes": 10,
    })
    assert r.status_code == 201, r.text
    class_id = r.json()["id"]
    r = client.post(f"/api/v1/classes/{class_id}/start", headers=admin_headers)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "ACTIVE"
    return class_id


@pytest.fixture()
def active_qr(client, admin_headers, active_class):
    r = client.post(f"/api/v1/classes/{active_class}/qr", headers=admin_headers)
    assert r.status_code == 200, r.text
    return r.json()
