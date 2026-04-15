from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.openapi.docs import (
    get_swagger_ui_html,
    get_swagger_ui_oauth2_redirect_html,
)
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
        docs_url=None,
    )

    app.include_router(system.router)

    @app.get("/docs", include_in_schema=False)
    async def swagger_ui_html():
        return get_swagger_ui_html(
            openapi_url="openapi.json",
            title=f"{app.title} - Swagger UI",
            oauth2_redirect_url="docs/oauth2-redirect",
        )

    @app.get("/docs/oauth2-redirect", include_in_schema=False)
    async def swagger_ui_redirect():
        return get_swagger_ui_oauth2_redirect_html()

    @app.get("/", tags=["system"])
    async def root() -> dict[str, str]:
        return {
            "service": settings.app_name,
            "environment": settings.app_env,
            "status": "ok",
        }

    return app
