from contextlib import asynccontextmanager
import asyncio
import logging

from fastapi import FastAPI
from redis.asyncio import Redis

from .chess.service import ChessGameService
from .game.connection_manager import ConnectionManager
from .config import get_settings
from .matchmaking.repository import MatchmakingRepository
from .matchmaking.service import MatchmakingService
from .matchmaking.worker import matchmaking_worker

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

    matchmaking_repository = MatchmakingRepository(redis_client)
    chess_service = ChessGameService()
    matchmaking_service = MatchmakingService(matchmaking_repository, chess_service)

    matchmaking_task = asyncio.create_task(
        matchmaking_worker(matchmaking_service)
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

        matchmaking_task.cancel()

        try:
            await matchmaking_task
        except asyncio.CancelledError:
            pass

        await redis_client.aclose()
