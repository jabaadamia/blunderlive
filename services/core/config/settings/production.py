from .base import *  # noqa: F403

import os

import dj_database_url


SECRET_KEY = os.environ["CORE_SECRET_KEY"]
DEBUG = False
ALLOWED_HOSTS = [host.strip() for host in os.environ.get("CORE_ALLOWED_HOSTS", "").split(",") if host.strip()]
DATABASES["default"] = dj_database_url.parse(os.environ["CORE_DATABASE_URL"], conn_max_age=600)  # type: ignore[name-defined]
