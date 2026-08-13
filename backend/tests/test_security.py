"""Seguridad de producción: validación de config, tickets WS y rate limiting."""

from contextlib import contextmanager

import pytest
from starlette.websockets import WebSocketDisconnect

from app.core.config import Settings
from app.core.deps import _client_ip
from app.core.ticket_store import ticket_store


# ---------------------------------------------------------------------------
# Validación de configuración en producción
# ---------------------------------------------------------------------------

def _prod_settings(**overrides):
    base = {
        "APP_ENV": "production",
        "JWT_SECRET_KEY": "a-secret-that-is-at-least-thirty-two-bytes-long-ok",
        "ADMIN_PASSWORD": "UnPassSeguro_2026!",
        "DATABASE_URL": "postgresql+psycopg2://asistencia:pass_segura@localhost:5432/asistencia",
        "CORS_ORIGINS": "https://asistencia.tudominio.com",
    }
    base.update(overrides)
    return Settings(**base)


def test_production_rejects_default_jwt_secret():
    s = _prod_settings(JWT_SECRET_KEY="change-me-in-production-please-use-a-long-random-value")
    with pytest.raises(RuntimeError) as exc:
        s.validate_production()
    assert "JWT_SECRET_KEY conserva el valor predeterminado" in str(exc.value)


def test_production_rejects_short_jwt_secret():
    s = _prod_settings(JWT_SECRET_KEY="solo-16-caracteres!")
    with pytest.raises(RuntimeError) as exc:
        s.validate_production()
    assert "al menos 32 bytes" in str(exc.value)


def test_production_rejects_default_admin_password():
    s = _prod_settings(ADMIN_PASSWORD="Admin123!")
    with pytest.raises(RuntimeError) as exc:
        s.validate_production()
    assert "ADMIN_PASSWORD conserva el valor predeterminado" in str(exc.value)


def test_production_rejects_default_postgres_password():
    s = _prod_settings(DATABASE_URL="postgresql+psycopg2://asistencia:asistencia@localhost:5432/db")
    with pytest.raises(RuntimeError) as exc:
        s.validate_production()
    assert "PostgreSQL conserva el valor predeterminado" in str(exc.value)


def test_production_rejects_wildcard_and_localhost_cors():
    s = _prod_settings(CORS_ORIGINS="*")
    with pytest.raises(RuntimeError) as exc:
        s.validate_production()
    assert "comodines ni localhost" in str(exc.value)
    s2 = _prod_settings(CORS_ORIGINS="https://localhost:4200,https://x.com")
    with pytest.raises(RuntimeError) as exc:
        s2.validate_production()
    assert "comodines ni localhost" in str(exc.value)


def test_production_accepts_secure_config():
    _prod_settings().validate_production()  # no debe lanzar


# ---------------------------------------------------------------------------
# Rate limiting: X-Forwarded-For solo desde proxy confiable
# ---------------------------------------------------------------------------

def _make_request(client_host: str, xff: str | None = None):
    from starlette.requests import Request

    headers = [(b"host", b"testserver")]
    if xff:
        headers.append((b"x-forwarded-for", xff.encode()))
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": headers,
        "client": ("testclient", 12345) if client_host == "testclient" else (client_host, 54321),
    }
    return Request(scope)


def test_client_ip_ignores_xff_when_no_trusted_proxies(monkeypatch):
    monkeypatch.setattr("app.core.deps.settings.TRUSTED_PROXIES", "", raising=False)
    monkeypatch.setattr("app.core.deps._TRUSTED_CIDRS", [])
    request = _make_request("127.0.0.1", xff="203.0.113.9")
    assert _client_ip(request) == "127.0.0.1"


def test_client_ip_accepts_xff_from_trusted_proxy(monkeypatch):
    monkeypatch.setattr("app.core.deps.settings.TRUSTED_PROXIES", "172.16.0.0/12", raising=False)
    monkeypatch.setattr("app.core.deps._TRUSTED_CIDRS", _trusted_nets("172.16.0.0/12"))
    request = _make_request("172.16.0.5", xff="203.0.113.9")
    assert _client_ip(request) == "203.0.113.9"


def test_client_ip_ignores_xff_from_untrusted_proxy(monkeypatch):
    monkeypatch.setattr("app.core.deps.settings.TRUSTED_PROXIES", "10.0.0.0/8", raising=False)
    monkeypatch.setattr("app.core.deps._TRUSTED_CIDRS", _trusted_nets("10.0.0.0/8"))
    request = _make_request("172.16.0.5", xff="203.0.113.9")
    assert _client_ip(request) == "172.16.0.5"


def _trusted_nets(cidr: str):
    import ipaddress

    return [ipaddress.ip_network(cidr, strict=False)]


