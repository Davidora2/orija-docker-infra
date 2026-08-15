"""Generate Frigate config.yml with 14-day activity recording retention."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import httpx
import yaml

logger = logging.getLogger("frigate-sync")

RECORD_RETAIN_DAYS = 14


def _camera_slug(device: dict[str, Any]) -> str:
    meta = device.get("meta") or {}
    name = meta.get("frigate_camera") or device.get("external_id") or device.get("name") or "cam"
    slug = "".join(ch.lower() if ch.isalnum() else "_" for ch in str(name)).strip("_")
    return slug or "cam"


def _rtsp_url(device: dict[str, Any]) -> str | None:
    meta = device.get("meta") or {}
    for key in ("rtsp_url", "rtsp", "stream_url"):
        val = meta.get(key)
        if isinstance(val, str) and val.strip().startswith(("rtsp://", "http://", "https://")):
            return val.strip()
    return None


def build_frigate_config(cameras: list[dict[str, Any]], *, mqtt_host: str = "mosquitto") -> dict[str, Any]:
    """Build a Frigate config that records motion activity for RECORD_RETAIN_DAYS days."""
    go2rtc_streams: dict[str, list[str]] = {}
    camera_blocks: dict[str, Any] = {}

    for device in cameras:
        slug = _camera_slug(device)
        rtsp = _rtsp_url(device)
        if rtsp:
            go2rtc_streams[slug] = [rtsp]
        else:
            # Always-on test pattern so Frigate can start before real RTSP is set
            go2rtc_streams[slug] = [
                f"ffmpeg:testsrc=size=1280x720:rate=5#video=h264#raw=-pix_fmt yuv420p"
            ]
        camera_blocks[slug] = {
            "enabled": True,
            "ffmpeg": {
                "inputs": [
                    {
                        "path": f"rtsp://127.0.0.1:8554/{slug}",
                        "roles": ["detect", "record"],
                    }
                ]
            },
            "detect": {"width": 1280, "height": 720, "fps": 5},
            "record": {
                "enabled": True,
                "retain": {"days": RECORD_RETAIN_DAYS, "mode": "motion"},
                "alerts": {"retain": {"days": RECORD_RETAIN_DAYS, "mode": "motion"}},
                "detections": {"retain": {"days": RECORD_RETAIN_DAYS, "mode": "motion"}},
            },
            "snapshots": {
                "enabled": True,
                "retain": {"default": RECORD_RETAIN_DAYS},
            },
            "objects": {"track": ["person", "car", "dog", "cat"]},
            "mqtt": {"enabled": True, "timestamp": True, "bounding_box": True},
        }

    if not camera_blocks:
        go2rtc_streams["preview"] = [
            "ffmpeg:testsrc=size=1280x720:rate=5#video=h264#raw=-pix_fmt yuv420p"
        ]
        camera_blocks["preview"] = {
            "enabled": True,
            "ffmpeg": {
                "inputs": [
                    {
                        "path": "rtsp://127.0.0.1:8554/preview",
                        "roles": ["detect", "record"],
                    }
                ]
            },
            "detect": {"width": 1280, "height": 720, "fps": 5},
            "record": {
                "enabled": True,
                "retain": {"days": RECORD_RETAIN_DAYS, "mode": "motion"},
            },
            "snapshots": {"enabled": True, "retain": {"default": RECORD_RETAIN_DAYS}},
            "objects": {"track": ["person"]},
        }

    return {
        "mqtt": {
            "enabled": True,
            "host": mqtt_host,
            "port": 1883,
            "topic_prefix": "frigate",
            "client_id": "homepulse-frigate",
        },
        "detectors": {"cpu": {"type": "cpu", "num_threads": 2}},
        "database": {"path": "/config/frigate.db"},
        "record": {
            "enabled": True,
            "retain": {"days": RECORD_RETAIN_DAYS, "mode": "motion"},
            "alerts": {"retain": {"days": RECORD_RETAIN_DAYS, "mode": "motion"}},
            "detections": {"retain": {"days": RECORD_RETAIN_DAYS, "mode": "motion"}},
        },
        "snapshots": {"enabled": True, "retain": {"default": RECORD_RETAIN_DAYS}},
        "go2rtc": {"streams": go2rtc_streams},
        "cameras": camera_blocks,
        "ui": {"timezone": "Europe/London"},
        "version": "0.14",
    }


def write_frigate_config(path: Path, cameras: list[dict[str, Any]], *, mqtt_host: str = "mosquitto") -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    config = build_frigate_config(cameras, mqtt_host=mqtt_host)
    # Frigate expects YAML; use safe dump
    text = yaml.safe_dump(config, sort_keys=False, default_flow_style=False)
    path.write_text(text)
    logger.info("Wrote Frigate config with %d cameras to %s (retain=%sd)", len(config["cameras"]), path, RECORD_RETAIN_DAYS)
    return path


async def reload_frigate(base_url: str) -> dict[str, Any]:
    url = f"{base_url.rstrip('/')}/api/reload"
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(url)
        if resp.status_code >= 400:
            return {"ok": False, "status": resp.status_code, "body": resp.text[:300]}
        return {"ok": True, "status": resp.status_code}
