import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from games.models import Game, Result, Termination
from ratings.models import Rating, RatingCategory, RatingHistory, RatingHistorySource
from ratings.services import (
    apply_game_result,
    ensure_default_ratings_for_user,
    get_or_create_rating,
)
from users.models import User


@pytest.fixture
def ratings_client():
    return APIClient()


@pytest.fixture
def rated_user(db):
    return User.objects.create_user( # type: ignore
        username="rated-user",
        email="rated@example.com",
        password="securepass123",
    )


@pytest.fixture
def opponent_user(db):
    return User.objects.create_user( # type: ignore
        username="opponent-user",
        email="opponent@example.com",
        password="securepass123",
    )


@pytest.fixture
def authenticated_ratings_client(ratings_client, rated_user):
    response = ratings_client.post(
        "/api/auth/login/",
        {"email": rated_user.email, "password": "securepass123"},
        format="json",
    )
    ratings_client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.json()['access']}")
    return ratings_client


@pytest.mark.django_db
def test_get_or_create_rating_returns_default_rating(rated_user):
    rating = get_or_create_rating(rated_user, RatingCategory.RAPID)

    assert rating.user == rated_user
    assert rating.category == RatingCategory.RAPID
    assert rating.value == 1200
    assert rating.games_played == 0


@pytest.mark.django_db
def test_user_creation_creates_all_default_ratings():
    user = User.objects.create_user(  # type: ignore
        username="default-ratings-user",
        email="defaults@example.com",
        password="securepass123",
    )

    created_categories = set(
        Rating.objects.filter(user=user).values_list("category", flat=True)
    )

    assert created_categories == set(RatingCategory.values)


@pytest.mark.django_db
def test_ensure_default_ratings_for_user_is_idempotent(rated_user):
    ensure_default_ratings_for_user(rated_user)
    ensure_default_ratings_for_user(rated_user)

    assert Rating.objects.filter(user=rated_user).count() == len(RatingCategory.values)


@pytest.mark.django_db
def test_apply_game_result_updates_both_ratings_and_history(rated_user, opponent_user):
    game = Game.objects.create(
        white_player=rated_user,
        black_player=opponent_user,
        result=Result.WHITE_WIN,
        termination=Termination.CHECKMATE,
        rated=True,
        rating_category=RatingCategory.RAPID,
        initial_time_ms=600000,
        increment_ms=0,
        ended_at=timezone.now(),
        move_count=42,
        fen_final="final-fen",
        pgn="1. e4 e5 1-0",
    )
    apply_game_result(
        white_user=rated_user,
        black_user=opponent_user,
        category=RatingCategory.RAPID,
        result="1-0",
        game=game,
    )

    winner_rating = Rating.objects.get(user=rated_user, category=RatingCategory.RAPID)
    loser_rating = Rating.objects.get(user=opponent_user, category=RatingCategory.RAPID)

    assert winner_rating.value > 1200
    assert loser_rating.value < 1200
    assert winner_rating.games_played == 1
    assert loser_rating.games_played == 1
    assert RatingHistory.objects.count() == 2
    assert RatingHistory.objects.filter(game=game).count() == 2


@pytest.mark.django_db
def test_my_ratings_endpoint_returns_authenticated_user_ratings(authenticated_ratings_client, rated_user):
    rapid_rating = get_or_create_rating(rated_user, RatingCategory.RAPID)
    rapid_rating.value = 1234
    rapid_rating.save(update_fields=["value", "last_updated"])
    puzzle_rating = get_or_create_rating(rated_user, RatingCategory.PUZZLE)
    puzzle_rating.value = 1450
    puzzle_rating.save(update_fields=["value", "last_updated"])

    response = authenticated_ratings_client.get("/api/ratings/me/")

    assert response.status_code == 200
    assert len(response.json()) == len(RatingCategory.values)
    ratings_by_category = {entry["category"]: entry for entry in response.json()}
    assert ratings_by_category[RatingCategory.RAPID]["value"] == 1234
    assert ratings_by_category[RatingCategory.PUZZLE]["value"] == 1450


@pytest.mark.django_db
def test_user_ratings_endpoint_is_public(ratings_client, rated_user):
    rapid_rating = get_or_create_rating(rated_user, RatingCategory.RAPID)
    rapid_rating.value = 1234
    rapid_rating.save(update_fields=["value", "last_updated"])

    response = ratings_client.get(f"/api/ratings/users/{rated_user.id}/")

    assert response.status_code == 200
    ratings_by_category = {entry["category"]: entry for entry in response.json()}
    assert ratings_by_category[RatingCategory.RAPID]["value"] == 1234


@pytest.mark.django_db
def test_my_rating_history_endpoint_filters_by_category(authenticated_ratings_client, rated_user):
    rating = get_or_create_rating(rated_user, RatingCategory.RAPID)
    rating.value = 1216
    rating.save(update_fields=["value", "last_updated"])
    RatingHistory.objects.create(
        rating=rating,
        source=RatingHistorySource.GAME,
        previous_value=1200,
        new_value=1216,
        delta=16,
        notes="Result: 1-0",
    )

    response = authenticated_ratings_client.get("/api/ratings/me/history/?category=rapid")

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["category"] == RatingCategory.RAPID
