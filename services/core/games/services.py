from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from django.db import transaction
from django.db.utils import IntegrityError
from django.utils import timezone

from games.models import Game
from games.models import Result, Termination
from ratings.models import RatingCategory
from ratings.services import RatingUpdateResult, apply_game_result
from users.models import User


@dataclass(frozen=True)
class FinishedGamePayload:
    game_id: UUID
    white_player: User
    black_player: User
    result: str
    termination: str
    rated: bool
    rating_category: str | None
    initial_time_ms: int
    increment_ms: int
    started_at: datetime
    ended_at: datetime
    move_count: int
    fen_final: str
    pgn: str


@dataclass(frozen=True)
class ProcessFinishedGameResult:
    game: Game
    rating_result: RatingUpdateResult | None
    created: bool


@transaction.atomic
def process_finished_game(*, payload: FinishedGamePayload) -> ProcessFinishedGameResult:
    validate_finished_game_payload(payload)
    game = Game.objects.select_for_update().filter(id=payload.game_id).first()
    created = False

    if game is None:
        game = Game(
            id=payload.game_id,
            white_player=payload.white_player,
            black_player=payload.black_player,
            result=payload.result,
            termination=payload.termination,
            rated=payload.rated,
            rating_category=payload.rating_category,
            initial_time_ms=payload.initial_time_ms,
            increment_ms=payload.increment_ms,
            started_at=payload.started_at,
            ended_at=payload.ended_at,
            move_count=payload.move_count,
            fen_final=payload.fen_final,
            pgn=payload.pgn,
        )
        try:
            game.save(force_insert=True)
            created = True
        except IntegrityError:
            game = Game.objects.select_for_update().get(pk=game.pk)

    if game.rating_applied_at is not None:
        return ProcessFinishedGameResult(game=game, rating_result=None, created=created)

    rating_result = None
    if game.rated:
        rating_result = apply_game_result(
            white_user=game.white_player,
            black_user=game.black_player,
            category=game.rating_category,
            result=game.result,
            game=game,
        )

        game.white_rating_before = rating_result.white_previous
        game.white_rating_after = rating_result.white_rating.value
        game.white_rating_delta = rating_result.white_delta
        game.black_rating_before = rating_result.black_previous
        game.black_rating_after = rating_result.black_rating.value
        game.black_rating_delta = rating_result.black_delta

    game.rating_applied_at = timezone.now()
    game.save(
        update_fields=[
            "white_rating_before",
            "white_rating_after",
            "white_rating_delta",
            "black_rating_before",
            "black_rating_after",
            "black_rating_delta",
            "rating_applied_at",
        ]
    )

    return ProcessFinishedGameResult(
        game=game,
        rating_result=rating_result,
        created=created,
    )


def build_processed_game_event(*, game: Game) -> dict[str, str]:
    event = {
        "game_id": str(game.id),
        "white_player_id": str(game.white_player_id),
        "black_player_id": str(game.black_player_id),
        "result": game.result,
        "termination": game.termination,
        "rated": str(game.rated).lower(),
        "rating_applied_at": game.rating_applied_at.isoformat() if game.rating_applied_at else "",
    }

    if game.rating_category:
        event["rating_category"] = game.rating_category

    if game.white_rating_before is not None:
        event["white_rating_before"] = str(game.white_rating_before)
        event["white_rating_after"] = str(game.white_rating_after)
        event["white_rating_delta"] = str(game.white_rating_delta)
        event["black_rating_before"] = str(game.black_rating_before)
        event["black_rating_after"] = str(game.black_rating_after)
        event["black_rating_delta"] = str(game.black_rating_delta)

    return event


def validate_finished_game_payload(payload: FinishedGamePayload) -> None:
    if payload.white_player.id == payload.black_player.id:
        raise ValueError("white and black players must be different users.")
    if payload.ended_at < payload.started_at:
        raise ValueError("ended_at must be greater than or equal to started_at.")
    if payload.result not in Result.values:
        raise ValueError("Unsupported game result.")
    if payload.termination not in Termination.values:
        raise ValueError("Unsupported game termination.")
    if payload.initial_time_ms < 0 or payload.increment_ms < 0:
        raise ValueError("Time control values must be positive.")
    if payload.move_count < 0:
        raise ValueError("move_count must be positive.")
    if payload.rated and payload.rating_category not in RatingCategory.values:
        raise ValueError("rating_category is required for rated games.")
    if not payload.rated and payload.rating_category is not None:
        raise ValueError("Casual games must not include a rating_category.")
