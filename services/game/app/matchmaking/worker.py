import asyncio
import logging

from redis.asyncio import Redis

from ..leases import acquire_lease, release_lease, renew_lease_loop
from .service import MatchmakingService

logger = logging.getLogger(__name__)


async def matchmaking_worker(
    service: MatchmakingService,
    *,
    redis: Redis | None = None,
    replica_id: str | None = None,
) -> None:
    while True:
        try:
            if redis is None or replica_id is None:
                await service.run_matchmaking_cycle()
            elif await acquire_lease(
                redis=redis,
                key="matchmaking:lease",
                owner=replica_id,
                ttl_ms=5000,
            ):
                renewal_task = asyncio.create_task(
                    renew_lease_loop(
                        redis=redis,
                        key="matchmaking:lease",
                        owner=replica_id,
                        ttl_ms=5000,
                        interval_ms=2000,
                    )
                )
                try:
                    await service.run_matchmaking_cycle()
                finally:
                    renewal_task.cancel()
                    try:
                        await renewal_task
                    except asyncio.CancelledError:
                        pass
                    await release_lease(
                        redis=redis,
                        key="matchmaking:lease",
                        owner=replica_id,
                    )
        except Exception:
            logger.exception("matchmaking_worker_failed")

        await asyncio.sleep(1)
