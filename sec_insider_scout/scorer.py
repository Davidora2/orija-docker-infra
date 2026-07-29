from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from statistics import mean

from .config import Settings, get_settings
from .models import (
    InsiderTransaction,
    OwnerRole,
    ScanResult,
    SignalFactors,
    TradeIdea,
    TradeTiming,
    TransactionSide,
)

DISCLAIMER = (
    "Educational research only — not investment advice, not an offer to buy or sell securities, "
    "and not a recommendation to trade on material non-public information. Insider Form 4 data is "
    "public after filing. Past patterns do not predict future results. Do your own due diligence."
)

ROLE_WEIGHTS = {
    OwnerRole.CEO: 1.0,
    OwnerRole.CFO: 0.9,
    OwnerRole.OFFICER: 0.7,
    OwnerRole.DIRECTOR: 0.55,
    OwnerRole.TEN_PERCENT: 0.45,
    OwnerRole.OTHER: 0.25,
}


def _best_role_weight(roles: list[OwnerRole]) -> float:
    if not roles:
        return ROLE_WEIGHTS[OwnerRole.OTHER]
    return max(ROLE_WEIGHTS.get(r, 0.25) for r in roles)


def _grade(score: float) -> str:
    if score >= 80:
        return "A"
    if score >= 65:
        return "B"
    if score >= 50:
        return "C"
    if score >= 35:
        return "D"
    return "F"


def _clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def build_trade_ideas(
    transactions: list[InsiderTransaction],
    *,
    settings: Settings | None = None,
    now: datetime | None = None,
) -> ScanResult:
    settings = settings or get_settings()
    now = now or datetime.now(timezone.utc)
    today = now.date()

    by_issuer: dict[str, list[InsiderTransaction]] = defaultdict(list)
    for tx in transactions:
        key = (tx.ticker or tx.issuer_cik or tx.issuer_name).upper()
        by_issuer[key].append(tx)

    ideas: list[TradeIdea] = []
    for _key, txs in by_issuer.items():
        idea = _score_issuer(txs, today=today, min_buy_value=settings.min_buy_value)
        if idea is not None:
            ideas.append(idea)

    side_rank = {"long": 0, "watch": 1, "avoid": 2}
    ideas.sort(key=lambda i: (side_rank.get(i.side, 9), -i.rank_score))
    return ScanResult(
        scanned_at=now,
        lookback_days=settings.lookback_days,
        filings_considered=len({t.accession for t in transactions}),
        ideas=ideas,
        disclaimer=DISCLAIMER,
    )


