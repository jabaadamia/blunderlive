from __future__ import annotations

from datetime import datetime
from uuid import UUID

from django.utils.dateparse import parse_datetime

from games.services import FinishedGamePayload
from users.models import User


def parse_finished_game_stream_entry(fields: dict[str, str]) -> FinishedGamePayload:
    started_at = _parse_datetime(fields, "started_at")
    ended_at = _parse_datetime(fields, "ended_at")

    return FinishedGamePayload(
        game_id=UUID(fields["game_id"]),
        white_player=_get_user(fields["white_player_id"]),
        black_player=_get_user(fields["black_player_id"]),
        result=fields["result"],
        termination=fields["termination"],
        rated=_parse_bool(fields["rated"]),
        rating_category=fields.get("rating_category") or None,
        initial_time_ms=int(fields["initial_time_ms"]),
        increment_ms=int(fields["increment_ms"]),
        started_at=started_at,
        ended_at=ended_at,
        move_count=int(fields["move_count"]),
        fen_final=fields["fen_final"],
        pgn=fields["pgn"],
    )


def _get_user(user_id: str) -> User:
    return User.objects.get(pk=UUID(user_id))


def _parse_bool(value: str) -> bool:
    normalized = value.strip().lower()
    if normalized == "true":
        return True
    if normalized == "false":
        return False
    raise ValueError(f"Unsupported boolean value: {value}")


def _parse_datetime(fields: dict[str, str], key: str) -> datetime:
    raw_value = fields[key]
    parsed = parse_datetime(raw_value)
    if parsed is None:
        raise ValueError(f"Unsupported datetime value for {key}: {raw_value}")
    return parsed
