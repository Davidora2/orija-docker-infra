"""Tests for the self-learning memory assistant."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from lifestyle_studio.config import Settings
from lifestyle_studio.learning import LearningMemory
from lifestyle_studio import prompts


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(gemini_api_key="", allow_mock_without_key=True, data_dir=tmp_path)


def test_learning_from_bake_and_reposition(settings: Settings):
    mem = LearningMemory(settings)
    mem.record(
        "bake_approved",
        {
            "brief": {
                "product_name": "Orija tote",
                "scene": "sunlit linen loft",
                "lighting": "soft window light",
                "camera": "50mm lifestyle",
                "aspect_ratio": "3:4",
                "include_model": True,
            },
            "layout": {
                "product": {"x": 62, "y": 70, "scale": 1.1},
                "model": {"enabled": True, "x": 34, "y": 46, "scale": 0.95},
            },
            "lesson": "Keep tote straps fully visible",
        },
    )
    mem.record(
        "reposition",
        {
            "brief": {"product_name": "Orija tote"},
            "before_layout": {
                "product": {"x": 50, "y": 50, "scale": 1.0},
                "model": {"enabled": True, "x": 40, "y": 50, "scale": 1.0},
            },
            "after_layout": {
                "product": {"x": 65, "y": 60, "scale": 1.15},
                "model": {"enabled": True, "x": 30, "y": 45, "scale": 1.0},
            },
        },
    )
    mem.record(
        "rating",
        {
            "rating": "down",
            "reason": "product too large vs hands",
            "brief": {"product_name": "Orija tote", "scene": "busy street"},
        },
    )

    profile = mem.profile()
    assert profile["totals"]["bakes"] == 1
    assert profile["totals"]["repositions"] == 1
    assert profile["totals"]["thumbs_down"] == 1
    assert any("sunlit linen loft" in r for r in profile["learned_rules"])

    suggestion = mem.suggest("Orija tote")
    assert suggestion["confidence"] > 0.2
    assert suggestion["brief"]["scene"] == "sunlit linen loft"
    assert suggestion["product_stats"]["bakes"] == 1

    ctx = mem.learning_context_for_prompt("Orija tote")
    assert "SELF-LEARNED" in ctx
    assert "tote straps" in ctx.lower() or "product" in ctx.lower()

    reply = mem.assistant_reply("What lighting should I use?", "Orija tote")
    assert "window" in reply["answer"].lower() or "lighting" in reply["answer"].lower()


def test_prompt_includes_learning_context():
    text = prompts.build_draft_prompt(
        {"product_name": "Bag", "include_model": False},
        learning_context="SELF-LEARNED\n- Prefer soft daylight",
    )
    assert "SELF-LEARNED" in text
    assert "Prefer soft daylight" in text
