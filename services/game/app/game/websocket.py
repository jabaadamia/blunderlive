from fastapi import WebSocket

from ..schemas.ws_out import OutboundWebSocketMessage


async def send_message(
    websocket: WebSocket,
    message: OutboundWebSocketMessage,
) -> None:
    await websocket.send_json(message.model_dump(mode="json"))