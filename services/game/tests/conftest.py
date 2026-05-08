import os
from collections.abc import Iterator
from pathlib import Path

import pytest

from app.config import get_settings


def resolve_game_public_key_path() -> str:
    container_path = Path("/run/dev-jwt/public.pem")
    if container_path.exists():
        return str(container_path)

    return str((Path(__file__).resolve().parents[3] / "infra/dev-jwt/public.pem").resolve())


@pytest.fixture(autouse=True)
def game_test_env(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    get_settings.cache_clear()
    monkeypatch.setenv("APP_NAME", os.environ.get("APP_NAME", "blunderlive-game"))
    monkeypatch.setenv("APP_ENV", os.environ.get("APP_ENV", "development"))
    monkeypatch.setenv("APP_HOST", os.environ.get("APP_HOST", "0.0.0.0"))
    monkeypatch.setenv("GAME_PORT", os.environ.get("GAME_PORT", "8005"))
    monkeypatch.setenv("LOG_LEVEL", os.environ.get("LOG_LEVEL", "INFO"))
    monkeypatch.setenv("REDIS_URL", os.environ.get("REDIS_URL", "redis://localhost:6379/0"))
    monkeypatch.setenv(
        "CORS_ALLOWED_ORIGINS",
        os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:3000"),
    )
    monkeypatch.setenv(
        "CORE_INTERNAL_BASE_URL",
        os.environ.get("CORE_INTERNAL_BASE_URL", "http://core:8000"),
    )
    monkeypatch.setenv("GAME_JWT_PUBLIC_KEY_PATH", resolve_game_public_key_path())
    yield
    get_settings.cache_clear()
