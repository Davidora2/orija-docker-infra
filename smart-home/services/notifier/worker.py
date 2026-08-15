"""Notifier — delivers ActionCommands to Google phones via FCM (or console dry-run)."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import signal
import sys
from pathlib import Path
from typing import Any

import httpx

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
logger = logging.getLogger("notifier")

GROUP = os.getenv("NOTIFIER_CONSUMER_GROUP", "notifier")
CONSUMER = os.getenv("HOSTNAME", "notifier-1")
REGISTRY_URL = os.getenv("REGISTRY_URL", "http://home-registry:8000")
FCM_MODE = os.getenv("FCM_MODE", "dry_run")  # dry_run | firebase
GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
FCM_PROJECT_ID = os.getenv("FCM_PROJECT_ID", "")

RUNNING = True
firebase_app = None


def handle_stop(*_args: Any) -> None:
    global RUNNING
    RUNNING = False


signal.signal(signal.SIGTERM, handle_stop)
signal.signal(signal.SIGINT, handle_stop)


def init_firebase() -> None:
    global firebase_app
    if FCM_MODE != "firebase":
        logger.info("FCM_MODE=dry_run — notifications will be logged, not sent")
        return
    if not GOOGLE_APPLICATION_CREDENTIALS or not Path(GOOGLE_APPLICATION_CREDENTIALS).exists():
        raise RuntimeError("GOOGLE_APPLICATION_CREDENTIALS file required when FCM_MODE=firebase")
    import firebase_admin
    from firebase_admin import credentials

    cred = credentials.Certificate(GOOGLE_APPLICATION_CREDENTIALS)
    firebase_app = firebase_admin.initialize_app(cred, {"projectId": FCM_PROJECT_ID or None})
    logger.info("Firebase Admin initialized for project %s", FCM_PROJECT_ID or "(from credentials)")


async def fetch_targets(home_id: str) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{REGISTRY_URL}/v1/internal/homes/{home_id}/push-targets")
    if resp.status_code != 200:
        logger.warning("No push targets for home %s (%s)", home_id, resp.status_code)
        return []
    return resp.json().get("targets", [])


async def send_fcm(token: str, command: ActionCommand) -> dict[str, Any]:
    assert command.notification is not None
    notification = command.notification

    if FCM_MODE == "dry_run":
        result = {
            "mode": "dry_run",
            "token_suffix": token[-8:] if len(token) >= 8 else token,
            "title": notification.title,
            "body": notification.body,
            "data": notification.data,
        }
        logger.info("DRY-RUN FCM → %s", json.dumps(result))
        return result

    from firebase_admin import messaging

    message = messaging.Message(
        token=token,
        notification=messaging.Notification(
            title=notification.title,
            body=notification.body,
            image=notification.image_url,
        ),
        data={k: str(v) for k, v in notification.data.items()},
        android=messaging.AndroidConfig(
            priority="high" if notification.priority == "high" else "normal",
            notification=messaging.AndroidNotification(
                channel_id="smart_home_alerts",
                priority="max" if notification.priority == "high" else "default",
                sound="default",
            ),
        ),
    )
    message_id = messaging.send(message)
    return {"mode": "firebase", "message_id": message_id}


async def handle_command(redis_client: Any, command: ActionCommand) -> None:
    if command.action_type != "notify.push":
        logger.debug("Ignoring non-push action %s", command.action_type)
        return
    if command.notification is None:
        logger.warning("notify.push missing notification payload: %s", command.action_id)
        return

    targets = await fetch_targets(command.home_id)
    if not targets:
        logger.warning("No FCM targets registered for home %s", command.home_id)
        return

    deliveries = []
    for target in targets:
        try:
            result = await send_fcm(target["token"], command)
            deliveries.append({"user_id": target["user_id"], "ok": True, "result": result})
        except Exception as exc:
            logger.exception("FCM failed for user %s", target["user_id"])
            deliveries.append({"user_id": target["user_id"], "ok": False, "error": str(exc)})

    await publish(
        redis_client,
        AUDIT_STREAM,
        {
            "json": json.dumps(
                {
                    "action_id": command.action_id,
                    "home_id": command.home_id,
                    "event_id": command.event_id,
                    "deliveries": deliveries,
                }
            ),
            "audit_type": "notify.delivered",
        },
    )


async def process_loop() -> None:
    init_firebase()
    client = await get_redis()
    await ensure_consumer_group(client, ACTIONS_STREAM, GROUP)
    logger.info(
        "Notifier listening on %s as %s/%s (mode=%s)",
        ACTIONS_STREAM,
        GROUP,
        CONSUMER,
        FCM_MODE,
    )

    while RUNNING:
        messages = await read_group(client, ACTIONS_STREAM, GROUP, CONSUMER)
        if not messages:
            continue
        for message_id, fields in messages:
            try:
                command = ActionCommand.from_stream_fields(fields)
                await handle_command(client, command)
                await ack(client, ACTIONS_STREAM, GROUP, message_id)
            except Exception:
                logger.exception("Failed action message %s", message_id)
                await asyncio.sleep(0.5)

    await client.aclose()


def main() -> None:
    asyncio.run(process_loop())


if __name__ == "__main__":
    main()
