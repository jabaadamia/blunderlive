from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = Field(validation_alias="APP_NAME")
    app_env: str = Field(validation_alias="APP_ENV")
    app_host: str = Field(validation_alias="APP_HOST")
    game_port: int = Field(validation_alias="GAME_PORT")
    log_level: str = Field(validation_alias="LOG_LEVEL")
    redis_url: str = Field(validation_alias="REDIS_URL")
    cors_allowed_origins: str = Field(validation_alias="CORS_ALLOWED_ORIGINS")
    jwt_public_key_path: str = Field(validation_alias="GAME_JWT_PUBLIC_KEY_PATH")
    core_internal_base_url: str = Field(
        validation_alias="CORE_INTERNAL_BASE_URL",
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
