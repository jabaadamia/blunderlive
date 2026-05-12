from fastapi import Depends
from redis.asyncio import Redis
from starlette.requests import HTTPConnection

from .chess.service import ChessGameService
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
) -> MatchmakingService:
    return MatchmakingService(repository, chess_service)


def get_game_session_service(
    repository: MatchmakingRepository = Depends(get_matchmaking_repository),
    chess_service: ChessGameService = Depends(get_chess_service),
) -> GameSessionService:
    return GameSessionService(repository, chess_service)


def get_connection_manager(conn: HTTPConnection) -> ConnectionManager:
    return conn.app.state.connection_manager
