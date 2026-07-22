"""Self-learning memory: records outcomes and derives reusable studio preferences."""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import Settings


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _tokenize(name: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", " ", (name or "").lower()).strip()
    return cleaned or "untitled"


def _avg(values: list[float], default: float) -> float:
    return sum(values) / len(values) if values else default


class LearningMemory:
    """Persistent event log + rolled-up preferences that improve with use."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.root = settings.data_dir / "memory"
        self.root.mkdir(parents=True, exist_ok=True)
        self.events_path = self.root / "events.jsonl"
        self.profile_path = self.root / "profile.json"
        if not self.profile_path.exists():
            self._write_profile(self._empty_profile())

    def _empty_profile(self) -> dict[str, Any]:
        return {
            "updated_at": _now(),
            "totals": {
                "events": 0,
                "bakes": 0,
                "thumbs_up": 0,
                "thumbs_down": 0,
                "repositions": 0,
            },
            "learned_rules": [],
            "preferred": {
                "scenes": [],
                "lighting": [],
                "cameras": [],
                "aspect_ratios": [],
                "include_model_rate": 0.5,
            },
            "layout_priors": {
                "product": {"x": 58, "y": 62, "scale": 1.0},
                "model": {"x": 38, "y": 48, "scale": 1.0},
            },
            "common_fixes": [],
            "products": {},
        }

    def _write_profile(self, profile: dict[str, Any]) -> None:
        profile["updated_at"] = _now()
        self.profile_path.write_text(json.dumps(profile, indent=2))

    def profile(self) -> dict[str, Any]:
        return json.loads(self.profile_path.read_text())

    def record(self, event_type: str, payload: dict[str, Any]) -> dict[str, Any]:
        event = {
            "ts": _now(),
            "type": event_type,
            **payload,
        }
        with self.events_path.open("a") as fh:
            fh.write(json.dumps(event) + "\n")
        profile = self.rebuild()
        return {"event": event, "profile": profile}

    def iter_events(self) -> list[dict[str, Any]]:
        if not self.events_path.exists():
            return []
        events = []
        for line in self.events_path.read_text().splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        return events

    def rebuild(self) -> dict[str, Any]:
        events = self.iter_events()
        profile = self._empty_profile()
        profile["totals"]["events"] = len(events)

        scenes: Counter[str] = Counter()
        lighting: Counter[str] = Counter()
        cameras: Counter[str] = Counter()
        ratios: Counter[str] = Counter()
        model_votes = 0
        model_total = 0

        prod_x: list[float] = []
        prod_y: list[float] = []
        prod_s: list[float] = []
        model_x: list[float] = []
        model_y: list[float] = []
        model_s: list[float] = []

        fix_notes: Counter[str] = Counter()
        product_stats: dict[str, dict[str, Any]] = defaultdict(
            lambda: {
                "bakes": 0,
                "up": 0,
                "down": 0,
                "scenes": Counter(),
                "lighting": Counter(),
                "cameras": Counter(),
                "layouts": [],
                "lessons": [],
            }
        )

        for ev in events:
            et = ev.get("type")
            brief = ev.get("brief") or {}
            layout = ev.get("layout") or {}
            product_name = _tokenize(brief.get("product_name") or ev.get("product_name") or "")
            ps = product_stats[product_name]

            if et == "bake_approved":
                profile["totals"]["bakes"] += 1
                ps["bakes"] += 1
                if brief.get("scene"):
                    scenes[brief["scene"]] += 2
                    ps["scenes"][brief["scene"]] += 2
                if brief.get("lighting"):
                    lighting[brief["lighting"]] += 2
                    ps["lighting"][brief["lighting"]] += 2
                if brief.get("camera"):
                    cameras[brief["camera"]] += 2
                    ps["cameras"][brief["camera"]] += 2
                if brief.get("aspect_ratio"):
                    ratios[brief["aspect_ratio"]] += 2
                model_total += 1
                if brief.get("include_model"):
                    model_votes += 1
                product = layout.get("product") or {}
                model = layout.get("model") or {}
                if product:
                    prod_x.append(float(product.get("x", 58)))
                    prod_y.append(float(product.get("y", 62)))
                    prod_s.append(float(product.get("scale", 1.0)))
                    ps["layouts"].append(layout)
                if model.get("enabled"):
                    model_x.append(float(model.get("x", 38)))
                    model_y.append(float(model.get("y", 48)))
                    model_s.append(float(model.get("scale", 1.0)))
                if ev.get("lesson"):
                    ps["lessons"].append(ev["lesson"])

            elif et == "rating":
                rating = ev.get("rating")
                if rating == "up":
                    profile["totals"]["thumbs_up"] += 1
                    ps["up"] += 1
                    if brief.get("scene"):
                        scenes[brief["scene"]] += 1
                    if brief.get("lighting"):
                        lighting[brief["lighting"]] += 1
                elif rating == "down":
                    profile["totals"]["thumbs_down"] += 1
                    ps["down"] += 1
                    reason = (ev.get("reason") or "").strip()
                    if reason:
                        fix_notes[reason] += 1
                        ps["lessons"].append(f"Avoid: {reason}")

            elif et == "reposition":
                profile["totals"]["repositions"] += 1
                before = ev.get("before_layout") or {}
                after = ev.get("after_layout") or {}
                bp = before.get("product") or {}
                ap = after.get("product") or {}
                if bp and ap:
                    dx = float(ap.get("x", 0)) - float(bp.get("x", 0))
                    dy = float(ap.get("y", 0)) - float(bp.get("y", 0))
                    ds = float(ap.get("scale", 1)) - float(bp.get("scale", 1))
                    bits = []
                    if abs(dx) >= 4:
                        bits.append("product right" if dx > 0 else "product left")
                    if abs(dy) >= 4:
                        bits.append("product lower" if dy > 0 else "product higher")
                    if abs(ds) >= 0.08:
                        bits.append("product larger" if ds > 0 else "product smaller")
                    bm = before.get("model") or {}
                    am = after.get("model") or {}
                    if bm.get("enabled") or am.get("enabled"):
                        mdx = float(am.get("x", bm.get("x", 0))) - float(bm.get("x", 0))
                        mdy = float(am.get("y", bm.get("y", 0))) - float(bm.get("y", 0))
                        if abs(mdx) >= 4:
                            bits.append("model right" if mdx > 0 else "model left")
                        if abs(mdy) >= 4:
                            bits.append("model lower" if mdy > 0 else "model higher")
                    if bits:
                        fix_notes[", ".join(bits)] += 1
                        ps["lessons"].append("Common fix: " + ", ".join(bits))

            elif et == "lesson":
                text = (ev.get("text") or "").strip()
                if text:
                    ps["lessons"].append(text)
                    fix_notes[text] += 1

        profile["preferred"] = {
            "scenes": [s for s, _ in scenes.most_common(8)],
            "lighting": [s for s, _ in lighting.most_common(8)],
            "cameras": [s for s, _ in cameras.most_common(8)],
            "aspect_ratios": [s for s, _ in ratios.most_common(5)],
            "include_model_rate": (model_votes / model_total) if model_total else 0.5,
        }
        profile["layout_priors"] = {
            "product": {
                "x": round(_avg(prod_x, 58), 1),
                "y": round(_avg(prod_y, 62), 1),
                "scale": round(_avg(prod_s, 1.0), 2),
            },
            "model": {
                "x": round(_avg(model_x, 38), 1),
                "y": round(_avg(model_y, 48), 1),
                "scale": round(_avg(model_s, 1.0), 2),
            },
        }
        profile["common_fixes"] = [
            {"pattern": k, "count": v} for k, v in fix_notes.most_common(12)
        ]

        learned_rules: list[str] = []
        if profile["totals"]["bakes"] >= 1:
            top_scene = profile["preferred"]["scenes"][:1]
            if top_scene:
                learned_rules.append(f"Approved lifestyle scenes often use: {top_scene[0]}")
            top_light = profile["preferred"]["lighting"][:1]
            if top_light:
                learned_rules.append(f"Preferred lighting: {top_light[0]}")
            rate = profile["preferred"]["include_model_rate"]
            if rate >= 0.7:
                learned_rules.append("Most approved shoots include a realistic human model.")
            elif rate <= 0.3 and model_total:
                learned_rules.append("Most approved shoots are product-only (no model).")
        for fix in profile["common_fixes"][:5]:
            learned_rules.append(
                f"When composing drafts, anticipate this correction: {fix['pattern']}."
            )
        profile["learned_rules"] = learned_rules

        products_out = {}
        for name, stats in product_stats.items():
            if name == "untitled" and stats["bakes"] == 0 and stats["up"] == 0:
                continue
            products_out[name] = {
                "bakes": stats["bakes"],
                "up": stats["up"],
                "down": stats["down"],
                "top_scenes": [s for s, _ in stats["scenes"].most_common(3)],
                "top_lighting": [s for s, _ in stats["lighting"].most_common(3)],
                "top_cameras": [s for s, _ in stats["cameras"].most_common(3)],
                "lessons": stats["lessons"][-8:],
                "last_layout": stats["layouts"][-1] if stats["layouts"] else None,
            }
        profile["products"] = products_out
        self._write_profile(profile)
        return profile

    def suggest(self, product_name: str = "", include_model: bool | None = None) -> dict[str, Any]:
        profile = self.profile()
        key = _tokenize(product_name)
        product = profile.get("products", {}).get(key) or {}
        preferred = profile.get("preferred") or {}

        scene = (product.get("top_scenes") or preferred.get("scenes") or [None])[0]
        lighting = (product.get("top_lighting") or preferred.get("lighting") or [None])[0]
        camera = (product.get("top_cameras") or preferred.get("cameras") or [None])[0]
        ratio = (preferred.get("aspect_ratios") or ["3:4"])[0]

        layout = json.loads(json.dumps(profile.get("layout_priors") or {}))
        if product.get("last_layout"):
            layout = product["last_layout"]

        if include_model is None:
            include_model = preferred.get("include_model_rate", 0.5) >= 0.5

        confidence = 0.15
        confidence += min(0.45, 0.05 * profile["totals"]["bakes"])
        confidence += min(0.2, 0.03 * profile["totals"]["thumbs_up"])
        if product.get("bakes"):
            confidence += min(0.25, 0.08 * product["bakes"])
        confidence = round(min(0.95, confidence), 2)

        tips = list(profile.get("learned_rules") or [])[:6]
        tips.extend(product.get("lessons") or [])
        # de-dupe preserving order
        seen = set()
        unique_tips = []
        for tip in tips:
            if tip not in seen:
                seen.add(tip)
                unique_tips.append(tip)

        return {
            "confidence": confidence,
            "brief": {
                "scene": scene,
                "lighting": lighting,
                "camera": camera,
                "aspect_ratio": ratio,
                "include_model": include_model,
            },
            "layout": layout,
            "tips": unique_tips[:8],
            "totals": profile.get("totals"),
            "product_key": key,
            "product_stats": {
                "bakes": product.get("bakes", 0),
                "up": product.get("up", 0),
                "down": product.get("down", 0),
            },
        }

    def learning_context_for_prompt(self, product_name: str = "") -> str:
        suggestion = self.suggest(product_name)
        tips = suggestion.get("tips") or []
        if not tips and suggestion["confidence"] < 0.2:
            return ""
        lines = ["SELF-LEARNED STUDIO GUIDANCE (from prior approved work and corrections):"]
        for tip in tips[:6]:
            lines.append(f"- {tip}")
        return "\n".join(lines)

    def assistant_reply(self, question: str, product_name: str = "") -> dict[str, Any]:
        suggestion = self.suggest(product_name)
        profile = self.profile()
        q = (question or "").lower()
        answer_parts: list[str] = []

        if any(w in q for w in ("scene", "setting", "where", "background")):
            scenes = suggestion["brief"].get("scene") or "a lived-in natural interior"
            answer_parts.append(f"I'd start with this scene: {scenes}.")
        if any(w in q for w in ("light", "lighting", "bright")):
            lighting = suggestion["brief"].get("lighting") or "soft natural window light"
            answer_parts.append(f"Preferred lighting from past approvals: {lighting}.")
        if any(w in q for w in ("model", "person", "human")):
            if suggestion["brief"].get("include_model"):
                answer_parts.append(
                    "Past approvals lean toward including a realistic model interacting with the product."
                )
            else:
                answer_parts.append(
                    "Past approvals lean product-only — skip the model unless the brief needs lifestyle scale."
                )
        if any(w in q for w in ("place", "layout", "position", "proportion", "scale")):
            lp = suggestion.get("layout", {}).get("product") or {}
            answer_parts.append(
                f"Start product near {lp.get('x', 58):.0f}% x / {lp.get('y', 62):.0f}% y, "
                f"scale ~{lp.get('scale', 1):.2f}×, then fine-tune in draft studio."
            )
        if any(w in q for w in ("learn", "memory", "remember", "progress")):
            t = profile.get("totals") or {}
            answer_parts.append(
                f"I've logged {t.get('events', 0)} events — {t.get('bakes', 0)} bakes, "
                f"{t.get('thumbs_up', 0)} ups, {t.get('thumbs_down', 0)} downs, "
                f"{t.get('repositions', 0)} layout fixes."
            )
        if not answer_parts:
            if suggestion["tips"]:
                answer_parts.append("Here's what I've learned so far:")
                answer_parts.extend(f"• {tip}" for tip in suggestion["tips"][:5])
            else:
                answer_parts.append(
                    "I'm still early in learning. Approve a bake or rate drafts so I can tune scenes, lighting, and placement for you."
                )

        return {
            "answer": "\n".join(answer_parts),
            "suggestion": suggestion,
            "confidence": suggestion["confidence"],
        }
