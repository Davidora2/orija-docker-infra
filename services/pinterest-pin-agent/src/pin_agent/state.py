from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class PinRecord:
    product_id: str
    image_id: str
    title: str
    posted_at: str
    mode: str
    pinterest_pin_id: str | None = None
    draft_path: str | None = None


class StateStore:
    """Tracks which product images have already been pinned."""

    def __init__(self, data_dir: Path) -> None:
        self.data_dir = data_dir
        self.path = data_dir / "state.json"
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self._data: dict[str, Any] = {"pins": [], "tokens": {}}
        self._load()

    def _load(self) -> None:
        if self.path.exists():
            self._data = json.loads(self.path.read_text(encoding="utf-8"))
            self._data.setdefault("pins", [])
            self._data.setdefault("tokens", {})

    def save(self) -> None:
        self.path.write_text(json.dumps(self._data, indent=2), encoding="utf-8")

    def was_pinned(self, product_id: str, image_id: str, cooldown_days: int) -> bool:
        cutoff = datetime.now(timezone.utc).timestamp() - cooldown_days * 86400
        for pin in self._data["pins"]:
            if pin.get("product_id") != product_id or pin.get("image_id") != image_id:
                continue
            try:
                posted = datetime.fromisoformat(pin["posted_at"]).timestamp()
            except (KeyError, ValueError):
                return True
            if posted >= cutoff:
                return True
        return False

    def record(self, record: PinRecord) -> None:
        self._data["pins"].append(
            {
                "product_id": record.product_id,
                "image_id": record.image_id,
                "title": record.title,
                "posted_at": record.posted_at,
                "mode": record.mode,
                "pinterest_pin_id": record.pinterest_pin_id,
                "draft_path": record.draft_path,
            }
        )
        self.save()

    def get_tokens(self) -> dict[str, str]:
        return dict(self._data.get("tokens") or {})

    def set_tokens(self, access_token: str, refresh_token: str | None = None) -> None:
        tokens = self._data.setdefault("tokens", {})
        tokens["access_token"] = access_token
        if refresh_token:
            tokens["refresh_token"] = refresh_token
        tokens["updated_at"] = datetime.now(timezone.utc).isoformat()
        self.save()

    def recent_product_ids(self, limit: int = 100) -> set[str]:
        pins = self._data["pins"][-limit:]
        return {p["product_id"] for p in pins if "product_id" in p}
