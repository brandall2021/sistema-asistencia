from tests.test_attendance import _checkin


def _setup_class_with_attendance(client, admin_headers, student_headers, seed_data):
    r = client.post("/api/v1/classes", headers=admin_headers, json={
        "commission_id": seed_data["commission_id"],
        "classroom_id": seed_data["classroom_id"],
        "date": "2026-08-10"})
    class_id = r.json()["id"]
    client.post(f"/api/v1/classes/{class_id}/start", headers=admin_headers)
    qr = client.post(f"/api/v1/classes/{class_id}/qr", headers=admin_headers).json()
    geo = seed_data["classroom"]
    _checkin(client, student_headers, qr["token"], geo["lat"], geo["lon"], 8.0)
    return class_id


def test_report_by_student(client, admin_headers, student_headers, seed_data):
    _setup_class_with_attendance(client, admin_headers, student_headers, seed_data)
    r = client.get("/api/v1/reports/attendance", headers=admin_headers,
                   params={"dimension": "student"})
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 1
    assert rows[0]["student_name"] == "Lucas Pérez"
    assert rows[0]["present"] == 1
    assert rows[0]["attendance_rate"] == 100.0


def test_report_by_commission(client, admin_headers, student_headers, seed_data):
    _setup_class_with_attendance(client, admin_headers, student_headers, seed_data)
    r = client.get("/api/v1/reports/attendance", headers=admin_headers,
                   params={"dimension": "commission"})
    assert r.status_code == 200
    assert r.json()[0]["label"] == "Comisión A"
    assert r.json()[0]["present"] == 1


def test_low_attendance(client, admin_headers, student_headers, seed_data):
    r = client.get("/api/v1/reports/students/low-attendance", headers=admin_headers,
                   params={"threshold": 90})
    assert r.status_code == 200
    assert r.json() == []  # el único alumno tiene 100% de asistencia


def test_export_csv(client, admin_headers, student_headers, seed_data):
    _setup_class_with_attendance(client, admin_headers, student_headers, seed_data)
    r = client.get("/api/v1/reports/attendance/export", headers=admin_headers,
                   params={"format": "csv", "dimension": "student"})
    assert r.status_code == 200
    assert "text/csv" in r.headers["content-type"]
    assert "student_name" in r.text


def test_export_xlsx(client, admin_headers, student_headers, seed_data):
    _setup_class_with_attendance(client, admin_headers, student_headers, seed_data)
    r = client.get("/api/v1/reports/attendance/export", headers=admin_headers,
                   params={"format": "xlsx", "dimension": "commission"})
    assert r.status_code == 200
    assert "spreadsheetml" in r.headers["content-type"]
    assert r.content[:2] == b"PK"
