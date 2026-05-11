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
    os.environ.setdefault("CORE_INTERNAL_BASE_URL", "http://core:8000")


set_default_game_test_env()
