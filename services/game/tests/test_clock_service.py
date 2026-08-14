from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest

from app.chess.service import ChessGameService
from app.domain.enums import GameResult, GameStatus, TerminationType
from app.domain.models import GameParticipant, GameSnapshot, PlayerColor
from app.game.deadlines import sweep_deadlines
from app.game.service import GameSessionService


def build_test_snapshot(
    *,
    initial_time_ms: int = 60000,
    increment_ms: int = 5000,
    white_time_left_ms: int = 60000,
    black_time_left_ms: int = 60000,
    turn_started_at: datetime | None = None,
    status: GameStatus = GameStatus.ACTIVE,
    moves: list[str] | None = None,
    version: int = 0,
) -> GameSnapshot:
    now = datetime.now(UTC)
    return GameSnapshot(
        game_id=uuid4(),
        status=status,
        fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        created_at=now,
        last_move_at=None,
        white=GameParticipant(
            user_id=UUID("aaaaaaaa-1111-1111-1111-111111111111"),
            color=PlayerColor.WHITE,
            username="white-player",
        ),
        black=GameParticipant(
            user_id=UUID("bbbbbbbb-2222-2222-2222-222222222222"),
            color=PlayerColor.BLACK,
            username="black-player",
        ),
        moves=moves or [],
        move_count=len(moves or []),
        rated=True,
        initial_time_ms=initial_time_ms,
        increment_ms=increment_ms,
        white_time_left_ms=white_time_left_ms,
        black_time_left_ms=black_time_left_ms,
        turn_started_at=turn_started_at or now,
        version=version,
    )


def test_create_game_initializes_clocks() -> None:
    chess_service = ChessGameService()
    white_id = UUID("aaaaaaaa-1111-1111-1111-111111111111")
    black_id = UUID("bbbbbbbb-2222-2222-2222-222222222222")

    snapshot = chess_service.create_game(
        white_player_id=white_id,
        black_player_id=black_id,
        initial_time_ms=180000,
        increment_ms=2000,
    )

    assert snapshot.initial_time_ms == 180000
    assert snapshot.increment_ms == 2000
    assert snapshot.white_time_left_ms == 180000
    assert snapshot.black_time_left_ms == 180000
    assert snapshot.turn_started_at is not None


def test_remaining_time_for_turn_calculation() -> None:
    chess_service = ChessGameService()
    now = datetime.now(UTC)
    snapshot = build_test_snapshot(
        initial_time_ms=60000,
        white_time_left_ms=60000,
        turn_started_at=now - timedelta(seconds=10),
    )

    remaining = chess_service.remaining_time_for_turn(snapshot=snapshot)
    assert 49000 <= remaining <= 51000

    untimed_snapshot = build_test_snapshot(initial_time_ms=0)
    assert chess_service.remaining_time_for_turn(snapshot=untimed_snapshot) == 0


def test_apply_timeout_triggers_when_expired() -> None:
    chess_service = ChessGameService()
    now = datetime.now(UTC)
    expired_snapshot = build_test_snapshot(
        initial_time_ms=10000,
        white_time_left_ms=10000,
        turn_started_at=now - timedelta(seconds=15),
    )

    timed_out = chess_service.apply_timeout(snapshot=expired_snapshot)
    assert timed_out is not None
    assert timed_out.status == GameStatus.FINISHED
    assert timed_out.result == GameResult.BLACK_WIN
    assert timed_out.termination == TerminationType.TIMEOUT
    assert timed_out.white_time_left_ms == 0

    valid_snapshot = build_test_snapshot(
        initial_time_ms=60000,
        white_time_left_ms=60000,
        turn_started_at=now,
    )
    assert chess_service.apply_timeout(snapshot=valid_snapshot) is None


def test_apply_move_updates_mover_clock_and_increment() -> None:
    chess_service = ChessGameService()
    now = datetime.now(UTC)
    snapshot = build_test_snapshot(
        initial_time_ms=60000,
        increment_ms=3000,
        white_time_left_ms=60000,
        black_time_left_ms=60000,
        turn_started_at=now - timedelta(seconds=5),
    )

    updated = chess_service.apply_move(
        snapshot=snapshot,
        player_id=snapshot.white.user_id,
        uci_move="e2e4",
    )

    # 60000 - ~5000 + 3000 = ~58000
    assert 57000 <= updated.white_time_left_ms <= 59000
    assert updated.black_time_left_ms == 60000
    assert updated.turn_started_at is not None
    assert len(updated.move_clocks_ms) == 1
    assert 57000 <= updated.move_clocks_ms[0] <= 59000


