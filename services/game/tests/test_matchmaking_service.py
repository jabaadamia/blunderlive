import os
from uuid import UUID

import pytest
from redis.asyncio import Redis

from app.chess.service import ChessGameService
from app.domain.enums import GameStatus
from app.matchmaking.repository import MatchmakingRepository
from app.matchmaking.service import MatchmakingService
from tests.player_profiles import StaticPlayerProfileClient


@pytest.mark.asyncio
async def test_run_matchmaking_cycle_matches_two_players() -> None:
    redis = Redis.from_url(
        os.environ["REDIS_URL"],
        encoding="utf-8",
        decode_responses=True,
    )

    await redis.flushdb()

    repository = MatchmakingRepository(redis)
    chess_service = ChessGameService()
    service = MatchmakingService(
        repository,
        chess_service,
        StaticPlayerProfileClient(),
    )

    user_one = UUID("aaaaaaaa-1111-1111-1111-111111111111")
    user_two = UUID("bbbbbbbb-2222-2222-2222-222222222222")

    await repository.enqueue_player(
        user_id=user_one,
        rated=True,
        initial_time_ms=300000,
        increment_ms=0,
    )

    await repository.enqueue_player(
        user_id=user_two,
        rated=True,
        initial_time_ms=300000,
        increment_ms=0,
    )

    await service.run_matchmaking_cycle()

    player_one_status = await repository.fetch_queue_status(
        user_id=user_one,
    )

    player_two_status = await repository.fetch_queue_status(
        user_id=user_two,
    )

    stored_snapshot = await repository.fetch_game_snapshot(
        game_id=UUID(player_one_status.active_game_id) # type: ignore[arg-type]
    )

    await redis.aclose()

    assert player_one_status.is_queued is False
    assert player_two_status.is_queued is False

    assert player_one_status.active_game_id is not None
    assert player_two_status.active_game_id is not None

    assert (
        player_one_status.active_game_id
        == player_two_status.active_game_id
    )
    assert stored_snapshot.status == GameStatus.ACTIVE
    assert stored_snapshot.white.user_id == user_one
    assert stored_snapshot.black.user_id == user_two
    assert stored_snapshot.white.username == f"player-{str(user_one)[:8]}"
    assert stored_snapshot.black.username == f"player-{str(user_two)[:8]}"
    assert stored_snapshot.white.rating == 1200
    assert stored_snapshot.black.rating == 1200
    assert stored_snapshot.rated is True
    assert stored_snapshot.rating_category == "blitz"
    assert stored_snapshot.initial_time_ms == 300000
    assert stored_snapshot.increment_ms == 0

@pytest.mark.asyncio
async def test_run_matchmaking_cycle_does_not_mix_rated_and_casual() -> None:
    redis = Redis.from_url(
        os.environ["REDIS_URL"],
        encoding="utf-8",
        decode_responses=True,
    )

    await redis.flushdb()

    repository = MatchmakingRepository(redis)
    chess_service = ChessGameService()
    service = MatchmakingService(
        repository,
        chess_service,
        StaticPlayerProfileClient(),
    )

    rated_user = UUID("cccccccc-3333-3333-3333-333333333333")
    casual_user = UUID("dddddddd-4444-4444-4444-444444444444")

    await repository.enqueue_player(
        user_id=rated_user,
        rated=True,
        initial_time_ms=300000,
        increment_ms=0,
    )

    await repository.enqueue_player(
        user_id=casual_user,
        rated=False,
        initial_time_ms=300000,
        increment_ms=0,
    )

    await service.run_matchmaking_cycle()

    rated_status = await repository.fetch_queue_status(
        user_id=rated_user,
    )

    casual_status = await repository.fetch_queue_status(
        user_id=casual_user,
    )

    await redis.aclose()

    assert rated_status.is_queued is True
    assert casual_status.is_queued is True

    assert rated_status.active_game_id is None
    assert casual_status.active_game_id is None
