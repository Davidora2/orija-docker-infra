"""Scheduler — lock-left-unlocked after sunset checks."""

from __future__ import annotations

import asyncio
import logging
import os
import signal
import sys
from datetime import datetime, time, timezone
from typing import Any
from zoneinfo import ZoneInfo

import httpx

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "shared"))
from homepulse.events import DeviceEvent, EventType  # noqa: E402
from homepulse.streams import AUDIT_STREAM, EVENTS_STREAM, get_redis, publish  # noqa: E402

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("scheduler")

REGISTRY_URL = os.getenv("REGISTRY_URL", "http://home-registry:8000")
CHECK_INTERVAL_SECONDS = int(os.getenv("LOCK_CHECK_INTERVAL_SECONDS", "60"))
# Approximate “after sunset” window using a configurable local clock (no astronomy dep).
# Override per-home later; default 20:00 local.
SUNSET_HOUR = int(os.getenv("SUNSET_HOUR_LOCAL", "20"))
SUNSET_MINUTE = int(os.getenv("SUNSET_MINUTE_LOCAL", "0"))
AUTO_LOCK = os.getenv("AUTO_LOCK_AFTER_SUNSET", "true").lower() == "true"
# Dedupe: don't re-alert the same unlocked lock more than once per evening.
_alerted: set[str] = set()
RUNNING = True


def handle_stop(*_args: Any) -> None:
    global RUNNING
    RUNNING = False


signal.signal(signal.SIGTERM, handle_stop)
signal.signal(signal.SIGINT, handle_stop)


def after_sunset(tz_name: str, now: datetime | None = None) -> bool:
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = timezone.utc
    local_now = (now or datetime.now(timezone.utc)).astimezone(tz)
    boundary = time(SUNSET_HOUR, SUNSET_MINUTE)
    return local_now.timetz().replace(tzinfo=None) >= boundary


def dedupe_key(home_id: str, device_id: str, local_date: str) -> str:
    return f"{home_id}:{device_id}:{local_date}"


async def check_once() -> None:
    async with httpx.AsyncClient(timeout=15.0) as client:
        homes_resp = await client.get(f"{REGISTRY_URL}/v1/internal/homes")
        if homes_resp.status_code != 200:
            logger.warning("Unable to list homes")
            return
        homes = homes_resp.json().get("homes", [])

        redis_client = await get_redis()
        try:
            for home in homes:
                home_id = home["home_id"]
                tz_name = home.get("timezone") or "UTC"
                if not after_sunset(tz_name):
                    continue
                ctx_resp = await client.get(f"{REGISTRY_URL}/v1/internal/homes/{home_id}/context")
                if ctx_resp.status_code != 200:
                    continue
                ctx = ctx_resp.json()
                locks = ctx.get("devices_by_role", {}).get("entry_lock") or []
                try:
                    local_date = datetime.now(ZoneInfo(tz_name)).date().isoformat()
                except Exception:
                    local_date = datetime.now(timezone.utc).date().isoformat()

                for lock in locks:
                    if (lock.get("state") or "").lower() != "unlocked":
                        continue
                    key = dedupe_key(home_id, lock["device_id"], local_date)
                    if key in _alerted:
                        continue
                    event = DeviceEvent(
                        home_id=home_id,
                        device_id=lock["device_id"],
                        device_type="lock",
                        vendor=lock.get("vendor", "mqtt"),
                        event_type=EventType.LOCK_LEFT_UNLOCKED,
                        title="Lock reminder",
                        body=f"{lock.get('name') or 'Entry lock'} is still unlocked after sunset",
                        severity="warning",
                        payload={
                            "auto_lock": AUTO_LOCK,
                            "state": lock.get("state"),
                            "sunset_hour_local": SUNSET_HOUR,
                        },
                        source="scheduler.lock_check",
                    )
                    await publish(redis_client, EVENTS_STREAM, event.to_stream_fields())
                    await publish(
                        redis_client,
                        AUDIT_STREAM,
                        {"json": event.model_dump_json(), "audit_type": "event.ingested"},
                    )
                    _alerted.add(key)
                    logger.info("Emitted lock-left-unlocked for %s", lock.get("name"))
        finally:
            await redis_client.aclose()


async def run() -> None:
    logger.info(
        "Scheduler started (interval=%ss sunset=%02d:%02d auto_lock=%s)",
        CHECK_INTERVAL_SECONDS,
        SUNSET_HOUR,
        SUNSET_MINUTE,
        AUTO_LOCK,
    )
    while RUNNING:
        try:
            await check_once()
        except Exception:
            logger.exception("Lock check failed")
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
