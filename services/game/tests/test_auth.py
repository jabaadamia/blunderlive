from pathlib import Path

import jwt
from fastapi import Depends, FastAPI, WebSocket
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_player_http, get_current_player_ws
from app.auth.models import PlayerIdentity


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
            "jti": "test-jti",
            "user_id": user_id,
        },
        private_key,
        algorithm="RS256",
    )


def build_test_app() -> FastAPI:
    app = FastAPI()

    @app.get("/protected")
    async def protected(
        player: PlayerIdentity = Depends(get_current_player_http),
    ) -> dict[str, str]:
        return {"user_id": str(player.user_id)}

    @app.websocket("/ws/protected")
    async def protected_ws(
        websocket: WebSocket,
        player: PlayerIdentity = Depends(get_current_player_ws),
    ) -> None:
        await websocket.accept()
        await websocket.send_json({"user_id": str(player.user_id)})
        await websocket.close()

    return app


def test_get_current_player_http_accepts_valid_rs256_access_token() -> None:
    token = issue_access_token("00adccda-ddd2-4a00-ba0b-31607bca61d6")
    app = build_test_app()

    with TestClient(app) as client:
        response = client.get("/protected", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json() == {"user_id": "00adccda-ddd2-4a00-ba0b-31607bca61d6"}


def test_get_current_player_http_rejects_missing_token() -> None:
    app = build_test_app()

    with TestClient(app) as client:
        response = client.get("/protected")

    assert response.status_code == 401


def test_get_current_player_ws_accepts_token_from_subprotocol() -> None:
    token = issue_access_token("00adccda-ddd2-4a00-ba0b-31607bca61d6")
    app = build_test_app()

    with TestClient(app) as client:
        with client.websocket_connect(
            "/ws/protected",
            subprotocols=["blunderlive-game", f"bearer.{token}"],
        ) as websocket:
            message = websocket.receive_json()

    assert message == {"user_id": "00adccda-ddd2-4a00-ba0b-31607bca61d6"}
