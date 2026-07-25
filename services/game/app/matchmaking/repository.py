from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from redis.asyncio import Redis

from ..domain.enums import GameStatus
from ..domain.exceptions import GameNotFoundError
from ..domain.models import GameSnapshot

FINISHED_GAME_SNAPSHOT_TTL_SECONDS = 1800


def build_time_control_bucket(rated: bool, initial_time_ms: int, increment_ms: int) -> str:
    rated_label = "rated" if rated else "casual"
    return f"{rated_label}_{initial_time_ms}_{increment_ms}"


def parse_time_control_bucket(queue_bucket: str) -> tuple[bool, int, int]:
    rated_label, initial_time_ms, increment_ms = queue_bucket.split("_", maxsplit=2)
    return (
        rated_label == "rated",
        int(initial_time_ms),
        int(increment_ms),
    )


class MatchmakingRepositoryError(Exception):
    """Base error for matchmaking repository operations."""


class DuplicateQueueEntryError(MatchmakingRepositoryError):
    """Raised when a player is already queued."""


class PlayerInActiveGameError(MatchmakingRepositoryError):
    """Raised when a player tries to queue while already in active game."""


@dataclass(frozen=True)
class QueueStatus:
    is_queued: bool
    queue: str | None = None
    rated: bool | None = None
    initial_time_ms: int | None = None
    increment_ms: int | None = None
    joined_at: datetime | None = None
    active_game_id: str | None = None


