from __future__ import annotations

import time
from dataclasses import dataclass, field

from trading_agent.config import RiskConfig
from trading_agent.models import Account, Order, OrderStatus, Side, Signal, SignalAction, TradeDecision


@dataclass
class RiskState:
    day_start_equity: float
    halted: bool = False
    halt_reason: str | None = None
    last_trade_at: dict[str, float] = field(default_factory=dict)


class RiskManager:
    """Hard risk gates — rejects unsafe orders before they hit the broker."""

    def __init__(self, config: RiskConfig, day_start_equity: float):
        self.config = config
        self.state = RiskState(day_start_equity=day_start_equity)

    def reset_day(self, equity: float) -> None:
        self.state = RiskState(day_start_equity=equity)

    def evaluate(
        self,
        account: Account,
        signal: Signal,
        price: float,
        proposed_qty: float,
    ) -> TradeDecision:
        if self.state.halted:
            return TradeDecision(
                signal=signal,
                approved=False,
                rejection_reason=self.state.halt_reason or "Trading halted",
            )

        drawdown = 0.0
        if self.state.day_start_equity > 0:
            drawdown = (self.state.day_start_equity - account.equity) / self.state.day_start_equity
        if drawdown >= self.config.max_daily_loss_pct:
            self.state.halted = True
            self.state.halt_reason = (
                f"Max daily loss hit ({drawdown:.2%} >= {self.config.max_daily_loss_pct:.2%})"
            )
            return TradeDecision(
                signal=signal,
                approved=False,
                rejection_reason=self.state.halt_reason,
            )

        if signal.action == SignalAction.HOLD or proposed_qty <= 0:
            return TradeDecision(
                signal=signal,
                approved=False,
                rejection_reason="No actionable trade",
            )

        if signal.confidence < self.config.min_confidence:
            return TradeDecision(
                signal=signal,
                approved=False,
                rejection_reason=(
                    f"Confidence {signal.confidence:.2f} below minimum "
                    f"{self.config.min_confidence:.2f}"
                ),
            )

        now = time.time()
        last = self.state.last_trade_at.get(signal.symbol, 0.0)
        if now - last < self.config.cooldown_seconds:
            return TradeDecision(
                signal=signal,
                approved=False,
                rejection_reason="Symbol in cooldown",
            )

        position = account.position_for(signal.symbol)
        open_count = len(account.positions)

        if signal.action == SignalAction.BUY:
            if position is None and open_count >= self.config.max_open_positions:
                return TradeDecision(
                    signal=signal,
                    approved=False,
                    rejection_reason="Max open positions reached",
                )

            notional = proposed_qty * price
            max_notional = account.equity * self.config.max_position_pct
            current_value = position.market_value if position else 0.0
            if current_value + notional > max_notional:
                # Shrink to remaining room
                remaining = max(max_notional - current_value, 0.0)
                proposed_qty = remaining / price if price > 0 else 0.0
                if proposed_qty < 1e-6:
                    return TradeDecision(
                        signal=signal,
                        approved=False,
                        rejection_reason="Position size limit reached",
                    )
                notional = proposed_qty * price

            cash_floor = account.equity * self.config.min_cash_reserve_pct
            if account.cash - notional < cash_floor:
                spendable = max(account.cash - cash_floor, 0.0)
                proposed_qty = spendable / price if price > 0 else 0.0
                if proposed_qty < 1e-6:
                    return TradeDecision(
                        signal=signal,
                        approved=False,
                        rejection_reason="Cash reserve would be breached",
                    )

            side = Side.BUY
        else:
            if not position or position.qty <= 0:
                return TradeDecision(
                    signal=signal,
                    approved=False,
                    rejection_reason="No long position to sell",
                )
            if not self.config.allow_short and proposed_qty > position.qty:
                proposed_qty = position.qty
            side = Side.SELL

        # Placeholder order; broker fills for real.
        order = Order(
            id="pending",
            symbol=signal.symbol,
            side=side,
            qty=round(proposed_qty, 4),
            status=OrderStatus.PENDING,
            reason=signal.reason,
        )
        return TradeDecision(signal=signal, approved=True, order=order)

    def record_fill(self, symbol: str) -> None:
        self.state.last_trade_at[symbol] = time.time()
