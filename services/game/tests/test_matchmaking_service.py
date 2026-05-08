from uuid import UUID

import pytest
from redis.asyncio import Redis

from app.matchmaking.repository import MatchmakingRepository
from app.matchmaking.service import MatchmakingService


@pytest.mark.asyncio
async def test_run_matchmaking_cycle_matches_two_players() -> None:
    redis = Redis.from_url(
        "redis://redis:6379/0",
        encoding="utf-8",
        decode_responses=True,
    )

    await redis.flushdb()

    repository = MatchmakingRepository(redis)
    service = MatchmakingService(repository)

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

    await redis.aclose()

    assert player_one_status.is_queued is False
    assert player_two_status.is_queued is False

    assert player_one_status.active_game_id is not None
    assert player_two_status.active_game_id is not None

    assert (
        player_one_status.active_game_id
        == player_two_status.active_game_id
    )

@pytest.mark.asyncio
async def test_run_matchmaking_cycle_does_not_mix_rated_and_casual() -> None:
    redis = Redis.from_url(
        "redis://redis:6379/0",
        encoding="utf-8",
        decode_responses=True,
    )

    await redis.flushdb()

    repository = MatchmakingRepository(redis)
    service = MatchmakingService(repository)

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