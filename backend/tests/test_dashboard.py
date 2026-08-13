"""Dashboard /summary: métricas acotadas por rol."""

import pytest


@pytest.fixture()
def other_commission(client, admin_headers, seed_data):
    """Comisión de otro docente + clase (2026-12-01)."""
    r = client.post("/api/v1/teachers", headers=admin_headers, json={
        "email": "docente3@universidad.edu", "username": "docente3",
        "password": "Docente123!", "full_name": "Prof. Laura",
        "employee_number": "LEG-003"})
    assert r.status_code == 201
    other_teacher = r.json()["id"]
    r = client.post("/api/v1/commissions", headers=admin_headers, json={
        "name": "Comisión C", "code": "IS-PROG2-C", "subject_id": seed_data["subject_id"],
        "career_id": seed_data["career_id"], "teacher_id": other_teacher,
        "year": 2026, "period": "2"})
    assert r.status_code == 201
    commission = r.json()["id"]
    r = client.post("/api/v1/classes", headers=admin_headers, json={
        "commission_id": commission, "date": "2026-12-01"})
    assert r.status_code == 201
    return commission


def test_summary_admin_sees_all_fields(client, admin_headers, seed_data, active_class):
    r = client.get("/api/v1/dashboard/summary", headers=admin_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    for key in ("classes_today", "active_classes", "attendance_rate_today",
                "pending_justifications", "low_attendance_students", "upcoming_classes",
                "next_class", "recent_attendance", "subjects_at_risk", "recent_audit"):
        assert key in body


def test_summary_docente_does_not_see_other_teacher_class(client, teacher_headers, other_commission):
    r = client.get("/api/v1/dashboard/summary", headers=teacher_headers)
    assert r.status_code == 200, r.text
    dates = [u["date"] for u in r.json()["upcoming_classes"]]
    assert "2026-12-01" not in dates


def test_summary_student_sees_own_upcoming(client, student_headers, seed_data, active_class):
    r = client.get("/api/v1/dashboard/summary", headers=student_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "upcoming_classes" in body
    assert "subjects_at_risk" in body
    assert "recent_attendance" in body


def test_summary_requires_auth(client):
    r = client.get("/api/v1/dashboard/summary")
    assert r.status_code == 401
