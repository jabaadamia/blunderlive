from contextlib import asynccontextmanager
import asyncio
import logging

from fastapi import FastAPI
from redis.asyncio import Redis

from .chess.service import ChessGameService
from .core.client import HttpPlayerProfileClient, ResilientPlayerProfileClient
from .game.clock_watchdog import ClockWatchdogManager
from .game.connection_manager import ConnectionManager
from .game.finished_worker import finished_game_publisher_worker
from .game.processed_worker import processed_game_worker
from .game.service import GameSessionService
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
    game_session_service = GameSessionService(matchmaking_repository, chess_service)
    app.state.clock_watchdog_manager = ClockWatchdogManager(
        session_service=game_session_service,
        manager=app.state.connection_manager,
    )

    player_client = ResilientPlayerProfileClient(
        HttpPlayerProfileClient(base_url=settings.core_api_base_url)
    )
    matchmaking_service = MatchmakingService(
        matchmaking_repository,
        chess_service,
        player_client,
    )

    matchmaking_task = asyncio.create_task(
        matchmaking_worker(matchmaking_service)
    )
    finished_game_publisher_task = asyncio.create_task(
        finished_game_publisher_worker(
            repository=matchmaking_repository,
            redis=redis_client,
            chess_service=chess_service,
            stream=settings.games_finished_stream,
        )
    )
    processed_game_task = asyncio.create_task(
        processed_game_worker(
            redis=redis_client,
            manager=app.state.connection_manager,
            stream=settings.games_processed_stream,
            group=settings.games_processed_consumer_group,
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

        app.state.clock_watchdog_manager.cancel_all()

        background_tasks = [
            matchmaking_task,
            finished_game_publisher_task,
            processed_game_task,
        ]

        for task in background_tasks:
            task.cancel()

        for task in background_tasks:
            try:
                await task
            except asyncio.CancelledError:
                pass

        await redis_client.aclose()
