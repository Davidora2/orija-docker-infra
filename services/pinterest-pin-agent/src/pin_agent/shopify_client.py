from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)


@dataclass
class ProductImage:
    id: str
    src: str
    alt: str | None = None
    width: int | None = None
    height: int | None = None


@dataclass
class Product:
    id: str
    title: str
    handle: str
    body_html: str
    product_type: str
    vendor: str
    tags: list[str]
    status: str
    online_store_url: str | None
    images: list[ProductImage] = field(default_factory=list)
    updated_at: str | None = None

    @property
    def primary_image(self) -> ProductImage | None:
        return self.images[0] if self.images else None


class ShopifyClient:
    def __init__(
        self,
        shop_domain: str,
        access_token: str,
        api_version: str = "2025-01",
        timeout: float = 30.0,
    ) -> None:
        domain = shop_domain.replace("https://", "").replace("http://", "").rstrip("/")
        self.base = f"https://{domain}/admin/api/{api_version}"
        self.headers = {
            "X-Shopify-Access-Token": access_token,
            "Content-Type": "application/json",
        }
        self.timeout = timeout

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
    def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        url = f"{self.base}{path}"
        with httpx.Client(timeout=self.timeout, headers=self.headers) as client:
            resp = client.get(url, params=params)
            resp.raise_for_status()
            return resp.json()

    def list_products(
        self,
        limit: int = 50,
        tag_filters: list[str] | None = None,
        status: str = "active",
    ) -> list[Product]:
        """Fetch products via REST Admin API (sufficient for read + images)."""
        params: dict[str, Any] = {
            "limit": min(limit, 250),
            "status": status,
            "fields": "id,title,handle,body_html,product_type,vendor,tags,status,images,updated_at",
        }
        data = self._get("/products.json", params=params)
        products: list[Product] = []
        tag_filters = [t.lower() for t in (tag_filters or [])]

        for raw in data.get("products", []):
            tags = [t.strip() for t in (raw.get("tags") or "").split(",") if t.strip()]
            if tag_filters:
                lower_tags = {t.lower() for t in tags}
                if not any(f in lower_tags for f in tag_filters):
                    continue

            images = [
                ProductImage(
                    id=str(img["id"]),
                    src=img["src"],
                    alt=img.get("alt"),
                    width=img.get("width"),
                    height=img.get("height"),
                )
                for img in raw.get("images") or []
                if img.get("src")
            ]
            if not images:
                continue

            handle = raw.get("handle") or ""
            # Link is finalized later using brand.yaml website or PINTEREST_DEFAULT_LINK.
            online_url = f"/products/{handle}" if handle else None

            products.append(
                Product(
                    id=str(raw["id"]),
                    title=raw.get("title") or "Untitled",
                    handle=handle,
                    body_html=raw.get("body_html") or "",
                    product_type=raw.get("product_type") or "",
                    vendor=raw.get("vendor") or "",
                    tags=tags,
                    status=raw.get("status") or status,
                    online_store_url=online_url,
                    images=images,
                    updated_at=raw.get("updated_at"),
                )
            )

        logger.info("Fetched %d Shopify products with images", len(products))
        return products[:limit]
