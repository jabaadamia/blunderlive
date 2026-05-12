import os
from uuid import UUID

import pytest
from redis.asyncio import Redis

from app.chess.service import ChessGameService
from app.domain.enums import GameStatus
from app.domain.exceptions import PlayerNotInGameError
from app.game.service import GameSessionService
from app.matchmaking.repository import MatchmakingRepository


@pytest.mark.asyncio
async def test_game_service_applies_move_and_persists_snapshot() -> None:
    redis = Redis.from_url(
        os.environ["REDIS_URL"],
        encoding="utf-8",
        decode_responses=True,
    )
    await redis.flushdb()

    repository = MatchmakingRepository(redis)
    chess_service = ChessGameService()
    session_service = GameSessionService(repository, chess_service)

    white_id = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    black_id = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
    snapshot = chess_service.create_game(
        white_player_id=white_id,
        black_player_id=black_id,
    )

    await repository.create_game_snapshot(snapshot=snapshot)

    updated = await session_service.apply_move(
        game_id=snapshot.game_id,
        player_id=white_id,
        uci_move="e2e4",
    )
    persisted = await repository.fetch_game_snapshot(game_id=snapshot.game_id)
    await redis.aclose()

    assert updated.moves == ["e2e4"]
    assert updated.move_count == 1
    assert persisted.fen == updated.fen
    assert persisted.moves == ["e2e4"]


@pytest.mark.asyncio
async def test_game_service_rejects_player_not_in_game() -> None:
    redis = Redis.from_url(
        os.environ["REDIS_URL"],
        encoding="utf-8",
        decode_responses=True,
    )
    await redis.flushdb()

    repository = MatchmakingRepository(redis)
    chess_service = ChessGameService()
    session_service = GameSessionService(repository, chess_service)

    white_id = UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")
    black_id = UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")
    outsider_id = UUID("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee")
    snapshot = chess_service.create_game(
        white_player_id=white_id,
        black_player_id=black_id,
    )

    await repository.create_game_snapshot(snapshot=snapshot)

    with pytest.raises(PlayerNotInGameError):
        await session_service.apply_move(
            game_id=snapshot.game_id,
            player_id=outsider_id,
            uci_move="e2e4",
        )

    await redis.aclose()


@pytest.mark.asyncio
async def test_game_service_clears_active_game_when_game_finishes() -> None:
    redis = Redis.from_url(
        os.environ["REDIS_URL"],
        encoding="utf-8",
        decode_responses=True,
    )
    await redis.flushdb()

    repository = MatchmakingRepository(redis)
    chess_service = ChessGameService()
    session_service = GameSessionService(repository, chess_service)

    white_id = UUID("ffffffff-ffff-ffff-ffff-ffffffffffff")
    black_id = UUID("11111111-2222-3333-4444-555555555555")
    snapshot = chess_service.create_game(
        white_player_id=white_id,
        black_player_id=black_id,
    )

    await repository.create_game_snapshot(snapshot=snapshot)
    await redis.set(f"matchmaking:active_game:{white_id}", str(snapshot.game_id))
    await redis.set(f"matchmaking:active_game:{black_id}", str(snapshot.game_id))

    for move in ("f2f3", "e7e5", "g2g4", "d8h4"):
        snapshot = await session_service.apply_move(
            game_id=snapshot.game_id,
            player_id=white_id if snapshot.move_count % 2 == 0 else black_id,
            uci_move=move,
        )

    persisted = await repository.fetch_game_snapshot(game_id=snapshot.game_id)
    white_active = await redis.get(f"matchmaking:active_game:{white_id}")
    black_active = await redis.get(f"matchmaking:active_game:{black_id}")
    await redis.aclose()

    assert persisted.status == GameStatus.FINISHED
    assert white_active is None
    assert black_active is None
