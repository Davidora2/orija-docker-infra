"""MQTT commander — executes device.* ActionCommands (lights, siren, lock)."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import signal
import sys
from typing import Any

import httpx
from aiomqtt import Client, MqttError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "shared"))
from homepulse.events import ActionCommand  # noqa: E402
from homepulse.streams import (  # noqa: E402
    ACTIONS_STREAM,
    AUDIT_STREAM,
    ack,
    ensure_consumer_group,
    get_redis,
    publish,
    read_group,
)

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("mqtt-commander")

GROUP = os.getenv("MQTT_COMMANDER_GROUP", "mqtt-commander")
CONSUMER = os.getenv("HOSTNAME", "mqtt-commander-1")
MQTT_HOST = os.getenv("MQTT_HOST", "mosquitto")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "")
REGISTRY_URL = os.getenv("REGISTRY_URL", "http://home-registry:8000")
RUNNING = True

# Pending timed offs: action_id -> asyncio Task
_timers: dict[str, asyncio.Task] = {}


def handle_stop(*_args: Any) -> None:
    global RUNNING
    RUNNING = False


signal.signal(signal.SIGTERM, handle_stop)
signal.signal(signal.SIGINT, handle_stop)


async def fetch_device(home_id: str, device_id: str) -> dict[str, Any] | None:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{REGISTRY_URL}/v1/internal/homes/{home_id}/context")
    if resp.status_code != 200:
        return None
    for d in resp.json().get("devices", []):
        if d["device_id"] == device_id:
            return d
    return None


def command_payload(action_type: str, params: dict[str, Any]) -> tuple[str, str]:
    """Return (payload, logical_state) for MQTT publish."""
    if action_type == "device.light_on":
        return "ON", "on"
    if action_type == "device.light_off":
        return "OFF", "off"
    if action_type == "device.siren_on":
        return json.dumps({"state": "ON", "duration": params.get("duration_seconds", 30)}), "on"
    if action_type == "device.siren_off":
        return json.dumps({"state": "OFF"}), "off"
    if action_type == "device.lock":
        return "LOCK", "locked"
    if action_type == "device.unlock":
        return "UNLOCK", "unlocked"
    return json.dumps({"action": action_type, **params}), action_type


async def mqtt_publish(topic: str, payload: str) -> None:
    async with Client(
        hostname=MQTT_HOST,
        port=MQTT_PORT,
        username=MQTT_USERNAME or None,
        password=MQTT_PASSWORD or None,
    ) as client:
        await client.publish(topic, payload.encode(), qos=1)
    logger.info("MQTT publish %s → %s", topic, payload)


async def set_device_state(device_id: str, state: str) -> None:
    async with httpx.AsyncClient(timeout=5.0) as client:
        await client.patch(
            f"{REGISTRY_URL}/v1/devices/{device_id}/state",
            json={"state": state},
        )


async def schedule_off(
    redis_client: Any,
    command: ActionCommand,
    device: dict[str, Any],
    off_action: str,
    delay_seconds: int,
) -> None:
    await asyncio.sleep(delay_seconds)
    off = ActionCommand(
        home_id=command.home_id,
        action_type=off_action,
        target=command.target,
        event_id=command.event_id,
        correlation_id=command.correlation_id,
        params={"rule_id": f"{command.params.get('rule_id')}-auto-off", "auto": True},
    )
    await publish(redis_client, ACTIONS_STREAM, off.to_stream_fields())
    logger.info("Queued auto-off %s for device %s", off_action, device.get("name"))


async def handle_command(redis_client: Any, command: ActionCommand) -> None:
    if not command.action_type.startswith("device."):
        return
    if not command.target:
        logger.warning("device command missing target: %s", command.action_id)
        return
    device = await fetch_device(command.home_id, command.target)
    if device is None:
        logger.warning("Unknown device target %s", command.target)
        return
    topic = device.get("mqtt_command_topic")
    if not topic:
        logger.warning("Device %s has no mqtt_command_topic", device.get("name"))
        return

    payload, state = command_payload(command.action_type, command.params)
    await mqtt_publish(topic, payload)
    await set_device_state(device["device_id"], state)

    await publish(
        redis_client,
        AUDIT_STREAM,
        {
            "json": json.dumps(
                {
                    "action_id": command.action_id,
                    "action_type": command.action_type,
                    "device_id": device["device_id"],
                    "topic": topic,
                    "payload": payload,
                }
            ),
            "audit_type": "device.commanded",
        },
    )

    # Timed porch light / siren off
    if command.action_type == "device.light_on":
        minutes = int(command.params.get("duration_minutes") or 5)
        task = asyncio.create_task(
            schedule_off(redis_client, command, device, "device.light_off", minutes * 60)
        )
        _timers[command.action_id] = task
    elif command.action_type == "device.siren_on":
        seconds = int(command.params.get("duration_seconds") or 30)
        task = asyncio.create_task(
            schedule_off(redis_client, command, device, "device.siren_off", seconds)
        )
        _timers[command.action_id] = task


async def process_loop() -> None:
    redis_client = await get_redis()
    await ensure_consumer_group(redis_client, ACTIONS_STREAM, GROUP)
    logger.info("MQTT commander listening on %s", ACTIONS_STREAM)

    while RUNNING:
        try:
            messages = await read_group(redis_client, ACTIONS_STREAM, GROUP, CONSUMER)
        except Exception:
            logger.exception("Redis read failed")
            await asyncio.sleep(2)
            continue
        if not messages:
            continue
        for message_id, fields in messages:
            try:
                command = ActionCommand.from_stream_fields(fields)
                if command.action_type.startswith("device."):
                    await handle_command(redis_client, command)
                await ack(redis_client, ACTIONS_STREAM, GROUP, message_id)
            except MqttError:
                logger.exception("MQTT publish failed for %s", message_id)
                await asyncio.sleep(1)
            except Exception:
                logger.exception("Failed action message %s", message_id)
                await asyncio.sleep(0.5)

    await redis_client.aclose()


def main() -> None:
    asyncio.run(process_loop())


if __name__ == "__main__":
    main()
