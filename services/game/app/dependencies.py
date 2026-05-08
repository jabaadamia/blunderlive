from fastapi import Depends, Request
from redis.asyncio import Redis

from .config import Settings, get_settings
from .matchmaking.repository import MatchmakingRepository
from .matchmaking.service import MatchmakingService

def get_redis(request: Request) -> Redis:
    return request.app.state.redis


def get_settings_dependency() -> Settings:
    return get_settings()


def get_matchmaking_repository(request: Request) -> MatchmakingRepository:
    redis = request.app.state.redis
    return MatchmakingRepository(redis)

def get_matchmaking_service(
    repository: MatchmakingRepository = Depends(get_matchmaking_repository),
) -> MatchmakingService:
    return MatchmakingService(repository)