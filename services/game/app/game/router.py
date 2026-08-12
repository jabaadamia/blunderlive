from uuid import UUID

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from redis.asyncio import Redis
from pydantic import TypeAdapter, ValidationError

from ..auth.dependencies import get_current_player_ws
from ..auth.models import PlayerIdentity
from ..dependencies import (
    get_connection_manager,
    get_game_session_service,
    get_redis,
)
from ..domain.enums import GameStatus
from ..domain.exceptions import (
    ConcurrentMoveConflictError,
    GameAlreadyFinishedError,
    GameNotFoundError,
    IllegalMoveError,
    InvalidDrawStateError,
    NotPlayersTurnError,
    PlayerNotInGameError,
)
from ..schemas.ws_in import (
    DrawAcceptedMessage,
    DrawDeclineMessage,
    DrawOfferMessage,
    InboundWebSocketMessage,
    MoveMessage,
    PingMessage,
    ResignMessage,
)
from ..schemas.ws_out import (
    DrawDeclinedMessage,
    DrawOfferedMessage,
    ErrorMessage,
    GameOverMessage,
    GameStateMessage,
    MoveAcceptedMessage,
    OutboundWebSocketMessage,
    PongMessage,
)
from .connection_manager import ConnectionManager
from .pubsub import publish_game_event
from .service import GameSessionService


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
    redis: Redis = Depends(get_redis),
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

        await manager.accept(
            websocket=websocket,
        )

        manager.register(
            game_id=game_id,
            websocket=websocket,
        )

        await manager.send_local(
            websocket=websocket,
            message=GameStateMessage(state=snapshot),
        )

        while True:
            try:
                payload = await websocket.receive_json()

                message = ws_inbound_adapter.validate_python(
                    payload,
                )

                if isinstance(message, PingMessage):
                    await manager.send_local(
                        websocket=websocket,
                        message=PongMessage(),
                    )
                    continue

                if isinstance(message, MoveMessage):
                    updated_snapshot = await session_service.apply_move(
                        game_id=game_id,
                        player_id=player.user_id,
                        uci_move=message.uci,
                    )

                    if updated_snapshot.status != GameStatus.ACTIVE:
                        outbound: OutboundWebSocketMessage = (
                            GameOverMessage(
                                state=updated_snapshot,
                            )
                        )
                    else:
                        outbound = MoveAcceptedMessage(
                            state=updated_snapshot,
                        )

                    await publish_game_event(
                        redis=redis,
                        game_id=game_id,
                        message=outbound,
                    )

                if isinstance(message, DrawOfferMessage):
                    updated_snapshot = await session_service.offer_draw(
                        game_id=game_id,
                        player_id=player.user_id,
                    )

                    await publish_game_event(
                        redis=redis,
                        game_id=game_id,
                        message=DrawOfferedMessage(),
                    )

                if isinstance(message, DrawDeclineMessage):
                    updated_snapshot = await session_service.decline_draw(
                        game_id=game_id,
                        player_id=player.user_id,
                    )

                    await publish_game_event(
                        redis=redis,
                        game_id=game_id,
                        message=DrawDeclinedMessage(reason="declined_by_opponent"),
                    )

                if isinstance(message, DrawAcceptedMessage):
                    updated_snapshot = await session_service.accept_draw(
                        game_id=game_id,
                        player_id=player.user_id,
                    )

                    await publish_game_event(
                        redis=redis,
                        game_id=game_id,
                        message=GameOverMessage(
                            state=updated_snapshot,
                        ),
                    )

                if isinstance(message, ResignMessage):
                    updated_snapshot = await session_service.resign_game(
                        game_id=game_id,
                        player_id=player.user_id,
                    )

                    await publish_game_event(
                        redis=redis,
                        game_id=game_id,
                        message=GameOverMessage(
                            state=updated_snapshot,
                        ),
                    )

            except (
                GameAlreadyFinishedError,
                IllegalMoveError,
                NotPlayersTurnError,
                ConcurrentMoveConflictError,
                InvalidDrawStateError,
                PlayerNotInGameError,
            ) as exc:
                await manager.send_local(
                    websocket=websocket,
                    message=ErrorMessage(
                        code=str(exc),
                    ),
                )

            except ValidationError:
                await manager.send_local(
                    websocket=websocket,
                    message=ErrorMessage(
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
