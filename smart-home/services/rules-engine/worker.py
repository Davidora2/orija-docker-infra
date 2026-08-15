"""Rules engine — doorbell, Frigate, and security automations."""

from __future__ import annotations

import asyncio
import logging
import os
import signal
import sys
from typing import Any

import httpx

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "shared"))
from homepulse.events import ActionCommand, DeviceEvent, EventType, NotificationPayload  # noqa: E402
from homepulse.streams import (  # noqa: E402
    ACTIONS_STREAM,
    AUDIT_STREAM,
    EVENTS_STREAM,
    ack,
    ensure_consumer_group,
    get_redis,
    publish,
    read_group,
)

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("rules-engine")

GROUP = os.getenv("RULES_CONSUMER_GROUP", "rules-engine")
CONSUMER = os.getenv("HOSTNAME", "rules-1")
REGISTRY_URL = os.getenv("REGISTRY_URL", "http://home-registry:8000")
FRIGATE_BASE_URL = os.getenv("FRIGATE_BASE_URL", "http://frigate:5000")
PORCH_LIGHT_MINUTES = int(os.getenv("PORCH_LIGHT_MINUTES", "5"))
NOTIFY_ON_MOTION = os.getenv("NOTIFY_ON_MOTION", "false").lower() == "true"
SIREN_SECONDS = int(os.getenv("SIREN_SECONDS", "30"))
RUNNING = True


def handle_stop(*_args: Any) -> None:
    global RUNNING
    RUNNING = False


signal.signal(signal.SIGTERM, handle_stop)
signal.signal(signal.SIGINT, handle_stop)


