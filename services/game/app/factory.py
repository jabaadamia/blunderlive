from fastapi import FastAPI

from .matchmaking import router as matchmaking_router
from .game import router as game_router

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
        root_path="/api/game",
    )

    app.include_router(system.router)
    app.include_router(matchmaking_router.router)
    app.include_router(game_router.router)

    @app.get("/", tags=["system"])
    async def root() -> dict[str, str]:
        return {
            "service": settings.app_name,
            "environment": settings.app_env,
            "auth_algorithm": "RS256",
            "status": "ok",
        }

    return app
