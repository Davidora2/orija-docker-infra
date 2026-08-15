"""Home Assistant → HomePulse ingest.

Listens to HA websocket state changes for doorbell dings
(`event.*_ding`, Blink camera activity, last_activity sensors)
and publishes normalized `doorbell.ring` events so subscribed phones
get push notifications when the physical bell is pressed.
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
POLL_SECONDS = float(os.getenv("HA_INGEST_POLL_SECONDS", "15"))
DEBUG_LOG_PATH = os.getenv("HA_INGEST_DEBUG_LOG", "/tmp/agent-debug.ndjson")
WATCH_RE = re.compile(r"(front_door|blink|ding|doorbell|lotus|ring)", re.I)


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
    local = re.sub(r"_(ding|motion|button|doorbell|last_activity|live_view)$", "", local)
    local = re.sub(r"^blink_", "", local)
    return local.replace("_", " ").strip().lower()


def agent_log(hypothesis_id: str, location: str, message: str, data: dict[str, Any] | None = None) -> None:
    # #region agent log
    payload = {
        "hypothesisId": hypothesis_id,
        "location": location,
        "message": message,
        "data": data or {},
        "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000),
    }
    line = json.dumps(payload, default=str)
    logger.info("AGENT_DEBUG %s", line)
    try:
        with open(DEBUG_LOG_PATH, "a", encoding="utf-8") as fh:
            fh.write(line + "\n")
    except Exception:  # noqa: BLE001
        pass
    # #endregion


class HaIngest:
    def __init__(self) -> None:
        self.token = load_token()
        self.redis = None
        self._last_fire: dict[str, float] = {}
        self._device_cache: list[dict[str, Any]] = []
        self._cache_at = 0.0
        self._poll_snapshot: dict[str, str] = {}
        self._msg_id = 1

    def _next_id(self) -> int:
        self._msg_id += 1
        return self._msg_id

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

    def pick_doorbell(
        self,
        devices: list[dict[str, Any]],
        entity_id: str,
        friendly: str,
        *,
        prefer_vendor: str | None = None,
    ) -> dict[str, Any] | None:
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
        prefer = (prefer_vendor or "").lower()
        scored: list[tuple[int, dict[str, Any]]] = []
        for d in doorbells:
            name = (d.get("name") or "").strip().lower()
            vendor = (d.get("vendor") or "").lower()
            score = 0
            if prefer and vendor == prefer:
                score += 20
            elif vendor == "blink" and not prefer:
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
        source: str = "ha-ingest.websocket",
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
            source=source,
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
        # #region agent log
        agent_log(
            "E",
            "worker.py:publish_ding",
            "published_doorbell_event",
            {
                "entity_id": entity_id,
                "event_type": event.event_type,
                "device": device.get("name"),
                "vendor": device.get("vendor"),
                "msg_id": msg_id,
                "source": source,
            },
        )
        # #endregion

    def _interesting_entity(self, entity_id: str) -> bool:
        return bool(WATCH_RE.search(entity_id or ""))

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
        old_attrs = (old_state or {}).get("attributes") or {} if isinstance(old_state, dict) else {}
        attribution = str(attrs.get("attribution") or "")
        brand = str(attrs.get("brand") or "")

        if self._interesting_entity(entity_id) or self._interesting_entity(friendly) or "blink" in attribution.lower() or "ring.com" in attribution.lower():
            # #region agent log
            agent_log(
                "A",
                "worker.py:handle_state_changed",
                "watched_state_changed",
                {
                    "entity_id": entity_id,
                    "old_val": old_val,
                    "new_val": new_val,
                    "attribution": attribution,
                    "brand": brand,
                    "event_type_attr": attrs.get("event_type"),
                    "motion_detected": attrs.get("motion_detected"),
                    "last_record": attrs.get("last_record"),
                    "thumbnail_ts": (str(attrs.get("thumbnail") or "")[-40:] if attrs.get("thumbnail") else None),
                    "old_motion_detected": old_attrs.get("motion_detected") if isinstance(old_attrs, dict) else None,
                    "old_last_record": old_attrs.get("last_record") if isinstance(old_attrs, dict) else None,
                    "last_changed": new_state.get("last_changed"),
                    "last_updated": new_state.get("last_updated"),
                },
            )
            # #endregion

        event_type: EventType | None = None
        prefer_vendor: str | None = None
        eid_l = entity_id.lower()

        if eid_l.startswith("event.") and eid_l.endswith("_ding"):
            # Ring (and synthetic) ding: timestamp state changes when pressed
            if new_val and new_val != old_val and new_val not in {"unknown", "unavailable"}:
                event_type = EventType.DOORBELL_RING
                if "ring.com" in attribution.lower():
                    prefer_vendor = "ring"
                # #region agent log
                agent_log("A", "worker.py:match", "matched_event_ding", {"entity_id": entity_id, "new_val": new_val, "old_val": old_val})
                # #endregion
        elif eid_l.startswith("event.") and eid_l.endswith("_motion") and NOTIFY_ON_MOTION:
            if new_val and new_val != old_val and new_val not in {"unknown", "unavailable"}:
                event_type = EventType.DOORBELL_MOTION
        elif eid_l.startswith("binary_sensor.") and "motion" in eid_l and ("front_door" in eid_l or "doorbell" in eid_l or "blink" in eid_l):
            # Blink doorbell button often only surfaces as motion ON (no dedicated ding entity)
            if new_val == "on" and old_val != "on":
                event_type = EventType.DOORBELL_RING if not NOTIFY_ON_MOTION else EventType.DOORBELL_MOTION
                prefer_vendor = "blink"
                # #region agent log
                agent_log("C", "worker.py:match", "matched_blink_binary_motion", {"entity_id": entity_id, "as": str(event_type)})
                # #endregion
        elif eid_l.startswith("binary_sensor.") and "motion" in eid_l and NOTIFY_ON_MOTION:
            if new_val == "on" and old_val != "on":
                event_type = EventType.DOORBELL_MOTION
        elif eid_l.startswith("binary_sensor.") and any(x in eid_l for x in ("ding", "doorbell", "button")):
            if new_val == "on" and old_val != "on":
                event_type = EventType.DOORBELL_RING
        elif eid_l.startswith("sensor.") and eid_l.endswith("_last_activity"):
            if new_val and new_val != old_val and new_val not in {"unknown", "unavailable"}:
                event_type = EventType.DOORBELL_RING
                if "ring.com" in attribution.lower():
                    prefer_vendor = "ring"
                # #region agent log
                agent_log("C", "worker.py:match", "matched_last_activity", {"entity_id": entity_id, "new_val": new_val})
                # #endregion
        elif eid_l.startswith("camera.") and ("front_door" in eid_l or "blink" in eid_l or brand.lower() == "blink"):
            # Blink lotus: attribute churn (last_record / motion_detected / thumbnail) after press
            old_md = old_attrs.get("motion_detected") if isinstance(old_attrs, dict) else None
            new_md = attrs.get("motion_detected")
            old_lr = old_attrs.get("last_record") if isinstance(old_attrs, dict) else None
            new_lr = attrs.get("last_record")
            old_thumb = (old_attrs.get("thumbnail") if isinstance(old_attrs, dict) else None) or ""
            new_thumb = attrs.get("thumbnail") or ""
            activity = False
            if new_md is True and old_md is not True:
                activity = True
            if new_lr and new_lr != old_lr:
                activity = True
            if new_thumb and new_thumb != old_thumb and ("lotus" in str(attrs.get("type") or "").lower() or brand.lower() == "blink"):
                # thumbnail URL ts= query often bumps after clip/press
                activity = True
            if activity:
                event_type = EventType.DOORBELL_RING
                prefer_vendor = "blink"
                # #region agent log
                agent_log(
                    "C",
                    "worker.py:match",
                    "matched_blink_camera_activity",
                    {"entity_id": entity_id, "motion_detected": new_md, "last_record": new_lr, "thumb_changed": new_thumb != old_thumb},
                )
                # #endregion

        if event_type is None:
            return

        debounce_key = f"{entity_id}:{event_type.value}"
        if self.debounced(debounce_key):
            # #region agent log
            agent_log("D", "worker.py:debounce", "debounced", {"key": debounce_key})
            # #endregion
            logger.debug("Debounced %s", debounce_key)
            return

        devices = await self.refresh_devices()
        device = self.pick_doorbell(devices, entity_id, friendly, prefer_vendor=prefer_vendor)
        if not device:
            # #region agent log
            agent_log("E", "worker.py:pick_doorbell", "no_device", {"entity_id": entity_id, "friendly": friendly})
            # #endregion
            logger.warning("HA event %s but no doorbell device registered in HomePulse", entity_id)
            return

        await self.publish_ding(
            device=device,
            entity_id=entity_id,
            event_type=event_type,
            friendly=friendly,
            new_state=new_val,
            source="ha-ingest.websocket",
        )

    async def poll_blink_entities(self) -> None:
        """Poll Blink-related HA entities — Blink is poll-based and may miss websocket-only paths."""
        headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
        watch_ids = (
            "camera.front_door",
            "binary_sensor.front_door_motion",
            "sensor.front_door_last_activity",
            "event.front_door_ding",
            "event.front_door_motion",
            "sensor.blink_front_door_temperature",
        )
        while True:
            try:
                async with httpx.AsyncClient(timeout=20.0) as client:
                    for eid in watch_ids:
                        try:
                            r = await client.get(f"{HA_BASE_URL}/api/states/{eid}", headers=headers)
                            if r.status_code != 200:
                                continue
                            st = r.json()
                        except Exception as exc:  # noqa: BLE001
                            agent_log("B", "worker.py:poll", "poll_entity_error", {"entity_id": eid, "error": str(exc)})
                            continue
                        attrs = st.get("attributes") or {}
                        snap = json.dumps(
                            {
                                "state": st.get("state"),
                                "last_changed": st.get("last_changed"),
                                "last_updated": st.get("last_updated"),
                                "motion_detected": attrs.get("motion_detected"),
                                "last_record": attrs.get("last_record"),
                                "thumbnail": attrs.get("thumbnail"),
                                "event_type": attrs.get("event_type"),
                                "attribution": attrs.get("attribution"),
                                "brand": attrs.get("brand"),
                            },
                            default=str,
                            sort_keys=True,
                        )
                        prev = self._poll_snapshot.get(eid)
                        if prev is None:
                            self._poll_snapshot[eid] = snap
                            agent_log("B", "worker.py:poll", "poll_baseline", {"entity_id": eid, "snap": json.loads(snap)})
                            continue
                        if snap != prev:
                            agent_log(
                                "B",
                                "worker.py:poll",
                                "poll_changed",
                                {"entity_id": eid, "prev": json.loads(prev), "new": json.loads(snap)},
                            )
                            self._poll_snapshot[eid] = snap
                            # Synthesize a state_changed-like payload so matching logic is shared
                            try:
                                prev_obj = json.loads(prev)
                                fake_event = {
                                    "data": {
                                        "entity_id": eid,
                                        "old_state": {
                                            "state": prev_obj.get("state"),
                                            "attributes": {
                                                "motion_detected": prev_obj.get("motion_detected"),
                                                "last_record": prev_obj.get("last_record"),
                                                "thumbnail": prev_obj.get("thumbnail"),
                                                "event_type": prev_obj.get("event_type"),
                                                "attribution": prev_obj.get("attribution"),
                                                "brand": prev_obj.get("brand"),
                                                "friendly_name": attrs.get("friendly_name"),
                                                "type": attrs.get("type"),
                                            },
                                        },
                                        "new_state": st,
                                    }
                                }
                                await self.handle_state_changed(fake_event)
                            except Exception:  # noqa: BLE001
                                logger.exception("poll handle failed for %s", eid)
            except Exception:  # noqa: BLE001
                logger.exception("poll loop error")
                agent_log("B", "worker.py:poll", "poll_loop_error", {})
            await asyncio.sleep(POLL_SECONDS)

    async def run_forever(self) -> None:
        if not self.token:
            logger.error("HA_TOKEN not set — ha-ingest idle (physical Blink dings will not notify)")
            agent_log("B", "worker.py:run_forever", "no_token", {})
            while True:
                await asyncio.sleep(60)
                self.token = load_token()
                if self.token:
                    break

        self.redis = await get_redis()
        url = ws_url(HA_BASE_URL)
        logger.info("Connecting to Home Assistant websocket %s", url)
        agent_log("B", "worker.py:run_forever", "connecting", {"url": url, "poll_seconds": POLL_SECONDS})

        # Start Blink/entity poller alongside websocket
        asyncio.create_task(self.poll_blink_entities())

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
                    agent_log("B", "worker.py:run_forever", "auth_ok", {})
                    backoff = 2.0

                    await ws.send(
                        json.dumps(
                            {
                                "id": self._next_id(),
                                "type": "subscribe_events",
                                "event_type": "state_changed",
                            }
                        )
                    )
                    # Also subscribe to ALL events to catch Blink custom / non-state paths
                    await ws.send(
                        json.dumps(
                            {
                                "id": self._next_id(),
                                "type": "subscribe_events",
                            }
                        )
                    )
                    # drain two confirmations
                    for _ in range(2):
                        conf = json.loads(await ws.recv())
                        agent_log("C", "worker.py:run_forever", "subscribe_result", {"conf": conf})
                        if conf.get("type") == "result" and conf.get("success") is False:
                            raise RuntimeError(f"subscribe_events failed: {conf}")
                    logger.info("Subscribed to HA state_changed + all events (Blink/Ring ding → HomePulse push)")

                    async for raw in ws:
                        try:
                            payload = json.loads(raw)
                        except json.JSONDecodeError:
                            continue
                        if payload.get("type") != "event":
                            continue
                        event = payload.get("event") or {}
                        et = str(event.get("event_type") or "")
                        if et != "state_changed":
                            # Log non-state events that look doorbell-related
                            blob = json.dumps(event, default=str).lower()
                            if WATCH_RE.search(blob) or et in {"blink", "ring", "doorbell", "call_service"}:
                                agent_log(
                                    "C",
                                    "worker.py:ws_event",
                                    "non_state_event",
                                    {"event_type": et, "data_keys": list((event.get("data") or {}).keys())[:20], "snippet": blob[:500]},
                                )
                            continue
                        try:
                            await self.handle_state_changed(event)
                        except Exception:  # noqa: BLE001
                            logger.exception("Failed handling HA state_changed")
            except ConnectionClosed as exc:
                logger.warning("HA websocket closed (%s) — reconnecting in %.0fs", exc, backoff)
                agent_log("B", "worker.py:run_forever", "ws_closed", {"error": str(exc), "backoff": backoff})
            except Exception as exc:  # noqa: BLE001
                logger.warning("HA websocket error (%s) — reconnecting in %.0fs", exc, backoff)
                agent_log("B", "worker.py:run_forever", "ws_error", {"error": str(exc), "backoff": backoff})
            await asyncio.sleep(backoff)
            backoff = min(backoff * 1.7, 60.0)


async def main() -> None:
    worker = HaIngest()
    await worker.run_forever()


if __name__ == "__main__":
    asyncio.run(main())
