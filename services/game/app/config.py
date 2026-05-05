from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "blunderlive-game"
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    game_port: int = 8005
    log_level: str = "INFO"
    redis_url: str = "redis://redis:6379/0"
    cors_allowed_origins: str = "http://localhost:3000"
    jwt_public_key_path: str = Field(validation_alias="GAME_JWT_PUBLIC_KEY_PATH")
    core_internal_base_url: str = Field(
        default="http://core:8000",
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
