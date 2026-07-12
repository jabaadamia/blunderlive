from datetime import timedelta
import uuid

import pytest
from django.utils import timezone

from games.management.commands.process_finished_games import Command
from games.models import Game, Result, Termination
from games.services import (
    FinishedGamePayload,
    build_processed_game_event,
    process_finished_game,
)
from games.streams import parse_finished_game_stream_entry
from ratings.models import Rating, RatingCategory, RatingHistory
from users.models import User


@pytest.fixture
def white_player(db):
    return User.objects.create_user(  # type: ignore
        username="white-player",
        email="white@example.com",
        password="securepass123",
    )


@pytest.fixture
def black_player(db):
    return User.objects.create_user(  # type: ignore
        username="black-player",
        email="black@example.com",
        password="securepass123",
    )


@pytest.fixture
def finished_game_fields(white_player, black_player):
    started_at = timezone.now() - timedelta(minutes=12)
    ended_at = timezone.now()
    return {
        "game_id": str(uuid.uuid4()),
        "white_player_id": str(white_player.id),
        "black_player_id": str(black_player.id),
        "result": Result.WHITE_WIN,
        "termination": Termination.CHECKMATE,
        "rated": "true",
        "rating_category": RatingCategory.RAPID,
        "initial_time_ms": "600000",
        "increment_ms": "0",
        "started_at": started_at.isoformat(),
        "ended_at": ended_at.isoformat(),
        "move_count": "42",
        "fen_final": "rnb1kbnr/pppp1ppp/8/4p3/6q1/5P2/PPPPP1PP/RNBQKBNR w KQkq - 1 3",
        "pgn": "1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0",
    }


@pytest.mark.django_db
def test_parse_finished_game_stream_entry_resolves_users_and_types(finished_game_fields):
    payload = parse_finished_game_stream_entry(finished_game_fields)

    assert payload.game_id == uuid.UUID(finished_game_fields["game_id"])
    assert payload.rated is True
    assert payload.initial_time_ms == 600000
    assert payload.move_count == 42
    assert payload.result == Result.WHITE_WIN


@pytest.mark.django_db
def test_process_finished_game_persists_game_and_ratings(white_player, black_player):
    payload = FinishedGamePayload(
        game_id=uuid.uuid4(),
        white_player=white_player,
        black_player=black_player,
        result=Result.WHITE_WIN,
        termination=Termination.CHECKMATE,
        rated=True,
        rating_category=RatingCategory.RAPID,
        initial_time_ms=600000,
        increment_ms=0,
        started_at=timezone.now() - timedelta(minutes=10),
        ended_at=timezone.now(),
        move_count=42,
        fen_final="final-fen",
        pgn="1. e4 e5 1-0",
    )

    result = process_finished_game(payload=payload)

    game = Game.objects.get(pk=payload.game_id)
    white_rating = Rating.objects.get(user=white_player, category=RatingCategory.RAPID)
    black_rating = Rating.objects.get(user=black_player, category=RatingCategory.RAPID)

    assert result.created is True
    assert game.rating_applied_at is not None
    assert white_rating.value == game.white_rating_after
    assert black_rating.value == game.black_rating_after
    assert RatingHistory.objects.filter(game=game).count() == 2


@pytest.mark.django_db
def test_process_finished_game_is_idempotent(white_player, black_player):
    payload = FinishedGamePayload(
        game_id=uuid.uuid4(),
        white_player=white_player,
        black_player=black_player,
        result=Result.DRAW,
        termination=Termination.DRAW_AGREEMENT,
        rated=True,
        rating_category=RatingCategory.RAPID,
        initial_time_ms=600000,
        increment_ms=0,
        started_at=timezone.now() - timedelta(minutes=10),
        ended_at=timezone.now(),
        move_count=60,
        fen_final="final-fen",
        pgn="1. e4 e5 1/2-1/2",
    )

    first = process_finished_game(payload=payload)
    second = process_finished_game(payload=payload)

    assert first.created is True
    assert second.created is False
    assert Game.objects.count() == 1
    assert RatingHistory.objects.count() == 2


