from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All configuration comes from environment variables (or a local .env file).

    The app refuses to start if DATABASE_URL or a strong JWT_SECRET is missing.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: str = Field(min_length=32)
    jwt_expires_minutes: int = 60
    login_rate_limit: int = 10
    login_rate_window_seconds: int = 900
    cors_origins: str = "http://localhost:5173"
    # Connection pool size. A normal server keeps up to 10 connections open. On AWS
    # Lambda every running copy of the function has its own pool, so we keep each
    # one tiny (for example 0 to 2) to avoid exhausting the database's connection limit.
    db_pool_min_size: int = Field(default=1, ge=0)
    db_pool_max_size: int = Field(default=10, ge=1)

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
