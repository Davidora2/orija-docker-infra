from __future__ import annotations

from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.panel import Panel

from trading_agent.agent import TradingAgent
from trading_agent.brokers import create_broker
from trading_agent.config import get_settings
from trading_agent.market_data import MarketData

app = typer.Typer(add_completion=False, no_args_is_help=True)
console = Console()

DISCLAIMER = (
    "This agent does NOT guarantee profits. Markets are risky. "
    "Default mode is paper/dry-run. Never trade money you cannot afford to lose."
)


@app.callback()
def main() -> None:
    """Orija trading agent — paper-first, risk-gated automation."""


@app.command("run")
def run(
    config: Path = typer.Option(Path("config.yaml"), help="Path to YAML config"),
    cycles: Optional[int] = typer.Option(1, help="Number of cycles (omit/None for forever use --cycles -1)"),
    live_orders: bool = typer.Option(
        False,
        "--live-orders",
        help="Actually submit orders to the (paper) broker. Still paper by default.",
    ),
) -> None:
    """Run one or more trading cycles."""
    console.print(Panel(DISCLAIMER, title="Risk notice", style="yellow"))
    get_settings.cache_clear()
    settings = get_settings(str(config))
    if live_orders:
        settings.agent.dry_run = False
        if settings.broker.provider == "paper":
            console.print("[cyan]Submitting orders to local paper broker[/cyan]")
        else:
            console.print("[cyan]Submitting orders to Alpaca paper API[/cyan]")
    else:
        settings.agent.dry_run = True

    broker = create_broker(settings)
    agent = TradingAgent(settings=settings, broker=broker, console=console)
    max_cycles = None if cycles is not None and cycles < 0 else (cycles or 1)
    agent.run_forever(max_cycles=max_cycles)


@app.command("status")
def status(config: Path = typer.Option(Path("config.yaml"))) -> None:
    """Show account snapshot from the configured broker."""
    console.print(Panel(DISCLAIMER, title="Risk notice", style="yellow"))
    get_settings.cache_clear()
    settings = get_settings(str(config))
    broker = create_broker(settings)
    account = broker.get_account()
    console.print(
        f"Broker: {broker.name} (paper={broker.is_paper})\n"
        f"Cash: ${account.cash:,.2f}\n"
        f"Equity: ${account.equity:,.2f}\n"
        f"Buying power: ${account.buying_power:,.2f}\n"
        f"Positions: {len(account.positions)}"
    )
    for position in account.positions:
        console.print(
            f"  {position.symbol}: qty={position.qty} "
            f"avg={position.avg_entry_price:.2f} "
            f"mkt={position.market_price:.2f} "
            f"uPnL={position.unrealized_pnl:.2f}"
        )


@app.command("quote")
def quote(
    symbol: str,
    config: Path = typer.Option(Path("config.yaml")),
) -> None:
    """Fetch a quote for a symbol."""
    get_settings.cache_clear()
    settings = get_settings(str(config))
    if settings.broker.provider == "alpaca" and settings.alpaca_api_key:
        broker = create_broker(settings)
        q = broker.get_quote(symbol.upper())
    else:
        q = MarketData().get_quote(symbol.upper())
    console.print(f"{q.symbol} last={q.last:.2f} bid={q.bid:.2f} ask={q.ask:.2f}")


if __name__ == "__main__":
    app()
