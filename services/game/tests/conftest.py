import os
from pathlib import Path


def resolve_game_public_key_path() -> str:
    container_path = Path("/run/dev-jwt/public.pem")
    if container_path.exists():
        return str(container_path)

    return str((Path(__file__).resolve().parents[3] / "infra/dev-jwt/public.pem").resolve())

def set_default_game_test_env() -> None:
    os.environ.setdefault("REDIS_URL", "redis://redis:6379/15")
    os.environ.setdefault("GAME_JWT_PUBLIC_KEY_PATH", resolve_game_public_key_path())
    os.environ.setdefault("CORE_GAMES_FINISHED_STREAM", "games.finished")
    os.environ.setdefault("CORE_GAMES_PROCESSED_STREAM", "games.processed")
    os.environ.setdefault("GAME_GAMES_PROCESSED_CONSUMER_GROUP", "game-rating-updates")
    os.environ.setdefault("CORE_API_BASE_URL", "http://core:8000")


set_default_game_test_env()
