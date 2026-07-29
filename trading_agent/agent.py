from __future__ import annotations

import time
from dataclasses import dataclass, field

from rich.console import Console
from rich.table import Table

from trading_agent.brokers.base import Broker
from trading_agent.config import Settings
from trading_agent.llm import LLMAnalyst
from trading_agent.market_data import MarketData
from trading_agent.models import OrderStatus, SignalAction, TradeDecision
from trading_agent.risk import RiskManager
from trading_agent.strategies import Strategy, build_strategy


@dataclass
class CycleResult:
    decisions: list[TradeDecision] = field(default_factory=list)
    equity: float = 0.0
    cash: float = 0.0
    halted: bool = False


class TradingAgent:
    """Autonomous loop: data → strategy → risk → (optional) order."""

    def __init__(
        self,
        settings: Settings,
        broker: Broker,
        strategy: Strategy | None = None,
        market_data: MarketData | None = None,
        console: Console | None = None,
    ):
        self.settings = settings
        self.broker = broker
        self.strategy = strategy or build_strategy(settings.agent.strategy)
        self.market_data = market_data or MarketData()
        self.console = console or Console()
        account = broker.get_account()
        self.risk = RiskManager(settings.risk, day_start_equity=account.equity)
        self.llm: LLMAnalyst | None = None
        if settings.agent.enable_llm:
            if not settings.openai_api_key:
                raise ValueError("enable_llm=true requires TRADE_OPENAI_API_KEY")
            self.llm = LLMAnalyst(settings.openai_api_key, settings.openai_model)

    def _position_qty_for_signal(self, signal, account, price: float) -> float:
        if signal.action == SignalAction.SELL:
            position = account.position_for(signal.symbol)
            return float(position.qty) if position else 0.0

        weight = signal.target_weight or self.settings.risk.max_position_pct
        notional = account.equity * weight
        existing = account.position_for(signal.symbol)
        existing_value = existing.market_value if existing else 0.0
        remaining = max(notional - existing_value, 0.0)
        return remaining / price if price > 0 else 0.0

    def run_once(self) -> CycleResult:
        account = self.broker.get_account()
        result = CycleResult(equity=account.equity, cash=account.cash)

        for symbol in self.settings.agent.symbols:
            bars = self.market_data.get_bars(symbol, lookback=self.settings.agent.lookback_bars)
            signal = self.strategy.generate(symbol, bars, account)
            if self.llm and signal.action != SignalAction.HOLD:
                signal = self.llm.refine(signal, bars)

            quote = self.broker.get_quote(symbol)
            qty = self._position_qty_for_signal(signal, account, quote.last)
            decision = self.risk.evaluate(account, signal, quote.last, qty)

            if decision.approved and decision.order and not self.settings.agent.dry_run:
                filled = self.broker.submit_order(
                    symbol=decision.order.symbol,
                    side=decision.order.side,
                    qty=decision.order.qty,
                    reason=signal.reason,
                )
                decision.order = filled
                if filled.status == OrderStatus.FILLED:
                    self.risk.record_fill(symbol)
                    account = self.broker.get_account()
            elif decision.approved and decision.order and self.settings.agent.dry_run:
                decision.rejection_reason = "Dry-run: order not submitted"
                # Keep approved=True so operators can see intended trades,
                # but mark clearly as simulation-only via rejection_reason.
                decision = decision.model_copy(
                    update={
                        "approved": False,
                        "rejection_reason": (
                            f"Dry-run would {decision.order.side.value} "
                            f"{decision.order.qty} {decision.order.symbol}"
                        ),
                    }
                )

            result.decisions.append(decision)
            if self.risk.state.halted:
                result.halted = True
                break

        account = self.broker.get_account()
        result.equity = account.equity
        result.cash = account.cash
        return result

    def print_cycle(self, result: CycleResult) -> None:
        table = Table(title=f"Trading cycle — equity ${result.equity:,.2f}")
        table.add_column("Symbol")
        table.add_column("Action")
        table.add_column("Conf")
        table.add_column("Result")
        table.add_column("Detail")
        for decision in result.decisions:
            signal = decision.signal
            if decision.approved and decision.order:
                outcome = f"SUBMIT {decision.order.side.value} {decision.order.qty}"
                detail = decision.order.reason or signal.reason
            else:
                outcome = "SKIP"
                detail = decision.rejection_reason or signal.reason
            table.add_row(
                signal.symbol,
                signal.action.value,
                f"{signal.confidence:.2f}",
                outcome,
                detail[:80],
            )
        self.console.print(table)
        if result.halted:
            self.console.print(f"[red]HALTED:[/red] {self.risk.state.halt_reason}")

    def run_forever(self, max_cycles: int | None = None) -> list[CycleResult]:
        self.console.print(
            f"[bold]Agent starting[/bold] broker={self.broker.name} "
            f"paper={self.broker.is_paper} dry_run={self.settings.agent.dry_run} "
            f"strategy={self.strategy.name}"
        )
        if not self.broker.is_paper:
            raise RuntimeError("Refusing to run against a non-paper broker")

        results: list[CycleResult] = []
        cycles = 0
        while max_cycles is None or cycles < max_cycles:
            result = self.run_once()
            self.print_cycle(result)
            results.append(result)
            cycles += 1
            if result.halted:
                break
            if max_cycles is not None and cycles >= max_cycles:
                break
            time.sleep(self.settings.agent.poll_interval_seconds)
        return results
