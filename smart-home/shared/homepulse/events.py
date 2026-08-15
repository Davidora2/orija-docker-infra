"""Canonical event / action schemas used across all HomePulse services."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


class EventType(str, Enum):
    DOORBELL_RING = "doorbell.ring"
    DOORBELL_MOTION = "doorbell.motion"
    LOCK_LOCKED = "lock.locked"
    LOCK_UNLOCKED = "lock.unlocked"
    CAMERA_MOTION = "camera.motion"
    CAMERA_PERSON = "camera.person"
    SENSOR_OPEN = "sensor.open"
    SENSOR_CLOSE = "sensor.close"
    HOME_MODE_CHANGED = "home.mode_changed"
    LOCK_LEFT_UNLOCKED = "lock.left_unlocked"
    SYSTEM_HEALTH = "system.health"
    CUSTOM = "custom"


class DeviceEvent(BaseModel):
    """Normalized device event published onto the home.events stream."""

    event_id: str = Field(default_factory=lambda: str(uuid4()))
    home_id: str
    device_id: str
    device_type: str = "doorbell"
    vendor: str = "ring"
    event_type: EventType
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    received_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    severity: str = "info"
    title: str | None = None
    body: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    correlation_id: str = Field(default_factory=lambda: str(uuid4()))
    source: str = "ring-ingest"

    def to_stream_fields(self) -> dict[str, str]:
        return {"json": self.model_dump_json()}

    @classmethod
    def from_stream_fields(cls, fields: dict[str, Any]) -> DeviceEvent:
        raw = fields.get(b"json") or fields.get("json")
        if isinstance(raw, bytes):
            raw = raw.decode()
        return cls.model_validate_json(raw)


class NotificationPayload(BaseModel):
    title: str
    body: str
    data: dict[str, str] = Field(default_factory=dict)
    image_url: str | None = None
    priority: str = "high"
    channel_id: str | None = None  # android notification channel override
    sound: str | None = None


class ActionCommand(BaseModel):
    """Command emitted by the rules engine for downstream executors."""

    action_id: str = Field(default_factory=lambda: str(uuid4()))
    home_id: str
    action_type: str
    # notify.push | device.light_on | device.light_off | device.siren_on
    # device.lock | device.unlock | audit.log
    target: str | None = None  # device_id or mqtt topic hint
    event_id: str | None = None
    correlation_id: str | None = None
    notification: NotificationPayload | None = None
    params: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def to_stream_fields(self) -> dict[str, str]:
        return {"json": self.model_dump_json()}

    @classmethod
    def from_stream_fields(cls, fields: dict[str, Any]) -> ActionCommand:
        raw = fields.get(b"json") or fields.get("json")
        if isinstance(raw, bytes):
            raw = raw.decode()
        return cls.model_validate_json(raw)
