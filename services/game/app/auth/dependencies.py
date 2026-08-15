from fastapi import Depends, HTTPException, Request, WebSocket, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from ..config import Settings
from ..dependencies import get_settings_dependency
from .models import PlayerIdentity
from .verifier import TokenVerificationError, verify_access_token

bearer_scheme = HTTPBearer(auto_error=False)
WS_APP_SUBPROTOCOL = "blunderlive-game"
WS_BEARER_SUBPROTOCOL_PREFIX = "bearer."


def get_current_player_http(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    settings: Settings = Depends(get_settings_dependency),
) -> PlayerIdentity:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    try:
        return verify_access_token(
            token=credentials.credentials,
            public_key=settings.jwt_public_key,
            public_key_path=settings.jwt_public_key_path,
        )
    except TokenVerificationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc


async def get_current_player_ws(
    websocket: WebSocket,
    settings: Settings = Depends(get_settings_dependency),
) -> PlayerIdentity:
    token: str | None = None

    for subprotocol in websocket.scope.get("subprotocols", []):
        if subprotocol.startswith(WS_BEARER_SUBPROTOCOL_PREFIX):
            token = subprotocol.removeprefix(WS_BEARER_SUBPROTOCOL_PREFIX)
            break

    if not token:
        authorization = websocket.headers.get("authorization", "")
        if authorization.lower().startswith("bearer "):
            token = authorization.split(" ", 1)[1].strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    try:
        return verify_access_token(
            token=token,
            public_key=settings.jwt_public_key,
            public_key_path=settings.jwt_public_key_path,
        )
    except TokenVerificationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc
