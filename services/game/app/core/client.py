from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

import httpx

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PlayerProfile:
    user_id: UUID
    username: str | None
    rating: int | None = None


class PlayerProfileClient(Protocol):
    async def fetch_game_players(
        self,
        *,
        user_ids: list[UUID],
        rating_category: str | None,
    ) -> dict[UUID, PlayerProfile]: ...


def unknown_player_profile(*, user_id: UUID) -> PlayerProfile:
    return PlayerProfile(user_id=user_id, username=None, rating=None)


class HttpPlayerProfileClient:
    def __init__(
        self,
        *,
        base_url: str,
        timeout: float = 1.5,
        max_attempts: int = 3,
        retry_backoff: float = 0.2,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.max_attempts = max_attempts
        self.retry_backoff = retry_backoff

    async def fetch_game_players(
        self,
        *,
        user_ids: list[UUID],
        rating_category: str | None,
    ) -> dict[UUID, PlayerProfile]:
        last_exc: Exception | None = None

        for attempt in range(self.max_attempts):
            try:
                return await self._fetch_once(
                    user_ids=user_ids,
                    rating_category=rating_category,
                )
            except Exception as exc:
                last_exc = exc
                if attempt < self.max_attempts - 1:
                    await asyncio.sleep(self.retry_backoff * (attempt + 1))

        assert last_exc is not None
        raise last_exc

    async def _fetch_once(
        self,
        *,
        user_ids: list[UUID],
        rating_category: str | None,
    ) -> dict[UUID, PlayerProfile]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/api/users/game-players/",
                json={
                    "user_ids": [str(user_id) for user_id in user_ids],
                    "rating_category": rating_category,
                },
            )
            response.raise_for_status()

        profiles: dict[UUID, PlayerProfile] = {}
        for item in response.json():
            user_id = UUID(item["id"])
            profiles[user_id] = PlayerProfile(
                user_id=user_id,
                username=item["username"],
                rating=item.get("rating"),
            )
        return profiles


class ResilientPlayerProfileClient:
    """Fetch player profiles from core; falls back to an honest unknown state."""

    def __init__(self, client: PlayerProfileClient) -> None:
        self.client = client

    async def fetch_game_players(
        self,
        *,
        user_ids: list[UUID],
        rating_category: str | None,
    ) -> dict[UUID, PlayerProfile]:
        try:
            profiles = await self.client.fetch_game_players(
                user_ids=user_ids,
                rating_category=rating_category,
            )
        except Exception:
            logger.error(
                "player_profile_lookup_failed",
                extra={"user_ids": [str(u) for u in user_ids]},
                exc_info=True,
            )
            profiles = {}

        resolved: dict[UUID, PlayerProfile] = {}
        for user_id in user_ids:
            resolved[user_id] = profiles.get(user_id) or unknown_player_profile(
                user_id=user_id,
            )
        return resolved
