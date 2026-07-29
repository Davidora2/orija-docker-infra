from __future__ import annotations

import uuid
from datetime import datetime, timezone

from trading_agent.brokers.base import Broker
from trading_agent.market_data import MarketData
from trading_agent.models import Account, Order, OrderStatus, Position, Quote, Side


class PaperBroker(Broker):
    """Local simulated broker with realistic fill prices and cash tracking."""

    def __init__(self, starting_cash: float = 100_000.0, market_data: MarketData | None = None):
        self._cash = float(starting_cash)
        self._positions: dict[str, Position] = {}
        self._orders: list[Order] = []
        self._market_data = market_data or MarketData()

    @property
    def name(self) -> str:
        return "paper"

    @property
    def is_paper(self) -> bool:
        return True

    def get_quote(self, symbol: str) -> Quote:
        return self._market_data.get_quote(symbol)

    def get_account(self) -> Account:
        positions: list[Position] = []
        equity = self._cash
        for symbol, position in list(self._positions.items()):
            quote = self.get_quote(symbol)
            updated = position.model_copy(update={"market_price": quote.last})
            positions.append(updated)
            equity += updated.market_value
            self._positions[symbol] = updated
        return Account(
            cash=self._cash,
            equity=equity,
            buying_power=self._cash,
            positions=positions,
        )

    def submit_order(self, symbol: str, side: Side, qty: float, reason: str = "") -> Order:
        if qty <= 0:
            return Order(
                id=str(uuid.uuid4()),
                symbol=symbol,
                side=side,
                qty=qty,
                status=OrderStatus.REJECTED,
                reason="Quantity must be positive",
            )

        quote = self.get_quote(symbol)
        fill_price = quote.ask if side == Side.BUY else quote.bid
        notional = fill_price * qty
        order_id = str(uuid.uuid4())

        if side == Side.BUY:
            if notional > self._cash:
                order = Order(
                    id=order_id,
                    symbol=symbol,
                    side=side,
                    qty=qty,
                    status=OrderStatus.REJECTED,
                    reason="Insufficient cash",
                    meta={"requested_notional": notional, "cash": self._cash},
                )
                self._orders.append(order)
                return order
            self._cash -= notional
            existing = self._positions.get(symbol)
            if existing:
                new_qty = existing.qty + qty
                new_avg = ((existing.avg_entry_price * existing.qty) + notional) / new_qty
                self._positions[symbol] = Position(
                    symbol=symbol,
                    qty=new_qty,
                    avg_entry_price=new_avg,
                    market_price=fill_price,
                )
            else:
                self._positions[symbol] = Position(
                    symbol=symbol,
                    qty=qty,
                    avg_entry_price=fill_price,
                    market_price=fill_price,
                )
        else:
            existing = self._positions.get(symbol)
            if not existing or existing.qty < qty:
                order = Order(
                    id=order_id,
                    symbol=symbol,
                    side=side,
                    qty=qty,
                    status=OrderStatus.REJECTED,
                    reason="Insufficient shares to sell",
                )
                self._orders.append(order)
                return order
            self._cash += notional
            remaining = existing.qty - qty
            if remaining <= 1e-9:
                del self._positions[symbol]
            else:
                self._positions[symbol] = existing.model_copy(
                    update={"qty": remaining, "market_price": fill_price}
                )

        order = Order(
            id=order_id,
            symbol=symbol,
            side=side,
            qty=qty,
            status=OrderStatus.FILLED,
            filled_price=fill_price,
            filled_at=datetime.now(timezone.utc),
            reason=reason,
        )
        self._orders.append(order)
        return order

    def cancel_open_orders(self) -> int:
        # Paper fills immediately; nothing to cancel.
        return 0

    @property
    def order_history(self) -> list[Order]:
        return list(self._orders)
