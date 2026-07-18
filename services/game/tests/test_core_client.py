from unittest.mock import AsyncMock, patch
from uuid import UUID

import httpx
import pytest

from app.core.client import HttpPlayerProfileClient, ResilientPlayerProfileClient


@pytest.mark.asyncio
async def test_http_player_profile_client_fetches_profiles() -> None:
    user_one = UUID("aaaaaaaa-1111-1111-1111-111111111111")
    user_two = UUID("bbbbbbbb-2222-2222-2222-222222222222")
    response = httpx.Response(
        200,
        json=[
            {
                "id": str(user_one),
                "username": "alice",
                "rating": 1450,
            },
            {
                "id": str(user_two),
                "username": "bob",
                "rating": 1523,
            },
        ],
        request=httpx.Request("POST", "http://core:8000/api/users/game-players/"),
    )

    with patch("app.core.client.httpx.AsyncClient") as async_client_cls:
        client = AsyncMock()
        client.__aenter__.return_value = client
        client.post.return_value = response
        async_client_cls.return_value = client

        profiles = await HttpPlayerProfileClient(
            base_url="http://core:8000"
        ).fetch_game_players(
            user_ids=[user_one, user_two],
            rating_category="blitz",
        )

    client.post.assert_awaited_once_with(
        "http://core:8000/api/users/game-players/",
        json={
            "user_ids": [str(user_one), str(user_two)],
            "rating_category": "blitz",
        },
    )
    assert profiles[user_one].username == "alice"
    assert profiles[user_one].rating == 1450
    assert profiles[user_two].username == "bob"


@pytest.mark.asyncio
async def test_resilient_player_profile_client_unknow_user_on_failure() -> None:
    user_id = UUID("cccccccc-3333-3333-3333-333333333333")
    response = httpx.Response(
        500,
        json={"detail": "error"},
        request=httpx.Request("POST", "http://core:8000/api/users/game-players/"),
    )

    with patch("app.core.client.httpx.AsyncClient") as async_client_cls:
        client = AsyncMock()
        client.__aenter__.return_value = client
        client.post.return_value = response
        async_client_cls.return_value = client

        profiles = await ResilientPlayerProfileClient(
            HttpPlayerProfileClient(base_url="http://core:8000")
        ).fetch_game_players(
            user_ids=[user_id],
            rating_category="blitz",
        )

    assert profiles[user_id].username == None
    assert profiles[user_id].rating == None
