from __future__ import annotations

from datetime import datetime, timezone

import yfinance as yf

from trading_agent.models import Bar, Quote


class MarketData:
    """Market data helper using Yahoo Finance (no API key required)."""

    def get_quote(self, symbol: str) -> Quote:
        ticker = yf.Ticker(symbol)
        info = ticker.fast_info
        last = float(getattr(info, "last_price", None) or getattr(info, "previous_close", 0) or 0)
        if last <= 0:
            history = ticker.history(period="5d", interval="1d")
            if history.empty:
                raise RuntimeError(f"Unable to fetch quote for {symbol}")
            last = float(history["Close"].iloc[-1])
        # Approximate NBBO with a small synthetic spread for paper fills.
        spread = max(last * 0.0005, 0.01)
        return Quote(
            symbol=symbol.upper(),
            bid=last - spread / 2,
            ask=last + spread / 2,
            last=last,
            timestamp=datetime.now(timezone.utc),
        )

    def get_bars(self, symbol: str, lookback: int = 30) -> list[Bar]:
        period = "3mo" if lookback > 40 else "1mo"
        history = yf.Ticker(symbol).history(period=period, interval="1d")
        if history.empty:
            raise RuntimeError(f"Unable to fetch bars for {symbol}")
        rows = history.tail(lookback)
        bars: list[Bar] = []
        for index, row in rows.iterrows():
            ts = index.to_pydatetime()
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            bars.append(
                Bar(
                    symbol=symbol.upper(),
                    open=float(row["Open"]),
                    high=float(row["High"]),
                    low=float(row["Low"]),
                    close=float(row["Close"]),
                    volume=float(row["Volume"]),
                    timestamp=ts,
                )
            )
        return bars
