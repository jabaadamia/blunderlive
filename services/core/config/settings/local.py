import os

from .base import *  # noqa: F403


SECRET_KEY = os.environ.get("CORE_SECRET_KEY")  # type: ignore[name-defined]
DEBUG = os.environ.get("CORE_DEBUG", "True").lower() == "true"
ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get("CORE_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
    if host.strip()
]
