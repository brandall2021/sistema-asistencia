"""Tickets de un solo uso para conexiones WebSocket.

Un ticket se emite contra un ``User`` y, opcionalmente, una ``class_id``
(canal de clase). Si no se liga a una clase, sirve para el canal personal de
notificaciones. Expira en segundos y se consume (no puede reutilizarse).
"""

import secrets
import time
from threading import Lock

import redis as redis_lib

from app.core.config import settings


class TicketStore:
    def __init__(self) -> None:
        self._redis = None
        self._redis_ok = False
        self._mem: dict[str, tuple[str, str, float]] = {}
        self._lock = Lock()
        try:
            client = redis_lib.Redis.from_url(settings.REDIS_URL, socket_timeout=1)
            client.ping()
            self._redis = client
            self._redis_ok = True
        except Exception:
            pass

    def _issue_key(self, ticket: str) -> str:
        return f"wsticket:{ticket}"

    def issue(self, class_id: str | None, user_id: str) -> tuple[str, int]:
        """Crea un ticket de un solo uso; ``class_id=None`` = canal personal."""
        ttl = settings.WS_TICKET_TTL_SECONDS
        ticket = secrets.token_urlsafe(32)
        value = f"{class_id or ''}|{user_id}"
        if self._redis_ok:
            try:
                self._redis.setex(self._issue_key(ticket), ttl, value)
                return ticket, ttl
            except Exception:
                self._redis_ok = False
        with self._lock:
            self._mem[ticket] = (class_id or '', user_id, time.time() + ttl)
            return ticket, ttl

    def consume(self, ticket: str, class_id: str | None) -> str | None:
        """Consume el ticket y devuelve el ``user_id`` si clase + TTL son válidos.

        ``class_id=None`` solo acepta tickets de canal personal (sin clase).
        El ticket es de un solo uso: se elimina en el primer intento, válido o no.
        """
        if not ticket:
            return None
        if self._redis_ok:
            try:
                raw = self._redis.get(self._issue_key(ticket))
                if raw is None:
                    return None
                self._redis.delete(self._issue_key(ticket))
                value = raw.decode("utf-8")
            except Exception:
                self._redis_ok = False
                return None
        else:
            with self._lock:
                entry = self._mem.pop(ticket, None)
                if entry is None:
                    return None
                if entry[2] < time.time():
                    return None
                value = f"{entry[0]}|{entry[1]}"
        bound_class, bound_user = value.split("|", 1)
        if bound_class != (class_id or ""):
            return None
        return bound_user


ticket_store = TicketStore()
