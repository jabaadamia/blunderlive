from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from redis.asyncio import Redis

from .config import get_settings

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
    logger.info("game service startup complete", extra={"service": settings.app_name})

    try:
        yield
    finally:
        logger.info("game service shutdown starting", extra={"service": settings.app_name})
        await redis_client.aclose()
