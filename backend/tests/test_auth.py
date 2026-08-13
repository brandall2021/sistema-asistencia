import pytest


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_login_ok(client):
    r = client.post("/api/v1/auth/login", json={
        "identifier": "admin@universidad.edu", "password": "Admin123!"})
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["token_type"] == "bearer"
    assert body["user"]["roles"] == ["ADMIN"]
    assert "password" not in body["user"].keys()


def test_login_wrong_password(client):
    r = client.post("/api/v1/auth/login", json={
        "identifier": "admin@universidad.edu", "password": "wrong"})
    assert r.status_code == 401


def test_login_unknown_user(client):
    r = client.post("/api/v1/auth/login", json={
        "identifier": "nadie@universidad.edu", "password": "whatever"})
    assert r.status_code == 401


def test_me_requires_token(client):
    assert client.get("/api/v1/auth/me").status_code == 401


def test_me_invalid_token(client):
    r = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalid"})
    assert r.status_code == 401


def test_refresh_flow(client, admin_headers):
    login = client.post("/api/v1/auth/login", json={
        "identifier": "admin@universidad.edu", "password": "Admin123!"}).json()
    r = client.post("/api/v1/auth/refresh", json={
        "refresh_token": login["refresh_token"]})
    assert r.status_code == 200
    assert r.json()["access_token"]


def test_refresh_token_reuse_rejected(client):
    login = client.post("/api/v1/auth/login", json={
        "identifier": "admin@universidad.edu", "password": "Admin123!"}).json()
    r1 = client.post("/api/v1/auth/refresh", json={"refresh_token": login["refresh_token"]})
    assert r1.status_code == 200
    r2 = client.post("/api/v1/auth/refresh", json={"refresh_token": login["refresh_token"]})
    assert r2.status_code == 401


def test_logout_revokes_refresh(client):
    login = client.post("/api/v1/auth/login", json={
        "identifier": "admin@universidad.edu", "password": "Admin123!"}).json()
    h = {"Authorization": f"Bearer {login['access_token']}"}
    r = client.post("/api/v1/auth/logout", headers=h, json={
        "refresh_token": login["refresh_token"]})
    assert r.status_code == 200
    r2 = client.post("/api/v1/auth/refresh", json={"refresh_token": login["refresh_token"]})
    assert r2.status_code == 401


def test_change_password(client, admin_headers):
    r = client.post("/api/v1/auth/change-password", headers=admin_headers, json={
        "current_password": "Admin123!", "new_password": "NuevaClave123!"})
    assert r.status_code == 200
    login = client.post("/api/v1/auth/login", json={
        "identifier": "admin@universidad.edu", "password": "NuevaClave123!"})
    assert login.status_code == 200
    client.post("/api/v1/auth/change-password", headers=admin_headers, json={
        "current_password": "NuevaClave123!", "new_password": "Admin123!"})


def test_change_password_wrong_current(client, admin_headers):
    r = client.post("/api/v1/auth/change-password", headers=admin_headers, json={
        "current_password": "incorrecta", "new_password": "NuevaClave123!"})
    assert r.status_code == 400


def test_rbac_alumno_denied_admin_endpoint(client, admin_headers, seed_data, student_headers):
    r = client.get("/api/v1/users", headers=student_headers)
    assert r.status_code == 403


def test_password_not_plaintext(client, admin_headers, seed_data):
    from app.db.session import SessionLocal
    from app.models.user import User
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == "alumno@universidad.edu").first()
        assert user.password_hash != "Alumno123!"
        assert user.password_hash.startswith("$argon2")
