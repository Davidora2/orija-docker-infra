from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class RiskConfig(BaseModel):
    max_position_pct: float = Field(
        default=0.10,
        description="Max fraction of equity in a single symbol",
        ge=0.01,
        le=1.0,
    )
    max_daily_loss_pct: float = Field(
        default=0.02,
        description="Halt trading if equity drops this much from day-start",
        ge=0.001,
        le=0.5,
    )
    max_open_positions: int = Field(default=5, ge=1, le=50)
    min_cash_reserve_pct: float = Field(default=0.20, ge=0.0, le=0.95)
    min_confidence: float = Field(default=0.55, ge=0.0, le=1.0)
    allow_short: bool = False
    cooldown_seconds: int = Field(default=60, ge=0)


class AgentConfig(BaseModel):
    symbols: list[str] = Field(default_factory=lambda: ["AAPL", "MSFT", "GOOGL", "SPY"])
    strategy: Literal["momentum", "mean_reversion", "hybrid"] = "hybrid"
    poll_interval_seconds: int = Field(default=60, ge=5)
    lookback_bars: int = Field(default=30, ge=5)
    dry_run: bool = True
    enable_llm: bool = False


class BrokerConfig(BaseModel):
    provider: Literal["paper", "alpaca"] = "paper"
    paper_mode: bool = True
    starting_cash: float = Field(default=100_000.0, gt=0)
    alpaca_base_url: str = "https://paper-api.alpaca.markets"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="TRADE_",
        extra="ignore",
    )

    broker: BrokerConfig = Field(default_factory=BrokerConfig)
    risk: RiskConfig = Field(default_factory=RiskConfig)
    agent: AgentConfig = Field(default_factory=AgentConfig)

    alpaca_api_key: str | None = None
    alpaca_api_secret: str | None = None
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"

    @field_validator("alpaca_api_key", "alpaca_api_secret", "openai_api_key", mode="before")
    @classmethod
    def empty_to_none(cls, value: object) -> object:
        if value == "":
            return None
        return value


def load_yaml_config(path: str | Path | None = None) -> dict:
    config_path = Path(path or "config.yaml")
    if not config_path.exists():
        return {}
    with config_path.open(encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}
    if not isinstance(data, dict):
        raise ValueError(f"Config file {config_path} must contain a mapping")
    return data


@lru_cache
def get_settings(config_path: str = "config.yaml") -> Settings:
    file_cfg = load_yaml_config(config_path)
    return Settings(**file_cfg)
