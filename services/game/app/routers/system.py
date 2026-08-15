from fastapi import APIRouter, Depends, Response, status
from redis.asyncio import Redis

from ..config import get_settings
from ..dependencies import get_redis

router = APIRouter(tags=["system"])


@router.get("/health/live")
async def health_live() -> dict[str, str]:
    settings = get_settings()
    return {
        "status": "ok",
        "service": settings.app_name,
        "auth_algorithm": "RS256",
    }


@router.get("/health/ready")
async def health_ready(
    response: Response,
    redis: Redis = Depends(get_redis),
) -> dict[str, str]:
    settings = get_settings()
    try:
        await redis.ping()
    except Exception:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "status": "error",
            "service": settings.app_name,
            "redis": "error",
        }

    return {
        "status": "ok",
        "service": settings.app_name,
        "redis": "ok",
    }
