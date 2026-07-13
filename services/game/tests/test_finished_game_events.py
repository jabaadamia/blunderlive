from datetime import UTC, datetime
from uuid import UUID

import pytest

from app.chess.service import ChessGameService
from app.domain.enums import GameResult, GameStatus, PlayerColor, TerminationType
from app.domain.models import GameParticipant, GameSnapshot
from app.game.events import build_finished_game_event, parse_processed_game_event
from app.game.finished_worker import publish_pending_finished_games
from app.game.processed_worker import (
    _broadcast_processed_event,
    _claimed_messages,
    _process_pending,
)


def finished_snapshot() -> GameSnapshot:
    return GameSnapshot(
        game_id=UUID("aaaaaaaa-1111-1111-1111-111111111111"),
        status=GameStatus.FINISHED,
        fen="rnb1kb1r/pppp1Qpp/5n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4",
        created_at=datetime(2026, 1, 1, 12, 0, tzinfo=UTC),
        last_move_at=datetime(2026, 1, 1, 12, 5, tzinfo=UTC),
        white=GameParticipant(
            user_id=UUID("bbbbbbbb-2222-2222-2222-222222222222"),
            color=PlayerColor.WHITE,
        ),
        black=GameParticipant(
            user_id=UUID("cccccccc-3333-3333-3333-333333333333"),
            color=PlayerColor.BLACK,
        ),
        moves=["e2e4", "e7e5", "d1h5", "b8c6", "f1c4", "g8f6", "h5f7"],
        result=GameResult.WHITE_WIN,
        termination=TerminationType.CHECKMATE,
        move_count=7,
        rated=True,
        rating_category="blitz",
        initial_time_ms=300000,
        increment_ms=0,
    )


def test_build_finished_game_event_contains_core_contract_fields() -> None:
    snapshot = finished_snapshot()

    event = build_finished_game_event(
        snapshot=snapshot,
        chess_service=ChessGameService(),
    )

    assert event["game_id"] == str(snapshot.game_id)
    assert event["white_player_id"] == str(snapshot.white.user_id)
    assert event["black_player_id"] == str(snapshot.black.user_id)
    assert event["result"] == "1-0"
    assert event["termination"] == "checkmate"
    assert event["rated"] == "true"
    assert event["rating_category"] == "blitz"
    assert event["move_count"] == "7"
    assert "Qxf7#" in event["pgn"]


class FakeRedis:
    def __init__(self) -> None:
        self.added: list[tuple[str, dict]] = []
        self.acked: list[tuple[str, str, str]] = []
        self.claimed = []

    async def xadd(self, stream: str, fields: dict) -> str:
        self.added.append((stream, fields))
        return "1-0"

    async def xack(self, stream: str, group: str, entry_id: str) -> int:
        self.acked.append((stream, group, entry_id))
        return 1

    async def xautoclaim(
        self,
        *,
        name: str,
        groupname: str,
        consumername: str,
        min_idle_time: int,
        start_id: str,
        count: int,
    ):
        return self.claimed


class FakeRepository:
    def __init__(self, snapshots: list[GameSnapshot]) -> None:
        self.snapshots = snapshots
        self.cleared: list[UUID] = []

    async def fetch_pending_finished_games(self):
        return self.snapshots

    async def clear_pending_finished_game(self, *, game_id: UUID) -> None:
        self.cleared.append(game_id)


@pytest.mark.asyncio
async def test_finished_game_publisher_publishes_pending_snapshots() -> None:
    snapshot = finished_snapshot()
    repository = FakeRepository([snapshot])
    redis = FakeRedis()

    published_count = await publish_pending_finished_games(
        repository=repository,  # type: ignore[arg-type]
        redis=redis,  # type: ignore[arg-type]
        chess_service=ChessGameService(),
        stream="games.finished",
    )

    assert published_count == 1
    assert redis.added[0][0] == "games.finished"
    assert redis.added[0][1]["game_id"] == str(snapshot.game_id)
    assert repository.cleared == [snapshot.game_id]


