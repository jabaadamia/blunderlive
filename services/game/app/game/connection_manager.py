from collections import defaultdict
import asyncio
from inspect import signature
from uuid import UUID

from fastapi import WebSocket

from app.game.websocket import send_message

from ..schemas.ws_out import OutboundWebSocketMessage

WS_APP_SUBPROTOCOL = "blunderlive-game"

class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[UUID, set[WebSocket]] = defaultdict(set)
        self._send_locks: dict[WebSocket, asyncio.Lock] = {}

    async def accept(self, *, websocket: WebSocket) -> None:
        scope = getattr(websocket, "scope", {}) or {}
        requested_subprotocols = set(scope.get("subprotocols", []))
        accepted_subprotocol = (
            WS_APP_SUBPROTOCOL if WS_APP_SUBPROTOCOL in requested_subprotocols else None
        )
        accept = websocket.accept

        if "subprotocol" in signature(accept).parameters:
            await accept(subprotocol=accepted_subprotocol)
        else:
            await accept()

    def register(self, *, game_id: UUID, websocket: WebSocket) -> None:
        self._connections[game_id].add(websocket)
        self._send_locks.setdefault(websocket, asyncio.Lock())

    def disconnect(self, *, game_id: UUID, websocket: WebSocket) -> None:
        connections = self._connections.get(game_id)

        if not connections:
            return

        connections.discard(websocket)
        self._send_locks.pop(websocket, None)

        if not connections:
            self._connections.pop(game_id, None)

    async def send_local(
        self,
        *,
        websocket: WebSocket,
        message: OutboundWebSocketMessage,
    ) -> None:
        lock = self._send_locks.setdefault(websocket, asyncio.Lock())
        async with lock:
            await send_message(websocket, message)

    async def broadcast_local(
        self,
        *,
        game_id: UUID,
        message: OutboundWebSocketMessage,
    ) -> None:
        dead_connections: list[WebSocket] = []

        for websocket in self._connections.get(game_id, set()):
            try:
                await self.send_local(websocket=websocket, message=message)

            except Exception:
                dead_connections.append(websocket)

        for websocket in dead_connections:
            self.disconnect(
                game_id=game_id,
                websocket=websocket,
            )

    def connection_count(self, *, game_id: UUID) -> int:
        return len(self._connections.get(game_id, set()))
