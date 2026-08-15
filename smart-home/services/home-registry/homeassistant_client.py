"""Home Assistant REST client for HomePulse."""

from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger("homeassistant")


class HomeAssistantClient:
    def __init__(self, base_url: str, token: str, timeout: float = 20.0):
        self.base_url = (base_url or "").rstrip("/")
        self.token = (token or "").strip()
        self.timeout = timeout

    @property
    def configured(self) -> bool:
        return bool(self.base_url and self.token)

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

    async def get(self, path: str, **kwargs: Any) -> httpx.Response:
        if not self.configured:
            raise RuntimeError("Home Assistant is not configured")
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            return await client.get(f"{self.base_url}{path}", headers=self._headers(), **kwargs)

    async def post(self, path: str, json: dict[str, Any] | None = None) -> httpx.Response:
        if not self.configured:
            raise RuntimeError("Home Assistant is not configured")
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            return await client.post(
                f"{self.base_url}{path}",
                headers=self._headers(),
                json=json or {},
            )

    async def health(self) -> dict[str, Any]:
        try:
            resp = await self.get("/api/")
            if resp.status_code >= 400:
                return {"ok": False, "status": resp.status_code, "body": resp.text[:200]}
            data = resp.json()
            return {"ok": True, "message": data.get("message"), "base_url": self.base_url}
        except Exception as exc:  # noqa: BLE001
            return {"ok": False, "error": str(exc), "base_url": self.base_url}

    async def states(self) -> list[dict[str, Any]]:
        resp = await self.get("/api/states")
        resp.raise_for_status()
        data = resp.json()
        return data if isinstance(data, list) else []

    async def state(self, entity_id: str) -> dict[str, Any]:
        resp = await self.get(f"/api/states/{entity_id}")
        if resp.status_code == 404:
            raise LookupError(entity_id)
        resp.raise_for_status()
        return resp.json()

    async def call_service(self, domain: str, service: str, data: dict[str, Any]) -> Any:
        resp = await self.post(f"/api/services/{domain}/{service}", json=data)
        resp.raise_for_status()
        if resp.content:
            try:
                return resp.json()
            except Exception:  # noqa: BLE001
                return {"ok": True}
        return {"ok": True}

    async def camera_proxy_bytes(self, entity_id: str) -> tuple[bytes, str]:
        """Fetch a still JPEG from a camera entity."""
        resp = await self.get(f"/api/camera_proxy/{entity_id}")
        resp.raise_for_status()
        ctype = resp.headers.get("content-type", "image/jpeg")
        return resp.content, ctype


def summarize_entity(entity: dict[str, Any]) -> dict[str, Any]:
    eid = entity.get("entity_id") or ""
    domain = eid.split(".", 1)[0] if "." in eid else ""
    attrs = entity.get("attributes") or {}
    return {
        "entity_id": eid,
        "domain": domain,
        "state": entity.get("state"),
        "name": attrs.get("friendly_name") or eid,
        "device_class": attrs.get("device_class"),
        "supported_features": attrs.get("supported_features"),
        "unit": attrs.get("unit_of_measurement"),
        "is_camera": domain == "camera",
        "is_blink": "blink" in eid.lower() or "blink" in str(attrs.get("friendly_name", "")).lower(),
        "controllable": domain in {"switch", "light", "lock", "cover", "fan", "input_boolean", "script", "scene", "button"},
    }


CONTROLLABLE_DOMAINS = {
    "switch",
    "light",
    "lock",
    "cover",
    "fan",
    "input_boolean",
    "script",
    "scene",
    "button",
    "camera",
}


def map_ha_action(domain: str, action: str) -> tuple[str, str, dict[str, Any]]:
    """Return (domain, service, extra_data) for a simple action name."""
    act = action.strip().lower()
    if domain == "light":
        if act in {"on", "turn_on", "light_on"}:
            return "light", "turn_on", {}
        if act in {"off", "turn_off", "light_off"}:
            return "light", "turn_off", {}
        if act == "toggle":
            return "light", "toggle", {}
    if domain == "switch" or domain == "input_boolean" or domain == "fan":
        if act in {"on", "turn_on"}:
            return domain, "turn_on", {}
        if act in {"off", "turn_off"}:
            return domain, "turn_off", {}
        if act == "toggle":
            return domain, "toggle", {}
    if domain == "lock":
        if act in {"lock", "on"}:
            return "lock", "lock", {}
        if act in {"unlock", "off"}:
            return "lock", "unlock", {}
    if domain == "cover":
        if act in {"open", "on"}:
            return "cover", "open_cover", {}
        if act in {"close", "off"}:
            return "cover", "close_cover", {}
        if act == "stop":
            return "cover", "stop_cover", {}
    if domain == "script":
        return "script", "turn_on", {}
    if domain == "scene":
        return "scene", "turn_on", {}
    if domain == "button":
        return "button", "press", {}
    if domain == "camera":
        # Trigger snapshot / blink update style services when available
        if act in {"snapshot", "update", "trigger"}:
            return "camera", "snapshot", {}
    raise ValueError(f"Unsupported action '{action}' for domain '{domain}'")
