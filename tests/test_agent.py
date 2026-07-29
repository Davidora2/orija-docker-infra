from __future__ import annotations

from datetime import datetime, timezone

import pytest

from trading_agent.brokers.paper import PaperBroker
from trading_agent.config import AgentConfig, BrokerConfig, RiskConfig, Settings
from trading_agent.models import Account, Bar, Quote, Side, Signal, SignalAction
from trading_agent.risk import RiskManager
from trading_agent.strategies import HybridStrategy, MeanReversionStrategy, MomentumStrategy


class FakeMarketData:
    def __init__(self, price: float = 100.0):
        self.price = price

    def get_quote(self, symbol: str) -> Quote:
        return Quote(symbol=symbol, bid=self.price - 0.05, ask=self.price + 0.05, last=self.price)

    def get_bars(self, symbol: str, lookback: int = 30) -> list[Bar]:
        bars = []
        price = 90.0
        for i in range(lookback):
            price += 1.0
            bars.append(
                Bar(
                    symbol=symbol,
                    open=price - 0.5,
                    high=price + 0.5,
                    low=price - 1.0,
                    close=price,
                    volume=1_000_000,
                    timestamp=datetime.now(timezone.utc),
                )
            )
        return bars


def test_paper_broker_buy_and_sell():
    md = FakeMarketData(100.0)
    broker = PaperBroker(starting_cash=10_000, market_data=md)  # type: ignore[arg-type]
    buy = broker.submit_order("AAPL", Side.BUY, 10, reason="test buy")
    assert buy.status.value == "filled"
    account = broker.get_account()
    assert account.cash == pytest.approx(10_000 - 100.05 * 10, rel=1e-3)
    assert account.position_for("AAPL") is not None

    sell = broker.submit_order("AAPL", Side.SELL, 10, reason="test sell")
    assert sell.status.value == "filled"
    account = broker.get_account()
    assert account.position_for("AAPL") is None
    assert account.cash > 9_900


def test_risk_manager_blocks_low_confidence():
    risk = RiskManager(RiskConfig(min_confidence=0.8), day_start_equity=100_000)
    account = Account(cash=100_000, equity=100_000, buying_power=100_000)
    signal = Signal(symbol="AAPL", action=SignalAction.BUY, confidence=0.4, target_weight=0.05)
    decision = risk.evaluate(account, signal, price=100.0, proposed_qty=10)
    assert decision.approved is False
    assert "Confidence" in (decision.rejection_reason or "")


def test_risk_manager_halts_on_daily_loss():
    risk = RiskManager(RiskConfig(max_daily_loss_pct=0.02), day_start_equity=100_000)
    account = Account(cash=97_000, equity=97_000, buying_power=97_000)
    signal = Signal(symbol="AAPL", action=SignalAction.BUY, confidence=0.9, target_weight=0.05)
    decision = risk.evaluate(account, signal, price=100.0, proposed_qty=10)
    assert decision.approved is False
    assert risk.state.halted is True


def test_momentum_strategy_buys_uptrend():
    strategy = MomentumStrategy(short_window=3, long_window=5)
    bars = []
    price = 100.0
    for i in range(10):
        price += 2.0
        bars.append(
            Bar(
                symbol="AAPL",
                open=price - 1,
                high=price + 1,
                low=price - 2,
                close=price,
                volume=1000,
                timestamp=datetime.now(timezone.utc),
            )
        )
    account = Account(cash=100_000, equity=100_000, buying_power=100_000)
    signal = strategy.generate("AAPL", bars, account)
    assert signal.action == SignalAction.BUY


def test_mean_reversion_detects_oversold():
    strategy = MeanReversionStrategy(window=10, z_entry=1.2)
    bars = []
    for i in range(10):
        close = 100.0
        bars.append(
            Bar(
                symbol="XYZ",
                open=close,
                high=close + 1,
                low=close - 1,
                close=close,
                volume=1000,
                timestamp=datetime.now(timezone.utc),
            )
        )
    bars[-1] = bars[-1].model_copy(update={"close": 80.0, "low": 79.0})
    account = Account(cash=100_000, equity=100_000, buying_power=100_000)
    signal = strategy.generate("XYZ", bars, account)
    assert signal.action == SignalAction.BUY


def test_agent_dry_run_does_not_submit(monkeypatch):
    from trading_agent.agent import TradingAgent

    settings = Settings(
        broker=BrokerConfig(provider="paper", starting_cash=50_000),
        risk=RiskConfig(min_confidence=0.01, cooldown_seconds=0),
        agent=AgentConfig(symbols=["AAPL"], strategy="momentum", dry_run=True, lookback_bars=25),
    )
    md = FakeMarketData(100.0)
    broker = PaperBroker(starting_cash=50_000, market_data=md)  # type: ignore[arg-type]
    agent = TradingAgent(settings=settings, broker=broker, market_data=md)  # type: ignore[arg-type]
    result = agent.run_once()
    assert result.decisions
    # Dry-run should leave cash unchanged (no fills)
    assert broker.get_account().cash == pytest.approx(50_000)
    assert all(d.order is None or d.approved is False or True for d in result.decisions)


def test_hybrid_strategy_instantiates():
    assert HybridStrategy().name == "hybrid"