def _score_issuer(
    txs: list[InsiderTransaction],
    *,
    today: date,
    min_buy_value: float,
) -> TradeIdea | None:
    buys = [t for t in txs if t.side == TransactionSide.BUY and not t.is_derivative]
    sells = [t for t in txs if t.side == TransactionSide.SELL]

    if not buys and not sells:
        return None

    total_buy = sum(t.value or 0.0 for t in buys)
    total_sell = sum(t.value or 0.0 for t in sells)
    buyers = {t.owner_name for t in buys}
    sellers = {t.owner_name for t in sells}

    # Require meaningful open-market purchase activity for actionable longs.
    meaningful_buys = [t for t in buys if (t.value or 0) >= min_buy_value * 0.2]
    if not meaningful_buys and total_buy < min_buy_value:
        # Still surface heavy selling as avoid/watch if material.
        if total_sell >= min_buy_value * 2 and len(sellers) >= 1:
            return _sell_pressure_idea(txs, buys, sells, today)
        return None

    latest_file = max(t.filed_at for t in txs).date()
    days_since = max(0, (today - latest_file).days)

    # Factor: open-market buy presence (codes already filtered to P)
    open_market = _clamp(len(meaningful_buys) / 3.0)

    # Factor: cluster buying — multiple insiders buying
    cluster = 0.0
    if len(buyers) >= 3:
        cluster = 1.0
    elif len(buyers) == 2:
        cluster = 0.7
    elif len(buyers) == 1 and total_buy >= min_buy_value:
        cluster = 0.35

    # Factor: role quality
    role = mean([_best_role_weight(t.roles) for t in meaningful_buys or buys]) if (meaningful_buys or buys) else 0.0

    # Factor: dollar conviction vs threshold
    size = _clamp(total_buy / (min_buy_value * 8.0))

    # Factor: recency — fresher filings score higher
    recency = _clamp(1.0 - days_since / 14.0)

    # Factor: multi-day accumulation
    buy_dates = {t.transaction_date for t in buys if t.transaction_date}
    multi = 0.0
    if len(buy_dates) >= 3:
        multi = 1.0
    elif len(buy_dates) == 2:
        multi = 0.6

    # Penalty: concurrent selling
    sell_penalty = 0.0
    if total_sell > 0 and total_buy > 0:
        ratio = total_sell / max(total_buy, 1.0)
        sell_penalty = _clamp(ratio / 2.0)
    elif total_sell > total_buy:
        sell_penalty = 0.85

    factors = SignalFactors(
        open_market_buy=round(open_market, 3),
        cluster_buying=round(cluster, 3),
        role_weight=round(role, 3),
        size_conviction=round(size, 3),
        recency=round(recency, 3),
        multi_day_accumulation=round(multi, 3),
        sell_pressure_penalty=round(sell_penalty, 3),
    )

    raw = (
        28 * open_market
        + 22 * cluster
        + 18 * role
        + 14 * size
        + 10 * recency
        + 8 * multi
        - 25 * sell_penalty
    )
    score = round(_clamp(raw, 0, 100), 1)
    grade = _grade(score)

    ticker = next((t.ticker for t in txs if t.ticker), None) or txs[0].issuer_cik
    issuer_name = txs[0].issuer_name
    issuer_cik = txs[0].issuer_cik

    if score >= 50 and total_buy > total_sell:
        side = "long"
    elif sell_penalty >= 0.6 and total_sell > total_buy:
        side = "avoid"
    else:
        side = "watch"

    timing = _timing_for(side=side, filed_on=latest_file, score=score)
    summary = _summary(
        side=side,
        ticker=ticker,
        buyers=len(buyers),
        total_buy=total_buy,
        total_sell=total_sell,
        roles=meaningful_buys or buys,
    )
    caveats = [
        "Form 4 purchases can reflect 10b5-1 plans, tax events, or incomplete context.",
        "Prefer waiting until the filing is public and liquidity/spread look acceptable.",
        "Size positions small; this scout does not model fundamentals, short interest, or catalysts.",
    ]
    if sell_penalty > 0.3:
        caveats.append("Mixed buy/sell flow — treat as weaker conviction.")
    if not any(t.ticker for t in txs):
        caveats.append("Ticker missing from filing; verify the issuer before trading.")

    return TradeIdea(
        ticker=ticker,
        issuer_name=issuer_name,
        issuer_cik=issuer_cik,
        side=side,
        rank_score=score,
        grade=grade,  # type: ignore[arg-type]
        summary=summary,
        factors=factors,
        timing=timing,
        transactions=sorted(txs, key=lambda t: t.filed_at, reverse=True),
        total_buy_value=round(total_buy, 2),
        total_sell_value=round(total_sell, 2),
        unique_buyers=len(buyers),
        unique_sellers=len(sellers),
        form_urls=sorted({t.form_url for t in txs}),
        caveats=caveats,
    )


