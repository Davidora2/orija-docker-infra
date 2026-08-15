from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "shared"))

from homepulse.events import ActionCommand, DeviceEvent, EventType, NotificationPayload
from homepulse.security import generate_api_key, hash_api_key, verify_api_key


def test_device_event_round_trip():
    event = DeviceEvent(
        home_id="home-1",
        device_id="dev-1",
        event_type=EventType.DOORBELL_RING,
        title="Doorbell",
        body="Someone rang the Front Door doorbell",
        payload={"ring_device_id": "ring-1"},
    )
    restored = DeviceEvent.from_stream_fields(event.to_stream_fields())
    assert restored.event_id == event.event_id
    assert restored.event_type == EventType.DOORBELL_RING
    assert restored.payload["ring_device_id"] == "ring-1"


def test_action_command_round_trip():
    cmd = ActionCommand(
        home_id="home-1",
        action_type="notify.push",
        notification=NotificationPayload(title="Doorbell", body="Ring"),
    )
    restored = ActionCommand.from_stream_fields(cmd.to_stream_fields())
    assert restored.action_type == "notify.push"
    assert restored.notification is not None
    assert restored.notification.title == "Doorbell"


def test_api_key_hash_verify():
    key = generate_api_key()
    pepper = "unit-test-pepper"
    digest = hash_api_key(key, pepper)
    assert verify_api_key(key, digest, pepper)
    assert not verify_api_key(key + "x", digest, pepper)


def test_rules_engine_doorbell_emits_notify(monkeypatch):
    sys.path.insert(0, str(ROOT / "services" / "rules-engine"))
    import worker as rules

    event = DeviceEvent(
        home_id="home-1",
        device_id="dev-1",
        event_type=EventType.DOORBELL_RING,
        title="Doorbell",
        body="Someone rang",
    )
    commands = rules.evaluate(event)
    notify = [c for c in commands if c.action_type == "notify.push"]
    assert len(notify) == 1
    assert notify[0].notification is not None
    assert notify[0].notification.title == "Doorbell"


def test_rules_engine_motion_respects_flag(monkeypatch):
    sys.path.insert(0, str(ROOT / "services" / "rules-engine"))
    import importlib
    import worker as rules

    monkeypatch.setenv("NOTIFY_ON_MOTION", "false")
    importlib.reload(rules)
    event = DeviceEvent(
        home_id="home-1",
        device_id="dev-1",
        event_type=EventType.DOORBELL_MOTION,
        title="Motion",
        body="Motion",
    )
    commands = rules.evaluate(event)
    assert not any(c.action_type == "notify.push" for c in commands)
