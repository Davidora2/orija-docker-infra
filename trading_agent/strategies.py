from __future__ import annotations

from abc import ABC, abstractmethod

from trading_agent.models import Account, Bar, Signal, SignalAction


class Strategy(ABC):
    name: str = "base"

    @abstractmethod
    def generate(self, symbol: str, bars: list[Bar], account: Account) -> Signal:
        raise NotImplementedError


def _sma(values: list[float], window: int) -> float | None:
    if len(values) < window:
        return None
    return sum(values[-window:]) / window


class MomentumStrategy(Strategy):
    """Buy when short SMA crosses above long SMA; sell on the reverse."""

    name = "momentum"

    def __init__(self, short_window: int = 5, long_window: int = 20):
        self.short_window = short_window
        self.long_window = long_window

    def generate(self, symbol: str, bars: list[Bar], account: Account) -> Signal:
        closes = [bar.close for bar in bars]
        short = _sma(closes, self.short_window)
        long = _sma(closes, self.long_window)
        if short is None or long is None or long == 0:
            return Signal(symbol=symbol, action=SignalAction.HOLD, reason="Insufficient data", strategy=self.name)

        spread = (short - long) / long
        position = account.position_for(symbol)

        if spread > 0.005 and (position is None or position.qty <= 0):
            confidence = min(0.5 + abs(spread) * 8, 0.95)
            return Signal(
                symbol=symbol,
                action=SignalAction.BUY,
                confidence=confidence,
                target_weight=0.08,
                reason=f"Bullish momentum: short SMA {short:.2f} > long SMA {long:.2f}",
                strategy=self.name,
            )
        if spread < -0.005 and position and position.qty > 0:
            confidence = min(0.5 + abs(spread) * 8, 0.95)
            return Signal(
                symbol=symbol,
                action=SignalAction.SELL,
                confidence=confidence,
                target_weight=0.0,
                reason=f"Bearish momentum: short SMA {short:.2f} < long SMA {long:.2f}",
                strategy=self.name,
            )
        return Signal(
            symbol=symbol,
            action=SignalAction.HOLD,
            confidence=0.4,
            reason=f"No momentum edge (spread={spread:.3%})",
            strategy=self.name,
        )


class MeanReversionStrategy(Strategy):
    """Fade moves far from the recent mean."""

    name = "mean_reversion"

    def __init__(self, window: int = 20, z_entry: float = 1.5):
        self.window = window
        self.z_entry = z_entry

    def generate(self, symbol: str, bars: list[Bar], account: Account) -> Signal:
        closes = [bar.close for bar in bars]
        if len(closes) < self.window:
            return Signal(symbol=symbol, action=SignalAction.HOLD, reason="Insufficient data", strategy=self.name)

        window = closes[-self.window :]
        mean = sum(window) / len(window)
        variance = sum((value - mean) ** 2 for value in window) / len(window)
        std = variance**0.5
        if std == 0:
            return Signal(symbol=symbol, action=SignalAction.HOLD, reason="Zero volatility", strategy=self.name)

        z = (closes[-1] - mean) / std
        position = account.position_for(symbol)

        if z <= -self.z_entry and (position is None or position.qty <= 0):
            confidence = min(0.5 + abs(z) * 0.15, 0.92)
            return Signal(
                symbol=symbol,
                action=SignalAction.BUY,
                confidence=confidence,
                target_weight=0.07,
                reason=f"Oversold vs mean (z={z:.2f})",
                strategy=self.name,
            )
        if z >= self.z_entry and position and position.qty > 0:
            confidence = min(0.5 + abs(z) * 0.15, 0.92)
            return Signal(
                symbol=symbol,
                action=SignalAction.SELL,
                confidence=confidence,
                target_weight=0.0,
                reason=f"Overbought vs mean (z={z:.2f})",
                strategy=self.name,
            )
        return Signal(
            symbol=symbol,
            action=SignalAction.HOLD,
            confidence=0.35,
            reason=f"Within band (z={z:.2f})",
            strategy=self.name,
        )


class HybridStrategy(Strategy):
    """Combine momentum and mean reversion; require agreement or strong confidence."""

    name = "hybrid"

    def __init__(self) -> None:
        self.momentum = MomentumStrategy()
        self.mean_reversion = MeanReversionStrategy()

    def generate(self, symbol: str, bars: list[Bar], account: Account) -> Signal:
        m = self.momentum.generate(symbol, bars, account)
        r = self.mean_reversion.generate(symbol, bars, account)

        if m.action == r.action and m.action != SignalAction.HOLD:
            return Signal(
                symbol=symbol,
                action=m.action,
                confidence=min((m.confidence + r.confidence) / 2 + 0.1, 0.97),
                target_weight=m.target_weight or r.target_weight,
                reason=f"Agreement: {m.reason} | {r.reason}",
                strategy=self.name,
            )

        # Prefer the stronger non-hold signal.
        candidates = [s for s in (m, r) if s.action != SignalAction.HOLD]
        if not candidates:
            return Signal(
                symbol=symbol,
                action=SignalAction.HOLD,
                confidence=0.3,
                reason="No hybrid edge",
                strategy=self.name,
            )
        best = max(candidates, key=lambda s: s.confidence)
        if best.confidence < 0.65:
            return Signal(
                symbol=symbol,
                action=SignalAction.HOLD,
                confidence=best.confidence,
                reason=f"Weak lone signal from {best.strategy}: {best.reason}",
                strategy=self.name,
            )
        return best.model_copy(update={"strategy": self.name})


def build_strategy(name: str) -> Strategy:
    mapping = {
        "momentum": MomentumStrategy,
        "mean_reversion": MeanReversionStrategy,
        "hybrid": HybridStrategy,
    }
    if name not in mapping:
        raise ValueError(f"Unknown strategy: {name}")
    return mapping[name]()
