from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="INSIDER_", env_file=".env", extra="ignore")

    # SEC requires a descriptive User-Agent with contact info.
    sec_user_agent: str = "SecInsiderScout/0.1 (research; contact@example.com)"
    lookback_days: int = 14
    max_filings: int = 80
    min_buy_value: float = 25_000.0
    request_timeout_seconds: float = 30.0
    cache_ttl_seconds: int = 900
    host: str = "0.0.0.0"
    port: int = 8080


@lru_cache
def get_settings() -> Settings:
    return Settings()
