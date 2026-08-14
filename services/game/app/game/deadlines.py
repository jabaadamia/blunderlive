from __future__ import annotations

import asyncio
import logging
import time

from redis.asyncio import Redis

from ..chess.service import ChessGameService
from ..domain.enums import GameStatus
from ..domain.exceptions import GameNotFoundError
from ..leases import acquire_lease, release_lease, renew_lease_loop
from ..matchmaking.repository import MatchmakingRepository
from ..schemas.ws_out import GameOverMessage
from .pubsub import publish_game_event
from .service import GameSessionService

logger = logging.getLogger(__name__)


async def deadline_sweep_worker(
    *,
    redis: Redis,
    repository: MatchmakingRepository,
    chess_service: ChessGameService,
    replica_id: str | None = None,
) -> None:
    session_service = GameSessionService(repository, chess_service)

    while True:
        try:
            if replica_id is None:
                await sweep_deadlines(
                    redis=redis,
                    repository=repository,
                    session_service=session_service,
                )
            elif await acquire_lease(
                redis=redis,
                key="game:deadlines:lease",
                owner=replica_id,
                ttl_ms=5000,
            ):
                renewal_task = asyncio.create_task(
                    renew_lease_loop(
                        redis=redis,
                        key="game:deadlines:lease",
                        owner=replica_id,
                        ttl_ms=5000,
                        interval_ms=2000,
                    )
                )
                try:
                    await sweep_deadlines(
                        redis=redis,
                        repository=repository,
                        session_service=session_service,
                    )
                finally:
                    renewal_task.cancel()
                    try:
                        await renewal_task
                    except asyncio.CancelledError:
                        pass
                    await release_lease(
                        redis=redis,
                        key="game:deadlines:lease",
                        owner=replica_id,
                    )
        except Exception:
            logger.exception("deadline_sweep_failed")

        await asyncio.sleep(1)


async def sweep_deadlines(
    *,
    redis: Redis,
    repository: MatchmakingRepository,
    session_service: GameSessionService,
) -> int:
    now_ms = int(time.time() * 1000)
    due = await repository.fetch_due_deadlines(now_ms=now_ms)
    finished_count = 0

    for game_id, deadline_ms in due:
        try:
            snapshot = await repository.fetch_game_snapshot(game_id=game_id)
        except GameNotFoundError:
            await repository.remove_deadline_if_score(
                game_id=game_id,
                deadline_ms=deadline_ms,
            )
            continue

        if snapshot.status != GameStatus.ACTIVE:
            await repository.remove_deadline_if_score(
                game_id=game_id,
                deadline_ms=deadline_ms,
            )
            continue

        timed_out = await session_service.check_timeout(
            game_id=game_id,
            expected_version=snapshot.version,
        )

        if timed_out is None:
            await repository.remove_deadline_if_score(
                game_id=game_id,
                deadline_ms=deadline_ms,
            )
            continue

        await publish_game_event(
            redis=redis,
            game_id=game_id,
            message=GameOverMessage(state=timed_out),
        )
        finished_count += 1

    return finished_count
