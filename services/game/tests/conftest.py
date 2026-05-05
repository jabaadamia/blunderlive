import os
from pathlib import Path

import pytest


def resolve_game_public_key_path() -> str:
    container_path = Path("/run/dev-jwt/public.pem")
    if container_path.exists():
        return str(container_path)

    return str((Path(__file__).resolve().parents[3] / "infra/dev-jwt/public.pem").resolve())


os.environ.setdefault("GAME_JWT_PUBLIC_KEY_PATH", resolve_game_public_key_path())


@pytest.fixture(autouse=True)
def game_test_env(monkeypatch):
    monkeypatch.setenv("GAME_JWT_PUBLIC_KEY_PATH", resolve_game_public_key_path())
