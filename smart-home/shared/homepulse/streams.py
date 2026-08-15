"""Redis Streams helpers for the HomePulse event bus."""

from __future__ import annotations

import os
from typing import Any

import redis.asyncio as redis

EVENTS_STREAM = os.getenv("EVENTS_STREAM", "home.events")
ACTIONS_STREAM = os.getenv("ACTIONS_STREAM", "home.actions")
AUDIT_STREAM = os.getenv("AUDIT_STREAM", "home.audit")


async def get_redis() -> redis.Redis:
    url = os.getenv("REDIS_URL", "redis://redis:6379/0")
    return redis.from_url(url, decode_responses=False)


async def ensure_consumer_group(
    client: redis.Redis, stream: str, group: str
) -> None:
    try:
        await client.xgroup_create(stream, group, id="0", mkstream=True)
    except redis.ResponseError as exc:
        if "BUSYGROUP" not in str(exc):
            raise


async def publish(client: redis.Redis, stream: str, fields: dict[str, str]) -> str:
    message_id = await client.xadd(stream, fields)
    if isinstance(message_id, bytes):
        return message_id.decode()
    return str(message_id)


async def read_group(
    client: redis.Redis,
    stream: str,
    group: str,
    consumer: str,
    count: int = 10,
    block_ms: int = 2000,
) -> list[tuple[str, dict[str, Any]]]:
    results = await client.xreadgroup(
        groupname=group,
        consumername=consumer,
        streams={stream: ">"},
        count=count,
        block=block_ms,
    )
    messages: list[tuple[str, dict[str, Any]]] = []
    if not results:
        return messages
    for _stream_name, entries in results:
        for message_id, fields in entries:
            mid = message_id.decode() if isinstance(message_id, bytes) else str(message_id)
            messages.append((mid, fields))
    return messages


async def ack(client: redis.Redis, stream: str, group: str, message_id: str) -> None:
    await client.xack(stream, group, message_id)
