from __future__ import annotations

import logging
import random
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
import yaml

from .shopify_client import Product
from .trends import ScoredProduct

logger = logging.getLogger(__name__)


@dataclass
class PinDraft:
    title: str
    description: str
    alt_text: str
    link: str | None
    matched_keywords: list[str]
    product_id: str
    product_title: str
    image_id: str
    image_src: str
    board_id: str | None = None


def load_brand_config(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {
            "brand_name": "Brand",
            "cta_phrases": ["Shop now"],
            "title_max_chars": 100,
            "description_max_chars": 500,
            "pin_width": 1000,
            "pin_height": 1500,
            "repost_cooldown_days": 30,
        }
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def _strip_html(html: str) -> str:
    text = re.sub(r"<[^>]+>", " ", html or "")
    return re.sub(r"\s+", " ", text).strip()


def _truncate(text: str, max_chars: int) -> str:
    text = text.strip()
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 1].rstrip() + "…"


def compose_with_template(
    scored: ScoredProduct,
    *,
    brand_name: str,
    brand_config: dict[str, Any],
    search_terms: list[str],
    brand_voice: str,
    link_override: str = "",
) -> PinDraft:
    product = scored.product
    keywords = scored.matched_keywords[:4]
    primary_kw = keywords[0] if keywords else (product.product_type or product.tags[0] if product.tags else "shop")
    cta = random.choice(brand_config.get("cta_phrases") or ["Shop now"])

    title = _truncate(f"{product.title} | {primary_kw.title()}", int(brand_config.get("title_max_chars") or 100))

    blurb = _strip_html(product.body_html)
    if not blurb:
        blurb = f"Discover {product.title} from {brand_name}."

    kw_line = " · ".join(dict.fromkeys([*keywords, *search_terms[:3]]))
    description = _truncate(
        f"{blurb} {cta} at {brand_name}. {kw_line}".strip(),
        int(brand_config.get("description_max_chars") or 500),
    )

    alt = _truncate(f"{product.title} — {primary_kw}", 500)
    link = link_override or product.online_store_url

    return PinDraft(
        title=title,
        description=description,
        alt_text=alt,
        link=link,
        matched_keywords=keywords,
        product_id=product.id,
        product_title=product.title,
        image_id=product.primary_image.id if product.primary_image else "",
        image_src=product.primary_image.src if product.primary_image else "",
        board_id=scored.board_id_override,
    )


def compose_with_openai(
    scored: ScoredProduct,
    *,
    brand_name: str,
    brand_voice: str,
    brand_config: dict[str, Any],
    search_terms: list[str],
    api_key: str,
    model: str,
    link_override: str = "",
) -> PinDraft | None:
    """Optional LLM captions. Returns None on failure so caller can fall back to templates."""
    product = scored.product
    prompt = (
        f"Write a Pinterest pin for brand {brand_name}. Voice: {brand_voice}.\n"
        f"Product: {product.title}\n"
        f"Type: {product.product_type}\n"
        f"Tags: {', '.join(product.tags)}\n"
        f"Matched keywords to weave in naturally: {', '.join(scored.matched_keywords) or 'none'}\n"
        f"Extra searchable terms: {', '.join(search_terms)}\n"
        "Return JSON with keys title (<=100 chars), description (<=500 chars), alt_text (<=500 chars).\n"
        "Title should be searchable. Description should include keywords naturally, no hashtag spam."
    )
    try:
        with httpx.Client(timeout=45.0) as client:
            resp = client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": model,
                    "temperature": 0.7,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": "You write high-performing Pinterest SEO copy."},
                        {"role": "user", "content": prompt},
                    ],
                },
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            import json

            data = json.loads(content)
            return PinDraft(
                title=_truncate(str(data.get("title") or product.title), 100),
                description=_truncate(str(data.get("description") or ""), 500),
                alt_text=_truncate(str(data.get("alt_text") or product.title), 500),
                link=link_override or product.online_store_url,
                matched_keywords=scored.matched_keywords,
                product_id=product.id,
                product_title=product.title,
                image_id=product.primary_image.id if product.primary_image else "",
                image_src=product.primary_image.src if product.primary_image else "",
                board_id=scored.board_id_override,
            )
    except Exception as exc:  # noqa: BLE001 — fall back to template
        logger.warning("OpenAI caption failed, using template: %s", exc)
        return None


def compose_pin(
    scored: ScoredProduct,
    *,
    brand_name: str,
    brand_voice: str,
    brand_config: dict[str, Any],
    search_terms: list[str],
    openai_api_key: str = "",
    openai_model: str = "gpt-4o-mini",
    link_override: str = "",
) -> PinDraft:
    if openai_api_key:
        draft = compose_with_openai(
            scored,
            brand_name=brand_name,
            brand_voice=brand_voice,
            brand_config=brand_config,
            search_terms=search_terms,
            api_key=openai_api_key,
            model=openai_model,
            link_override=link_override,
        )
        if draft:
            return draft
    return compose_with_template(
        scored,
        brand_name=brand_name,
        brand_config=brand_config,
        search_terms=search_terms,
        brand_voice=brand_voice,
        link_override=link_override,
    )
