from contextlib import asynccontextmanager

from fastapi import FastAPI
from redis.asyncio import Redis

from .config import get_settings
from .routers import system


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    redis_client = Redis.from_url(settings.redis_url, encoding="utf-8", decode_responses=True)
    await redis_client.ping()
    app.state.redis = redis_client

    try:
        yield
    finally:
        await redis_client.aclose()


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="BlunderLive Game Service",
        lifespan=lifespan,
    )

    app.include_router(system.router)

    @app.get("/", tags=["system"])
    async def root() -> dict[str, str]:
        return {
            "service": settings.app_name,
            "environment": settings.app_env,
            "status": "ok",
        }

    return app
