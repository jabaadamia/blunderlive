from fastapi import APIRouter, Depends
from redis.asyncio import Redis

from ..dependencies import get_redis

router = APIRouter(tags=["system"])


@router.get("/health")
async def health(redis: Redis = Depends(get_redis)) -> dict[str, str]:
    await redis.ping()
    return {"status": "ok"}
