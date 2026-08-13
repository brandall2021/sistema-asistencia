import asyncio
import json
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    """Maneja conexiones WebSocket por clase y por usuario.

    Los canales por clase transmiten eventos de asistencia (``checkin``) a
    docentes y administradores. Los canales personales por usuario entregan
    notificaciones (``class-started``, ``checkin_confirmed``).
    """

    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = {}
        self._user_rooms: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()
        self._loop: asyncio.AbstractEventLoop | None = None

    def _ensure_loop(self) -> None:
        try:
            self._loop = asyncio.get_running_loop()
        except RuntimeError:
            pass

    async def connect(self, class_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        await self.subscribe(class_id, websocket)

    async def subscribe(self, class_id: str, websocket: WebSocket) -> None:
        self._ensure_loop()
        async with self._lock:
            self._rooms.setdefault(class_id, set()).add(websocket)

    async def disconnect(self, class_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            room = self._rooms.get(class_id)
            if room:
                room.discard(websocket)
                if not room:
                    self._rooms.pop(class_id, None)

    async def subscribe_user(self, user_id: str, websocket: WebSocket) -> None:
        self._ensure_loop()
        async with self._lock:
            self._user_rooms.setdefault(user_id, set()).add(websocket)

    async def disconnect_user(self, user_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            room = self._user_rooms.get(user_id)
            if room:
                room.discard(websocket)
                if not room:
                    self._user_rooms.pop(user_id, None)

    def dispatch(self, coro) -> None:
        """Dispara un coroutine de notificación desde un endpoint síncrono.

        El coroutine se encola en el loop que posee los WebSocket; si no hay
        loop registrado (aún sin conexiones) se ignora silenciosamente.
        """
        if self._loop is None or self._loop.is_closed():
            return
        try:
            asyncio.run_coroutine_threadsafe(coro, self._loop)
        except RuntimeError:
            pass

    async def _send(self, message: str, room: set[WebSocket]) -> int:
        sent = 0
        dead = []
        for ws in list(room):
            try:
                await ws.send_text(message)
                sent += 1
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    room.discard(ws)
        return sent

    async def notify(self, class_id: str, event: str, data: dict[str, Any]) -> int:
        """Envía un evento a todos los clientes conectados de la clase."""
        message = json.dumps({"event": event, "data": data}, default=str)
        async with self._lock:
            room = self._rooms.get(class_id, set())
        return await self._send(message, room)

    async def notify_user(self, user_id: str, event: str, data: dict[str, Any]) -> int:
        """Envía un evento al canal personal de un usuario."""
        message = json.dumps({"event": event, "data": data}, default=str)
        async with self._lock:
            room = self._user_rooms.get(user_id, set())
        return await self._send(message, room)

    async def notify_attendance(self, class_id: str, payload: dict[str, Any]) -> int:
        return await self.notify(class_id, "checkin", payload)


manager = ConnectionManager()
