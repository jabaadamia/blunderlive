import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from games.models import Game, Result, Termination
from ratings.models import RatingCategory
from users.models import User


@pytest.fixture
def games_client():
    return APIClient()


@pytest.fixture
def white_user(db):
    return User.objects.create_user(  # type: ignore
        username="white-user",
        email="white@example.com",
        password="securepass123",
    )


@pytest.fixture
def black_user(db):
    return User.objects.create_user(  # type: ignore
        username="black-user",
        email="black@example.com",
        password="securepass123",
    )


@pytest.fixture
def authenticated_games_client(games_client, white_user):
    response = games_client.post(
        "/api/auth/login/",
        {"email": white_user.email, "password": "securepass123"},
        format="json",
    )
    games_client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.json()['access']}")
    return games_client


@pytest.fixture
def finished_game(white_user, black_user):
    return Game.objects.create(
        white_player=white_user,
        black_player=black_user,
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


@pytest.mark.django_db
def test_my_games_endpoint_returns_authenticated_user_games(
    authenticated_games_client, finished_game
):
    response = authenticated_games_client.get("/api/game-history/me/")

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 1
    assert results[0]["id"] == str(finished_game.id)
    assert results[0]["result"] == Result.WHITE_WIN


@pytest.mark.django_db
def test_my_games_endpoint_excludes_other_users_games(
    authenticated_games_client, black_user
):
    other_white = User.objects.create_user(  # type: ignore
        username="unrelated-white",
        email="unrelated-white@example.com",
        password="securepass123",
    )
    other_black = User.objects.create_user(  # type: ignore
        username="unrelated-black",
        email="unrelated-black@example.com",
        password="securepass123",
    )
    Game.objects.create(
        white_player=other_white,
        black_player=other_black,
        result=Result.DRAW,
        termination=Termination.DRAW_AGREEMENT,
        rated=True,
        rating_category=RatingCategory.RAPID,
        initial_time_ms=600000,
        increment_ms=0,
        ended_at=timezone.now(),
        move_count=10,
        fen_final="unrelated-fen",
        pgn="1. d4 d5 1/2-1/2",
    )

    response = authenticated_games_client.get("/api/game-history/me/")

    assert response.status_code == 200
    assert response.json()["results"] == []


@pytest.mark.django_db
def test_my_games_endpoint_filters_by_category(
    authenticated_games_client, white_user, black_user, finished_game
):
    Game.objects.create(
        white_player=white_user,
        black_player=black_user,
        result=Result.BLACK_WIN,
        termination=Termination.RESIGNATION,
        rated=True,
        rating_category=RatingCategory.BLITZ,
        initial_time_ms=300000,
        increment_ms=0,
        ended_at=timezone.now(),
        move_count=30,
        fen_final="blitz-fen",
        pgn="1. e4 e5 0-1",
    )

    response = authenticated_games_client.get(
        "/api/game-history/me/?category=rapid"
    )

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 1
    assert results[0]["id"] == str(finished_game.id)
    assert results[0]["rating_category"] == RatingCategory.RAPID


@pytest.mark.django_db
def test_user_games_endpoint_is_public(games_client, finished_game, white_user):
    response = games_client.get(f"/api/game-history/users/{white_user.id}/")

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 1
    assert results[0]["id"] == str(finished_game.id)


@pytest.mark.django_db
def test_game_detail_endpoint_returns_full_game(
    authenticated_games_client, finished_game
):
    response = authenticated_games_client.get(f"/api/game-history/{finished_game.id}/")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(finished_game.id)
    assert body["pgn"] == "1. e4 e5 1-0"
    assert body["fen_final"] == "final-fen"


@pytest.mark.django_db
def test_game_detail_endpoint_is_public(games_client, finished_game):
    response = games_client.get(f"/api/game-history/{finished_game.id}/")

    assert response.status_code == 200
    assert response.json()["id"] == str(finished_game.id)


@pytest.mark.django_db
def test_game_detail_endpoint_404_for_unknown_id(authenticated_games_client):
    response = authenticated_games_client.get(
        "/api/game-history/00000000-0000-0000-0000-000000000000/"
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_my_games_endpoint_paginates_results(authenticated_games_client, white_user, black_user):
    for i in range(21):
        Game.objects.create(
            white_player=white_user,
            black_player=black_user,
            result=Result.WHITE_WIN,
            termination=Termination.CHECKMATE,
            rated=True,
            rating_category=RatingCategory.RAPID,
            initial_time_ms=600000,
            increment_ms=0,
            ended_at=timezone.now(),
            move_count=i,
            fen_final=f"fen-{i}",
            pgn=f"game-{i}",
        )

    first_page = authenticated_games_client.get("/api/game-history/me/")

    assert first_page.status_code == 200
    body = first_page.json()
    assert len(body["results"]) == 20
    assert body["next"] is not None

    second_page = authenticated_games_client.get(body["next"])

    assert second_page.status_code == 200
    second_body = second_page.json()
    assert len(second_body["results"]) == 1
    assert second_body["next"] is None
