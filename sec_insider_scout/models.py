from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class OwnerRole(str, Enum):
    CEO = "ceo"
    CFO = "cfo"
    OFFICER = "officer"
    DIRECTOR = "director"
    TEN_PERCENT = "ten_percent"
    OTHER = "other"


class TransactionSide(str, Enum):
    BUY = "buy"
    SELL = "sell"


class InsiderTransaction(BaseModel):
    accession: str
    filed_at: datetime
    transaction_date: date | None = None
    issuer_cik: str
    issuer_name: str
    ticker: str | None = None
    owner_name: str
    owner_cik: str | None = None
    roles: list[OwnerRole] = Field(default_factory=list)
    officer_title: str | None = None
    side: TransactionSide
    code: str
    shares: float
    price: float | None = None
    value: float | None = None
    shares_owned_after: float | None = None
    is_direct: bool = True
    form_url: str
    is_derivative: bool = False


class SignalFactors(BaseModel):
    open_market_buy: float = 0.0
    cluster_buying: float = 0.0
    role_weight: float = 0.0
    size_conviction: float = 0.0
    recency: float = 0.0
    multi_day_accumulation: float = 0.0
    sell_pressure_penalty: float = 0.0


class TradeTiming(BaseModel):
    entry_window_start: date
    entry_window_end: date
    review_date: date
    target_exit_start: date
    target_exit_end: date
    stop_review_days: int
    rationale: str


class TradeIdea(BaseModel):
    ticker: str
    issuer_name: str
    issuer_cik: str
    side: Literal["long", "avoid", "watch"]
    rank_score: float = Field(ge=0, le=100)
    grade: Literal["A", "B", "C", "D", "F"]
    summary: str
    factors: SignalFactors
    timing: TradeTiming
    transactions: list[InsiderTransaction]
    total_buy_value: float = 0.0
    total_sell_value: float = 0.0
    unique_buyers: int = 0
    unique_sellers: int = 0
    form_urls: list[str] = Field(default_factory=list)
    caveats: list[str] = Field(default_factory=list)


class ScanResult(BaseModel):
    scanned_at: datetime
    lookback_days: int
    filings_considered: int
    ideas: list[TradeIdea]
    disclaimer: str
