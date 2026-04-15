import os

import dj_database_url

from .base import *  # noqa: F403


SECRET_KEY = os.environ["CORE_SECRET_KEY"]
DEBUG = False
ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get("CORE_ALLOWED_HOSTS", "").split(",")
    if host.strip()
]
CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("CORE_CSRF_TRUSTED_ORIGINS", "").split(",")
    if origin.strip()
]
DATABASES["default"] = dj_database_url.parse(  # type: ignore[name-defined]
    os.environ["CORE_DATABASE_URL"],
    conn_max_age=600,
)
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = env_bool("CORE_SECURE_COOKIES", False)  # type: ignore[name-defined]
CSRF_COOKIE_SECURE = env_bool("CORE_SECURE_COOKIES", False)  # type: ignore[name-defined]
SECURE_SSL_REDIRECT = env_bool("CORE_SECURE_SSL_REDIRECT", False)  # type: ignore[name-defined]
SECURE_HSTS_SECONDS = int(os.environ.get("CORE_SECURE_HSTS_SECONDS", "0"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool(  # type: ignore[name-defined]
    "CORE_SECURE_HSTS_INCLUDE_SUBDOMAINS",
    False,
)
SECURE_HSTS_PRELOAD = env_bool("CORE_SECURE_HSTS_PRELOAD", False)  # type: ignore[name-defined]
