"""Rules engine — maps DeviceEvents to ActionCommands (notify, device cmds, audit)."""

from __future__ import annotations

import asyncio
import logging
import os
import signal
import sys
from typing import Any

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
RUNNING = True


def handle_stop(*_args: Any) -> None:
    global RUNNING
    RUNNING = False


signal.signal(signal.SIGTERM, handle_stop)
signal.signal(signal.SIGINT, handle_stop)


# Extensible rule table — replace with DB-backed rules later without changing the bus.
RULES: list[dict[str, Any]] = [
    {
        "id": "doorbell-ring-push",
        "match_event_types": [EventType.DOORBELL_RING.value],
        "actions": ["notify.push"],
        "priority": "high",
    },
    {
        "id": "doorbell-motion-push",
        "match_event_types": [EventType.DOORBELL_MOTION.value],
        "actions": ["notify.push"],
        "priority": "normal",
        "enabled": os.getenv("NOTIFY_ON_MOTION", "false").lower() == "true",
    },
]


def evaluate(event: DeviceEvent) -> list[ActionCommand]:
    commands: list[ActionCommand] = []
    for rule in RULES:
        if rule.get("enabled", True) is False:
            continue
        if event.event_type.value not in rule["match_event_types"]:
            continue
        for action_type in rule["actions"]:
            if action_type == "notify.push":
                commands.append(
                    ActionCommand(
                        home_id=event.home_id,
                        action_type="notify.push",
                        event_id=event.event_id,
                        correlation_id=event.correlation_id,
                        notification=NotificationPayload(
                            title=event.title or "Smart home alert",
                            body=event.body or f"{event.event_type.value} on {event.device_id}",
                            data={
                                "event_id": event.event_id,
                                "event_type": event.event_type.value,
                                "device_id": event.device_id,
                                "home_id": event.home_id,
                                "vendor": event.vendor,
                                "snapshot_url": str(event.payload.get("snapshot_url") or ""),
                            },
                            image_url=event.payload.get("snapshot_url"),
                            priority=rule.get("priority", "high"),
                        ),
                        params={"rule_id": rule["id"]},
                    )
                )
            elif action_type == "audit.log":
                commands.append(
                    ActionCommand(
                        home_id=event.home_id,
                        action_type="audit.log",
                        event_id=event.event_id,
                        correlation_id=event.correlation_id,
                        params={"rule_id": rule["id"]},
                    )
                )
    # Always emit an audit trail action for every processed event.
    commands.append(
        ActionCommand(
            home_id=event.home_id,
            action_type="audit.log",
            event_id=event.event_id,
            correlation_id=event.correlation_id,
            params={"phase": "rules.evaluated", "action_count": str(len(commands))},
        )
    )
    return commands


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
                commands = evaluate(event)
                for cmd in commands:
                    stream = ACTIONS_STREAM if cmd.action_type != "audit.log" else AUDIT_STREAM
                    # Prefer actions stream for notify; also mirror audit entries.
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
                        "Emitted %s for event %s (rule params=%s)",
                        cmd.action_type,
                        event.event_id,
                        cmd.params,
                    )
                await ack(client, EVENTS_STREAM, GROUP, message_id)
            except Exception:
                logger.exception("Failed processing message %s", message_id)
                # Leave unacked for retry / pending claim in scaled deployments.
                await asyncio.sleep(0.5)

    await client.aclose()


def main() -> None:
    asyncio.run(process_loop())


if __name__ == "__main__":
    main()