@pytest.mark.django_db
def test_build_processed_game_event_includes_confirmed_rating_deltas(white_player, black_player):
    payload = FinishedGamePayload(
        game_id=uuid.uuid4(),
        white_player=white_player,
        black_player=black_player,
        result=Result.WHITE_WIN,
        termination=Termination.CHECKMATE,
        rated=True,
        rating_category=RatingCategory.RAPID,
        initial_time_ms=300000,
        increment_ms=2000,
        started_at=timezone.now() - timedelta(minutes=8),
        ended_at=timezone.now(),
        move_count=35,
        fen_final="final-fen",
        pgn="1. e4 e5 1-0",
    )

    processed = process_finished_game(payload=payload)
    event = build_processed_game_event(game=processed.game)

    assert event["game_id"] == str(payload.game_id)
    assert event["rated"] == "true"
    assert event["rating_category"] == RatingCategory.RAPID
    assert int(event["white_rating_delta"]) == processed.game.white_rating_delta
    assert int(event["black_rating_delta"]) == processed.game.black_rating_delta


class FakeRedis:
    def __init__(self) -> None:
        self.added: list[tuple[str, dict[str, str]]] = []
        self.acked: list[tuple[str, str, str]] = []
        self.claimed: list[tuple[str, dict[str, str]]] = []

    def xadd(self, stream: str, fields: dict[str, str]) -> str:
        self.added.append((stream, fields))
        return "1-0"

    def xack(self, stream: str, group: str, entry_id: str) -> int:
        self.acked.append((stream, group, entry_id))
        return 1

    def xautoclaim(
        self,
        *,
        name: str,
        groupname: str,
        consumername: str,
        min_idle_time: int,
        start_id: str,
        count: int,
    ):
        return ("0-0", self.claimed[:count], [])


@pytest.mark.django_db
def test_command_process_entry_publishes_processed_event_and_acknowledges(
    white_player,
    black_player,
    finished_game_fields,
):
    redis = FakeRedis()
    command = Command()

    command._process_entry(
        redis=redis,
        stream="games.finished",
        processed_stream="games.processed",
        failed_stream="games.failed",
        group="core-game-processing",
        entry_id="1-0",
        fields=finished_game_fields,
    )

    assert len(redis.added) == 1
    assert redis.added[0][0] == "games.processed"
    assert redis.added[0][1]["game_id"] == finished_game_fields["game_id"]
    assert redis.acked == [("games.finished", "core-game-processing", "1-0")]


@pytest.mark.django_db
def test_command_process_entry_moves_invalid_event_to_failed_stream(
    finished_game_fields,
):
    redis = FakeRedis()
    command = Command()
    finished_game_fields["rated"] = "maybe"

    command._process_entry(
        redis=redis,
        stream="games.finished",
        processed_stream="games.processed",
        failed_stream="games.failed",
        group="core-game-processing",
        entry_id="1-0",
        fields=finished_game_fields,
    )

    assert redis.added[0][0] == "games.failed"
    assert redis.added[0][1]["source_entry_id"] == "1-0"
    assert redis.added[0][1]["payload_rated"] == "maybe"
    assert redis.acked == [("games.finished", "core-game-processing", "1-0")]


@pytest.mark.django_db
def test_command_processes_claimed_pending_entries(finished_game_fields):
    redis = FakeRedis()
    redis.claimed = [("1-0", finished_game_fields)]
    command = Command()

    processed_count = command._process_pending_entries(
        redis=redis,
        stream="games.finished",
        processed_stream="games.processed",
        failed_stream="games.failed",
        group="core-game-processing",
        consumer="core-worker-1",
        count=10,
        min_idle_time=60000,
    )

    assert processed_count == 1
    assert redis.added[0][0] == "games.processed"
    assert redis.acked == [("games.finished", "core-game-processing", "1-0")]
