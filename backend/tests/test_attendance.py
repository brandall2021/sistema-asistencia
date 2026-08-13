def _checkin(client, headers, token, lat, lon, accuracy):
    return client.post("/api/v1/attendance/check-in", headers=headers, json={
        "token": token, "latitude": lat, "longitude": lon, "accuracy": accuracy})


def test_check_in_success(client, admin_headers, student_headers, seed_data, active_class, active_qr):
    geo = seed_data["classroom"]
    r = _checkin(client, student_headers, active_qr["token"], geo["lat"], geo["lon"], 8.0)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["success"] is True
    assert body["status"] in ("PRESENT", "LATE")
    assert body["attendance"]["student_id"] == seed_data["student_id"]
    assert body["attendance"]["method"] == "QR"


def test_check_in_duplicate_rejected(client, admin_headers, student_headers, seed_data, active_class, active_qr):
    geo = seed_data["classroom"]
    r1 = _checkin(client, student_headers, active_qr["token"], geo["lat"], geo["lon"], 8.0)
    assert r1.status_code == 200
    r2 = _checkin(client, student_headers, active_qr["token"], geo["lat"], geo["lon"], 8.0)
    assert r2.status_code == 400
    assert r2.json()["detail"] == "ASISTENCIA_YA_REGISTRADA"


def test_check_in_invalid_token(client, student_headers):
    r = _checkin(client, student_headers, "token-invalido-xyz", -26.8, -65.2, 8.0)
    assert r.status_code == 400
    assert r.json()["detail"] == "QR_INVALIDO"


def test_check_in_outside_classroom(client, student_headers, seed_data, active_class, active_qr):
    r = _checkin(client, student_headers, active_qr["token"],
                 seed_data["classroom"]["lat"] + 0.05, seed_data["classroom"]["lon"], 8.0)
    assert r.status_code == 400
    assert r.json()["detail"] == "FUERA_DEL_AULA"


def test_check_in_imprecise_gps(client, student_headers, seed_data, active_class, active_qr):
    r = _checkin(client, student_headers, active_qr["token"],
                 seed_data["classroom"]["lat"], seed_data["classroom"]["lon"], 300.0)
    assert r.status_code == 400
    assert r.json()["detail"] == "GPS_IMPRECISO"


def test_check_in_class_not_active(client, admin_headers, student_headers, seed_data):
    from datetime import datetime, timezone

    from app.db.session import SessionLocal
    from app.models.class_entity import ClassSession

    r = client.post("/api/v1/classes", headers=admin_headers, json={
        "commission_id": seed_data["commission_id"],
        "classroom_id": seed_data["classroom_id"],
        "date": "2026-08-14"})
    class_id = r.json()["id"]
    r = client.post(f"/api/v1/classes/{class_id}/start", headers=admin_headers)
    assert r.status_code == 200
    qr = client.post(f"/api/v1/classes/{class_id}/qr", headers=admin_headers).json()
    # Finalizar la clase directamente en la BD (sin revocar el QR)
    with SessionLocal() as db:
        cls = db.get(ClassSession, class_id)
        cls.status = "FINISHED"
        cls.ends_at = datetime.now(timezone.utc)
        db.commit()
    geo = seed_data["classroom"]
    r = _checkin(client, student_headers, qr["token"], geo["lat"], geo["lon"], 8.0)
    assert r.status_code == 400
    assert r.json()["detail"] == "CLASE_NO_ACTIVA"


def test_check_in_not_enrolled(client, admin_headers, seed_data):
    # Crear alumno no inscripto
    r = client.post("/api/v1/students", headers=admin_headers, json={
        "email": "otro@universidad.edu", "username": "otro", "password": "Otro12345!",
        "full_name": "Otro Alumno", "registration_number": "MAT-999",
        "career_id": seed_data["career_id"], "year": 1})
    assert r.status_code == 201
    login = client.post("/api/v1/auth/login", json={
        "identifier": "otro@universidad.edu", "password": "Otro12345!"}).json()
    headers = {"Authorization": f"Bearer {login['access_token']}"}

    # crear clase activa
    r = client.post("/api/v1/classes", headers=admin_headers, json={
        "commission_id": seed_data["commission_id"],
        "classroom_id": seed_data["classroom_id"],
        "date": "2026-08-15"})
    class_id = r.json()["id"]
    client.post(f"/api/v1/classes/{class_id}/start", headers=admin_headers)
    qr = client.post(f"/api/v1/classes/{class_id}/qr", headers=admin_headers).json()
    geo = seed_data["classroom"]
    r = _checkin(client, headers, qr["token"], geo["lat"], geo["lon"], 8.0)
    assert r.status_code == 400
    assert r.json()["detail"] == "ALUMNO_NO_INSCRIPTO"


def test_check_in_teacher_forbidden(client, teacher_headers, seed_data, active_class, active_qr):
    geo = seed_data["classroom"]
    r = _checkin(client, teacher_headers, active_qr["token"], geo["lat"], geo["lon"], 8.0)
    assert r.status_code == 403


def test_my_attendance(client, student_headers, seed_data, active_class, active_qr):
    geo = seed_data["classroom"]
    _checkin(client, student_headers, active_qr["token"], geo["lat"], geo["lon"], 8.0)
    r = client.get("/api/v1/attendance/me", headers=student_headers)
    assert r.status_code == 200
    assert r.json()["total"] == 1


def test_class_attendance_list(client, admin_headers, student_headers, seed_data, active_class, active_qr):
    geo = seed_data["classroom"]
    _checkin(client, student_headers, active_qr["token"], geo["lat"], geo["lon"], 8.0)
    r = client.get(f"/api/v1/classes/{active_class}/attendance", headers=admin_headers)
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["status"] == "PRESENT"


def test_status_change_by_teacher(client, teacher_headers, student_headers, seed_data, active_class, active_qr):
    geo = seed_data["classroom"]
    r = _checkin(client, student_headers, active_qr["token"], geo["lat"], geo["lon"], 8.0)
    attendance_id = r.json()["attendance"]["id"]
    r = client.patch(f"/api/v1/attendance/{attendance_id}/status", headers=teacher_headers,
                     json={"status": "JUSTIFIED", "review_reason": "Justificado por docente"})
    assert r.status_code == 200
    assert r.json()["status"] == "JUSTIFIED"


def test_justification_flow(client, student_headers, admin_headers, seed_data, active_class, active_qr):
    geo = seed_data["classroom"]
    r = _checkin(client, student_headers, active_qr["token"], geo["lat"], geo["lon"], 8.0)
    attendance_id = r.json()["attendance"]["id"]
    r = client.post("/api/v1/attendance/justify", headers=student_headers, json={
        "attendance_id": attendance_id, "reason": "Problema médico"})
    assert r.status_code == 200
    j = client.get("/api/v1/attendance/justifications", headers=admin_headers)
    assert j.status_code == 200
    assert j.json()["total"] == 1
    justification_id = j.json()["items"][0]["id"]
    r = client.post(f"/api/v1/attendance/justifications/{justification_id}/review",
                    headers=admin_headers, json={"status": "APPROVED", "review_notes": "ok"})
    assert r.status_code == 200
    r = client.get(f"/api/v1/classes/{active_class}/attendance", headers=admin_headers)
    assert r.json()[0]["status"] == "JUSTIFIED"
