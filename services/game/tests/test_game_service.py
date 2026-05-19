from datetime import datetime, UTC
import os
from uuid import UUID

import pytest
from redis.asyncio import Redis

from app.chess.service import ChessGameService
from app.domain.models import GameSnapshot, GameParticipant, GameStatus
from app.domain.enums import GameResult, GameStatus, PlayerColor, TerminationType
from app.domain.exceptions import InvalidDrawStateError, PlayerNotInGameError
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
    assert updated.version == 1
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

@pytest.mark.asyncio
async def test_resign_game_finishes_game() -> None:
    redis = Redis.from_url(
        os.environ["REDIS_URL"],
        encoding="utf-8",
        decode_responses=True,
    )

    await redis.flushdb()

    repository = MatchmakingRepository(redis)
    chess_service = ChessGameService()

    service = GameSessionService(
        repository,
        chess_service,
    )

    white_id = UUID("aaaaaaaa-1111-1111-1111-111111111111")
    black_id = UUID("bbbbbbbb-2222-2222-2222-222222222222")

    snapshot = GameSnapshot(
        game_id=UUID("cccccccc-3333-3333-3333-333333333333"),
        status=GameStatus.ACTIVE,
        fen="startpos",
        created_at=datetime.now(UTC),
        white=GameParticipant(
            user_id=white_id,
            color=PlayerColor.WHITE,
        ),
        black=GameParticipant(
            user_id=black_id,
            color=PlayerColor.BLACK,
        ),
        version=0,
    )

    await repository.create_game_snapshot(
        snapshot=snapshot,
    )

    await redis.set(
        f"matchmaking:active_game:{white_id}",
        str(snapshot.game_id),
    )

    await redis.set(
        f"matchmaking:active_game:{black_id}",
        str(snapshot.game_id),
    )

    updated_snapshot = await service.resign_game(
        game_id=snapshot.game_id,
        player_id=white_id,
    )

    stored_snapshot = await repository.fetch_game_snapshot(
        game_id=snapshot.game_id,
    )

    white_active = await redis.get(
        f"matchmaking:active_game:{white_id}",
    )

    black_active = await redis.get(
        f"matchmaking:active_game:{black_id}",
    )

    await redis.aclose()

    assert updated_snapshot.status == GameStatus.FINISHED
    assert updated_snapshot.result == GameResult.BLACK_WIN
    assert updated_snapshot.termination == TerminationType.RESIGNATION

    assert stored_snapshot.status == GameStatus.FINISHED

    assert white_active is None
    assert black_active is None


@pytest.mark.asyncio
async def test_offer_draw_persists_offer_for_acceptance() -> None:
    redis = Redis.from_url(
        os.environ["REDIS_URL"],
        encoding="utf-8",
        decode_responses=True,
    )
    await redis.flushdb()

    repository = MatchmakingRepository(redis)
    chess_service = ChessGameService()
    service = GameSessionService(repository, chess_service)

    white_id = UUID("12121212-1212-1212-1212-121212121212")
    black_id = UUID("34343434-3434-3434-3434-343434343434")
    snapshot = chess_service.create_game(
        white_player_id=white_id,
        black_player_id=black_id,
    )

    await repository.create_game_snapshot(snapshot=snapshot)

    offered_snapshot = await service.offer_draw(
        game_id=snapshot.game_id,
        player_id=white_id,
    )
    accepted_snapshot = await service.accept_draw(
        game_id=snapshot.game_id,
        player_id=black_id,
    )
    persisted = await repository.fetch_game_snapshot(game_id=snapshot.game_id)
    await redis.aclose()

    assert offered_snapshot.draw_offer_by == white_id
    assert offered_snapshot.version == 1
    assert accepted_snapshot.status == GameStatus.FINISHED
    assert accepted_snapshot.result == GameResult.DRAW
    assert accepted_snapshot.termination == TerminationType.DRAW_AGREEMENT
    assert accepted_snapshot.draw_offer_by is None
    assert persisted.status == GameStatus.FINISHED


@pytest.mark.asyncio
async def test_decline_draw_clears_offer() -> None:
    redis = Redis.from_url(
        os.environ["REDIS_URL"],
        encoding="utf-8",
        decode_responses=True,
    )
    await redis.flushdb()

    repository = MatchmakingRepository(redis)
    chess_service = ChessGameService()
    service = GameSessionService(repository, chess_service)

    white_id = UUID("56565656-5656-5656-5656-565656565656")
    black_id = UUID("78787878-7878-7878-7878-787878787878")
    snapshot = chess_service.create_game(
        white_player_id=white_id,
        black_player_id=black_id,
    )

    await repository.create_game_snapshot(snapshot=snapshot)
    await service.offer_draw(
        game_id=snapshot.game_id,
        player_id=white_id,
    )

    declined_snapshot = await service.decline_draw(
        game_id=snapshot.game_id,
        player_id=black_id,
    )
    persisted = await repository.fetch_game_snapshot(game_id=snapshot.game_id)
    await redis.aclose()

    assert declined_snapshot.draw_offer_by is None
    assert declined_snapshot.version == 2
    assert persisted.draw_offer_by is None


@pytest.mark.asyncio
async def test_decline_draw_rejects_missing_offer() -> None:
    redis = Redis.from_url(
        os.environ["REDIS_URL"],
        encoding="utf-8",
        decode_responses=True,
    )
    await redis.flushdb()

    repository = MatchmakingRepository(redis)
    chess_service = ChessGameService()
    service = GameSessionService(repository, chess_service)

    white_id = UUID("90909090-9090-9090-9090-909090909090")
    black_id = UUID("abababab-abab-abab-abab-abababababab")
    snapshot = chess_service.create_game(
        white_player_id=white_id,
        black_player_id=black_id,
    )

    await repository.create_game_snapshot(snapshot=snapshot)

    with pytest.raises(InvalidDrawStateError):
        await service.decline_draw(
            game_id=snapshot.game_id,
            player_id=black_id,
        )

    await redis.aclose()
