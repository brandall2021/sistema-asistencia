import time
from threading import Lock

import redis as redis_lib

from app.core.config import settings


class TokenStore:
    """Denylist de refresh tokens (jti) con fallback en memoria."""

    def __init__(self) -> None:
        self._redis = None
        self._redis_ok = False
        self._mem: set[str] = set()
        self._lock = Lock()
        try:
            client = redis_lib.Redis.from_url(settings.REDIS_URL, socket_timeout=1)
            client.ping()
            self._redis = client
            self._redis_ok = True
        except Exception:
            pass

    def revoke(self, jti: str, ttl_seconds: int) -> None:
        if self._redis_ok:
            try:
                self._redis.setex(f"rt:{jti}", ttl_seconds, "1")
                return
            except Exception:
                self._redis_ok = False
        with self._lock:
            self._mem.add(jti)

    def is_revoked(self, jti: str) -> bool:
        if self._redis_ok:
            try:
                return bool(self._redis.exists(f"rt:{jti}"))
            except Exception:
                self._redis_ok = False
        with self._lock:
            return jti in self._mem


token_store = TokenStore()
