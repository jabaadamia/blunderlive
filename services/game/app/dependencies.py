from fastapi import Depends
from redis.asyncio import Redis
from starlette.requests import HTTPConnection

from .chess.service import ChessGameService
from .core.client import HttpPlayerProfileClient, ResilientPlayerProfileClient
from .game.clock_watchdog import ClockWatchdogManager
from .game.connection_manager import ConnectionManager
from .config import Settings, get_settings
from .game.service import GameSessionService
from .matchmaking.repository import MatchmakingRepository
from .matchmaking.service import MatchmakingService


def get_redis(conn: HTTPConnection) -> Redis:
    return conn.app.state.redis


def get_settings_dependency() -> Settings:
    return get_settings()


def get_matchmaking_repository(conn: HTTPConnection) -> MatchmakingRepository:
    redis = conn.app.state.redis
    return MatchmakingRepository(redis)

def get_chess_service() -> ChessGameService:
    return ChessGameService()

def get_matchmaking_service(
    repository: MatchmakingRepository = Depends(get_matchmaking_repository),
    chess_service: ChessGameService = Depends(get_chess_service),
    settings: Settings = Depends(get_settings_dependency),
) -> MatchmakingService:
    player_client = ResilientPlayerProfileClient(
        HttpPlayerProfileClient(base_url=settings.core_api_base_url)
    )
    return MatchmakingService(repository, chess_service, player_client)


def get_game_session_service(
    repository: MatchmakingRepository = Depends(get_matchmaking_repository),
    chess_service: ChessGameService = Depends(get_chess_service),
) -> GameSessionService:
    return GameSessionService(repository, chess_service)


def get_connection_manager(conn: HTTPConnection) -> ConnectionManager:
    return conn.app.state.connection_manager


def get_clock_watchdog_manager(conn: HTTPConnection) -> ClockWatchdogManager:
    if not hasattr(conn.app.state, "clock_watchdog_manager"):
        repository = get_matchmaking_repository(conn)
        chess_service = get_chess_service()
        session_service = GameSessionService(repository, chess_service)
        manager = get_connection_manager(conn)
        conn.app.state.clock_watchdog_manager = ClockWatchdogManager(
            session_service=session_service,
            manager=manager,
        )
    return conn.app.state.clock_watchdog_manager
