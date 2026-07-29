from __future__ import annotations

import asyncio
import json
from typing import Optional

import typer
from rich.console import Console
from rich.table import Table

from . import __version__
from .service import run_scan

app = typer.Typer(
    add_completion=False,
    no_args_is_help=True,
    help="SEC Insider Scout — rank Form 4 filings and suggest research trade windows.",
)
console = Console()


@app.command("scan")
def scan_cmd(
    lookback_days: int = typer.Option(14, help="How many days of filings to include"),
    max_filings: int = typer.Option(60, help="Max Form 4 filings to parse"),
    min_buy_value: float = typer.Option(25_000, help="Soft minimum buy notional for conviction"),
    limit: int = typer.Option(15, help="How many ranked ideas to print"),
    json_out: bool = typer.Option(False, "--json", help="Emit JSON"),
    refresh: bool = typer.Option(False, help="Bypass cache"),
) -> None:
    """Scan recent SEC Form 4 filings and rank trade ideas."""
    result = asyncio.run(
        run_scan(
            lookback_days=lookback_days,
            max_filings=max_filings,
            min_buy_value=min_buy_value,
            force_refresh=refresh,
        )
    )
    if json_out:
        console.print_json(json.dumps(result.model_dump(mode="json")))
        return

    console.print(f"[bold]SEC Insider Scout[/] v{__version__}")
    console.print(
        f"Scanned {result.filings_considered} filings · lookback {result.lookback_days}d · "
        f"{len(result.ideas)} ideas\n"
    )

    table = Table(show_header=True, header_style="bold")
    table.add_column("#", justify="right")
    table.add_column("Ticker")
    table.add_column("Grade")
    table.add_column("Score", justify="right")
    table.add_column("Side")
    table.add_column("Buy $", justify="right")
    table.add_column("Buyers", justify="right")
    table.add_column("Entry window")
    table.add_column("Exit window")

    for idx, idea in enumerate(result.ideas[:limit], start=1):
        table.add_row(
            str(idx),
            idea.ticker,
            idea.grade,
            f"{idea.rank_score:.1f}",
            idea.side,
            f"${idea.total_buy_value:,.0f}",
            str(idea.unique_buyers),
            f"{idea.timing.entry_window_start} → {idea.timing.entry_window_end}",
            f"{idea.timing.target_exit_start} → {idea.timing.target_exit_end}",
        )
    console.print(table)
    console.print()
    if result.ideas:
        top = result.ideas[0]
        console.print(f"[bold]Top idea[/]: {top.summary}")
        console.print(f"[dim]{top.timing.rationale}[/]")
    console.print(f"\n[dim]{result.disclaimer}[/]")


@app.command("serve")
def serve_cmd(
    host: str = typer.Option("0.0.0.0"),
    port: int = typer.Option(8080),
) -> None:
    """Start the web dashboard."""
    import uvicorn

    uvicorn.run("sec_insider_scout.web:app", host=host, port=port)


@app.command("version")
def version_cmd() -> None:
    console.print(__version__)


if __name__ == "__main__":
    app()