def _sell_pressure_idea(
    txs: list[InsiderTransaction],
    buys: list[InsiderTransaction],
    sells: list[InsiderTransaction],
    today: date,
) -> TradeIdea:
    total_buy = sum(t.value or 0.0 for t in buys)
    total_sell = sum(t.value or 0.0 for t in sells)
    latest_file = max(t.filed_at for t in txs).date()
    factors = SignalFactors(sell_pressure_penalty=0.9, recency=_clamp(1.0 - max(0, (today - latest_file).days) / 14.0))
    score = round(20 + 15 * factors.recency, 1)
    ticker = next((t.ticker for t in txs if t.ticker), None) or txs[0].issuer_cik
    return TradeIdea(
        ticker=ticker,
        issuer_name=txs[0].issuer_name,
        issuer_cik=txs[0].issuer_cik,
        side="avoid",
        rank_score=score,
        grade=_grade(score),  # type: ignore[arg-type]
        summary=(
            f"Elevated insider selling (${total_sell:,.0f}) with little open-market buying "
            f"(${total_buy:,.0f}). Prefer avoid / wait-for-clarity rather than chasing longs."
        ),
        factors=factors,
        timing=_timing_for(side="avoid", filed_on=latest_file, score=score),
        transactions=sorted(txs, key=lambda t: t.filed_at, reverse=True),
        total_buy_value=round(total_buy, 2),
        total_sell_value=round(total_sell, 2),
        unique_buyers=len({t.owner_name for t in buys}),
        unique_sellers=len({t.owner_name for t in sells}),
        form_urls=sorted({t.form_url for t in txs}),
        caveats=[
            "Insider sales are often planned and less informative than open-market buys.",
            DISCLAIMER,
        ],
    )


def _timing_for(*, side: str, filed_on: date, score: float) -> TradeTiming:
    # Academic/practitioner pattern: Form 4 buy signal often studied over ~1–3 months.
    # We suggest a short entry window after public filing, then staged review/exit bands.
    entry_start = filed_on
    if score >= 70:
        entry_end = filed_on + timedelta(days=5)
        review = filed_on + timedelta(days=21)
        exit_start = filed_on + timedelta(days=30)
        exit_end = filed_on + timedelta(days=90)
        stop_days = 15
        rationale = (
            "Higher-conviction cluster/role signal: consider entries within ~1 week of the "
            "public filing, reassess around 3 weeks, and plan a 1–3 month exit window unless "
            "thesis strengthens."
        )
    elif score >= 50:
        entry_end = filed_on + timedelta(days=7)
        review = filed_on + timedelta(days=28)
        exit_start = filed_on + timedelta(days=45)
        exit_end = filed_on + timedelta(days=120)
        stop_days = 20
        rationale = (
            "Moderate signal: allow up to a week for liquidity/confirmation after filing, "
            "review near one month, and target a 1.5–4 month hold with tight invalidation."
        )
    else:
        entry_end = filed_on + timedelta(days=3)
        review = filed_on + timedelta(days=14)
        exit_start = filed_on + timedelta(days=21)
        exit_end = filed_on + timedelta(days=60)
        stop_days = 10
        rationale = (
            "Low conviction or sell-pressure name: if watched at all, keep any risk tiny, "
            "revisit within two weeks, and default to standing down."
        )

    if side == "avoid":
        rationale = (
            "Net insider selling / weak buy quality — no long entry suggested. "
            "Revisit only if fresh open-market buying appears."
        )
        entry_end = filed_on
        review = filed_on + timedelta(days=14)
        exit_start = filed_on
        exit_end = filed_on

    return TradeTiming(
        entry_window_start=entry_start,
        entry_window_end=entry_end,
        review_date=review,
        target_exit_start=exit_start,
        target_exit_end=exit_end,
        stop_review_days=stop_days,
        rationale=rationale,
    )


def _summary(
    *,
    side: str,
    ticker: str,
    buyers: int,
    total_buy: float,
    total_sell: float,
    roles: list[InsiderTransaction],
) -> str:
    top_role = "insider"
    if roles:
        ranked = sorted(roles, key=lambda t: _best_role_weight(t.roles), reverse=True)[0]
        if OwnerRole.CEO in ranked.roles:
            top_role = "CEO"
        elif OwnerRole.CFO in ranked.roles:
            top_role = "CFO"
        elif OwnerRole.OFFICER in ranked.roles:
            top_role = ranked.officer_title or "officer"
        elif OwnerRole.DIRECTOR in ranked.roles:
            top_role = "director"
    action = {
        "long": "Candidate long",
        "watch": "Watchlist only",
        "avoid": "Avoid / stand aside",
    }[side]
    return (
        f"{action} on {ticker}: {buyers} buyer(s) including {top_role}, "
        f"${total_buy:,.0f} open-market buys vs ${total_sell:,.0f} sells in the scan window."
    )
