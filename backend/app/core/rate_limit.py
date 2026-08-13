import time
from collections import defaultdict, deque
from typing import Any

import redis as redis_lib

from app.core.config import settings


class RateLimiter:
    """Sliding-window rate limiter backed by Redis with an in-memory fallback."""

    def __init__(self) -> None:
        self._redis: Any = None
        self._redis_ok: bool = False
        self._mem: dict[str, deque] = defaultdict(deque)
        self._lock = __import__("threading").RLock()
        self._try_connect()

    def _try_connect(self) -> None:
        try:
            client = redis_lib.Redis.from_url(settings.REDIS_URL, socket_timeout=1)
            client.ping()
            self._redis = client
            self._redis_ok = True
        except Exception:
            self._redis = None
            self._redis_ok = False

    def allow(self, key: str, limit: int, period_seconds: int) -> bool:
        now = time.time()
        window_start = now - period_seconds
        if self._redis_ok:
            try:
                pipe = self._redis.pipeline()
                pipe.zremrangebyscore(key, 0, window_start)
                pipe.zadd(key, {f"{now}:{key}": now})
                pipe.zcount(key, window_start, now + 1)
                pipe.expire(key, period_seconds)
                _, _, count, _ = pipe.execute()
                return int(count) <= limit
            except Exception:
                self._redis_ok = False
                self._redis = None
        with self._lock:
            bucket = self._mem[key]
            while bucket and bucket[0] < window_start:
                bucket.popleft()
            if len(bucket) >= limit:
                return False
            bucket.append(now)
            return True

    def reset(self, key: str) -> None:
        if self._redis_ok:
            try:
                self._redis.delete(key)
            except Exception:
                self._redis_ok = False
        with self._lock:
            self._mem.pop(key, None)

    def clear(self) -> None:
        """Borra todos los contadores (útil en tests para aislar cada caso)."""
        if self._redis_ok:
            try:
                for key in self._redis.scan_iter("rl:*"):
                    self._redis.delete(key)
            except Exception:
                self._redis_ok = False
        with self._lock:
            self._mem.clear()


rate_limiter = RateLimiter()
