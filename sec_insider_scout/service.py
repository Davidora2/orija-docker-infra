from __future__ import annotations

import time
from typing import Any

from .config import Settings, get_settings
from .models import ScanResult
from .scorer import build_trade_ideas
from .sec_client import SecEdgarClient

_cache: dict[str, Any] = {"expires": 0.0, "result": None}


async def run_scan(
    *,
    lookback_days: int | None = None,
    max_filings: int | None = None,
    min_buy_value: float | None = None,
    force_refresh: bool = False,
    settings: Settings | None = None,
) -> ScanResult:
    settings = settings or get_settings()
    lookback_days = lookback_days or settings.lookback_days
    max_filings = max_filings or settings.max_filings
    if min_buy_value is not None:
        settings = settings.model_copy(update={"min_buy_value": min_buy_value, "lookback_days": lookback_days})

    cache_key = f"{lookback_days}:{max_filings}:{settings.min_buy_value}"
    now = time.time()
    if (
        not force_refresh
        and _cache.get("key") == cache_key
        and _cache["result"] is not None
        and now < float(_cache["expires"])
    ):
        return _cache["result"]

    async with SecEdgarClient(settings) as client:
        txs = await client.fetch_recent_transactions(
            lookback_days=lookback_days,
            max_filings=max_filings,
        )
    result = build_trade_ideas(txs, settings=settings)
    _cache.update({"key": cache_key, "result": result, "expires": now + settings.cache_ttl_seconds})
    return result
