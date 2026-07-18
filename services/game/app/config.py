from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = Field(default="blunderlive-game", validation_alias="APP_NAME")
    app_env: str = Field(default="development", validation_alias="APP_ENV")
    app_host: str = Field(default="0.0.0.0", validation_alias="APP_HOST")
    game_port: int = Field(default=8005, validation_alias="GAME_PORT")
    log_level: str = Field(default="INFO", validation_alias="LOG_LEVEL")
    redis_url: str = Field(validation_alias="REDIS_URL")
    cors_allowed_origins: str = Field(
        default="http://localhost:3000",
        validation_alias="CORS_ALLOWED_ORIGINS",
    )
    jwt_public_key_path: str = Field(validation_alias="GAME_JWT_PUBLIC_KEY_PATH")
    core_api_base_url: str = Field(
        default="http://core:8000",
        validation_alias="CORE_API_BASE_URL",
    )
    games_finished_stream: str = Field(
        default="games.finished",
        validation_alias="CORE_GAMES_FINISHED_STREAM",
    )
    games_processed_stream: str = Field(
        default="games.processed",
        validation_alias="CORE_GAMES_PROCESSED_STREAM",
    )
    games_processed_consumer_group: str = Field(
        default="game-rating-updates",
        validation_alias="GAME_GAMES_PROCESSED_CONSUMER_GROUP",
    )

    model_config = SettingsConfigDict(case_sensitive=False)


@lru_cache
def get_settings() -> Settings:
    return Settings() # type: ignore
