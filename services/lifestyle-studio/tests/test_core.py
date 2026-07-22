"""Unit tests for prompts and project store (no Gemini calls)."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from lifestyle_studio.config import Settings
from lifestyle_studio.nanobanana import NanoBananaClient
from lifestyle_studio.projects import ProjectStore
from lifestyle_studio import prompts


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        gemini_api_key="",
        allow_mock_without_key=True,
        data_dir=tmp_path,
    )


def test_draft_prompt_includes_fidelity_and_model():
    text = prompts.build_draft_prompt(
        {
            "product_name": "Orija tote",
            "include_model": True,
            "scene": "cafe terrace",
            "layout": {
                "product": {"x": 60, "y": 70, "scale": 1.1},
                "model": {"enabled": True, "x": 30, "y": 40, "scale": 0.9, "pose": "holding bag"},
            },
        }
    )
    assert "PRODUCT FIDELITY" in text
    assert "Orija tote" in text
    assert "human model" in text.lower()
    assert "60%" in text
    assert "holding bag" in text


def test_reposition_prompt_moves_subjects():
    text = prompts.build_reposition_prompt(
        {"notes": "warmer light"},
        {
            "product": {"x": 70, "y": 55, "scale": 1.2},
            "model": {"enabled": True, "x": 25, "y": 45, "scale": 0.8, "pose": ""},
        },
    )
    assert "Edit this lifestyle photograph" in text
    assert "70%" in text
    assert "25%" in text


def test_bake_prompt_locks_composition():
    text = prompts.build_bake_prompt(
        {"product_name": "Bottle"},
        {"product": {"x": 50, "y": 50, "scale": 1.0}, "model": {"enabled": False}},
    )
    assert "high-resolution" in text.lower()
    assert "Bottle" in text


def test_project_store_roundtrip(settings: Settings):
    store = ProjectStore(settings)
    project = store.create()
    assert project["id"]
    store.add_ref(project["id"], "product", "shot.png", b"\x89PNG\r\n\x1a\nfake")
    project = store.get(project["id"])
    assert len(project["refs"]["product"]) == 1

    project, draft = store.add_draft(
        project, b"imagedata", prompt="p", model="m", size="1K"
    )
    assert project["active_draft_id"] == draft["id"]
    assert (store.project_dir(project["id"]) / draft["path"]).read_bytes() == b"imagedata"

    project, baked = store.add_baked(
        project, b"hires", prompt="bake", model="pro", size="2K", from_draft_id=draft["id"]
    )
    assert project["status"] == "baked"
    assert baked["size"] == "2K"


def test_mock_nanobanana_generates_png(settings: Settings, tmp_path: Path):
    client = NanoBananaClient(settings)
    ref = tmp_path / "ref.png"
    # minimal valid-ish PNG via Pillow path — write raw and let mock skip paste on failure
    ref.write_bytes(b"not-a-real-png")
    data = client.generate(
        prompt="test lifestyle",
        reference_paths=[ref],
        model="mock",
        image_size="1K",
        aspect_ratio="3:4",
    )
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
