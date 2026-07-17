from uuid import uuid4

import pytest
from django.test import Client, TestCase
from rest_framework.test import APIClient

from ratings.models import Rating, RatingCategory
from ratings.services import get_or_create_rating
from users.models import User


@pytest.fixture
def users_client():
    return APIClient()


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


@pytest.mark.django_db
def test_game_players_lookup_returns_usernames_and_ratings(
    users_client,
    white_player,
    black_player,
):
    get_or_create_rating(white_player, RatingCategory.BLITZ)
    get_or_create_rating(black_player, RatingCategory.BLITZ)
    Rating.objects.filter(user=white_player, category=RatingCategory.BLITZ).update(value=1450)
    Rating.objects.filter(user=black_player, category=RatingCategory.BLITZ).update(value=1523)

    response = users_client.post(
        "/api/users/game-players/",
        {
            "user_ids": [str(white_player.id), str(black_player.id)],
            "rating_category": RatingCategory.BLITZ,
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": str(white_player.id),
            "username": "white-player",
            "rating": 1450,
        },
        {
            "id": str(black_player.id),
            "username": "black-player",
            "rating": 1523,
        },
    ]


@pytest.mark.django_db
def test_game_players_lookup_omits_rating_for_casual_games(
    users_client,
    white_player,
    black_player,
):
    response = users_client.post(
        "/api/users/game-players/",
        {
            "user_ids": [str(white_player.id), str(black_player.id)],
            "rating_category": None,
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": str(white_player.id),
            "username": "white-player",
            "rating": None,
        },
        {
            "id": str(black_player.id),
            "username": "black-player",
            "rating": None,
        },
    ]


@pytest.mark.django_db
def test_game_players_lookup_creates_missing_rating_for_category(
    users_client,
    white_player,
):
    response = users_client.post(
        "/api/users/game-players/",
        {
            "user_ids": [str(white_player.id)],
            "rating_category": RatingCategory.RAPID,
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": str(white_player.id),
            "username": "white-player",
            "rating": 1200,
        },
    ]


@pytest.mark.django_db
def test_game_players_lookup_returns_404_for_unknown_user(users_client, white_player):
    missing_id = uuid4()

    response = users_client.post(
        "/api/users/game-players/",
        {
            "user_ids": [str(white_player.id), str(missing_id)],
            "rating_category": RatingCategory.BLITZ,
        },
        format="json",
    )

    assert response.status_code == 404
    assert "Unknown player ids" in response.json()["detail"]


@pytest.mark.django_db
def test_game_players_lookup_rejects_invalid_category(users_client, white_player):
    response = users_client.post(
        "/api/users/game-players/",
        {
            "user_ids": [str(white_player.id)],
            "rating_category": "invalid",
        },
        format="json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_game_players_lookup_preserves_request_order(
    users_client,
    white_player,
    black_player,
):
    response = users_client.post(
        "/api/users/game-players/",
        {
            "user_ids": [str(black_player.id), str(white_player.id)],
            "rating_category": RatingCategory.BLITZ,
        },
        format="json",
    )

    assert response.status_code == 200
    assert [entry["username"] for entry in response.json()] == [
        "black-player",
        "white-player",
    ]


class GamePlayersLookupViewTests(TestCase):
    def test_game_players_lookup_requires_post(self) -> None:
        response = Client().get("/api/users/game-players/")

        self.assertEqual(response.status_code, 405)
