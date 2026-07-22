"""Project persistence for lifestyle generation sessions."""

from __future__ import annotations

import json
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import Settings


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class ProjectStore:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.root = settings.projects_dir

    def create(self, meta: dict[str, Any] | None = None) -> dict[str, Any]:
        project_id = uuid.uuid4().hex[:12]
        path = self.root / project_id
        (path / "refs" / "product").mkdir(parents=True)
        (path / "refs" / "model").mkdir(parents=True)
        (path / "refs" / "style").mkdir(parents=True)
        (path / "drafts").mkdir(parents=True)
        (path / "baked").mkdir(parents=True)
        project = {
            "id": project_id,
            "created_at": _now(),
            "updated_at": _now(),
            "status": "new",
            "brief": {
                "product_name": "",
                "product_notes": "",
                "scene": "sunlit modern apartment with soft linen textures and indoor plants",
                "lighting": "soft natural window light with gentle fill",
                "camera": "editorial lifestyle photograph, 50mm feel, shallow depth of field",
                "include_model": True,
                "model_description": "realistic adult model, natural styling that fits the product",
                "notes": "",
                "aspect_ratio": "3:4",
            },
            "layout": {
                "product": {"x": 58, "y": 62, "scale": 1.0},
                "model": {"enabled": True, "x": 38, "y": 48, "scale": 1.0, "pose": ""},
            },
            "refs": {"product": [], "model": [], "style": []},
            "drafts": [],
            "active_draft_id": None,
            "baked": [],
            "approved_draft_id": None,
            "meta": meta or {},
        }
        self._write(project)
        return project

    def list(self) -> list[dict[str, Any]]:
        items = []
        for path in sorted(self.root.iterdir(), reverse=True):
            if (path / "project.json").exists():
                items.append(self.get(path.name))
        return items

    def get(self, project_id: str) -> dict[str, Any]:
        data = json.loads((self.root / project_id / "project.json").read_text())
        return data

    def save(self, project: dict[str, Any]) -> dict[str, Any]:
        project["updated_at"] = _now()
        self._write(project)
        return project

    def delete(self, project_id: str) -> None:
        path = self.root / project_id
        if path.exists():
            shutil.rmtree(path)

    def project_dir(self, project_id: str) -> Path:
        return self.root / project_id

    def add_ref(
        self,
        project_id: str,
        kind: str,
        filename: str,
        content: bytes,
    ) -> dict[str, Any]:
        if kind not in {"product", "model", "style"}:
            raise ValueError("kind must be product, model, or style")
        project = self.get(project_id)
        dest_dir = self.project_dir(project_id) / "refs" / kind
        safe = f"{uuid.uuid4().hex[:8]}_{Path(filename).name}"
        dest = dest_dir / safe
        dest.write_bytes(content)
        rel = f"refs/{kind}/{safe}"
        project["refs"][kind].append(
            {"id": safe, "path": rel, "filename": Path(filename).name}
        )
        return self.save(project)

    def remove_ref(self, project_id: str, kind: str, ref_id: str) -> dict[str, Any]:
        project = self.get(project_id)
        kept = []
        for ref in project["refs"].get(kind, []):
            if ref["id"] == ref_id:
                path = self.project_dir(project_id) / ref["path"]
                if path.exists():
                    path.unlink()
            else:
                kept.append(ref)
        project["refs"][kind] = kept
        return self.save(project)

    def resolve_refs(self, project: dict[str, Any], kinds: list[str] | None = None) -> tuple[list[Path], list[str]]:
        kinds = kinds or ["product", "model", "style"]
        paths: list[Path] = []
        labels: list[str] = []
        base = self.project_dir(project["id"])
        for kind in kinds:
            for ref in project["refs"].get(kind, []):
                paths.append(base / ref["path"])
                labels.append(f"{kind.title()} reference: {ref['filename']}")
        return paths, labels

    def add_draft(
        self,
        project: dict[str, Any],
        image_bytes: bytes,
        prompt: str,
        model: str,
        size: str,
        source: str = "generate",
    ) -> dict[str, Any]:
        draft_id = uuid.uuid4().hex[:10]
        rel = f"drafts/{draft_id}.png"
        path = self.project_dir(project["id"]) / rel
        path.write_bytes(image_bytes)
        entry = {
            "id": draft_id,
            "path": rel,
            "created_at": _now(),
            "prompt": prompt,
            "model": model,
            "size": size,
            "source": source,
            "layout": json.loads(json.dumps(project.get("layout") or {})),
        }
        project.setdefault("drafts", []).append(entry)
        project["active_draft_id"] = draft_id
        project["status"] = "draft"
        return self.save(project), entry

    def add_baked(
        self,
        project: dict[str, Any],
        image_bytes: bytes,
        prompt: str,
        model: str,
        size: str,
        from_draft_id: str | None,
    ) -> dict[str, Any]:
        bake_id = uuid.uuid4().hex[:10]
        rel = f"baked/{bake_id}.png"
        path = self.project_dir(project["id"]) / rel
        path.write_bytes(image_bytes)
        # Also copy to shared outputs for easy download browsing
        self.settings.outputs_dir.mkdir(parents=True, exist_ok=True)
        out = self.settings.outputs_dir / f"{project['id']}_{bake_id}.png"
        out.write_bytes(image_bytes)
        entry = {
            "id": bake_id,
            "path": rel,
            "created_at": _now(),
            "prompt": prompt,
            "model": model,
            "size": size,
            "from_draft_id": from_draft_id,
            "output_path": str(out),
        }
        project.setdefault("baked", []).append(entry)
        project["status"] = "baked"
        project["approved_draft_id"] = from_draft_id
        return self.save(project), entry

    def _write(self, project: dict[str, Any]) -> None:
        path = self.root / project["id"] / "project.json"
        path.write_text(json.dumps(project, indent=2))
