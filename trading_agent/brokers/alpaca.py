from __future__ import annotations

from datetime import datetime, timezone

import httpx

from trading_agent.brokers.base import Broker
from trading_agent.models import Account, Order, OrderStatus, Position, Quote, Side


class AlpacaBroker(Broker):
    """Alpaca Markets broker adapter. Defaults to paper trading endpoint."""

    def __init__(
        self,
        api_key: str,
        api_secret: str,
        base_url: str = "https://paper-api.alpaca.markets",
        paper_mode: bool = True,
        timeout: float = 30.0,
    ):
        if not paper_mode and "paper-api" in base_url:
            raise ValueError(
                "Refusing live trading against paper URL. "
                "Set broker.alpaca_base_url to https://api.alpaca.markets and paper_mode=false."
            )
        if not paper_mode:
            # Extra safety: live trading must be explicitly opted into.
            raise ValueError(
                "Live Alpaca trading is disabled in this agent by default. "
                "Use paper_mode=true (Alpaca paper account) or the local paper broker."
            )

        self._base_url = base_url.rstrip("/")
        self._paper_mode = paper_mode
        self._client = httpx.Client(
            base_url=self._base_url,
            headers={
                "APCA-API-KEY-ID": api_key,
                "APCA-API-SECRET-KEY": api_secret,
                "Accept": "application/json",
            },
            timeout=timeout,
        )
        # Data API for quotes
        self._data_client = httpx.Client(
            base_url="https://data.alpaca.markets",
            headers={
                "APCA-API-KEY-ID": api_key,
                "APCA-API-SECRET-KEY": api_secret,
                "Accept": "application/json",
            },
            timeout=timeout,
        )

    @property
    def name(self) -> str:
        return "alpaca"

    @property
    def is_paper(self) -> bool:
        return self._paper_mode

    def get_account(self) -> Account:
        account = self._client.get("/v2/account").raise_for_status().json()
        positions_raw = self._client.get("/v2/positions").raise_for_status().json()
        positions = [
            Position(
                symbol=item["symbol"],
                qty=float(item["qty"]),
                avg_entry_price=float(item["avg_entry_price"]),
                market_price=float(item["current_price"]),
            )
            for item in positions_raw
        ]
        return Account(
            cash=float(account["cash"]),
            equity=float(account["equity"]),
            buying_power=float(account["buying_power"]),
            positions=positions,
        )

    def get_quote(self, symbol: str) -> Quote:
        response = self._data_client.get(
            f"/v2/stocks/{symbol}/quotes/latest",
            params={"feed": "iex"},
        )
        if response.status_code == 404:
            # Fallback: latest trade as last, with a tiny spread.
            trade = (
                self._data_client.get(
                    f"/v2/stocks/{symbol}/trades/latest",
                    params={"feed": "iex"},
                )
                .raise_for_status()
                .json()["trade"]
            )
            last = float(trade["p"])
            return Quote(symbol=symbol, bid=last * 0.9995, ask=last * 1.0005, last=last)

        response.raise_for_status()
        quote = response.json()["quote"]
        bid = float(quote["bp"] or 0)
        ask = float(quote["ap"] or 0)
        last = ask if ask else bid
        if bid <= 0 and ask <= 0:
            raise RuntimeError(f"No quote available for {symbol}")
        if bid <= 0:
            bid = ask * 0.9995
        if ask <= 0:
            ask = bid * 1.0005
        return Quote(symbol=symbol, bid=bid, ask=ask, last=last or ((bid + ask) / 2))

    def submit_order(self, symbol: str, side: Side, qty: float, reason: str = "") -> Order:
        payload = {
            "symbol": symbol,
            "qty": str(qty),
            "side": side.value,
            "type": "market",
            "time_in_force": "day",
        }
        response = self._client.post("/v2/orders", json=payload)
        if response.status_code >= 400:
            detail = response.text
            return Order(
                id=response.headers.get("x-request-id", "unknown"),
                symbol=symbol,
                side=side,
                qty=qty,
                status=OrderStatus.REJECTED,
                reason=detail,
            )
        data = response.json()
        status = OrderStatus.FILLED if data.get("status") == "filled" else OrderStatus.PENDING
        filled_price = float(data["filled_avg_price"]) if data.get("filled_avg_price") else None
        return Order(
            id=data["id"],
            symbol=symbol,
            side=side,
            qty=float(data.get("qty") or qty),
            status=status,
            filled_price=filled_price,
            filled_at=datetime.now(timezone.utc) if status == OrderStatus.FILLED else None,
            reason=reason,
            meta={"alpaca_status": data.get("status")},
        )

    def cancel_open_orders(self) -> int:
        response = self._client.delete("/v2/orders").raise_for_status()
        # Alpaca returns 207 multi-status sometimes; treat 2xx as success.
        return 1 if response.status_code < 300 else 0

    def close(self) -> None:
        self._client.close()
        self._data_client.close()
