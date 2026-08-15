"""Home Assistant → HomePulse ingest.

Listens to HA websocket state changes for Blink doorbell dings
(`event.*_ding`) and publishes normalized `doorbell.ring` events so
subscribed phones get push notifications when the physical bell is pressed.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import sys
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

import httpx
import websockets
from websockets.exceptions import ConnectionClosed

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "shared"))
from homepulse.events import DeviceEvent, EventType  # noqa: E402
from homepulse.streams import AUDIT_STREAM, EVENTS_STREAM, get_redis, publish  # noqa: E402

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("ha-ingest")

HA_BASE_URL = os.getenv("HA_BASE_URL", "http://homeassistant:8123").rstrip("/")
HA_TOKEN = os.getenv("HA_TOKEN", "").strip()
HA_TOKEN_FILE = os.getenv("HA_TOKEN_FILE", "/secrets/ha-token.txt")
REGISTRY_URL = os.getenv("REGISTRY_URL", "http://home-registry:8000")
NOTIFY_ON_MOTION = os.getenv("NOTIFY_ON_MOTION", "false").lower() in {"1", "true", "yes"}
DEBOUNCE_SECONDS = float(os.getenv("HA_INGEST_DEBOUNCE_SECONDS", "8"))


def load_token() -> str:
    if HA_TOKEN:
        return HA_TOKEN
    try:
        from pathlib import Path

        p = Path(HA_TOKEN_FILE)
        if p.is_file():
            return p.read_text().strip()
    except Exception:  # noqa: BLE001
        pass
    return ""


def ws_url(http_base: str) -> str:
    parsed = urlparse(http_base)
    scheme = "wss" if parsed.scheme == "https" else "ws"
    return f"{scheme}://{parsed.netloc}/api/websocket"


def stem_from_entity(entity_id: str) -> str:
    # event.front_door_ding → front_door
    local = entity_id.split(".", 1)[-1]
    local = re.sub(r"_(ding|motion|button|doorbell)$", "", local)
    return local.replace("_", " ").strip().lower()


class HaIngest:
    def __init__(self) -> None:
        self.token = load_token()
        self.redis = None
        self._last_fire: dict[str, float] = {}
        self._device_cache: list[dict[str, Any]] = []
        self._cache_at = 0.0

    async def refresh_devices(self) -> list[dict[str, Any]]:
        now = asyncio.get_event_loop().time()
        if self._device_cache and now - self._cache_at < 60:
            return self._device_cache
        async with httpx.AsyncClient(timeout=15.0) as client:
            homes = (await client.get(f"{REGISTRY_URL}/v1/internal/homes")).json().get("homes") or []
            devices: list[dict[str, Any]] = []
            for home in homes:
                hid = home.get("home_id")
                if not hid:
                    continue
                ctx = (await client.get(f"{REGISTRY_URL}/v1/internal/homes/{hid}/context")).json()
                for d in ctx.get("devices") or []:
                    d = dict(d)
                    d["home_id"] = hid
                    devices.append(d)
        self._device_cache = devices
        self._cache_at = now
        return devices

    def pick_doorbell(self, devices: list[dict[str, Any]], entity_id: str, friendly: str) -> dict[str, Any] | None:
        doorbells = [
            d
            for d in devices
            if (d.get("role") == "doorbell" or d.get("device_type") == "doorbell")
            and (d.get("vendor") or "").lower() in {"blink", "ring", "esphome", "mqtt", ""}
        ]
        if not doorbells:
            doorbells = [d for d in devices if (d.get("role") == "doorbell" or d.get("device_type") == "doorbell")]
        if not doorbells:
            return None

        stem = stem_from_entity(entity_id)
        fname = (friendly or "").strip().lower()
        scored: list[tuple[int, dict[str, Any]]] = []
        for d in doorbells:
            name = (d.get("name") or "").strip().lower()
            vendor = (d.get("vendor") or "").lower()
            score = 0
            if vendor == "blink":
                score += 5
            if stem and stem in name:
                score += 10
            if fname and (fname in name or name in fname):
                score += 8
            if "front" in name and "front" in (stem + " " + fname):
                score += 3
            scored.append((score, d))
        scored.sort(key=lambda x: x[0], reverse=True)
        best_score, best = scored[0]
        if best_score <= 0 and len(doorbells) == 1:
            return doorbells[0]
        return best if best_score > 0 else (doorbells[0] if len(doorbells) == 1 else best)

    def debounced(self, key: str) -> bool:
        now = asyncio.get_event_loop().time()
        prev = self._last_fire.get(key, 0.0)
        if now - prev < DEBOUNCE_SECONDS:
            return True
        self._last_fire[key] = now
        return False

    async def publish_ding(
        self,
        *,
        device: dict[str, Any],
        entity_id: str,
        event_type: EventType,
        friendly: str,
        new_state: str,
    ) -> None:
        location = device.get("location_label") or device.get("name") or friendly or "Front door"
        if event_type == EventType.DOORBELL_RING:
            title = "Doorbell"
            body = f"Someone rang the {location} doorbell"
        else:
            title = "Doorbell motion"
            body = f"Motion detected at {location}"

        event = DeviceEvent(
            home_id=device["home_id"],
            device_id=device["device_id"],
            device_type=device.get("device_type", "doorbell"),
            vendor=device.get("vendor") or "blink",
            event_type=event_type,
            occurred_at=datetime.now(timezone.utc),
            title=title,
            body=body,
            payload={
                "ha_entity_id": entity_id,
                "ha_state": new_state,
                "friendly_name": friendly,
                "source": "homeassistant",
            },
            source="ha-ingest.websocket",
        )
        assert self.redis is not None
        msg_id = await publish(self.redis, EVENTS_STREAM, event.to_stream_fields())
        await publish(
            self.redis,
            AUDIT_STREAM,
            {"json": event.model_dump_json(), "audit_type": "event.ingested"},
        )
        logger.info(
            "HA %s → %s device=%s stream=%s",
            entity_id,
            event.event_type,
            device.get("name"),
            msg_id,
        )

    async def handle_state_changed(self, event: dict[str, Any]) -> None:
        data = event.get("data") or {}
        entity_id = str(data.get("entity_id") or "")
        new_state = data.get("new_state") or {}
        old_state = data.get("old_state") or {}
        if not entity_id or not isinstance(new_state, dict):
            return

        attrs = new_state.get("attributes") or {}
        friendly = str(attrs.get("friendly_name") or "")
        new_val = str(new_state.get("state") or "")
        old_val = str((old_state or {}).get("state") or "") if isinstance(old_state, dict) else ""

        event_type: EventType | None = None
        eid_l = entity_id.lower()

        if eid_l.startswith("event.") and eid_l.endswith("_ding"):
            # Blink ding event entity updates its timestamp state when pressed
            if new_val and new_val != old_val and new_val not in {"unknown", "unavailable"}:
                event_type = EventType.DOORBELL_RING
        elif eid_l.startswith("event.") and eid_l.endswith("_motion") and NOTIFY_ON_MOTION:
            if new_val and new_val != old_val and new_val not in {"unknown", "unavailable"}:
                event_type = EventType.DOORBELL_MOTION
        elif eid_l.startswith("binary_sensor.") and "motion" in eid_l and NOTIFY_ON_MOTION:
            if new_val == "on" and old_val != "on":
                event_type = EventType.DOORBELL_MOTION
        elif eid_l.startswith("binary_sensor.") and any(x in eid_l for x in ("ding", "doorbell", "button")):
            if new_val == "on" and old_val != "on":
                event_type = EventType.DOORBELL_RING

        if event_type is None:
            return

        debounce_key = f"{entity_id}:{event_type.value}"
        if self.debounced(debounce_key):
            logger.debug("Debounced %s", debounce_key)
            return

        devices = await self.refresh_devices()
        device = self.pick_doorbell(devices, entity_id, friendly)
        if not device:
            logger.warning("HA event %s but no doorbell device registered in HomePulse", entity_id)
            return

        await self.publish_ding(
            device=device,
            entity_id=entity_id,
            event_type=event_type,
            friendly=friendly,
            new_state=new_val,
        )

    async def run_forever(self) -> None:
        if not self.token:
            logger.error("HA_TOKEN not set — ha-ingest idle (physical Blink dings will not notify)")
            while True:
                await asyncio.sleep(60)
                self.token = load_token()
                if self.token:
                    break

        self.redis = await get_redis()
        url = ws_url(HA_BASE_URL)
        logger.info("Connecting to Home Assistant websocket %s", url)

        backoff = 2.0
        while True:
            try:
                async with websockets.connect(url, ping_interval=20, ping_timeout=20) as ws:
                    # auth_required
                    msg = json.loads(await ws.recv())
                    if msg.get("type") != "auth_required":
                        raise RuntimeError(f"Unexpected first message: {msg}")
                    await ws.send(json.dumps({"type": "auth", "access_token": self.token}))
                    msg = json.loads(await ws.recv())
                    if msg.get("type") != "auth_ok":
                        raise RuntimeError(f"HA auth failed: {msg}")
                    logger.info("Home Assistant websocket authenticated")
                    backoff = 2.0

                    await ws.send(
                        json.dumps(
                            {
                                "id": 1,
                                "type": "subscribe_events",
                                "event_type": "state_changed",
                            }
                        )
                    )
                    # confirmation
                    conf = json.loads(await ws.recv())
                    if not conf.get("success", True) and conf.get("type") == "result" and conf.get("success") is False:
                        raise RuntimeError(f"subscribe_events failed: {conf}")
                    logger.info("Subscribed to HA state_changed (Blink ding → HomePulse push)")

                    async for raw in ws:
                        try:
                            payload = json.loads(raw)
                        except json.JSONDecodeError:
                            continue
                        if payload.get("type") != "event":
                            continue
                        event = payload.get("event") or {}
                        if event.get("event_type") != "state_changed":
                            continue
                        try:
                            await self.handle_state_changed(event)
                        except Exception:  # noqa: BLE001
                            logger.exception("Failed handling HA state_changed")
            except ConnectionClosed as exc:
                logger.warning("HA websocket closed (%s) — reconnecting in %.0fs", exc, backoff)
            except Exception as exc:  # noqa: BLE001
                logger.warning("HA websocket error (%s) — reconnecting in %.0fs", exc, backoff)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 1.7, 60.0)


async def main() -> None:
    worker = HaIngest()
    await worker.run_forever()


if __name__ == "__main__":
    asyncio.run(main())
