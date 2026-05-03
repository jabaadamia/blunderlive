from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from math import pow
from typing import Iterable
from uuid import UUID

from django.db import transaction

from ratings.models import Rating, RatingCategory, RatingHistory, RatingHistorySource
from users.models import User


DEFAULT_RATING = 1200
DEFAULT_K_FACTOR = 32


@dataclass(frozen=True)
class RatingUpdateResult:
    player_rating: Rating
    opponent_rating: Rating
    player_delta: int
    opponent_delta: int


def ensure_default_ratings_for_user(user: User) -> list[Rating]:
    existing_categories = set(
        Rating.objects.filter(user=user).values_list("category", flat=True)
    )
    missing_categories = [
        Rating(user=user, category=category, value=DEFAULT_RATING)
        for category in RatingCategory.values
        if category not in existing_categories
    ]

    if missing_categories:
        Rating.objects.bulk_create(missing_categories)

    return list(get_ratings_for_user(user))


def get_or_create_rating(user: User, category: str) -> Rating:
    return Rating.objects.get_or_create(
        user=user,
        category=category,
        defaults={"value": DEFAULT_RATING},
    )[0]


def get_ratings_for_user(user: User) -> Iterable[Rating]:
    return Rating.objects.filter(user=user).order_by("category")


def get_rating_history_for_user(user: User, *, category: str | None = None) -> Iterable[RatingHistory]:
    queryset = RatingHistory.objects.filter(rating__user=user).select_related("rating")
    if category:
        queryset = queryset.filter(rating__category=category)
    return queryset.order_by("-created_at")


def expected_score(player_rating: int, opponent_rating: int) -> Decimal:
    return Decimal("1") / (Decimal("1") + Decimal(str(pow(10, (opponent_rating - player_rating) / 400))))


def calculate_elo_rating(player_rating: int, opponent_rating: int, score: Decimal, *, k_factor: int = DEFAULT_K_FACTOR) -> int:
    expected = expected_score(player_rating, opponent_rating)
    new_rating = Decimal(player_rating) + Decimal(k_factor) * (score - expected)
    return int(round(new_rating))


@transaction.atomic
def apply_game_result(
    *,
    white_user: User,
    black_user: User,
    category: str,
    result: str,
    game_id: UUID | None = None,
    k_factor: int = DEFAULT_K_FACTOR,
) -> RatingUpdateResult:
    if category not in RatingCategory.values:
        raise ValueError("Unsupported rating category.")
    if result not in {"1-0", "0-1", "1/2-1/2"}:
        raise ValueError("Unsupported game result.")

    white_rating = get_or_create_rating(white_user, category)
    black_rating = get_or_create_rating(black_user, category)

    if result == "1-0":
        white_score = Decimal("1")
        black_score = Decimal("0")
    elif result == "0-1":
        white_score = Decimal("0")
        black_score = Decimal("1")
    else:
        white_score = Decimal("0.5")
        black_score = Decimal("0.5")

    white_old = white_rating.value
    black_old = black_rating.value

    white_new = calculate_elo_rating(white_old, black_old, white_score, k_factor=k_factor)
    black_new = calculate_elo_rating(black_old, white_old, black_score, k_factor=k_factor)

    white_rating.value = white_new
    white_rating.games_played += 1
    white_rating.save(update_fields=["value", "games_played", "last_updated"])

    black_rating.value = black_new
    black_rating.games_played += 1
    black_rating.save(update_fields=["value", "games_played", "last_updated"])

    RatingHistory.objects.create(
        rating=white_rating,
        source=RatingHistorySource.GAME,
        previous_value=white_old,
        new_value=white_new,
        delta=white_new - white_old,
        opponent_user=black_user,
        game_id=game_id,
        notes=f"Result: {result}",
    )
    RatingHistory.objects.create(
        rating=black_rating,
        source=RatingHistorySource.GAME,
        previous_value=black_old,
        new_value=black_new,
        delta=black_new - black_old,
        opponent_user=white_user,
        game_id=game_id,
        notes=f"Result: {result}",
    )

    return RatingUpdateResult(
        player_rating=white_rating,
        opponent_rating=black_rating,
        player_delta=white_new - white_old,
        opponent_delta=black_new - black_old,
    )
