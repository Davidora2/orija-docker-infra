from __future__ import annotations

import base64
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from .config import Settings, get_settings
from .image_processor import download_image, prepare_pin_image
from .pin_composer import compose_pin, load_brand_config
from .pinterest_client import PinterestClient
from .shopify_client import ShopifyClient
from .state import PinRecord, StateStore
from .trends import load_keyword_config, rank_products

logger = logging.getLogger(__name__)


def _in_quiet_hours(settings: Settings) -> bool:
    start = settings.pin_quiet_start_hour
    end = settings.pin_quiet_end_hour
    if start is None or end is None:
        return False
    now = datetime.now(ZoneInfo(settings.pin_timezone))
    hour = now.hour
    if start <= end:
        return start <= hour < end
    # wraps midnight
    return hour >= start or hour < end


def _resolve_product_link(settings: Settings, draft_link: str | None, handle: str) -> str | None:
    if settings.pinterest_default_link:
        return settings.pinterest_default_link
    brand = load_brand_config(settings.config_dir / "brand.yaml")
    website = (brand.get("website") or "").rstrip("/")
    if website and handle:
        return f"{website}/products/{handle}"
    if draft_link and draft_link.startswith("http"):
        return draft_link
    return None


def pick_next_candidate(settings: Settings, state: StateStore):
    if not settings.shopify_ready:
        raise RuntimeError("Shopify credentials missing (SHOPIFY_SHOP_DOMAIN + SHOPIFY_ACCESS_TOKEN)")

    shopify = ShopifyClient(
        settings.shopify_shop_domain,
        settings.shopify_access_token,
        settings.shopify_api_version,
    )
    products = shopify.list_products(
        limit=settings.shopify_product_limit,
        tag_filters=settings.tag_filters,
    )
    if not products:
        raise RuntimeError("No Shopify products with images found")

    kw_config = load_keyword_config(settings.config_dir / "keywords.yaml")
    brand_config = load_brand_config(settings.config_dir / "brand.yaml")
    cooldown = int(brand_config.get("repost_cooldown_days") or 30)

    ranked = rank_products(products, kw_config)
    for scored in ranked:
        product = scored.product
        for image in product.images:
            if state.was_pinned(product.id, image.id, cooldown):
                continue
            # Prefer primary image first; rotate through others over time
            scored.product.images = [image] + [i for i in product.images if i.id != image.id]
            return scored, kw_config, brand_config

    raise RuntimeError("All candidate product images are within repost cooldown")


def run_once(settings: Settings | None = None) -> dict:
    settings = settings or get_settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    drafts_dir = settings.data_dir / "drafts"
    drafts_dir.mkdir(parents=True, exist_ok=True)

    if _in_quiet_hours(settings):
        logger.info("Quiet hours active — skipping this cycle")
        return {"status": "skipped", "reason": "quiet_hours"}

    state = StateStore(settings.data_dir)

    # Prefer refreshed tokens persisted from prior runs
    tokens = state.get_tokens()
    access_token = tokens.get("access_token") or settings.pinterest_access_token
    refresh_token = tokens.get("refresh_token") or settings.pinterest_refresh_token

    scored, kw_config, brand_config = pick_next_candidate(settings, state)
    draft = compose_pin(
        scored,
        brand_name=settings.brand_name,
        brand_voice=settings.brand_voice,
        brand_config=brand_config,
        search_terms=list(kw_config.get("search_terms") or []),
        openai_api_key=settings.openai_api_key,
        openai_model=settings.openai_model,
        link_override=settings.pinterest_default_link,
    )
    draft.link = _resolve_product_link(settings, draft.link, scored.product.handle)
    board_id = draft.board_id or settings.pinterest_board_id

    logger.info(
        "Selected product=%s score=%.2f keywords=%s",
        scored.product.title,
        scored.score,
        draft.matched_keywords,
    )

    raw = download_image(draft.image_src)
    prepared = prepare_pin_image(
        raw,
        target_width=int(brand_config.get("pin_width") or 1000),
        target_height=int(brand_config.get("pin_height") or 1500),
    )
    image_b64 = base64.b64encode(prepared.jpeg_bytes).decode("ascii")

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    draft_meta = {
        "created_at": stamp,
        "mode": settings.pin_agent_mode,
        "score": scored.score,
        "matched_keywords": draft.matched_keywords,
        "title": draft.title,
        "description": draft.description,
        "alt_text": draft.alt_text,
        "link": draft.link,
        "board_id": board_id,
        "product_id": draft.product_id,
        "product_title": draft.product_title,
        "image_id": draft.image_id,
        "image_src": draft.image_src,
        "pin_size": [prepared.width, prepared.height],
    }

    img_path = drafts_dir / f"{stamp}_{draft.product_id}.jpg"
    meta_path = drafts_dir / f"{stamp}_{draft.product_id}.json"
    img_path.write_bytes(prepared.jpeg_bytes)
    meta_path.write_text(json.dumps(draft_meta, indent=2), encoding="utf-8")

    pin_id = None
    if settings.pin_agent_mode == "live":
        if not access_token or not board_id:
            raise RuntimeError("Live mode requires PINTEREST_ACCESS_TOKEN and PINTEREST_BOARD_ID")

        client = PinterestClient(
            access_token=access_token,
            api_base=settings.pinterest_api_base,
            app_id=settings.pinterest_app_id,
            app_secret=settings.pinterest_app_secret,
            refresh_token=refresh_token,
            on_token_refresh=lambda a, r: state.set_tokens(a, r),
        )
        result = client.create_pin(
            board_id=board_id,
            title=draft.title,
            description=draft.description,
            link=draft.link,
            image_base64=image_b64,
            content_type=prepared.content_type,
            alt_text=draft.alt_text,
        )
        pin_id = str(result.get("id") or "")
        draft_meta["pinterest_pin_id"] = pin_id
        draft_meta["pinterest_response"] = result
        meta_path.write_text(json.dumps(draft_meta, indent=2), encoding="utf-8")
        logger.info("Posted Pinterest pin id=%s", pin_id)
    else:
        logger.info("Dry run — draft saved to %s", meta_path)

    state.record(
        PinRecord(
            product_id=draft.product_id,
            image_id=draft.image_id,
            title=draft.title,
            posted_at=datetime.now(timezone.utc).isoformat(),
            mode=settings.pin_agent_mode,
            pinterest_pin_id=pin_id,
            draft_path=str(meta_path),
        )
    )

    return {"status": "ok", "mode": settings.pin_agent_mode, "draft": draft_meta, "pin_id": pin_id}
