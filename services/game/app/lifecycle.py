from contextlib import asynccontextmanager
import asyncio
import logging

from fastapi import FastAPI
from redis.asyncio import Redis

from .game.connection_manager import ConnectionManager
from .game.pubsub import relay_game_events
from .config import get_settings
from .matchmaking.repository import MatchmakingRepository

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()

    redis_client = Redis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True,
    )

    await redis_client.ping()

    app.state.redis = redis_client
    app.state.settings = settings
    app.state.connection_manager = ConnectionManager()
    app.state.matchmaking_repository = MatchmakingRepository(
        redis_client,
        games_finished_stream=settings.games_finished_stream,
    )

    relay_task = asyncio.create_task(
        relay_game_events(
            redis=redis_client,
            manager=app.state.connection_manager,
        )
    )

    logger.info(
        "game service startup complete",
        extra={"service": settings.app_name},
    )

    try:
        yield
    finally:
        logger.info(
            "game service shutdown starting",
            extra={"service": settings.app_name},
        )

        background_tasks = [
            relay_task,
        ]

        for task in background_tasks:
            task.cancel()

        for task in background_tasks:
            try:
                await task
            except asyncio.CancelledError:
                pass

        await redis_client.aclose()
