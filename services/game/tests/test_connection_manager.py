from datetime import UTC, datetime
from uuid import UUID

import pytest

from app.domain.enums import GameStatus, PlayerColor, PlayerColor
from app.domain.models import GameParticipant, GameSnapshot
from app.game.connection_manager import ConnectionManager

from app.schemas.ws_out import GameStateMessage


class FakeWebSocket:
    def __init__(self) -> None:
        self.accepted = False
        self.messages: list[dict] = []

    async def accept(self) -> None:
        self.accepted = True

    async def send_json(self, payload: dict) -> None:
        self.messages.append(payload)


@pytest.mark.asyncio
async def test_connection_manager_connects_broadcasts_and_disconnects() -> None:
    manager = ConnectionManager()
    game_id = UUID("aaaaaaaa-1111-1111-1111-111111111111")
    ws_one = FakeWebSocket()
    ws_two = FakeWebSocket()

    await manager.connect(game_id=game_id, websocket=ws_one) # type: ignore[arg-type]
    await manager.connect(game_id=game_id, websocket=ws_two) # type: ignore[arg-type]

    snapshot = GameSnapshot(
        game_id=game_id,
        status=GameStatus.ACTIVE,
        fen="startpos",
        created_at=datetime.now(UTC),
        white=GameParticipant(
            user_id=UUID("ffffffff-ffff-ffff-ffff-ffffffffffff"),
            color=PlayerColor.WHITE,
        ),
        black=  GameParticipant(
            user_id=UUID("11111111-2222-3333-4444-555555555555"),
            color=PlayerColor.BLACK,
        ),
    )
    
    await manager.broadcast(
        game_id=game_id,
        message=GameStateMessage(
            state=snapshot,
        ),
    )
    
    expected = GameStateMessage(
        state=snapshot,
    ).model_dump(mode="json")

    manager.disconnect(game_id=game_id, websocket=ws_one) # type: ignore[arg-type]
    manager.disconnect(game_id=game_id, websocket=ws_two) # type: ignore[arg-type]

    assert ws_one.accepted is True
    assert ws_two.accepted is True
    assert ws_one.messages == [expected]
    assert ws_two.messages == [expected]
    assert manager.connection_count(game_id=game_id) == 0
