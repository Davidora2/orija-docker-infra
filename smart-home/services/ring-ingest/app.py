"""Ring ingest service — webhooks, adapters, and normalized event publishing."""

from __future__ import annotations

import logging
import os
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import FastAPI, Header, HTTPException, Request, status
from pydantic import BaseModel, Field

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "shared"))
from homepulse.events import DeviceEvent, EventType  # noqa: E402
from homepulse.streams import AUDIT_STREAM, EVENTS_STREAM, get_redis, publish  # noqa: E402

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("ring-ingest")

REGISTRY_URL = os.getenv("REGISTRY_URL", "http://home-registry:8000")
RING_WEBHOOK_SECRET = os.getenv("RING_WEBHOOK_SECRET", "")

redis_client = None


class RingDingPayload(BaseModel):
    """Minimal Ring-compatible ding payload (webhook / adapter)."""

    device_id: str = Field(..., description="Ring device external id")
    event: str = "ding"
    ding_id: str | None = None
    created_at: datetime | None = None
    kind: str | None = None  # ding | motion
    snapshot_url: str | None = None


class SimulateRingRequest(BaseModel):
    external_device_id: str
    event: str = "ding"
    snapshot_url: str | None = None
    vendor: str = "ring"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global redis_client
    redis_client = await get_redis()
    yield
    if redis_client is not None:
        await redis_client.aclose()


app = FastAPI(
    title="HomePulse Ring Ingest",
    version="0.1.0",
    description="Ingests Ring doorbell events and publishes normalized DeviceEvents.",
    lifespan=lifespan,
)


async def auth_home(x_api_key: str | None) -> dict[str, Any]:
    if not x_api_key:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "X-API-Key required")
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{REGISTRY_URL}/v1/internal/auth/api-key",
            headers={"X-API-Key": x_api_key},
        )
    if resp.status_code != 200:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid API key")
    data = resp.json()
    if "ingest:write" not in data.get("scopes", []):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "API key missing ingest:write scope")
    return data


async def resolve_device(vendor: str, external_id: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{REGISTRY_URL}/v1/internal/devices/resolve",
            params={"vendor": vendor, "external_id": external_id},
        )
    if resp.status_code != 200:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown Ring device — register it first")
    return resp.json()


def map_ring_event(kind: str | None, event: str) -> EventType:
    value = (kind or event or "ding").lower()
    if value in {"motion", "doorbell.motion", "motion_detection"}:
        return EventType.DOORBELL_MOTION
    return EventType.DOORBELL_RING


async def ingest_ring_event(
    body: RingDingPayload, home_id: str, *, vendor: str = "ring"
) -> dict[str, Any]:
    device = await resolve_device(vendor, body.device_id)
    if device["home_id"] != home_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Device does not belong to this home")

    event_type = map_ring_event(body.kind, body.event)
    location = device.get("location_label") or device.get("name") or "Front door"
    title = "Doorbell" if event_type == EventType.DOORBELL_RING else "Doorbell motion"
    body_text = (
        f"Someone rang the {location} doorbell"
        if event_type == EventType.DOORBELL_RING
        else f"Motion detected at {location}"
    )

    event = DeviceEvent(
        home_id=device["home_id"],
        device_id=device["device_id"],
        device_type=device.get("device_type", "doorbell"),
        vendor=vendor,
        event_type=event_type,
        occurred_at=body.created_at or datetime.now(timezone.utc),
        title=title,
        body=body_text,
        payload={
            "external_device_id": body.device_id,
            "ding_id": body.ding_id,
            "snapshot_url": body.snapshot_url,
            "raw_event": body.event,
            "kind": body.kind,
            "vendor": vendor,
        },
        source="ring-ingest.webhook",
    )

    assert redis_client is not None
    msg_id = await publish(redis_client, EVENTS_STREAM, event.to_stream_fields())
    await publish(
        redis_client,
        AUDIT_STREAM,
        {
            "json": event.model_dump_json(),
            "audit_type": "event.ingested",
        },
    )
    logger.info("Published %s event_id=%s stream_id=%s", event.event_type, event.event_id, msg_id)
    return {"accepted": True, "event_id": event.event_id, "stream_id": msg_id}


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "ring-ingest"}


@app.post("/v1/webhooks/ring")
async def ring_webhook(
    body: RingDingPayload,
    request: Request,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    x_ring_signature: str | None = Header(default=None, alias="X-Ring-Signature"),
) -> dict[str, Any]:
    """Public webhook endpoint for Ring adapters / IFTTT / ring-mqtt bridges.

    Security layers:
    1. Home-scoped API key (required)
    2. Optional shared webhook secret header for network-edge verification
    """
    if RING_WEBHOOK_SECRET:
        provided = request.headers.get("X-Webhook-Secret") or x_ring_signature
        if provided != RING_WEBHOOK_SECRET:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid webhook secret")

    auth = await auth_home(x_api_key)
    return await ingest_ring_event(body, auth["home_id"])


@app.post("/v1/simulate/ring")
async def simulate_ring(
    body: SimulateRingRequest,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> dict[str, Any]:
    """Dev/demo helper that fabricates a Ring ding without the physical doorbell."""
    auth = await auth_home(x_api_key)
    payload = RingDingPayload(
        device_id=body.external_device_id,
        event=body.event,
        kind="ding" if body.event == "ding" else body.event,
        snapshot_url=body.snapshot_url,
        ding_id=f"sim-{datetime.now(timezone.utc).timestamp()}",
    )
    return await ingest_ring_event(payload, auth["home_id"], vendor=body.vendor or "ring")
