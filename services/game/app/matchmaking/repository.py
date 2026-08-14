from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

import chess
from redis.asyncio import Redis

from ..domain.enums import GameStatus
from ..domain.exceptions import GameNotFoundError
from ..domain.models import GameSnapshot

FINISHED_GAME_SNAPSHOT_TTL_SECONDS = 1800
GAME_DEADLINES_KEY = "game:deadlines"


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
    def __init__(
        self,
        redis: Redis,
        *,
        games_finished_stream: str = "games.finished",
    ) -> None:
        self.redis = redis
        self.games_finished_stream = games_finished_stream

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
    def _match_found_key(user_id: UUID) -> str:
        return f"matchmaking:match_found:{user_id}"

    @staticmethod
    def _bucket_scan_pattern() -> str:
        return "matchmaking:queue:*"

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
                    self._write_deadline(pipe, snapshot)

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
        async with self.redis.pipeline(transaction=True) as pipe:
            pipe.set(
                self._game_snapshot_key(snapshot.game_id),
                snapshot.model_dump_json(),
            )
            self._write_deadline(pipe, snapshot)
            await pipe.execute()

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
        finished_game_event: dict[str, str] | None = None,
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
                    self._write_deadline(pipe, snapshot)

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
                        if finished_game_event is not None:
                            pipe.xadd(
                                self.games_finished_stream,
                                finished_game_event,
                                maxlen=10000,
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

    async def fetch_due_deadlines(self, *, now_ms: int) -> list[tuple[UUID, int]]:
        entries = await self.redis.zrangebyscore(
            GAME_DEADLINES_KEY,
            0,
            now_ms,
            withscores=True,
        )
        return [
            (UUID(str(game_id)), int(deadline_ms))
            for game_id, deadline_ms in entries
        ]

    async def remove_deadline_if_score(
        self,
        *,
        game_id: UUID,
        deadline_ms: int,
    ) -> bool:
        while True:
            try:
                async with self.redis.pipeline(transaction=True) as pipe:
                    await pipe.watch(GAME_DEADLINES_KEY)
                    current_score = await pipe.zscore(GAME_DEADLINES_KEY, str(game_id))

                    if current_score is None or int(current_score) != deadline_ms:
                        await pipe.unwatch()
                        return False

                    pipe.multi()
                    pipe.zrem(GAME_DEADLINES_KEY, str(game_id))
                    await pipe.execute()
                    return True

            except Exception as exc:
                from redis.exceptions import WatchError

                if isinstance(exc, WatchError):
                    continue
                raise

    @classmethod
    def _deadline_ms_for_snapshot(cls, snapshot: GameSnapshot) -> int | None:
        if (
            snapshot.status != GameStatus.ACTIVE
            or snapshot.initial_time_ms == 0
            or snapshot.turn_started_at is None
        ):
            return None

        is_white_turn = chess.Board(snapshot.fen).turn == chess.WHITE
        remaining_ms = (
            snapshot.white_time_left_ms if is_white_turn else snapshot.black_time_left_ms
        )
        return int(snapshot.turn_started_at.timestamp() * 1000) + remaining_ms

    @classmethod
    def _write_deadline(cls, pipe, snapshot: GameSnapshot) -> None:
        deadline_ms = cls._deadline_ms_for_snapshot(snapshot)
        if deadline_ms is None:
            pipe.zrem(GAME_DEADLINES_KEY, str(snapshot.game_id))
            return

        pipe.zadd(GAME_DEADLINES_KEY, {str(snapshot.game_id): deadline_ms})
