from pathlib import Path

import jwt
from fastapi.testclient import TestClient
from redis import Redis

from app.main import app


def resolve_private_key_path() -> Path:
    container_path = Path("/run/dev-jwt/private.pem")
    if container_path.exists():
        return container_path

    return (Path(__file__).resolve().parents[3] / "infra/dev-jwt/private.pem").resolve()


def issue_access_token(user_id: str) -> str:
    with open(resolve_private_key_path(), encoding="utf-8") as key_file:
        private_key = key_file.read()

    return jwt.encode(
        {
            "token_type": "access",
            "exp": 4_100_000_000,
            "iat": 1_700_000_000,
            "jti": "test-jti-matchmaking",
            "user_id": user_id,
        },
        private_key,
        algorithm="RS256",
    )


def test_join_matchmaking_requires_auth() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/matchmaking/join",
            json={
                "rated": True,
                "time_control": {"initial_time_ms": 600000, "increment_ms": 0},
            },
        )

    assert response.status_code == 401


def test_join_matchmaking_enqueues_player_in_time_control_bucket() -> None:
    user_id = "28ff2337-7be5-4f06-8da0-9d7e31a7f692"
    token = issue_access_token(user_id)

    with TestClient(app) as client:
        redis_url = client.app.state.settings.redis_url # type: ignore
        redis = Redis.from_url(redis_url, encoding="utf-8", decode_responses=True)
        redis.flushdb()

        response = client.post(
            "/matchmaking/join",
            json={
                "rated": True,
                "time_control": {"initial_time_ms": 600000, "increment_ms": 2000},
            },
            headers={"Authorization": f"Bearer {token}"},
        )

        queue_bucket = "rated_600000_2000"
        queue_score = redis.zscore(f"matchmaking:queue:{queue_bucket}", user_id)
        entry = redis.hgetall(f"matchmaking:entry:{user_id}")
        redis.close()

    assert response.status_code == 200
    assert response.json() == {
        "status": "queued",
        "queue": "rated_600000_2000",
        "rated": True,
        "time_control": {"initial_time_ms": 600000, "increment_ms": 2000},
    }
    assert queue_score is not None
    assert entry["queue"] == "rated_600000_2000" # type: ignore
    assert entry["rated"] == "true" # type: ignore
    assert entry["initial_time_ms"] == "600000" # type: ignore 
    assert entry["increment_ms"] == "2000" # type: ignore


def test_join_matchmaking_rejects_duplicate_queue_entry() -> None:
    user_id = "ab0c46c7-0eef-4aef-98a2-4a8aa4e856f0"
    token = issue_access_token(user_id)

    with TestClient(app) as client:
        redis_url = client.app.state.settings.redis_url # type: ignore
        redis = Redis.from_url(redis_url, encoding="utf-8", decode_responses=True)
        redis.flushdb()
        payload = {
            "rated": True,
            "time_control": {"initial_time_ms": 600000, "increment_ms": 0},
        }
        first_response = client.post("/matchmaking/join", json=payload, headers={"Authorization": f"Bearer {token}"})
        second_response = client.post("/matchmaking/join", json=payload, headers={"Authorization": f"Bearer {token}"})
        redis.close()

    assert first_response.status_code == 200
    assert second_response.status_code == 409
    assert second_response.json()["detail"] == "player_already_queued"


def test_join_matchmaking_rejects_player_in_active_game() -> None:
    user_id = "709704e4-3cde-4f44-81da-eaf8ebde995f"
    token = issue_access_token(user_id)

    with TestClient(app) as client:
        redis_url = client.app.state.settings.redis_url # type: ignore
        redis = Redis.from_url(redis_url, encoding="utf-8", decode_responses=True)
        redis.flushdb()
        redis.set(f"matchmaking:active_game:{user_id}", "game-1")
        response = client.post(
            "/matchmaking/join",
            json={
                "rated": True,
                "time_control": {"initial_time_ms": 600000, "increment_ms": 0},
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        redis.close()

    assert response.status_code == 409
    assert response.json()["detail"] == "player_in_active_game"
