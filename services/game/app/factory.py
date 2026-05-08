from fastapi import FastAPI
from fastapi.openapi.docs import (
    get_swagger_ui_html,
    get_swagger_ui_oauth2_redirect_html,
)

from .matchmaking import router as matchmaking_router

from .config import get_settings
from .lifecycle import lifespan
from .logging import configure_logging
from .routers import system


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(
        title="BlunderLive Game Service",
        lifespan=lifespan,
        docs_url=None,
    )

    app.include_router(system.router)
    app.include_router(matchmaking_router.router)

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
            "auth_algorithm": "RS256",
            "status": "ok",
        }

    return app
