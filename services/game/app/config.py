from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "blunderlive-game"
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    game_port: int = 8005
    log_level: str = "INFO"
    redis_url: str = "redis://redis:6379/0"
    cors_allowed_origins: str = "http://localhost:3000"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
