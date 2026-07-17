from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from ratings.models import RatingCategory
from ratings.services import get_or_create_rating
from users.models import User


@dataclass(frozen=True)
class GamePlayerProfile:
    id: UUID
    username: str
    rating: int | None


class UnknownGamePlayersError(ValueError):
    """Raised when one or more requested players do not exist."""


def get_game_player_profiles(
    *,
    user_ids: list[UUID],
    rating_category: str | None = None,
) -> list[GamePlayerProfile]:
    if not user_ids:
        return []

    if rating_category is not None and rating_category not in RatingCategory.values:
        raise ValueError("Unsupported rating category.")

    users_by_id = User.objects.in_bulk(user_ids)
    missing_ids = [user_id for user_id in user_ids if user_id not in users_by_id]
    if missing_ids:
        raise UnknownGamePlayersError(
            f"Unknown player ids: {', '.join(str(user_id) for user_id in missing_ids)}"
        )

    profiles: list[GamePlayerProfile] = []
    for user_id in user_ids:
        user = users_by_id[user_id]
        rating: int | None = None
        if rating_category is not None:
            rating = get_or_create_rating(user, rating_category).value

        profiles.append(
            GamePlayerProfile(
                id=user_id,
                username=user.username,
                rating=rating,
            )
        )

    return profiles
