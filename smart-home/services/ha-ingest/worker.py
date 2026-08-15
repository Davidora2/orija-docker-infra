"""Home Assistant → HomePulse ingest.

Blink's cloud API does **not** expose doorbell button presses to Home Assistant.
`event.*_ding` entities attributed to Ring.com are for Ring devices.

Supported ding sources:
1. HA `input_boolean.*` helpers flipped by an Alexa routine (Blink → Alexa → HA)
2. Ring `event.*_ding` / last_activity (when Ring is actually linked)
3. Optional: Blink motion / camera activity (approx — not a true button press)

Publishes normalized `doorbell.ring` (or motion) onto Redis for the rules engine.
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
# Treat Blink camera/motion activity as a ding (imperfect; Blink has no real ding entity)
BLINK_ACTIVITY_AS_DING = os.getenv("BLINK_ACTIVITY_AS_DING", "true").lower() in {"1", "true", "yes"}
DEBOUNCE_SECONDS = float(os.getenv("HA_INGEST_DEBOUNCE_SECONDS", "8"))
POLL_SECONDS = float(os.getenv("HA_INGEST_POLL_SECONDS", "20"))
HELPER_ENTITY = os.getenv("HA_DING_HELPER_ENTITY", "input_boolean.blink_front_door_ding")


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
    local = entity_id.split(".", 1)[-1]
    local = re.sub(r"^(blink_|ha_)", "", local)
    local = re.sub(r"_(ding|motion|button|doorbell|last_activity|live_view|pressed)$", "", local)
    return local.replace("_", " ").strip().lower()


class HaIngest:
    def __init__(self) -> None:
        self.token = load_token()
        self.redis = None
        self._last_fire: dict[str, float] = {}
        self._device_cache: list[dict[str, Any]] = []
        self._cache_at = 0.0
        self._poll_snapshot: dict[str, str] = {}
        self._http = httpx.AsyncClient(timeout=20.0)

    async def close(self) -> None:
        await self._http.aclose()

    def ha_headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}

    async def ha_get_state(self, entity_id: str) -> dict[str, Any] | None:
        resp = await self._http.get(f"{HA_BASE_URL}/api/states/{entity_id}", headers=self.ha_headers())
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return resp.json()

    async def ha_turn_off_helper(self, entity_id: str) -> None:
        try:
            await self._http.post(
                f"{HA_BASE_URL}/api/services/input_boolean/turn_off",
                headers=self.ha_headers(),
                json={"entity_id": entity_id},
            )
        except Exception:  # noqa: BLE001
            logger.exception("Failed to reset helper %s", entity_id)

    async def refresh_devices(self) -> list[dict[str, Any]]:
        now = asyncio.get_event_loop().time()
        if self._device_cache and now - self._cache_at < 60:
            return self._device_cache
        homes = (await self._http.get(f"{REGISTRY_URL}/v1/internal/homes")).json().get("homes") or []
        devices: list[dict[str, Any]] = []
        for home in homes:
            hid = home.get("home_id")
            if not hid:
                continue
            ctx = (await self._http.get(f"{REGISTRY_URL}/v1/internal/homes/{hid}/context")).json()
            for d in ctx.get("devices") or []:
                d = dict(d)
                d["home_id"] = hid
                devices.append(d)
        self._device_cache = devices
        self._cache_at = now
        return devices

    def pick_doorbell(
        self, devices: list[dict[str, Any]], entity_id: str, friendly: str, *, prefer_vendor: str | None = None
    ) -> dict[str, Any] | None:
        doorbells = [
            d
            for d in devices
            if (d.get("role") == "doorbell" or d.get("device_type") == "doorbell")
        ]
        if not doorbells:
            return None
        stem = stem_from_entity(entity_id)
        fname = (friendly or "").strip().lower()
        scored: list[tuple[int, dict[str, Any]]] = []
        for d in doorbells:
            name = (d.get("name") or "").strip().lower()
            vendor = (d.get("vendor") or "").lower()
            score = 0
            if prefer_vendor and vendor == prefer_vendor.lower():
                score += 12
            if stem and stem in name:
                score += 10
            if fname and (fname in name or name in fname or "front door" in name):
                score += 6
            if "front" in name and "front" in (stem + " " + fname):
                score += 2
            scored.append((score, d))
        scored.sort(key=lambda x: x[0], reverse=True)
        best_score, best = scored[0]
        if best_score <= 0 and len(doorbells) == 1:
            return doorbells[0]
        return best

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
        note: str = "",
    ) -> None:
        location = device.get("location_label") or device.get("name") or friendly or "Front door"
        if event_type == EventType.DOORBELL_RING:
            title = "Doorbell"
            body = f"Someone rang the {location} doorbell"
        else:
            title = "Doorbell motion"
            body = f"Motion detected at {location}"
        if note:
            body = f"{body} ({note})"

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
                "note": note,
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
            "HA %s → %s device=%s stream=%s note=%s",
            entity_id,
            event.event_type,
            device.get("name"),
            msg_id,
            note or "-",
        )

    async def emit(
        self,
        *,
        entity_id: str,
        friendly: str,
        new_state: str,
        event_type: EventType,
        prefer_vendor: str | None,
        note: str = "",
    ) -> None:
        key = f"{entity_id}:{event_type.value}"
        if self.debounced(key):
            return
        devices = await self.refresh_devices()
        device = self.pick_doorbell(devices, entity_id, friendly, prefer_vendor=prefer_vendor)
        if not device:
            logger.warning("HA event %s but no doorbell device registered", entity_id)
            return
        await self.publish_ding(
            device=device,
            entity_id=entity_id,
            event_type=event_type,
            friendly=friendly,
            new_state=new_state,
            note=note,
        )

    async def handle_state_changed(self, event: dict[str, Any]) -> None:
        data = event.get("data") or {}
        entity_id = str(data.get("entity_id") or "")
        new_state = data.get("new_state") or {}
        old_state = data.get("old_state") or {}
        if not entity_id or not isinstance(new_state, dict):
            return

        attrs = new_state.get("attributes") or {}
        old_attrs = old_state.get("attributes") or {} if isinstance(old_state, dict) else {}
        friendly = str(attrs.get("friendly_name") or "")
        attribution = str(attrs.get("attribution") or "")
        brand = str(attrs.get("brand") or "")
        new_val = str(new_state.get("state") or "")
        old_val = str((old_state or {}).get("state") or "") if isinstance(old_state, dict) else ""
        eid_l = entity_id.lower()

        # 1) Alexa/helper bridge — the reliable Blink button path
        if eid_l.startswith("input_boolean.") and any(
            x in eid_l for x in ("ding", "doorbell", "blink", "bell", "pressed")
        ):
            if new_val == "on" and old_val != "on":
                await self.emit(
                    entity_id=entity_id,
                    friendly=friendly or "Blink doorbell",
                    new_state=new_val,
                    event_type=EventType.DOORBELL_RING,
                    prefer_vendor="blink",
                    note="via Alexa/helper",
                )
                await self.ha_turn_off_helper(entity_id)
            return

        # 2) Ring ding event entity (only if Ring attribution / not unknown forever)
        if eid_l.startswith("event.") and eid_l.endswith("_ding"):
            if new_val and new_val != old_val and new_val not in {"unknown", "unavailable"}:
                prefer = "ring" if "ring.com" in attribution.lower() else "blink"
                await self.emit(
                    entity_id=entity_id,
                    friendly=friendly,
                    new_state=new_val,
                    event_type=EventType.DOORBELL_RING,
                    prefer_vendor=prefer,
                    note="ha event ding",
                )
            return

        # 3) Motion / activity (optional)
        if eid_l.startswith("event.") and eid_l.endswith("_motion") and NOTIFY_ON_MOTION:
            if new_val and new_val != old_val and new_val not in {"unknown", "unavailable"}:
                await self.emit(
                    entity_id=entity_id,
                    friendly=friendly,
                    new_state=new_val,
                    event_type=EventType.DOORBELL_MOTION,
                    prefer_vendor="ring" if "ring.com" in attribution.lower() else None,
                )
            return

        if eid_l.startswith("binary_sensor.") and "motion" in eid_l:
            if new_val == "on" and old_val != "on":
                if BLINK_ACTIVITY_AS_DING or NOTIFY_ON_MOTION:
                    et = EventType.DOORBELL_RING if BLINK_ACTIVITY_AS_DING else EventType.DOORBELL_MOTION
                    await self.emit(
                        entity_id=entity_id,
                        friendly=friendly,
                        new_state=new_val,
                        event_type=et,
                        prefer_vendor="blink",
                        note="blink motion sensor",
                    )
            return

        # 4) Blink camera attribute changes (poll-based activity after a press/motion)
        if eid_l.startswith("camera.") and (
            brand.lower() == "blink" or "blink" in friendly.lower() or attrs.get("type") == "lotus"
        ):
            if not BLINK_ACTIVITY_AS_DING:
                return
            old_md = old_attrs.get("motion_detected") if isinstance(old_attrs, dict) else None
            new_md = attrs.get("motion_detected")
            old_lr = old_attrs.get("last_record") if isinstance(old_attrs, dict) else None
            new_lr = attrs.get("last_record")
            old_thumb = str((old_attrs or {}).get("thumbnail") or "")
            new_thumb = str(attrs.get("thumbnail") or "")
            triggered = False
            note = ""
            if new_md is True and old_md is not True:
                triggered = True
                note = "blink motion_detected"
            elif new_lr and new_lr != old_lr:
                triggered = True
                note = "blink new recording"
            elif new_thumb and new_thumb != old_thumb and "ts=" in new_thumb:
                # thumbnail timestamp query param changed
                old_ts = re.search(r"ts=(\d+)", old_thumb)
                new_ts = re.search(r"ts=(\d+)", new_thumb)
                if new_ts and (not old_ts or new_ts.group(1) != old_ts.group(1)):
                    triggered = True
                    note = "blink thumbnail update"
            if triggered:
                await self.emit(
                    entity_id=entity_id,
                    friendly=friendly,
                    new_state=new_val,
                    event_type=EventType.DOORBELL_RING,
                    prefer_vendor="blink",
                    note=note,
                )

    async def poll_loop(self) -> None:
        """Blink updates are often poll-delayed; compare snapshots periodically."""
        watch = [
            HELPER_ENTITY,
            "binary_sensor.front_door_motion",
            "camera.front_door",
            "event.front_door_ding",
        ]
        while True:
            try:
                for eid in watch:
                    try:
                        state = await self.ha_get_state(eid)
                    except Exception as exc:  # noqa: BLE001
                        logger.debug("poll %s: %s", eid, exc)
                        continue
                    if not state:
                        continue
                    attrs = state.get("attributes") or {}
                    snap = json.dumps(
                        {
                            "state": state.get("state"),
                            "motion_detected": attrs.get("motion_detected"),
                            "last_record": attrs.get("last_record"),
                            "thumbnail": attrs.get("thumbnail"),
                            "event_type": attrs.get("event_type"),
                        },
                        sort_keys=True,
                        default=str,
                    )
                    prev = self._poll_snapshot.get(eid)
                    if prev is None:
                        self._poll_snapshot[eid] = snap
                        continue
                    if snap == prev:
                        continue
                    logger.info("Poll change detected on %s", eid)
                    fake_event = {
                        "data": {
                            "entity_id": eid,
                            "old_state": {
                                "state": json.loads(prev).get("state"),
                                "attributes": {
                                    "motion_detected": json.loads(prev).get("motion_detected"),
                                    "last_record": json.loads(prev).get("last_record"),
                                    "thumbnail": json.loads(prev).get("thumbnail"),
                                    "friendly_name": attrs.get("friendly_name"),
                                    "brand": attrs.get("brand"),
                                    "type": attrs.get("type"),
                                    "attribution": attrs.get("attribution"),
                                },
                            },
                            "new_state": state,
                        }
                    }
                    self._poll_snapshot[eid] = snap
                    await self.handle_state_changed(fake_event)
            except Exception:  # noqa: BLE001
                logger.exception("poll loop error")
            await asyncio.sleep(POLL_SECONDS)

    async def run_forever(self) -> None:
        if not self.token:
            logger.error("HA_TOKEN not set — ha-ingest idle")
            while True:
                await asyncio.sleep(60)
                self.token = load_token()
                if self.token:
                    break

        self.redis = await get_redis()
        url = ws_url(HA_BASE_URL)
        logger.info(
            "HA ingest starting (helper=%s blink_activity_as_ding=%s poll=%ss)",
            HELPER_ENTITY,
            BLINK_ACTIVITY_AS_DING,
            POLL_SECONDS,
        )
        asyncio.create_task(self.poll_loop())

        backoff = 2.0
        while True:
            try:
                async with websockets.connect(url, ping_interval=20, ping_timeout=20) as ws:
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
                        json.dumps({"id": 1, "type": "subscribe_events", "event_type": "state_changed"})
                    )
                    _ = json.loads(await ws.recv())
                    logger.info(
                        "Subscribed to HA state_changed — "
                        "Blink button needs Alexa→%s (Blink API has no ding entity)",
                        HELPER_ENTITY,
                    )
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
    try:
        await worker.run_forever()
    finally:
        await worker.close()


if __name__ == "__main__":
    asyncio.run(main())
