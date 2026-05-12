from collections import defaultdict
from uuid import UUID

from fastapi import WebSocket

from app.game.websocket import send_message

from ..schemas.ws_out import OutboundWebSocketMessage

class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[UUID, set[WebSocket]] = defaultdict(set)

    async def connect(self, *, game_id: UUID, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[game_id].add(websocket)

    def disconnect(self, *, game_id: UUID, websocket: WebSocket) -> None:
        connections = self._connections.get(game_id)

        if not connections:
            return

        connections.discard(websocket)

        if not connections:
            self._connections.pop(game_id, None)

    async def broadcast(self, *, game_id: UUID, message: OutboundWebSocketMessage) -> None:
        dead_connections: list[WebSocket] = []

        for websocket in self._connections.get(game_id, set()):
            try:
                await send_message(websocket, message)

            except Exception:
                dead_connections.append(websocket)

        for websocket in dead_connections:
            self.disconnect(
                game_id=game_id,
                websocket=websocket,
            )

    def connection_count(self, *, game_id: UUID) -> int:
        return len(self._connections.get(game_id, set()))