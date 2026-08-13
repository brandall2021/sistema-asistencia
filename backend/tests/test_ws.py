from contextlib import contextmanager

from starlette.websockets import WebSocketDisconnect


@contextmanager
def _open(client, url):
    """Abre el WebSocket y absorbe el cierre de la conexión al salir (quirk del TestClient)."""
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


def test_ws_valid_token(client, admin_token, seed_data, active_class):
    with _open(client, f"/api/v1/ws/classes/{active_class}?token={admin_token}") as ws:
        ws.send_text("ping")
        assert ws.receive_json()["event"] == "pong"


def test_ws_missing_token_rejected(client, seed_data, active_class):
    _expect_error(client, f"/api/v1/ws/classes/{active_class}")


def test_ws_invalid_token_rejected(client, seed_data, active_class):
    _expect_error(client, f"/api/v1/ws/classes/{active_class}?token=bad-token")


def test_ws_enrolled_student_allowed(client, seed_data, active_class):
    r = client.post("/api/v1/auth/login", json={
        "identifier": "alumno@universidad.edu", "password": "Alumno123!"})
    token = r.json()["access_token"]
    with _open(client, f"/api/v1/ws/classes/{active_class}?token={token}") as ws:
        ws.send_text("ping")
        assert ws.receive_json()["event"] == "pong"


def test_ws_teacher_not_owner_rejected(client, admin_headers, seed_data, active_class):
    r = client.post("/api/v1/teachers", headers=admin_headers, json={
        "email": "d2@universidad.edu", "username": "d2", "password": "Docente123!",
        "full_name": "Otro Docente", "employee_number": "LEG-002"})
    other_teacher_id = r.json()["id"]
    r = client.post("/api/v1/commissions", headers=admin_headers, json={
        "name": "Comisión D", "code": "OTRA-D", "subject_id": seed_data["subject_id"],
        "career_id": seed_data["career_id"], "teacher_id": other_teacher_id,
        "year": 2026, "period": "1"})
    commission2 = r.json()["id"]
    r = client.post("/api/v1/classes", headers=admin_headers, json={
        "commission_id": commission2, "date": "2026-09-10"})
    class2 = r.json()["id"]

    login = client.post("/api/v1/auth/login", json={
        "identifier": "d2@universidad.edu", "password": "Docente123!"})
    token = login.json()["access_token"]
    _expect_error(client, f"/api/v1/ws/classes/{active_class}?token={token}")
    with _open(client, f"/api/v1/ws/classes/{class2}?token={token}") as ws:
        ws.send_text("ping")
        assert ws.receive_json()["event"] == "pong"


# ---------------------------------------------------------------------------
# Canal personal de notificaciones (/ws/notifications)
# ---------------------------------------------------------------------------

def _personal_ticket(client, token: str) -> str:
    r = client.post("/api/v1/auth/ws-ticket",
                    headers={"Authorization": f"Bearer {token}"}, json={})
    assert r.status_code == 200, r.text
    return r.json()["ticket"]


def test_ws_notifications_valid_personal_ticket(client, admin_token):
    ticket = _personal_ticket(client, admin_token)
    with _open(client, f"/api/v1/ws/notifications?ticket={ticket}") as ws:
        ws.send_text("ping")
        assert ws.receive_json()["event"] == "pong"


def test_ws_notifications_requires_auth(client, seed_data):
    _expect_error(client, "/api/v1/ws/notifications")


def test_ws_notifications_rejects_class_ticket(client, admin_token, seed_data, active_class):
    r = client.post("/api/v1/auth/ws-ticket",
                    headers={"Authorization": f"Bearer {admin_token}"},
                    json={"class_id": active_class})
    assert r.status_code == 200
    _expect_error(client, f"/api/v1/ws/notifications?ticket={r.json()['ticket']}")


def test_ws_class_rejects_personal_ticket(client, admin_token, seed_data, active_class):
    ticket = _personal_ticket(client, admin_token)
    _expect_error(client, f"/api/v1/ws/classes/{active_class}?ticket={ticket}")


def test_class_start_notifies_enrolled_student(client, admin_headers, seed_data):
    r = client.post("/api/v1/classes", headers=admin_headers, json={
        "commission_id": seed_data["commission_id"], "date": "2026-09-01"})
    assert r.status_code == 201
    class_id = r.json()["id"]

    login = client.post("/api/v1/auth/login", json={
        "identifier": "alumno@universidad.edu", "password": "Alumno123!"})
    token = login.json()["access_token"]
    ticket = _personal_ticket(client, token)

    with _open(client, f"/api/v1/ws/notifications?ticket={ticket}") as ws:
        ws.send_text("ping")
        assert ws.receive_json()["event"] == "pong"
        r = client.post(f"/api/v1/classes/{class_id}/start", headers=admin_headers)
        assert r.status_code == 200, r.text
        ev = ws.receive_json()
        assert ev["event"] == "class-started"
        assert ev["data"]["class_id"] == class_id

