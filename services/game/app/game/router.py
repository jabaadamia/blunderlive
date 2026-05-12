from uuid import UUID

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from pydantic import TypeAdapter, ValidationError

from app.domain.enums import GameStatus

from ..auth.dependencies import get_current_player_ws
from ..auth.models import PlayerIdentity
from ..dependencies import (
    get_connection_manager,
    get_game_session_service,
)
from ..domain.exceptions import (
    ConcurrentMoveConflictError,
    GameNotFoundError,
    IllegalMoveError,
    NotPlayersTurnError,
)
from ..schemas.ws_in import (
    InboundWebSocketMessage,
    MoveMessage,
    PingMessage,
)
from ..schemas.ws_out import (
    ErrorMessage,
    GameOverMessage,
    GameStateMessage,
    MoveAcceptedMessage,
    OutboundWebSocketMessage,
    PongMessage,
)
from .connection_manager import ConnectionManager
from .service import GameSessionService
from .websocket import send_message


router = APIRouter(
    prefix="/games",
    tags=["games"],
)

ws_inbound_adapter = TypeAdapter(
    InboundWebSocketMessage
)

@router.websocket("/{game_id}/ws")
async def game_websocket(
    websocket: WebSocket,
    game_id: UUID,
    player: PlayerIdentity = Depends(get_current_player_ws),
    manager: ConnectionManager = Depends(get_connection_manager),
    session_service: GameSessionService = Depends(
        get_game_session_service,
    ),
) -> None:
    try:
        try:
            snapshot = await session_service.get_game_snapshot(
                game_id=game_id,
            )
        except GameNotFoundError:
            await websocket.accept()
            await websocket.close(code=1008)
            return

        if player.user_id not in {
            snapshot.white.user_id,
            snapshot.black.user_id,
        }:
            await websocket.accept()
            await websocket.close(code=1008)
            return

        await manager.connect(
            game_id=game_id,
            websocket=websocket,
        )

        await send_message(
            websocket,
            GameStateMessage(
                state=snapshot,
            ),
        )

        while True:
            try:
                payload = await websocket.receive_json()

                message = ws_inbound_adapter.validate_python(
                    payload,
                )

                if isinstance(message, PingMessage):
                    await send_message(
                        websocket,
                        PongMessage(),
                    )
                    continue

                if isinstance(message, MoveMessage):
                    updated_snapshot = await session_service.apply_move(
                        game_id=game_id,
                        player_id=player.user_id,
                        uci_move=message.uci,
                    )

                    if updated_snapshot.status == GameStatus.FINISHED:
                        outbound: OutboundWebSocketMessage = (
                            GameOverMessage(
                                state=updated_snapshot,
                            )
                        )
                    else:
                        outbound = MoveAcceptedMessage(
                            state=updated_snapshot,
                        )

                    await manager.broadcast(
                        game_id=game_id,
                        message=outbound,
                    )

            except (
                IllegalMoveError,
                NotPlayersTurnError,
                ConcurrentMoveConflictError,
            ) as exc:
                await send_message(
                    websocket,
                    ErrorMessage(
                        code=str(exc),
                    ),
                )

            except ValidationError:
                await send_message(
                    websocket,
                    ErrorMessage(
                        code="invalid_message",
                    ),
                )

    except WebSocketDisconnect:
        pass

    finally:
        manager.disconnect(
            game_id=game_id,
            websocket=websocket,
        )