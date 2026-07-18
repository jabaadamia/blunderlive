from __future__ import annotations

from uuid import UUID

from app.core.client import PlayerProfile, PlayerProfileClient


class StaticPlayerProfileClient:
    def __init__(
        self,
        profiles: dict[UUID, PlayerProfile] | None = None,
    ) -> None:
        self.profiles = profiles or {}

    async def fetch_game_players(
        self,
        *,
        user_ids: list[UUID],
        rating_category: str | None,
    ) -> dict[UUID, PlayerProfile]:
        resolved: dict[UUID, PlayerProfile] = {}
        for user_id in user_ids:
            if user_id in self.profiles:
                resolved[user_id] = self.profiles[user_id]
                continue

            resolved[user_id] = PlayerProfile(
                user_id=user_id,
                username=f"player-{str(user_id)[:8]}",
                rating=1200 if rating_category is not None else None,
            )

        return resolved
