import asyncio
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4

import pytest

from app.chess.service import ChessGameService
from app.domain.enums import GameResult, GameStatus, TerminationType
from app.domain.models import GameParticipant, GameSnapshot, PlayerColor
from app.game.clock_watchdog import ClockWatchdogManager
from app.game.service import GameSessionService
from app.schemas.ws_out import GameOverMessage


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


@pytest.mark.asyncio
async def test_clock_watchdog_manager_schedule_and_timeout() -> None:
    session_service = AsyncMock()
    manager = AsyncMock()
    watchdog = ClockWatchdogManager(session_service, manager)

    game_id = uuid4()
    finished_snapshot = build_test_snapshot(status=GameStatus.FINISHED)
    session_service.check_timeout.return_value = finished_snapshot

    watchdog.schedule(game_id=game_id, version=1, delay_ms=10)
    await asyncio.sleep(0.05)

    session_service.check_timeout.assert_called_once_with(
        game_id=game_id,
        expected_version=1,
    )
    manager.broadcast.assert_called_once()
    broadcast_args = manager.broadcast.call_args.kwargs
    assert broadcast_args["game_id"] == game_id
    assert isinstance(broadcast_args["message"], GameOverMessage)


@pytest.mark.asyncio
async def test_clock_watchdog_manager_cancel() -> None:
    session_service = AsyncMock()
    manager = AsyncMock()
    watchdog = ClockWatchdogManager(session_service, manager)

    game_id = uuid4()
    watchdog.schedule(game_id=game_id, version=1, delay_ms=500)
    assert game_id in watchdog._tasks

    watchdog.cancel(game_id=game_id)
    assert game_id not in watchdog._tasks
    await asyncio.sleep(0.05)

    session_service.check_timeout.assert_not_called()
