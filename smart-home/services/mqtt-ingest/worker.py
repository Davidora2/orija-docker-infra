"""MQTT ingest — ESP doorbell, Zigbee sensors, Frigate person events."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import signal
import sys
from datetime import datetime, timezone
from typing import Any

import httpx
from aiomqtt import Client, MqttError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "shared"))
from homepulse.events import DeviceEvent, EventType  # noqa: E402
from homepulse.streams import AUDIT_STREAM, EVENTS_STREAM, get_redis, publish  # noqa: E402

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("mqtt-ingest")

MQTT_HOST = os.getenv("MQTT_HOST", "mosquitto")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "")
REGISTRY_URL = os.getenv("REGISTRY_URL", "http://home-registry:8000")
FRIGATE_BASE_URL = os.getenv("FRIGATE_BASE_URL", "http://frigate:5000")
# Topics (wildcards supported by broker subscription list)
SUBSCRIBE_TOPICS = [
    t.strip()
    for t in os.getenv(
        "MQTT_SUBSCRIBE_TOPICS",
        "homepulse/+/doorbell/+/state,zigbee2mqtt/+/+,frigate/+/events",
    ).split(",")
    if t.strip()
]

RUNNING = True


def handle_stop(*_args: Any) -> None:
    global RUNNING
    RUNNING = False


signal.signal(signal.SIGTERM, handle_stop)
signal.signal(signal.SIGINT, handle_stop)


async def resolve_device(vendor: str, external_id: str) -> dict[str, Any] | None:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{REGISTRY_URL}/v1/internal/devices/resolve",
            params={"vendor": vendor, "external_id": external_id},
        )
    if resp.status_code != 200:
        return None
    return resp.json()


async def publish_event(event: DeviceEvent) -> None:
    client = await get_redis()
    try:
        await publish(client, EVENTS_STREAM, event.to_stream_fields())
        await publish(
            client,
            AUDIT_STREAM,
            {"json": event.model_dump_json(), "audit_type": "event.ingested"},
        )
        logger.info("Ingested %s from %s device=%s", event.event_type, event.source, event.device_id)
    finally:
        await client.aclose()


async def handle_esp_doorbell(topic: str, payload: dict[str, Any] | str) -> None:
    # Topic: homepulse/{home_hint}/doorbell/{external_id}/state
    parts = topic.split("/")
    if len(parts) < 5:
        return
    external_id = parts[3]
    state = payload if isinstance(payload, str) else str(payload.get("state") or payload.get("event") or "")
    if state.lower() not in {"ring", "ding", "pressed", "on"}:
        return
    device = await resolve_device("esphome", external_id)
    if device is None:
        device = await resolve_device("esp", external_id)
    if device is None:
        logger.warning("Unknown ESP doorbell %s", external_id)
        return
    location = device.get("location_label") or device.get("name") or "Front door"
    event = DeviceEvent(
        home_id=device["home_id"],
        device_id=device["device_id"],
        device_type="doorbell",
        vendor=device.get("vendor", "esphome"),
        event_type=EventType.DOORBELL_RING,
        title="Doorbell",
        body=f"Someone rang the {location} doorbell",
        payload={"mqtt_topic": topic, "raw": payload if isinstance(payload, dict) else {"state": state}},
        source="mqtt-ingest.esp",
    )
    await publish_event(event)


async def handle_zigbee_contact(topic: str, payload: dict[str, Any]) -> None:
    # Topic: zigbee2mqtt/<friendly_name>
    friendly = topic.split("/", 1)[-1]
    contact = payload.get("contact")
    if contact is None:
        return
    device = await resolve_device("zigbee2mqtt", friendly)
    if device is None:
        logger.debug("Ignoring unregistered zigbee device %s", friendly)
        return
    opened = contact is False  # zigbee2mqtt: contact=true means closed
    event_type = EventType.SENSOR_OPEN if opened else EventType.SENSOR_CLOSE
    # Persist state best-effort
    async with httpx.AsyncClient(timeout=5.0) as client:
        await client.patch(
            f"{REGISTRY_URL}/v1/devices/{device['device_id']}/state",
            json={"state": "open" if opened else "closed"},
        )
    location = device.get("location_label") or device.get("name") or friendly
    event = DeviceEvent(
        home_id=device["home_id"],
        device_id=device["device_id"],
        device_type="contact_sensor",
        vendor="zigbee2mqtt",
        event_type=event_type,
        title="Door/window" if opened else "Sensor closed",
        body=f"{location} {'opened' if opened else 'closed'}",
        severity="warning" if opened else "info",
        payload={"mqtt_topic": topic, "raw": payload},
        source="mqtt-ingest.zigbee",
    )
    await publish_event(event)


async def handle_frigate_event(topic: str, payload: dict[str, Any]) -> None:
    # Topic: frigate/<camera>/events  — payload type new/update/end
    if payload.get("type") not in {"new", "update"}:
        return
    after = payload.get("after") or {}
    label = (after.get("label") or "").lower()
    if label != "person":
        return
    if after.get("false_positive"):
        return
    camera = after.get("camera") or topic.split("/")[1]
    device = await resolve_device("frigate", camera)
    if device is None:
        logger.warning("Unknown Frigate camera %s", camera)
        return
    event_id = after.get("id")
    score = after.get("top_score") or after.get("score")
    base = ((device.get("meta") or {}).get("frigate_base_url") or FRIGATE_BASE_URL).rstrip("/")
    snapshot = f"{base}/api/events/{event_id}/thumbnail.jpg" if event_id else f"{base}/api/{camera}/latest.jpg"
    clip = f"{base}/api/events/{event_id}/clip.mp4" if event_id else None
    event = DeviceEvent(
        home_id=device["home_id"],
        device_id=device["device_id"],
        device_type="camera",
        vendor="frigate",
        event_type=EventType.CAMERA_PERSON,
        title="Person detected",
        body=f"Person detected on {device.get('name') or camera}",
        severity="warning",
        payload={
            "label": label,
            "score": score,
            "frigate_event_id": event_id,
            "snapshot_url": snapshot,
            "thumbnail_url": snapshot,
            "clip_url": clip,
            "camera": camera,
            "mqtt_topic": topic,
        },
        source="mqtt-ingest.frigate",
    )
    await publish_event(event)


async def handle_lock_state(topic: str, payload: dict[str, Any] | str) -> None:
    # Optional: zigbee lock state via zigbee2mqtt already covered if we map device_type lock
    # Topic pattern can also be homepulse/lock/<external_id>/state
    parts = topic.split("/")
    if "lock" not in parts:
        return
    external_id = parts[-2] if parts[-1] == "state" else parts[-1]
    state_raw = payload if isinstance(payload, str) else str(payload.get("state") or "")
    state = state_raw.lower()
    if state not in {"locked", "unlocked", "lock", "unlock"}:
        return
    normalized = "locked" if state in {"locked", "lock"} else "unlocked"
    device = await resolve_device("zigbee2mqtt", external_id)
    if device is None:
        device = await resolve_device("mqtt", external_id)
    if device is None:
        return
    async with httpx.AsyncClient(timeout=5.0) as client:
        await client.patch(
            f"{REGISTRY_URL}/v1/devices/{device['device_id']}/state",
            json={"state": normalized},
        )
    event = DeviceEvent(
        home_id=device["home_id"],
        device_id=device["device_id"],
        device_type="lock",
        vendor=device.get("vendor", "mqtt"),
        event_type=EventType.LOCK_LOCKED if normalized == "locked" else EventType.LOCK_UNLOCKED,
        title="Lock",
        body=f"{device.get('name')} is {normalized}",
        payload={"mqtt_topic": topic, "state": normalized},
        source="mqtt-ingest.lock",
        occurred_at=datetime.now(timezone.utc),
    )
    await publish_event(event)


def parse_payload(raw: bytes) -> dict[str, Any] | str:
    text = raw.decode("utf-8", errors="replace")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return text


async def dispatch(topic: str, raw: bytes) -> None:
    payload = parse_payload(raw)
    if topic.startswith("homepulse/") and "/doorbell/" in topic:
        await handle_esp_doorbell(topic, payload)
    elif topic.startswith("frigate/") and topic.endswith("/events"):
        if isinstance(payload, dict):
            await handle_frigate_event(topic, payload)
    elif topic.startswith("zigbee2mqtt/"):
        if isinstance(payload, dict):
            if "contact" in payload:
                await handle_zigbee_contact(topic, payload)
            elif "state" in payload and str(payload.get("state", "")).lower() in {
                "locked",
                "unlocked",
                "LOCK",
                "UNLOCK",
                "lock",
                "unlock",
            }:
                await handle_lock_state(topic, payload)
    elif "/lock/" in topic:
        await handle_lock_state(topic, payload)


async def run() -> None:
    logger.info("Connecting to MQTT %s:%s topics=%s", MQTT_HOST, MQTT_PORT, SUBSCRIBE_TOPICS)
    while RUNNING:
        try:
            async with Client(
                hostname=MQTT_HOST,
                port=MQTT_PORT,
                username=MQTT_USERNAME or None,
                password=MQTT_PASSWORD or None,
            ) as client:
                for topic in SUBSCRIBE_TOPICS:
                    await client.subscribe(topic)
                async for message in client.messages:
                    if not RUNNING:
                        break
                    topic = str(message.topic)
                    try:
                        await dispatch(topic, message.payload)
                    except Exception:
                        logger.exception("Failed handling MQTT message on %s", topic)
        except MqttError:
            logger.exception("MQTT connection error; retrying in 3s")
            await asyncio.sleep(3)
        except Exception:
            logger.exception("Unexpected MQTT ingest failure; retrying in 5s")
            await asyncio.sleep(5)


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