async def fetch_context(home_id: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{REGISTRY_URL}/v1/internal/homes/{home_id}/context")
    if resp.status_code != 200:
        logger.warning("Missing home context for %s (%s)", home_id, resp.status_code)
        return {
            "home_id": home_id,
            "mode": "home",
            "armed": False,
            "devices_by_role": {},
            "timezone": "UTC",
        }
    return resp.json()


def first_role(ctx: dict[str, Any], role: str) -> dict[str, Any] | None:
    items = ctx.get("devices_by_role", {}).get(role) or []
    return items[0] if items else None


def frigate_snapshot_url(camera_device: dict[str, Any] | None, event: DeviceEvent) -> str | None:
    if event.payload.get("snapshot_url"):
        return str(event.payload["snapshot_url"])
    if event.payload.get("clip_url"):
        # Prefer explicit clip thumbnail if present
        thumb = event.payload.get("thumbnail_url")
        if thumb:
            return str(thumb)
    if camera_device is None:
        return None
    meta = camera_device.get("meta") or {}
    camera_name = meta.get("frigate_camera") or camera_device.get("external_id")
    if not camera_name:
        return None
    base = (meta.get("frigate_base_url") or FRIGATE_BASE_URL).rstrip("/")
    return f"{base}/api/{camera_name}/latest.jpg"


def frigate_clip_url(camera_device: dict[str, Any] | None, event: DeviceEvent) -> str | None:
    if event.payload.get("clip_url"):
        return str(event.payload["clip_url"])
    event_id = event.payload.get("frigate_event_id")
    if not event_id:
        return None
    meta = (camera_device or {}).get("meta") or {}
    base = (meta.get("frigate_base_url") or FRIGATE_BASE_URL).rstrip("/")
    return f"{base}/api/events/{event_id}/clip.mp4"


def push_cmd(
    event: DeviceEvent,
    *,
    title: str,
    body: str,
    priority: str,
    image_url: str | None,
    extra_data: dict[str, str] | None = None,
    channel_id: str | None = None,
    sound: str | None = None,
    rule_id: str,
) -> ActionCommand:
    data = {
        "event_id": event.event_id,
        "event_type": event.event_type.value,
        "device_id": event.device_id,
        "home_id": event.home_id,
        "vendor": event.vendor,
    }
    if image_url:
        data["snapshot_url"] = image_url
    if extra_data:
        data.update(extra_data)
    return ActionCommand(
        home_id=event.home_id,
        action_type="notify.push",
        event_id=event.event_id,
        correlation_id=event.correlation_id,
        notification=NotificationPayload(
            title=title,
            body=body,
            data=data,
            image_url=image_url,
            priority=priority,
            channel_id=channel_id,
            sound=sound,
        ),
        params={"rule_id": rule_id},
    )


def device_cmd(
    event: DeviceEvent,
    *,
    action_type: str,
    device: dict[str, Any],
    rule_id: str,
    params: dict[str, Any] | None = None,
) -> ActionCommand:
    merged = {"rule_id": rule_id, "role": device.get("role"), "device_name": device.get("name")}
    if params:
        merged.update(params)
    return ActionCommand(
        home_id=event.home_id,
        action_type=action_type,
        target=device["device_id"],
        event_id=event.event_id,
        correlation_id=event.correlation_id,
        params=merged,
    )


async def evaluate(event: DeviceEvent, ctx: dict[str, Any] | None = None) -> list[ActionCommand]:
    """Produce ActionCommands for the configured automations."""
    if ctx is None:
        ctx = await fetch_context(event.home_id)

    mode = ctx.get("mode", "home")
    armed = bool(ctx.get("armed", False))
    porch = first_role(ctx, "porch_light")
    siren = first_role(ctx, "siren")
    camera = first_role(ctx, "frigate_camera")
    commands: list[ActionCommand] = []

    # --- Doorbell ring ---
    if event.event_type == EventType.DOORBELL_RING:
        snapshot = frigate_snapshot_url(camera, event)
        away = mode == "away"
        title = "Doorbell (Away)" if away else (event.title or "Doorbell")
        body = event.body or "Someone rang the doorbell"
        if away:
            body = f"AWAY MODE — {body}"
        commands.append(
            push_cmd(
                event,
                title=title,
                body=body,
                priority="max" if away else "high",
                image_url=snapshot,
                extra_data={"home_mode": mode, "clip_url": frigate_clip_url(camera, event) or ""},
                channel_id="smart_home_critical" if away else "smart_home_alerts",
                sound="alarm" if away else "default",
                rule_id="doorbell-ring-push",
            )
        )
        # Announce on all Google Home / Nest speakers registered for this home
        commands.append(
            ActionCommand(
                home_id=event.home_id,
                action_type="notify.google_home",
                event_id=event.event_id,
                correlation_id=event.correlation_id,
                notification=NotificationPayload(
                    title=title,
                    body=body,
                    priority="max" if away else "high",
                ),
                params={"rule_id": "doorbell-ring-google-home", "home_mode": mode},
            )
        )
        if porch:
            commands.append(
                device_cmd(
                    event,
                    action_type="device.light_on",
                    device=porch,
                    rule_id="doorbell-porch-light",
                    params={"duration_minutes": PORCH_LIGHT_MINUTES},
                )
            )
        if away and siren:
            commands.append(
                device_cmd(
                    event,
                    action_type="device.siren_on",
                    device=siren,
                    rule_id="doorbell-away-siren",
                    params={"duration_seconds": SIREN_SECONDS},
                )
            )

    # --- Doorbell motion (optional) ---
    elif event.event_type == EventType.DOORBELL_MOTION and NOTIFY_ON_MOTION:
        snapshot = frigate_snapshot_url(camera, event)
        commands.append(
            push_cmd(
                event,
                title=event.title or "Doorbell motion",
                body=event.body or "Motion at the doorbell",
                priority="normal",
                image_url=snapshot,
                rule_id="doorbell-motion-push",
            )
        )

    # --- Contact sensor while armed ---
    elif event.event_type == EventType.SENSOR_OPEN and armed:
        commands.append(
            push_cmd(
                event,
                title="Security alert",
                body=event.body or f"Sensor opened while armed ({event.device_id})",
                priority="max",
                image_url=frigate_snapshot_url(camera, event),
                channel_id="smart_home_critical",
                sound="alarm",
                rule_id="armed-sensor-open-push",
            )
        )
        if siren:
            commands.append(
                device_cmd(
                    event,
                    action_type="device.siren_on",
                    device=siren,
                    rule_id="armed-sensor-open-siren",
                    params={"duration_seconds": SIREN_SECONDS},
                )
            )

    # --- Frigate person detection ---
    elif event.event_type == EventType.CAMERA_PERSON:
        clip = frigate_clip_url(camera, event) or event.payload.get("clip_url")
        snapshot = frigate_snapshot_url(camera, event)
        label = event.payload.get("label") or "person"
        score = event.payload.get("score")
        body = event.body or f"{label.title()} detected"
        if score is not None:
            body = f"{body} ({float(score):.0%})"
        if clip:
            body = f"{body} — open clip"
        commands.append(
            push_cmd(
                event,
                title=event.title or "Camera alert",
                body=body,
                priority="high" if mode == "away" or armed else "normal",
                image_url=str(snapshot) if snapshot else None,
                extra_data={"clip_url": str(clip or ""), "label": str(label)},
                channel_id="smart_home_critical" if mode == "away" or armed else "smart_home_alerts",
                rule_id="frigate-person-push",
            )
        )

    # --- Lock left unlocked after sunset (from scheduler) ---
    elif event.event_type == EventType.LOCK_LEFT_UNLOCKED:
        lock = first_role(ctx, "entry_lock")
        commands.append(
            push_cmd(
                event,
                title="Lock reminder",
                body=event.body or "Entry lock is still unlocked after sunset",
                priority="high",
                image_url=None,
                rule_id="lock-left-unlocked-push",
            )
        )
        if lock and event.payload.get("auto_lock", True):
            commands.append(
                device_cmd(
                    event,
                    action_type="device.lock",
                    device=lock,
                    rule_id="lock-left-unlocked-autolock",
                )
            )

    # Always audit
    commands.append(
        ActionCommand(
            home_id=event.home_id,
            action_type="audit.log",
            event_id=event.event_id,
            correlation_id=event.correlation_id,
            params={
                "phase": "rules.evaluated",
                "mode": mode,
                "armed": armed,
                "action_count": len([c for c in commands if c.action_type != "audit.log"]),
            },
        )
    )
    return commands


# Sync helper for unit tests
def evaluate_with_context(event: DeviceEvent, ctx: dict[str, Any]) -> list[ActionCommand]:
    return asyncio.run(evaluate(event, ctx))


async def process_loop() -> None:
    client = await get_redis()
    await ensure_consumer_group(client, EVENTS_STREAM, GROUP)
    logger.info("Rules engine listening on %s as %s/%s", EVENTS_STREAM, GROUP, CONSUMER)

    while RUNNING:
        messages = await read_group(client, EVENTS_STREAM, GROUP, CONSUMER)
        if not messages:
            continue
        for message_id, fields in messages:
            try:
                event = DeviceEvent.from_stream_fields(fields)
                commands = await evaluate(event)
                for cmd in commands:
                    if cmd.action_type.startswith("notify.") or cmd.action_type.startswith("device."):
                        await publish(client, ACTIONS_STREAM, cmd.to_stream_fields())
                    await publish(
                        client,
                        AUDIT_STREAM,
                        {
                            "json": cmd.model_dump_json(),
                            "audit_type": "action.emitted",
                        },
                    )
                    logger.info(
                        "Emitted %s for event %s (params=%s)",
                        cmd.action_type,
                        event.event_id,
                        cmd.params,
                    )
                await ack(client, EVENTS_STREAM, GROUP, message_id)
            except Exception:
                logger.exception("Failed processing message %s", message_id)
                await asyncio.sleep(0.5)

    await client.aclose()


def main() -> None:
    asyncio.run(process_loop())


if __name__ == "__main__":
    main()