def test_login_rate_limit_not_bypassed_with_spoofed_xff(client, admin_headers):
    """Rotar X-Forwarded-For no evita el límite: se usa la IP real del cliente."""
    limit = 100  # configurado en conftest
    statuses = []
    for i in range(limit + 2):
        r = client.post("/api/v1/auth/login", json={
            "identifier": "admin@universidad.edu", "password": "Admin123!"},
            headers={"X-Forwarded-For": f"203.0.113.{i % 254}"})
        statuses.append(r.status_code)
        if r.status_code == 429:
            break
    assert statuses[-1] == 429
    assert statuses[-2] == 200


# ---------------------------------------------------------------------------
# Ticket de WebSocket de un solo uso
# ---------------------------------------------------------------------------

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


def _issue_ticket(client, headers, class_id):
    r = client.post("/api/v1/auth/ws-ticket", headers=headers, json={"class_id": class_id})
    assert r.status_code == 200, r.text
    return r.json()["ticket"]


def test_ws_ticket_flow_single_use(client, teacher_headers, seed_data, active_class):
    ticket = _issue_ticket(client, teacher_headers, active_class)
    with _open(client, f"/api/v1/ws/classes/{active_class}?ticket={ticket}") as ws:
        ws.send_text("ping")
        assert ws.receive_json()["event"] == "pong"
    # El ticket ya fue consumido: no puede reutilizarse
    _expect_error(client, f"/api/v1/ws/classes/{active_class}?ticket={ticket}")


def test_ws_ticket_rejected_for_other_class(client, teacher_headers, seed_data, active_class):
    ticket = _issue_ticket(client, teacher_headers, active_class)
    # Usado contra otra clase con el mismo id de clase inexistente
    _expect_error(client, f"/api/v1/ws/classes/00000000-0000-0000-0000-000000000000?ticket={ticket}")


def test_ws_ticket_requires_authorization(client, admin_headers, seed_data, active_class):
    # El alumno inscripto puede pedir ticket para su clase
    login = client.post("/api/v1/auth/login", json={
        "identifier": "alumno@universidad.edu", "password": "Alumno123!"}).json()
    student_headers = {"Authorization": f"Bearer {login['access_token']}"}
    ticket = _issue_ticket(client, student_headers, active_class)
    with _open(client, f"/api/v1/ws/classes/{active_class}?ticket={ticket}") as ws:
        ws.send_text("ping")
        assert ws.receive_json()["event"] == "pong"

    # Un alumno no inscripto no puede obtener ticket de una clase ajena
    r = client.post("/api/v1/students", headers=admin_headers, json={
        "email": "otro@universidad.edu", "username": "otro", "password": "Otro12345!",
        "full_name": "Otro Alumno", "registration_number": "MAT-777",
        "career_id": seed_data["career_id"], "year": 1})
    assert r.status_code == 201
    other = client.post("/api/v1/auth/login", json={
        "identifier": "otro@universidad.edu", "password": "Otro12345!"}).json()
    other_headers = {"Authorization": f"Bearer {other['access_token']}"}
    r = client.post("/api/v1/auth/ws-ticket", headers=other_headers, json={"class_id": active_class})
    assert r.status_code == 403


def test_ticket_store_single_use(client):
    ticket, _ttl = ticket_store.issue("clase-a", "user-x")
    assert ticket_store.consume(ticket, "clase-b") is None
    assert ticket_store.consume(ticket, "clase-a") is None  # ya se consumió


# ---------------------------------------------------------------------------
# Refresh token en cookie HttpOnly
# ---------------------------------------------------------------------------

def test_login_sets_http_only_refresh_cookie(client):
    r = client.post("/api/v1/auth/login", json={
        "identifier": "admin@universidad.edu", "password": "Admin123!"})
    assert r.status_code == 200
    set_cookie = r.headers.get("set-cookie", "")
    assert "refresh_token=" in set_cookie
    assert "HttpOnly" in set_cookie
    assert "httponly" in set_cookie.lower()


def test_refresh_with_cookie_and_rotation(client):
    r = client.post("/api/v1/auth/login", json={
        "identifier": "admin@universidad.edu", "password": "Admin123!"})
    old_refresh = r.json()["refresh_token"]
    assert client.cookies.get("refresh_token") == old_refresh

    # Refresh usando solo la cookie (sin body)
    r2 = client.post("/api/v1/auth/refresh", json={})
    assert r2.status_code == 200, r2.text
    new_refresh = r2.json()["refresh_token"]
    assert new_refresh != old_refresh
    assert client.cookies.get("refresh_token") == new_refresh

    # El refresh anterior quedó revocado (rotación)
    r3 = client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert r3.status_code == 401


def test_logout_revokes_cookie(client):
    r = client.post("/api/v1/auth/login", json={
        "identifier": "admin@universidad.edu", "password": "Admin123!"})
    access = r.json()["access_token"]
    r2 = client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {access}"}, json={})
    assert r2.status_code == 200
    set_cookie = r2.headers.get("set-cookie", "")
    assert "Max-Age=0" in set_cookie
    assert client.cookies.get("refresh_token", None) is None
