from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "shared"))
sys.path.insert(0, str(ROOT / "services" / "rules-engine"))

from homepulse.events import ActionCommand, DeviceEvent, EventType, NotificationPayload
from homepulse.security import generate_api_key, hash_api_key, verify_api_key
import worker as rules


BASE_CTX = {
    "home_id": "home-1",
    "mode": "home",
    "armed": False,
    "timezone": "UTC",
    "devices_by_role": {
        "porch_light": [
            {
                "device_id": "light-1",
                "name": "Porch Light",
                "role": "porch_light",
                "mqtt_command_topic": "zigbee2mqtt/porch_light/set",
            }
        ],
        "siren": [
            {
                "device_id": "siren-1",
                "name": "Siren",
                "role": "siren",
                "mqtt_command_topic": "homepulse/siren/set",
            }
        ],
        "frigate_camera": [
            {
                "device_id": "cam-1",
                "name": "Front Camera",
                "role": "frigate_camera",
                "external_id": "front",
                "meta": {"frigate_camera": "front", "frigate_base_url": "http://frigate:5000"},
            }
        ],
        "entry_lock": [
            {
                "device_id": "lock-1",
                "name": "Front Lock",
                "role": "entry_lock",
                "state": "unlocked",
                "mqtt_command_topic": "zigbee2mqtt/front_lock/set",
            }
        ],
    },
}


def test_device_event_round_trip():
    event = DeviceEvent(
        home_id="home-1",
        device_id="dev-1",
        event_type=EventType.DOORBELL_RING,
        title="Doorbell",
        body="Someone rang",
    )
    restored = DeviceEvent.from_stream_fields(event.to_stream_fields())
    assert restored.event_type == EventType.DOORBELL_RING


def test_action_command_round_trip():
    cmd = ActionCommand(
        home_id="home-1",
        action_type="notify.push",
        notification=NotificationPayload(title="Doorbell", body="Ring"),
    )
    restored = ActionCommand.from_stream_fields(cmd.to_stream_fields())
    assert restored.notification.title == "Doorbell"


def test_api_key_hash_verify():
    key = generate_api_key()
    pepper = "unit-test-pepper"
    digest = hash_api_key(key, pepper)
    assert verify_api_key(key, digest, pepper)


def test_doorbell_home_mode_push_light_and_snapshot():
    event = DeviceEvent(
        home_id="home-1",
        device_id="doorbell-1",
        event_type=EventType.DOORBELL_RING,
        title="Doorbell",
        body="Someone rang the Front Door doorbell",
    )
    commands = rules.evaluate_with_context(event, BASE_CTX)
    types = [c.action_type for c in commands]
    assert "notify.push" in types
    assert "notify.google_home" in types
    assert "device.light_on" in types
    assert "device.siren_on" not in types
    gh = next(c for c in commands if c.action_type == "notify.google_home")
    assert gh.notification is not None
    assert "doorbell" in gh.notification.body.lower() or "rang" in gh.notification.body.lower()
    notify = next(c for c in commands if c.action_type == "notify.push")
    assert notify.notification is not None
    assert notify.notification.image_url == "http://frigate:5000/api/front/latest.jpg"
    light = next(c for c in commands if c.action_type == "device.light_on")
    assert light.params.get("duration_minutes") == 5


def test_doorbell_away_mode_louder_and_siren():
    ctx = {**BASE_CTX, "mode": "away", "armed": True}
    event = DeviceEvent(
        home_id="home-1",
        device_id="doorbell-1",
        event_type=EventType.DOORBELL_RING,
        title="Doorbell",
        body="Someone rang",
    )
    commands = rules.evaluate_with_context(event, ctx)
    notify = next(c for c in commands if c.action_type == "notify.push")
    assert notify.notification.priority == "max"
    assert notify.notification.channel_id == "smart_home_critical"
    assert any(c.action_type == "device.siren_on" for c in commands)


def test_armed_sensor_open_triggers_siren():
    ctx = {**BASE_CTX, "mode": "away", "armed": True}
    event = DeviceEvent(
        home_id="home-1",
        device_id="sensor-1",
        event_type=EventType.SENSOR_OPEN,
        title="Door/window",
        body="Front door opened",
    )
    commands = rules.evaluate_with_context(event, ctx)
    assert any(c.action_type == "notify.push" for c in commands)
    assert any(c.action_type == "device.siren_on" for c in commands)


def test_sensor_open_disarmed_is_quiet():
    event = DeviceEvent(
        home_id="home-1",
        device_id="sensor-1",
        event_type=EventType.SENSOR_OPEN,
        body="Front door opened",
    )
    commands = rules.evaluate_with_context(event, BASE_CTX)
    assert not any(c.action_type == "notify.push" for c in commands)
    assert not any(c.action_type == "device.siren_on" for c in commands)


def test_frigate_person_includes_clip():
    event = DeviceEvent(
        home_id="home-1",
        device_id="cam-1",
        event_type=EventType.CAMERA_PERSON,
        title="Person detected",
        body="Person detected",
        payload={
            "label": "person",
            "score": 0.92,
            "frigate_event_id": "evt123",
            "clip_url": "http://frigate:5000/api/events/evt123/clip.mp4",
            "snapshot_url": "http://frigate:5000/api/events/evt123/thumbnail.jpg",
        },
    )
    commands = rules.evaluate_with_context(event, BASE_CTX)
    notify = next(c for c in commands if c.action_type == "notify.push")
    assert "clip" in notify.notification.body.lower() or notify.notification.data.get("clip_url")
    assert notify.notification.image_url.endswith("thumbnail.jpg")


def test_lock_left_unlocked_autolock():
    event = DeviceEvent(
        home_id="home-1",
        device_id="lock-1",
        event_type=EventType.LOCK_LEFT_UNLOCKED,
        body="Front Lock is still unlocked after sunset",
        payload={"auto_lock": True},
    )
    commands = rules.evaluate_with_context(event, BASE_CTX)
    assert any(c.action_type == "notify.push" for c in commands)
    assert any(c.action_type == "device.lock" for c in commands)