def test_parse_processed_game_event_extracts_rating_changes() -> None:
    event = parse_processed_game_event(
        {
            "game_id": "aaaaaaaa-1111-1111-1111-111111111111",
            "white_player_id": "bbbbbbbb-2222-2222-2222-222222222222",
            "black_player_id": "cccccccc-3333-3333-3333-333333333333",
            "rated": "true",
            "rating_category": "blitz",
            "white_rating_before": "1200",
            "white_rating_after": "1216",
            "white_rating_delta": "16",
            "black_rating_before": "1200",
            "black_rating_after": "1184",
            "black_rating_delta": "-16",
        }
    )

    assert event["white_rating_change"] == {
        "before": 1200,
        "after": 1216,
        "delta": 16,
    }
    assert event["black_rating_change"]["delta"] == -16


class FakeConnectionManager:
    def __init__(self) -> None:
        self.broadcasts: list[tuple[UUID, object]] = []

    async def broadcast(self, *, game_id: UUID, message) -> None:
        self.broadcasts.append((game_id, message))


@pytest.mark.asyncio
async def test_broadcast_processed_event_sends_rating_update_and_acknowledges() -> None:
    redis = FakeRedis()
    manager = FakeConnectionManager()

    await _broadcast_processed_event(
        redis=redis,  # type: ignore[arg-type]
        manager=manager,  # type: ignore[arg-type]
        stream="games.processed",
        group="game-rating-updates",
        entry_id="1-0",
        fields={
            "game_id": "aaaaaaaa-1111-1111-1111-111111111111",
            "white_player_id": "bbbbbbbb-2222-2222-2222-222222222222",
            "black_player_id": "cccccccc-3333-3333-3333-333333333333",
            "rated": "true",
            "rating_category": "blitz",
            "white_rating_before": "1200",
            "white_rating_after": "1216",
            "white_rating_delta": "16",
            "black_rating_before": "1200",
            "black_rating_after": "1184",
            "black_rating_delta": "-16",
        },
    )

    assert manager.broadcasts[0][0] == UUID("aaaaaaaa-1111-1111-1111-111111111111")
    assert manager.broadcasts[0][1].type == "rating_update_confirmed"
    assert manager.broadcasts[0][1].white_rating_change.delta == 16
    assert redis.acked == [("games.processed", "game-rating-updates", "1-0")]


def test_claimed_messages_accepts_redis_cursor_list_shape() -> None:
    fields = {
        "game_id": "aaaaaaaa-1111-1111-1111-111111111111",
    }

    assert _claimed_messages(["0-0", [("1-0", fields)], []]) == [
        ("1-0", fields),
    ]


def test_claimed_messages_accepts_plain_message_list_shape() -> None:
    fields = {
        "game_id": "aaaaaaaa-1111-1111-1111-111111111111",
    }

    assert _claimed_messages([("1-0", fields)]) == [("1-0", fields)]


@pytest.mark.asyncio
async def test_process_pending_handles_redis_cursor_list_shape() -> None:
    redis = FakeRedis()
    manager = FakeConnectionManager()
    redis.claimed = [
        "0-0",
        [
            (
                "1-0",
                {
                    "game_id": "aaaaaaaa-1111-1111-1111-111111111111",
                    "white_player_id": "bbbbbbbb-2222-2222-2222-222222222222",
                    "black_player_id": "cccccccc-3333-3333-3333-333333333333",
                    "rated": "true",
                    "rating_category": "blitz",
                    "white_rating_before": "1200",
                    "white_rating_after": "1216",
                    "white_rating_delta": "16",
                    "black_rating_before": "1200",
                    "black_rating_after": "1184",
                    "black_rating_delta": "-16",
                },
            )
        ],
        [],
    ]

    await _process_pending(
        redis=redis,  # type: ignore[arg-type]
        manager=manager,  # type: ignore[arg-type]
        stream="games.processed",
        group="game-rating-updates",
        consumer="game-worker-1",
    )

    assert manager.broadcasts[0][1].type == "rating_update_confirmed"
    assert redis.acked == [("games.processed", "game-rating-updates", "1-0")]
