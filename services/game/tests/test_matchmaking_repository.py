import os
from datetime import UTC, datetime
from uuid import UUID

import pytest
from redis.asyncio import Redis

from app.domain.enums import GameStatus, PlayerColor
from app.domain.models import GameParticipant, GameSnapshot
from app.matchmaking.repository import (
    DuplicateQueueEntryError,
    MatchmakingRepository,
    PlayerInActiveGameError,
)


@pytest.mark.asyncio
async def test_enqueue_player_persists_queue_entry() -> None:
    redis = Redis.from_url(os.environ["REDIS_URL"], encoding="utf-8", decode_responses=True)
    await redis.flushdb()
    repository = MatchmakingRepository(redis)
    user_id = UUID("15d92535-b40c-4ea1-b7dc-cf30598869cc")

    queue = await repository.enqueue_player(
        user_id=user_id,
        rated=True,
        initial_time_ms=300000,
        increment_ms=2000,
    )

    status = await repository.fetch_queue_status(user_id=user_id)
    await redis.aclose()

    assert queue == "rated_300000_2000"
    assert status.is_queued is True
    assert status.queue == "rated_300000_2000"
    assert status.rated is True


@pytest.mark.asyncio
async def test_enqueue_player_prevents_duplicate_entries() -> None:
    redis = Redis.from_url(os.environ["REDIS_URL"], encoding="utf-8", decode_responses=True)
    await redis.flushdb()
    repository = MatchmakingRepository(redis)
    user_id = UUID("51142be8-0d47-45bc-9f4e-f0bd3f97604c")

    await repository.enqueue_player(
        user_id=user_id,
        rated=True,
        initial_time_ms=300000,
        increment_ms=0,
    )

    with pytest.raises(DuplicateQueueEntryError):
        await repository.enqueue_player(
            user_id=user_id,
            rated=True,
            initial_time_ms=300000,
            increment_ms=0,
        )
    await redis.aclose()


@pytest.mark.asyncio
async def test_enqueue_player_rejected_when_active_game_exists() -> None:
    redis = Redis.from_url(os.environ["REDIS_URL"], encoding="utf-8", decode_responses=True)
    await redis.flushdb()
    repository = MatchmakingRepository(redis)
    user_id = UUID("3b2b2134-e3d9-4f45-838f-9a5f3c8f5872")
    await redis.set(f"matchmaking:active_game:{user_id}", "game-123")

    with pytest.raises(PlayerInActiveGameError):
        await repository.enqueue_player(
            user_id=user_id,
            rated=True,
            initial_time_ms=600000,
            increment_ms=0,
        )
    await redis.aclose()


@pytest.mark.asyncio
async def test_remove_player_dequeues_and_clears_entry() -> None:
    redis = Redis.from_url(os.environ["REDIS_URL"], encoding="utf-8", decode_responses=True)
    await redis.flushdb()
    repository = MatchmakingRepository(redis)
    user_id = UUID("0df8ea49-fd6f-4a74-8b58-66d6385ac3c4")

    await repository.enqueue_player(
        user_id=user_id,
        rated=False,
        initial_time_ms=180000,
        increment_ms=1000,
    )
    removed = await repository.remove_player(user_id=user_id)
    status = await repository.fetch_queue_status(user_id=user_id)
    await redis.aclose()

    assert removed is True
    assert status.is_queued is False

@pytest.mark.asyncio
async def test_fetch_waiting_players_returns_players_in_order() -> None:
    redis = Redis.from_url(
        os.environ["REDIS_URL"],
        encoding="utf-8",
        decode_responses=True,
    )

    await redis.flushdb()

    repository = MatchmakingRepository(redis)

    user_one = UUID("11111111-1111-1111-1111-111111111111")
    user_two = UUID("22222222-2222-2222-2222-222222222222")

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

    players = await repository.fetch_waiting_players(
        queue_bucket="rated_300000_0",
    )

    await redis.aclose()

    assert players == [
        str(user_one),
        str(user_two),
    ]

