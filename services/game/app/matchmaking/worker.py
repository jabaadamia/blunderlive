import asyncio
import logging

from .service import MatchmakingService

logger = logging.getLogger(__name__)


async def matchmaking_worker(service: MatchmakingService) -> None:
    while True:
        try:
            await service.run_matchmaking_cycle()
        except Exception:
            logger.exception("matchmaking_worker_failed")

        await asyncio.sleep(1)