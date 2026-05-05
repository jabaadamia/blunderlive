from fastapi import APIRouter, Depends
from redis.asyncio import Redis

from ..config import get_settings
from ..dependencies import get_redis

router = APIRouter(tags=["system"])


@router.get("/health")
async def health(redis: Redis = Depends(get_redis)) -> dict[str, str]:
    await redis.ping()
    settings = get_settings()
    return {
        "status": "ok",
        "service": settings.app_name,
        "redis": "ok",
        "auth_algorithm": "RS256",
    }
