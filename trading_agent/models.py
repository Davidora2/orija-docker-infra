from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class Side(str, Enum):
    BUY = "buy"
    SELL = "sell"


class OrderType(str, Enum):
    MARKET = "market"
    LIMIT = "limit"


class OrderStatus(str, Enum):
    PENDING = "pending"
    FILLED = "filled"
    REJECTED = "rejected"
    CANCELED = "canceled"


class SignalAction(str, Enum):
    BUY = "buy"
    SELL = "sell"
    HOLD = "hold"


class Quote(BaseModel):
    symbol: str
    bid: float
    ask: float
    last: float
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def mid(self) -> float:
        return (self.bid + self.ask) / 2.0


class Bar(BaseModel):
    symbol: str
    open: float
    high: float
    low: float
    close: float
    volume: float
    timestamp: datetime


class Position(BaseModel):
    symbol: str
    qty: float
    avg_entry_price: float
    market_price: float = 0.0

    @property
    def market_value(self) -> float:
        return self.qty * self.market_price

    @property
    def unrealized_pnl(self) -> float:
        return (self.market_price - self.avg_entry_price) * self.qty


class Order(BaseModel):
    id: str
    symbol: str
    side: Side
    qty: float
    order_type: OrderType = OrderType.MARKET
    limit_price: float | None = None
    status: OrderStatus = OrderStatus.PENDING
    filled_price: float | None = None
    filled_at: datetime | None = None
    reason: str | None = None
    meta: dict[str, Any] = Field(default_factory=dict)


class Account(BaseModel):
    cash: float
    equity: float
    buying_power: float
    positions: list[Position] = Field(default_factory=list)

    def position_for(self, symbol: str) -> Position | None:
        for position in self.positions:
            if position.symbol == symbol:
                return position
        return None


class Signal(BaseModel):
    symbol: str
    action: SignalAction
    confidence: float = Field(ge=0.0, le=1.0, default=0.5)
    target_weight: float | None = Field(
        default=None,
        description="Desired portfolio weight for symbol, 0..1",
    )
    reason: str = ""
    strategy: str = ""


class TradeDecision(BaseModel):
    signal: Signal
    approved: bool
    order: Order | None = None
    rejection_reason: str | None = None
