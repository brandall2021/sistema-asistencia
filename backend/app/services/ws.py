import asyncio
import json
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    """Maneja conexiones WebSocket por clase. Notifica eventos de asistencia."""

    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, class_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        await self.subscribe(class_id, websocket)

    async def subscribe(self, class_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            self._rooms.setdefault(class_id, set()).add(websocket)

    async def disconnect(self, class_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            room = self._rooms.get(class_id)
            if room:
                room.discard(websocket)
                if not room:
                    self._rooms.pop(class_id, None)

    async def notify(self, class_id: str, event: str, data: dict[str, Any]) -> int:
        """Envía un evento a todos los clientes conectados de la clase."""
        message = json.dumps({"event": event, "data": data}, default=str)
        sent = 0
        async with self._lock:
            room = list(self._rooms.get(class_id, set()))
        dead = []
        for ws in room:
            try:
                await ws.send_text(message)
                sent += 1
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    self._rooms.get(class_id, set()).discard(ws)
        return sent

    async def notify_attendance(self, class_id: str, payload: dict[str, Any]) -> int:
        return await self.notify(class_id, "attendance_recorded", payload)


manager = ConnectionManager()
