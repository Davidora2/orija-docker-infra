from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    pin_agent_mode: Literal["dry_run", "live"] = "dry_run"
    pin_interval_hours: float = 2.0
    pin_quiet_start_hour: int | None = None
    pin_quiet_end_hour: int | None = None
    pin_timezone: str = "America/New_York"

    shopify_shop_domain: str = ""
    shopify_access_token: str = ""
    shopify_api_version: str = "2025-01"
    shopify_product_tag_filter: str = ""
    shopify_product_limit: int = 50

    pinterest_app_id: str = ""
    pinterest_app_secret: str = ""
    pinterest_access_token: str = ""
    pinterest_refresh_token: str = ""
    pinterest_board_id: str = ""
    pinterest_default_link: str = ""
    pinterest_use_sandbox: bool = False

    brand_name: str = "Orija"
    brand_voice: str = "warm, practical, SEO-friendly"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    data_dir: Path = Field(default=Path("/data"))
    config_dir: Path = Field(default=Path("/app/config"))

    @property
    def shopify_ready(self) -> bool:
        return bool(self.shopify_shop_domain and self.shopify_access_token)

    @property
    def pinterest_ready(self) -> bool:
        return bool(self.pinterest_access_token and self.pinterest_board_id)

    @property
    def pinterest_api_base(self) -> str:
        if self.pinterest_use_sandbox:
            return "https://api-sandbox.pinterest.com/v5"
        return "https://api.pinterest.com/v5"

    @property
    def tag_filters(self) -> list[str]:
        if not self.shopify_product_tag_filter.strip():
            return []
        return [t.strip().lower() for t in self.shopify_product_tag_filter.split(",") if t.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