@pytest.mark.asyncio
async def test_try_create_match_assigns_active_games_and_removes_queue_entries() -> None:
    redis = Redis.from_url(
        os.environ["REDIS_URL"],
        encoding="utf-8",
        decode_responses=True,
    )

    await redis.flushdb()

    repository = MatchmakingRepository(redis)

    user_one = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    user_two = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")

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

    snapshot = GameSnapshot(
        game_id=UUID("cccccccc-cccc-cccc-cccc-cccccccccccc"),
        status=GameStatus.ACTIVE,
        fen="startpos",
        created_at=datetime.now(UTC),
        white=GameParticipant(user_id=user_one, color=PlayerColor.WHITE),
        black=GameParticipant(user_id=user_two, color=PlayerColor.BLACK),
        moves=[],
        move_count=0,
        version=0,
    )

    success = await repository.try_create_match(
        queue_bucket="rated_300000_0",
        player_one_id=str(user_one),
        player_two_id=str(user_two),
        snapshot=snapshot,
    )

    queue_members = await redis.zrange(
        "matchmaking:queue:rated_300000_0",
        0,
        -1,
    )

    player_one_active = await redis.get(f"matchmaking:active_game:{user_one}")

    player_two_active = await redis.get(f"matchmaking:active_game:{user_two}")
    stored_snapshot = await repository.fetch_game_snapshot(game_id=snapshot.game_id)

    await redis.aclose()

    assert success is True
    assert queue_members == []
    assert player_one_active == str(snapshot.game_id)
    assert player_two_active == str(snapshot.game_id)
    assert stored_snapshot.game_id == snapshot.game_id
    assert stored_snapshot.white.user_id == user_one
    assert stored_snapshot.black.user_id == user_two

@pytest.mark.asyncio
async def test_save_game_snapshot_clears_active_games_when_finished() -> None:
    redis = Redis.from_url(
        os.environ["REDIS_URL"],
        encoding="utf-8",
        decode_responses=True,
    )

    await redis.flushdb()

    repository = MatchmakingRepository(redis)

    user_one = UUID("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee")
    user_two = UUID("ffffffff-ffff-ffff-ffff-ffffffffffff")

    initial_snapshot = GameSnapshot(
        game_id=UUID("99999999-9999-9999-9999-999999999999"),
        status=GameStatus.ACTIVE,
        fen="active-fen",
        created_at=datetime.now(UTC),
        white=GameParticipant(
            user_id=user_one,
            color=PlayerColor.WHITE,
        ),
        black=GameParticipant(
            user_id=user_two,
            color=PlayerColor.BLACK,
        ),
        move_count=0,
        version=0,
    )

    await repository.create_game_snapshot(
        snapshot=initial_snapshot,
    )

    finished_snapshot = initial_snapshot.model_copy(
        update={
            "status": GameStatus.FINISHED,
            "fen": "finished-fen",
            "moves": ["e2e4", "e7e5"],
            "move_count": 2,
            "version": 1,
        },
    )

    await redis.set(
        f"matchmaking:active_game:{user_one}",
        str(initial_snapshot.game_id),
    )

    await redis.set(
        f"matchmaking:active_game:{user_two}",
        str(initial_snapshot.game_id),
    )

    await repository.save_game_snapshot(
        expected_version=initial_snapshot.version,
        snapshot=finished_snapshot,
    )

    player_one_active = await redis.get(
        f"matchmaking:active_game:{user_one}"
    )

    player_two_active = await redis.get(
        f"matchmaking:active_game:{user_two}"
    )

    stored_snapshot = await repository.fetch_game_snapshot(
        game_id=initial_snapshot.game_id,
    )

    await redis.aclose()

    assert player_one_active is None
    assert player_two_active is None
    assert stored_snapshot.status == GameStatus.FINISHED

@pytest.mark.asyncio
async def test_save_game_snapshot_rejects_stale_version() -> None:
    redis = Redis.from_url(
        os.environ["REDIS_URL"],
        encoding="utf-8",
        decode_responses=True,
    )

    await redis.flushdb()

    repository = MatchmakingRepository(redis)

    snapshot = GameSnapshot(
        game_id=UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
        status=GameStatus.ACTIVE,
        fen="startpos",
        created_at=datetime.now(UTC),
        white=GameParticipant(
            user_id=UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
            color=PlayerColor.WHITE,
        ),
        black=GameParticipant(
            user_id=UUID("cccccccc-cccc-cccc-cccc-cccccccccccc"),
            color=PlayerColor.BLACK,
        ),
        version=2,
    )

    await repository.create_game_snapshot(
        snapshot=snapshot,
    )

    updated_snapshot = snapshot.model_copy(
        update={
            "version": 3,
        }
    )

    saved = await repository.save_game_snapshot(
        expected_version=1,
        snapshot=updated_snapshot,
    )

    await redis.aclose()

    assert saved is False