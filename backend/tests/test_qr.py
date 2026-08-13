from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.qr_session import QRSession
from app.services.qr import (
    create_qr_session,
    generate_raw_token,
    hash_token,
    is_valid,
    resolve_qr,
)


def test_token_cryptographically_secure():
    tokens = {generate_raw_token() for _ in range(200)}
    assert len(tokens) == 200
    assert all(len(t) >= 60 for t in tokens)


def test_hash_is_sha256():
    token = generate_raw_token()
    assert hash_token(token) == hash_token(token)
    assert len(hash_token(token)) == 64


def test_create_qr_and_resolve(client, admin_headers, seed_data, active_class):
    with SessionLocal() as db:
        from app.models.class_entity import ClassSession
        cls = db.get(ClassSession, active_class)
        session, raw, expires_at = create_qr_session(db, cls)
        assert session.token_hash == hash_token(raw)
        assert expires_at > datetime.now(timezone.utc)

        resolved = resolve_qr(db, raw)
        assert resolved is not None
        assert str(resolved.class_id) == active_class

        valid, reason = is_valid(db, resolved)
        assert valid is True


def test_generate_qr_requires_active_class(client, admin_headers, seed_data):
    # Clase en estado SCHEDULED: el QR debe rechazarse
    r = client.post("/api/v1/classes", headers=admin_headers, json={
        "commission_id": seed_data["commission_id"],
        "classroom_id": seed_data["classroom_id"],
        "date": "2026-08-20"})
    assert r.status_code == 201
    class_id = r.json()["id"]
    r = client.post(f"/api/v1/classes/{class_id}/qr", headers=admin_headers)
    assert r.status_code == 400


def test_generate_qr_active_class(client, admin_headers, active_class):
    r = client.post(f"/api/v1/classes/{active_class}/qr", headers=admin_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["token"]
    assert body["class_id"] == active_class
    assert 30 <= body["ttl_seconds"] <= 60


def test_new_qr_revokes_previous(client, admin_headers, active_class):
    r1 = client.post(f"/api/v1/classes/{active_class}/qr", headers=admin_headers).json()
    r2 = client.post(f"/api/v1/classes/{active_class}/qr", headers=admin_headers).json()
    with SessionLocal() as db:
        old = resolve_qr(db, r1["token"])
        new = resolve_qr(db, r2["token"])
        assert old is not None and old.revoked_at is not None
        valid, _ = is_valid(db, old)
        assert valid is False
        assert new is not None and new.revoked_at is None


def test_expired_qr_rejected(client, admin_headers, active_class, monkeypatch):
    r = client.post(f"/api/v1/classes/{active_class}/qr", headers=admin_headers).json()
    with SessionLocal() as db:
        session = resolve_qr(db, r["token"])
        session.expires_at = datetime.now(timezone.utc) - timedelta(seconds=10)
        db.commit()
        valid, reason = is_valid(db, session)
        assert valid is False
        assert reason == "QR_EXPIRADO"


def test_finish_class_revokes_qr(client, admin_headers, active_class):
    qr = client.post(f"/api/v1/classes/{active_class}/qr", headers=admin_headers).json()
    r = client.post(f"/api/v1/classes/{active_class}/finish", headers=admin_headers)
    assert r.status_code == 200
    with SessionLocal() as db:
        session = resolve_qr(db, qr["token"])
        valid, _ = is_valid(db, session)
        assert valid is False
