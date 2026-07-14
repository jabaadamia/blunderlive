import os
from datetime import timedelta
from pathlib import Path

import dj_database_url

BASE_DIR = Path(__file__).resolve().parents[2]


def env_bool(name: str, default: bool = False) -> bool:
    return os.environ.get(name, str(default)).lower() in {"1", "true", "yes", "on"}


SECRET_KEY = os.environ.get("CORE_SECRET_KEY")
DEBUG = False
ALLOWED_HOSTS = ["localhost", "127.0.0.1"]

DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "drf_spectacular",
    "rest_framework_simplejwt.token_blacklist",
]

LOCAL_APPS = [
    "accounts.apps.AccountsConfig",
    "users.apps.UsersConfig",
    "ratings.apps.RatingsConfig",
    "games.apps.GamesConfig",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

CORE_DATABASE_URL = os.environ["CORE_DATABASE_URL"]
CORE_JWT_PRIVATE_KEY_PATH = os.environ["CORE_JWT_PRIVATE_KEY_PATH"]
CORE_JWT_PUBLIC_KEY_PATH = os.environ["CORE_JWT_PUBLIC_KEY_PATH"]
CORE_REDIS_URL = os.environ.get("REDIS_URL")
CORE_GAMES_FINISHED_STREAM = os.environ.get("CORE_GAMES_FINISHED_STREAM", "games.finished")
CORE_GAMES_PROCESSED_STREAM = os.environ.get("CORE_GAMES_PROCESSED_STREAM", "games.processed")
CORE_GAMES_FAILED_STREAM = os.environ.get("CORE_GAMES_FAILED_STREAM", "games.failed")
CORE_GAMES_CONSUMER_GROUP = os.environ.get("CORE_GAMES_CONSUMER_GROUP", "core-game-processing")

DATABASES = {
    "default": dj_database_url.parse(CORE_DATABASE_URL, conn_max_age=600)
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "users.User"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.BasicAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "ALGORITHM": "RS256",
    "SIGNING_KEY": Path(CORE_JWT_PRIVATE_KEY_PATH).read_text(encoding="utf-8"),
    "VERIFYING_KEY": Path(CORE_JWT_PUBLIC_KEY_PATH).read_text(encoding="utf-8"),
}

SPECTACULAR_SETTINGS = {
    "TITLE": "BlunderLive Core API",
    "DESCRIPTION": "HTTP API for the BlunderLive core service.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "SCHEMA_PATH_PREFIX": r"/api",
    "TAGS": [
        {"name": "health", "description": "Liveness and readiness style checks."},
        {"name": "auth", "description": "Authentication-related endpoints."},
        {"name": "users", "description": "User-related endpoints."},
        {"name": "ratings", "description": "User ratings and rating history."},
        {"name": "games", "description": "Finished games."},
    ],
    "APPEND_COMPONENTS": {
        "securitySchemes": {
            "jwtAuth": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT",
                "description": "JWT access token: `Authorization: Bearer <access>`",
            }
        }
    },
}
