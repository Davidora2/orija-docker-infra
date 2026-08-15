"""Notifier — FCM phone push + Google Home / Nest Cast announcements."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import signal
import sys
import urllib.parse
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
GOOGLE_HOME_MODE = os.getenv("GOOGLE_HOME_MODE", "cast")  # cast | dry_run
GOOGLE_HOME_LANG = os.getenv("GOOGLE_HOME_LANG", "en")
VAPID_PRIVATE_KEY_FILE = os.getenv("VAPID_PRIVATE_KEY_FILE", "/secrets/vapid-private.pem")
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "")
VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "mailto:admin@homepulse.local")

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
        logger.info("FCM_MODE=dry_run — phone notifications will be logged, not sent")
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


async def fetch_google_homes(home_id: str) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{REGISTRY_URL}/v1/internal/homes/{home_id}/context")
    if resp.status_code != 200:
        logger.warning("No home context for Google Home fan-out (%s)", resp.status_code)
        return []
    by_role = resp.json().get("devices_by_role") or {}
    devices = []
    for role in ("google_home", "announcer"):
        devices.extend(by_role.get(role) or [])
    # Also include any google_cast vendor devices
    for d in resp.json().get("devices") or []:
        if d.get("vendor") in {"google_cast", "google_home", "nest"} and d not in devices:
            if d.get("role") in {None, "google_home", "announcer", "speaker"}:
                devices.append(d)
    # de-dupe by device_id
    seen: set[str] = set()
    unique = []
    for d in devices:
        did = d.get("device_id")
        if did and did not in seen:
            seen.add(did)
            unique.append(d)
    return unique


def tts_url(text: str, lang: str = "en") -> str:
    q = urllib.parse.quote(text[:180])
    return (
        "https://translate.google.com/translate_tts"
        f"?ie=UTF-8&client=tw-ob&tl={urllib.parse.quote(lang)}&q={q}"
    )


def cast_ip_for_device(device: dict[str, Any]) -> str | None:
    meta = device.get("meta") or {}
    return (
        meta.get("cast_ip")
        or meta.get("ip")
        or device.get("external_id")
        or meta.get("host")
    )


def announce_on_cast(host: str, text: str) -> dict[str, Any]:
    import pychromecast

    url = tts_url(text, GOOGLE_HOME_LANG)
    cast = pychromecast.Chromecast(host)
    cast.wait(timeout=8)
    mc = cast.media_controller
    mc.play_media(url, "audio/mp3")
    mc.block_until_active(timeout=8)
    return {"mode": "cast", "host": host, "url": url, "cast_name": getattr(cast, "name", None)}


async def send_fcm(token: str, command: ActionCommand) -> dict[str, Any]:
    assert command.notification is not None
    notification = command.notification

    # Web Push subscription JSON from the simple /join page (iPhone/Android browser)
    if token.strip().startswith("{"):
        return await asyncio.to_thread(send_web_push, token, command)

    channel = notification.channel_id or "smart_home_alerts"
    sound = notification.sound or "default"
    high = notification.priority in {"high", "max"}

    if FCM_MODE == "dry_run":
        result = {
            "mode": "dry_run",
            "token_suffix": token[-8:] if len(token) >= 8 else token,
            "title": notification.title,
            "body": notification.body,
            "data": notification.data,
            "image_url": notification.image_url,
            "priority": notification.priority,
            "channel_id": channel,
            "sound": sound,
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
            priority="high" if high else "normal",
            notification=messaging.AndroidNotification(
                channel_id=channel,
                priority="max" if notification.priority == "max" else ("high" if high else "default"),
                sound=sound,
            ),
        ),
        apns=messaging.APNSConfig(
            headers={"apns-priority": "10" if high else "5"},
            payload=messaging.APNSPayload(
                aps=messaging.Aps(
                    alert=messaging.ApsAlert(title=notification.title, body=notification.body),
                    sound=sound or "default",
                    content_available=True,
                )
            ),
        ),
    )
    message_id = messaging.send(message)
    return {"mode": "firebase", "message_id": message_id}


def send_web_push(subscription_json: str, command: ActionCommand) -> dict[str, Any]:
    assert command.notification is not None
    from pywebpush import webpush, WebPushException

    if not Path(VAPID_PRIVATE_KEY_FILE).exists():
        raise RuntimeError(f"Missing VAPID private key at {VAPID_PRIVATE_KEY_FILE}")
    payload = json.dumps(
        {
            "title": command.notification.title,
            "body": command.notification.body,
            "data": command.notification.data,
        }
    )
    if FCM_MODE == "dry_run" and os.getenv("WEB_PUSH_DRY_RUN", "false").lower() == "true":
        logger.info("DRY-RUN web push → %s", payload)
        return {"mode": "dry_run_web", "payload": payload}
    try:
        webpush(
            subscription_info=json.loads(subscription_json),
            data=payload,
            vapid_private_key=VAPID_PRIVATE_KEY_FILE,
            vapid_claims={"sub": VAPID_SUBJECT},
        )
        return {"mode": "web_push", "ok": True}
    except WebPushException as exc:
        raise RuntimeError(str(exc)) from exc


async def handle_push(redis_client: Any, command: ActionCommand) -> None:
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


async def handle_google_home(redis_client: Any, command: ActionCommand) -> None:
    text = ""
    if command.notification:
        text = command.notification.body or command.notification.title or ""
    text = text or command.params.get("message") or "Someone is at the door"
    devices = await fetch_google_homes(command.home_id)
    if not devices:
        logger.warning(
            "No Google Home devices registered for home %s — add speakers with role google_home and cast IP",
            command.home_id,
        )
        return

    deliveries = []
    for device in devices:
        host = cast_ip_for_device(device)
        name = device.get("name") or host or device.get("device_id")
        if not host:
            deliveries.append(
                {"device_id": device.get("device_id"), "name": name, "ok": False, "error": "missing cast_ip"}
            )
            continue
        if GOOGLE_HOME_MODE == "dry_run":
            result = {"mode": "dry_run", "host": host, "text": text, "name": name}
            logger.info("DRY-RUN Google Home → %s", json.dumps(result))
            deliveries.append({"device_id": device.get("device_id"), "name": name, "ok": True, "result": result})
            continue
        try:
            result = await asyncio.to_thread(announce_on_cast, host, text)
            logger.info("Google Home announced on %s (%s)", name, host)
            deliveries.append({"device_id": device.get("device_id"), "name": name, "ok": True, "result": result})
        except Exception as exc:
            logger.exception("Google Home announce failed for %s (%s)", name, host)
            deliveries.append(
                {"device_id": device.get("device_id"), "name": name, "ok": False, "error": str(exc)}
            )

    await publish(
        redis_client,
        AUDIT_STREAM,
        {
            "json": json.dumps(
                {
                    "action_id": command.action_id,
                    "home_id": command.home_id,
                    "event_id": command.event_id,
                    "text": text,
                    "deliveries": deliveries,
                }
            ),
            "audit_type": "notify.google_home",
        },
    )


async def handle_command(redis_client: Any, command: ActionCommand) -> None:
    if command.action_type == "notify.push":
        await handle_push(redis_client, command)
        return
    if command.action_type == "notify.google_home":
        await handle_google_home(redis_client, command)
        return
    logger.debug("Ignoring action %s", command.action_type)


async def process_loop() -> None:
    init_firebase()
    client = await get_redis()
    await ensure_consumer_group(client, ACTIONS_STREAM, GROUP)
    logger.info(
        "Notifier listening on %s as %s/%s (fcm=%s google_home=%s)",
        ACTIONS_STREAM,
        GROUP,
        CONSUMER,
        FCM_MODE,
        GOOGLE_HOME_MODE,
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
