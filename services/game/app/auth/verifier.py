from functools import lru_cache
from uuid import UUID

import jwt
from jwt import InvalidTokenError
from pydantic import ValidationError

from .keys import load_key
from .models import PlayerIdentity


class TokenVerificationError(Exception):
    """Raised when a JWT cannot be verified into a player identity."""


@lru_cache
def load_public_key(public_key: str | None, public_key_path: str | None) -> str:
    return load_key(content=public_key, path=public_key_path)


def verify_access_token(
    token: str,
    *,
    public_key: str | None,
    public_key_path: str | None,
) -> PlayerIdentity:
    try:
        payload = jwt.decode(
            token,
            load_public_key(public_key, public_key_path),
            algorithms=["RS256"],
            options={"require": ["exp", "iat", "jti", "user_id", "token_type"]},
        )
    except InvalidTokenError as exc:
        raise TokenVerificationError("invalid_token") from exc

    if payload.get("token_type") != "access":
        raise TokenVerificationError("invalid_token_type")

    user_id = payload.get("user_id")
    try:
        identity = PlayerIdentity(
            user_id=UUID(str(user_id)),
            token_id=str(payload["jti"]),
        )
    except (ValueError, ValidationError, KeyError) as exc:
        raise TokenVerificationError("invalid_identity_claims") from exc

    return identity
