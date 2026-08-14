from __future__ import annotations

import asyncio
import logging
import socket
import sys

from redis.asyncio import Redis

from .chess.service import ChessGameService
from .config import get_settings
from .core.client import HttpPlayerProfileClient, ResilientPlayerProfileClient
from .game.deadlines import deadline_sweep_worker
from .game.processed_worker import processed_game_worker
from .logging import configure_logging
from .matchmaking.repository import MatchmakingRepository
from .matchmaking.service import MatchmakingService
from .matchmaking.worker import matchmaking_worker

logger = logging.getLogger(__name__)


async def healthcheck() -> None:
    settings = get_settings()
    redis_client = Redis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True,
    )
    try:
        await redis_client.ping()
    finally:
        await redis_client.aclose()


async def main() -> None:
    settings = get_settings()
    configure_logging(settings.log_level)

    redis_client = Redis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True,
    )
    await redis_client.ping()

    chess_service = ChessGameService()
    repository = MatchmakingRepository(
        redis_client,
        games_finished_stream=settings.games_finished_stream,
    )
    player_client = ResilientPlayerProfileClient(
        HttpPlayerProfileClient(base_url=settings.core_api_base_url)
    )
    matchmaking_service = MatchmakingService(
        repository,
        chess_service,
        player_client,
    )

    replica_id = socket.gethostname()
    tasks = [
        asyncio.create_task(
            matchmaking_worker(
                matchmaking_service,
                redis=redis_client,
                replica_id=replica_id,
            )
        ),
        asyncio.create_task(
            deadline_sweep_worker(
                redis=redis_client,
                repository=repository,
                chess_service=chess_service,
                replica_id=replica_id,
            )
        ),
        asyncio.create_task(
            processed_game_worker(
                redis=redis_client,
                stream=settings.games_processed_stream,
                group=settings.games_processed_consumer_group,
            )
        ),
    ]

    logger.info("game worker startup complete")

    try:
        await asyncio.gather(*tasks)
    finally:
        for task in tasks:
            task.cancel()

        for task in tasks:
            try:
                await task
            except asyncio.CancelledError:
                pass

        await redis_client.aclose()


if __name__ == "__main__":
    if "--healthcheck" in sys.argv:
        asyncio.run(healthcheck())
    else:
        asyncio.run(main())
