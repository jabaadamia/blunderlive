import os
from uuid import UUID

import jwt
import pytest
from fastapi.testclient import TestClient
from redis.asyncio import Redis

from app.chess.service import ChessGameService
from app.core.client import PlayerProfile
from app.main import app
from app.matchmaking.repository import MatchmakingRepository
from app.matchmaking.service import MatchmakingService
from tests.player_profiles import StaticPlayerProfileClient


def issue_access_token(user_id: str) -> str:
    from pathlib import Path

    container_path = Path("/run/dev-jwt/private.pem")
    if container_path.exists():
        private_key_path = container_path
    else:
        private_key_path = (
            Path(__file__).resolve().parents[3] / "infra/dev-jwt/private.pem"
        ).resolve()

    with open(private_key_path, encoding="utf-8") as key_file:
        private_key = key_file.read()

    return jwt.encode(
        {
            "token_type": "access",
            "exp": 4_100_000_000,
            "iat": 1_700_000_000,
            "jti": "test-jti-matchmaking-status",
            "user_id": user_id,
        },
        private_key,
        algorithm="RS256",
    )


@pytest.mark.asyncio
async def test_matchmaking_status_returns_players_when_matched() -> None:
    white_id = UUID("aaaaaaaa-1111-1111-1111-111111111111")
    black_id = UUID("bbbbbbbb-2222-2222-2222-222222222222")

    redis = Redis.from_url(
        os.environ["REDIS_URL"],
        encoding="utf-8",
        decode_responses=True,
    )
    await redis.flushdb()

    repository = MatchmakingRepository(redis)
    chess_service = ChessGameService()
    player_client = StaticPlayerProfileClient(
        {
            white_id: PlayerProfile(
                user_id=white_id,
                username="alice",
                rating=1450,
            ),
            black_id: PlayerProfile(
                user_id=black_id,
                username="bob",
                rating=1523,
            ),
        }
    )
    service = MatchmakingService(repository, chess_service, player_client)

    await repository.enqueue_player(
        user_id=white_id,
        rated=True,
        initial_time_ms=300000,
        increment_ms=0,
    )
    await repository.enqueue_player(
        user_id=black_id,
        rated=True,
        initial_time_ms=300000,
        increment_ms=0,
    )
    await service.run_matchmaking_cycle()

    token = issue_access_token(str(white_id))
    with TestClient(app) as client:
        response = client.get(
            "/matchmaking/status",
            headers={"Authorization": f"Bearer {token}"},
        )

    await redis.aclose()

    assert response.status_code == 200
    payload = response.json()
    assert payload["state"] == "matched"
    assert payload["active_game_id"] is not None
    assert payload["white_player"] == {
        "user_id": str(white_id),
        "username": "alice",
        "rating": 1450,
    }
    assert payload["black_player"] == {
        "user_id": str(black_id),
        "username": "bob",
        "rating": 1523,
    }
