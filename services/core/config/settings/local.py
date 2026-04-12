import os
from pathlib import Path

from .base import *  # noqa: F403

BASE_DIR = Path(__file__).resolve().parents[3]

env_test = BASE_DIR / ".env.test"
env = BASE_DIR / ".env"

try:
    from dotenv import load_dotenv
    if env_test.exists():
        load_dotenv(env_test, override=True)
    elif env.exists():
        load_dotenv(env, override=True)
except ImportError:
    pass


SECRET_KEY = os.environ.get("CORE_SECRET_KEY")  # type: ignore[name-defined]
DEBUG = os.environ.get("CORE_DEBUG", "True").lower() == "true"
ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get("CORE_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
    if host.strip()
]
