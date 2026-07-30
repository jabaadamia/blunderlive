from __future__ import annotations

from typing import Any

from redis.asyncio import Redis

from ..chess.service import ChessGameService
from ..domain.models import GameSnapshot


def build_finished_game_event(
    *,
    snapshot: GameSnapshot,
    chess_service: ChessGameService,
) -> dict[str, str]:
    if snapshot.result is None or snapshot.termination is None:
        raise ValueError("Finished game event requires result and termination.")

    event = {
        "game_id": str(snapshot.game_id),
        "white_player_id": str(snapshot.white.user_id),
        "black_player_id": str(snapshot.black.user_id),
        "result": snapshot.result,
        "termination": snapshot.termination,
        "rated": str(snapshot.rated).lower(),
        "initial_time_ms": str(snapshot.initial_time_ms),
        "increment_ms": str(snapshot.increment_ms),
        "started_at": snapshot.created_at.isoformat(),
        "ended_at": (
            snapshot.last_move_at.isoformat()
            if snapshot.last_move_at
            else snapshot.created_at.isoformat()
        ),
        "move_count": str(snapshot.move_count),
        "fen_final": snapshot.fen,
        "pgn": chess_service.build_pgn(snapshot=snapshot),
    }

    if snapshot.rated and snapshot.rating_category:
        event["rating_category"] = snapshot.rating_category

    return event


async def publish_finished_game_event(
    *,
    redis: Redis,
    stream: str,
    snapshot: GameSnapshot,
    chess_service: ChessGameService,
) -> str:
    return await redis.xadd(
        stream,
        build_finished_game_event(
            snapshot=snapshot,
            chess_service=chess_service,
        ),
        maxlen=10000,
    )


def parse_processed_game_event(fields: dict[str, Any]) -> dict[str, Any]:
    return {
        "game_id": fields["game_id"],
        "white_player_id": fields["white_player_id"],
        "black_player_id": fields["black_player_id"],
        "rated": fields["rated"] == "true",
        "rating_category": fields.get("rating_category"),
        "white_rating_change": _rating_change(fields, "white"),
        "black_rating_change": _rating_change(fields, "black"),
    }


def _rating_change(fields: dict[str, Any], color: str) -> dict[str, int] | None:
    before_key = f"{color}_rating_before"
    after_key = f"{color}_rating_after"
    delta_key = f"{color}_rating_delta"
    if before_key not in fields:
        return None
    return {
        "before": int(fields[before_key]),
        "after": int(fields[after_key]),
        "delta": int(fields[delta_key]),
    }