class MatchmakingRepository:
    def __init__(self, redis: Redis) -> None:
        self.redis = redis

    @staticmethod
    def _entry_key(user_id: UUID) -> str:
        return f"matchmaking:entry:{user_id}"

    @staticmethod
    def _active_game_key(user_id: UUID) -> str:
        return f"matchmaking:active_game:{user_id}"

    @staticmethod
    def _queue_key(queue_bucket: str) -> str:
        return f"matchmaking:queue:{queue_bucket}"

    @staticmethod
    def _game_snapshot_key(game_id: UUID) -> str:
        return f"game:snapshot:{game_id}"

    @staticmethod
    def _finished_game_pending_key(game_id: UUID) -> str:
        return f"game:finished_pending:{game_id}"
    
    @staticmethod
    def _match_found_key(user_id: UUID) -> str:
        return f"matchmaking:match_found:{user_id}"

    @staticmethod
    def _bucket_scan_pattern() -> str:
        return "matchmaking:queue:*"

    @staticmethod
    def _finished_game_pending_pattern() -> str:
        return "game:finished_pending:*"
    
    async def enqueue_player(
        self,
        *,
        user_id: UUID,
        rated: bool,
        initial_time_ms: int,
        increment_ms: int,
    ) -> str:
        active_game_id = await self.redis.get(self._active_game_key(user_id))
        if active_game_id:
            raise PlayerInActiveGameError("player_in_active_game")

        queue_bucket = build_time_control_bucket(
            rated=rated,
            initial_time_ms=initial_time_ms,
            increment_ms=increment_ms,
        )

        queue_key = self._queue_key(queue_bucket)
        entry_key = self._entry_key(user_id)

        joined_at = datetime.now(UTC)

        while True:
            try:
                async with self.redis.pipeline(transaction=True) as pipe:
                    await pipe.watch(entry_key)

                    existing_entry = await pipe.hgetall(entry_key) # type: ignore
                    if existing_entry:
                        raise DuplicateQueueEntryError("player_already_queued")

                    pipe.multi()

                    pipe.zadd(
                        queue_key,
                        {str(user_id): joined_at.timestamp()},
                    )

                    pipe.hset(
                        entry_key,
                        mapping={
                            "queue": queue_bucket,
                            "rated": str(rated).lower(),
                            "initial_time_ms": str(initial_time_ms),
                            "increment_ms": str(increment_ms),
                            "joined_at": joined_at.isoformat(),
                        },
                    )

                    await pipe.execute()
                    return queue_bucket

            except Exception as exc:
                from redis.exceptions import WatchError

                if isinstance(exc, WatchError):
                    continue
                raise

    async def remove_player(self, *, user_id: UUID) -> bool:
        entry_key = self._entry_key(user_id)
        existing_entry = await self.redis.hgetall(entry_key) # type: ignore
        if not existing_entry:
            return False

        queue_bucket = existing_entry["queue"]
        queue_key = self._queue_key(queue_bucket)
        async with self.redis.pipeline(transaction=True) as pipe:
            pipe.zrem(queue_key, str(user_id))
            pipe.delete(entry_key)
            await pipe.execute()
        return True
    
    async def fetch_waiting_players(
        self,
        *,
        queue_bucket: str,
        limit: int = 2,
    ) -> list[str]:
        queue_key = self._queue_key(queue_bucket)

        players = await self.redis.zrange(queue_key, 0, limit - 1)
        return list(players)
    
    async def try_create_match(
        self,
        *,
        queue_bucket: str,
        player_one_id: str,
        player_two_id: str,
        snapshot: GameSnapshot,
    ) -> bool:
        queue_key = self._queue_key(queue_bucket)

        player_one_entry_key = self._entry_key(UUID(player_one_id))
        player_two_entry_key = self._entry_key(UUID(player_two_id))

        player_one_active_key = self._active_game_key(UUID(player_one_id))
        player_two_active_key = self._active_game_key(UUID(player_two_id))
        snapshot_key = self._game_snapshot_key(snapshot.game_id)

        while True:
            try:
                async with self.redis.pipeline(transaction=True) as pipe:
                    await pipe.watch(
                        queue_key,
                        player_one_entry_key,
                        player_two_entry_key,
                    )

                    queue_members = await pipe.zrange(queue_key, 0, 1)

                    if len(queue_members) < 2:
                        await pipe.unwatch()
                        return False

                    if queue_members[0] != player_one_id:
                        await pipe.unwatch()
                        return False

                    if queue_members[1] != player_two_id:
                        await pipe.unwatch()
                        return False

                    player_one_entry = await pipe.exists(player_one_entry_key)
                    player_two_entry = await pipe.exists(player_two_entry_key)

                    if not player_one_entry or not player_two_entry:
                        await pipe.unwatch()
                        return False

                    pipe.multi()

                    pipe.zrem(queue_key, player_one_id, player_two_id)

                    pipe.delete(player_one_entry_key)
                    pipe.delete(player_two_entry_key)

                    pipe.set(player_one_active_key, str(snapshot.game_id))
                    pipe.set(player_two_active_key, str(snapshot.game_id))
                    pipe.set(snapshot_key, snapshot.model_dump_json())

                    await pipe.execute()
                    return True

            except Exception as exc:
                from redis.exceptions import WatchError

                if isinstance(exc, WatchError):
                    continue
                raise

    async def create_game_snapshot(
        self,
        *,
        snapshot: GameSnapshot,
    ) -> None:
        await self.redis.set(
            self._game_snapshot_key(snapshot.game_id),
            snapshot.model_dump_json(),
        )

    async def fetch_game_snapshot(self, *, game_id: UUID) -> GameSnapshot:
        payload = await self.redis.get(self._game_snapshot_key(game_id))
        if not payload:
            raise GameNotFoundError("game_not_found")

        return GameSnapshot.model_validate_json(payload)

    async def save_game_snapshot(
        self,
        *,
        expected_version: int,
        snapshot: GameSnapshot,
    ) -> bool:
        snapshot_key = self._game_snapshot_key(snapshot.game_id)

        while True:
            try:
                async with self.redis.pipeline(transaction=True) as pipe:
                    await pipe.watch(snapshot_key)

                    current_payload = await pipe.get(snapshot_key)

                    if not current_payload:
                        raise GameNotFoundError("game_not_found")

                    current_snapshot = GameSnapshot.model_validate_json(
                        current_payload
                    )

                    if current_snapshot.version != expected_version:
                        await pipe.unwatch()
                        return False

                    pipe.multi()

                    pipe.set(
                        snapshot_key,
                        snapshot.model_dump_json(),
                    )

                    if snapshot.status != GameStatus.ACTIVE:
                        pipe.delete(
                            self._active_game_key(snapshot.white.user_id)
                        )
                        pipe.delete(
                            self._active_game_key(snapshot.black.user_id)
                        )
                        pipe.expire(
                            snapshot_key,
                            FINISHED_GAME_SNAPSHOT_TTL_SECONDS,
                        )

                    if snapshot.status == GameStatus.FINISHED:
                        pipe.set(
                            self._finished_game_pending_key(snapshot.game_id),
                            snapshot.model_dump_json(),
                        )

                    await pipe.execute()
                    return True

            except Exception as exc:
                from redis.exceptions import WatchError

                if isinstance(exc, WatchError):
                    continue

                raise

    async def fetch_active_buckets(self) -> list[str]:
        keys: list[str] = []
    
        async for key in self.redis.scan_iter(match=self._bucket_scan_pattern()):
            keys.append(key)
    
        buckets = [key.replace("matchmaking:queue:", "") for key in keys]
        return buckets

    async def fetch_queue_status(self, *, user_id: UUID) -> QueueStatus:
        active_game_id = await self.redis.get(self._active_game_key(user_id))
        entry = await self.redis.hgetall(self._entry_key(user_id)) # type: ignore
        if not entry:
            return QueueStatus(is_queued=False, active_game_id=active_game_id)

        return QueueStatus(
            is_queued=True,
            queue=entry["queue"],
            rated=entry["rated"] == "true",
            initial_time_ms=int(entry["initial_time_ms"]),
            increment_ms=int(entry["increment_ms"]),
            joined_at=(
                datetime.fromisoformat(entry["joined_at"])
                if entry.get("joined_at")
                else None
            ),
            active_game_id=active_game_id,
        )

    async def fetch_pending_finished_games(self, *, limit: int = 20) -> list[GameSnapshot]:
        snapshots: list[GameSnapshot] = []

        async for key in self.redis.scan_iter(match=self._finished_game_pending_pattern()):
            payload = await self.redis.get(key)
            if payload:
                snapshots.append(GameSnapshot.model_validate_json(payload))

            if len(snapshots) >= limit:
                break

        return snapshots

    async def clear_pending_finished_game(self, *, game_id: UUID) -> None:
        await self.redis.delete(self._finished_game_pending_key(game_id))