def test_build_pgn_includes_clock_comments() -> None:
    chess_service = ChessGameService()
    snapshot = build_test_snapshot(
        initial_time_ms=300000,
        moves=["e2e4", "e7e5"],
    ).model_copy(update={
        "move_clocks_ms": [298000, 296000],
    })

    pgn = chess_service.build_pgn(snapshot=snapshot)
    assert "[%clk 0:04:58]" in pgn
    assert "[%clk 0:04:56]" in pgn


def test_apply_move_intercepts_flag_fall() -> None:
    chess_service = ChessGameService()
    now = datetime.now(UTC)
    flagged_snapshot = build_test_snapshot(
        initial_time_ms=10000,
        white_time_left_ms=10000,
        turn_started_at=now - timedelta(seconds=15),
    )

    result = chess_service.apply_move(
        snapshot=flagged_snapshot,
        player_id=flagged_snapshot.white.user_id,
        uci_move="e2e4",
    )

    assert result.status == GameStatus.FINISHED
    assert result.termination == TerminationType.TIMEOUT
    assert result.result == GameResult.BLACK_WIN
    assert result.moves == []


@pytest.mark.asyncio
async def test_game_session_service_check_timeout() -> None:
    chess_service = ChessGameService()
    repository = AsyncMock()
    session_service = GameSessionService(repository, chess_service)

    now = datetime.now(UTC)
    expired_snapshot = build_test_snapshot(
        initial_time_ms=10000,
        white_time_left_ms=10000,
        turn_started_at=now - timedelta(seconds=15),
        version=2,
    )
    repository.fetch_game_snapshot.return_value = expired_snapshot
    repository.save_game_snapshot.return_value = True

    res = await session_service.check_timeout(
        game_id=expired_snapshot.game_id,
        expected_version=2,
    )

    assert res is not None
    assert res.status == GameStatus.FINISHED
    assert res.version == 3
    repository.save_game_snapshot.assert_called_once()


class FakeDeadlineRepository:
    def __init__(self, snapshot: GameSnapshot) -> None:
        self.snapshot = snapshot
        self.removed: list[tuple[UUID, int]] = []

    async def fetch_due_deadlines(self, *, now_ms: int):
        return [(self.snapshot.game_id, 1234)]

    async def fetch_game_snapshot(self, *, game_id: UUID) -> GameSnapshot:
        return self.snapshot

    async def remove_deadline_if_score(self, *, game_id: UUID, deadline_ms: int) -> bool:
        self.removed.append((game_id, deadline_ms))
        return True


class FakeRedis:
    def __init__(self) -> None:
        self.published: list[tuple[str, str]] = []

    async def publish(self, channel: str, payload: str) -> int:
        self.published.append((channel, payload))
        return 1


@pytest.mark.asyncio
async def test_sweep_deadlines_applies_timeout_and_publishes_game_over() -> None:
    snapshot = build_test_snapshot(version=3)
    repository = FakeDeadlineRepository(snapshot)
    session_service = AsyncMock()
    timed_out = snapshot.model_copy(
        update={
            "status": GameStatus.FINISHED,
            "result": GameResult.BLACK_WIN,
            "termination": TerminationType.TIMEOUT,
            "version": 4,
        }
    )
    session_service.check_timeout.return_value = timed_out
    redis = FakeRedis()

    count = await sweep_deadlines(
        redis=redis,  # type: ignore[arg-type]
        repository=repository,  # type: ignore[arg-type]
        session_service=session_service,
    )

    assert count == 1
    session_service.check_timeout.assert_called_once_with(
        game_id=snapshot.game_id,
        expected_version=3,
    )
    assert redis.published[0][0] == f"game:events:{snapshot.game_id}"
    assert '"type":"game_over"' in redis.published[0][1]


@pytest.mark.asyncio
async def test_sweep_deadlines_removes_stale_unexpired_deadline_conditionally() -> None:
    snapshot = build_test_snapshot(version=3)
    repository = FakeDeadlineRepository(snapshot)
    session_service = AsyncMock()
    session_service.check_timeout.return_value = None
    redis = FakeRedis()

    count = await sweep_deadlines(
        redis=redis,  # type: ignore[arg-type]
        repository=repository,  # type: ignore[arg-type]
        session_service=session_service,
    )

    assert count == 0
    assert repository.removed == [(snapshot.game_id, 1234)]
    assert redis.published == []
