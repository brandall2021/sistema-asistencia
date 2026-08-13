def test_create_career_subject_commission(client, admin_headers):
    r = client.post("/api/v1/careers", headers=admin_headers, json={
        "name": "Licenciatura en Matemática", "code": "LM", "active": True})
    assert r.status_code == 201
    career_id = r.json()["id"]
    assert client.get(f"/api/v1/careers/{career_id}", headers=admin_headers).status_code == 200

    r = client.post("/api/v1/subjects", headers=admin_headers, json={
        "name": "Álgebra", "code": "ALG", "career_id": career_id})
    assert r.status_code == 201
    subject_id = r.json()["id"]

    r = client.post("/api/v1/commissions", headers=admin_headers, json={
        "name": "Comisión B", "code": "LM-ALG-B", "subject_id": subject_id,
        "career_id": career_id, "year": 2026, "period": "1"})
    assert r.status_code == 201


def test_create_duplicate_career_code(client, admin_headers):
    payload = {"name": "Ing", "code": "INGX", "active": True}
    assert client.post("/api/v1/careers", headers=admin_headers, json=payload).status_code == 201
    assert client.post("/api/v1/careers", headers=admin_headers, json=payload).status_code == 409


def test_students_crud(client, admin_headers, seed_data):
    r = client.post("/api/v1/students", headers=admin_headers, json={
        "email": "s2@universidad.edu", "username": "s2", "password": "Clave12345!",
        "full_name": "Estudiante Dos", "registration_number": "MAT-002",
        "career_id": seed_data["career_id"], "year": 2})
    assert r.status_code == 201
    sid = r.json()["id"]

    r = client.patch(f"/api/v1/students/{sid}", headers=admin_headers, json={"year": 4})
    assert r.status_code == 200
    assert r.json()["year"] == 4

    r = client.delete(f"/api/v1/students/{sid}", headers=admin_headers)
    assert r.status_code == 200
    login = client.post("/api/v1/auth/login", json={
        "identifier": "s2@universidad.edu", "password": "Clave12345!"})
    assert login.status_code == 403  # usuario desactivado


def test_teacher_cannot_manage_other_commission(client, teacher_headers, admin_headers, seed_data):
    # Crear comisión de otro docente
    r = client.post("/api/v1/teachers", headers=admin_headers, json={
        "email": "d2@universidad.edu", "username": "d2", "password": "Docente123!",
        "full_name": "Otro Docente", "employee_number": "LEG-002"})
    other_teacher_id = r.json()["id"]
    r = client.post("/api/v1/commissions", headers=admin_headers, json={
        "name": "Comisión C", "code": "OTRA-C", "subject_id": seed_data["subject_id"],
        "career_id": seed_data["career_id"], "teacher_id": other_teacher_id,
        "year": 2026, "period": "1"})
    commission2 = r.json()["id"]

    r = client.post("/api/v1/classes", headers=teacher_headers, json={
        "commission_id": commission2, "date": "2026-09-01"})
    assert r.status_code == 403

    r = client.get(f"/api/v1/commissions/{commission2}", headers=teacher_headers)
    assert r.status_code == 403


def test_teacher_manages_own_commission(client, teacher_headers, seed_data):
    r = client.get("/api/v1/commissions", headers=teacher_headers)
    assert r.status_code == 200
    assert len(r.json()) == 1
    r = client.post("/api/v1/classes", headers=teacher_headers, json={
        "commission_id": seed_data["commission_id"],
        "classroom_id": seed_data["classroom_id"],
        "date": "2026-09-05"})
    assert r.status_code == 201


def test_enrollment_duplicate(client, admin_headers, seed_data):
    payload = {"student_id": seed_data["student_id"], "commission_id": seed_data["commission_id"]}
    assert client.post("/api/v1/enrollments", headers=admin_headers, json=payload).status_code == 409


def test_audit_logs_written(client, admin_headers, seed_data):
    r = client.get("/api/v1/audit", headers=admin_headers)
    assert r.status_code == 200
    actions = {item["action"] for item in r.json()["items"]}
    assert "login" in actions
    assert "career_create" in actions


def test_audit_requires_admin_or_auditor(client, student_headers):
    assert client.get("/api/v1/audit", headers=student_headers).status_code == 403


def test_rate_limit_login(client):
    # 100 permitidos por config de test; verificar que responde 200 (no 429 por defecto)
    for _ in range(3):
        r = client.post("/api/v1/auth/login", json={
            "identifier": "admin@universidad.edu", "password": "incorrecta"})
        assert r.status_code == 401
