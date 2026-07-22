from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml

from .shopify_client import Product

logger = logging.getLogger(__name__)


@dataclass
class ScoredProduct:
    product: Product
    score: float
    matched_keywords: list[str]
    board_id_override: str | None = None


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower()).strip()


def load_keyword_config(path: Path) -> dict[str, Any]:
    if not path.exists():
        logger.warning("Keyword config missing at %s — using empty defaults", path)
        return {"keywords": [], "seasonal": [], "search_terms": [], "board_routing": {}}
    with path.open(encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    data.setdefault("keywords", [])
    data.setdefault("seasonal", [])
    data.setdefault("search_terms", [])
    data.setdefault("board_routing", {})
    return data


def active_seasonal_phrases(config: dict[str, Any], now: datetime | None = None) -> list[tuple[str, float]]:
    now = now or datetime.now()
    month = now.month
    out: list[tuple[str, float]] = []
    for block in config.get("seasonal") or []:
        months = block.get("months") or []
        if month not in months:
            continue
        boost = float(block.get("boost") or 1.2)
        for phrase in block.get("phrases") or []:
            out.append((str(phrase), boost))
    return out


def score_product(product: Product, config: dict[str, Any], now: datetime | None = None) -> ScoredProduct:
    """
    Rank a product by keyword overlap with title, type, tags, and body.
    This is the 'what's trending for us' signal until Pinterest Trends API access is available.
    """
    haystack = _normalize(
        " ".join(
            [
                product.title,
                product.product_type,
                " ".join(product.tags),
                re.sub(r"<[^>]+>", " ", product.body_html),
            ]
        )
    )

    score = 0.0
    matched: list[str] = []

    for item in config.get("keywords") or []:
        phrase = str(item.get("phrase") or "").strip()
        if not phrase:
            continue
        weight = float(item.get("weight") or 1.0)
        if _normalize(phrase) in haystack:
            score += weight
            matched.append(phrase)

    for phrase, boost in active_seasonal_phrases(config, now):
        if _normalize(phrase) in haystack:
            score += boost
            matched.append(phrase)
        else:
            # Soft seasonal lift for products that share a token with seasonal phrases
            tokens = [t for t in _normalize(phrase).split() if len(t) > 3]
            if any(t in haystack for t in tokens):
                score += boost * 0.25

    # Prefer products with richer imagery / tags
    score += min(len(product.images), 3) * 0.05
    score += min(len(product.tags), 5) * 0.02

    board_override = None
    routing = config.get("board_routing") or {}
    for kw in matched:
        if kw in routing:
            board_override = str(routing[kw])
            break

    return ScoredProduct(
        product=product,
        score=score,
        matched_keywords=matched,
        board_id_override=board_override,
    )


def rank_products(products: list[Product], config: dict[str, Any]) -> list[ScoredProduct]:
    scored = [score_product(p, config) for p in products]
    scored.sort(key=lambda s: s.score, reverse=True)
    return scored
