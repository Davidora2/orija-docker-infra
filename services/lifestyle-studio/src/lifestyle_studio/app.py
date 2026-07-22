"""FastAPI application for Orija Lifestyle Studio."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .config import Settings, get_settings
from .learning import LearningMemory
from .nanobanana import NanoBananaClient, NanoBananaError
from .projects import ProjectStore
from . import prompts

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("lifestyle_studio")

STATIC_DIR = Path(__file__).resolve().parent.parent.parent / "static"

app = FastAPI(title="Orija Lifestyle Studio", version="1.1.0")


def store() -> ProjectStore:
    return ProjectStore(get_settings())


def banana() -> NanoBananaClient:
    return NanoBananaClient(get_settings())


def memory() -> LearningMemory:
    return LearningMemory(get_settings())


class BriefUpdate(BaseModel):
    product_name: str | None = None
    product_notes: str | None = None
    scene: str | None = None
    lighting: str | None = None
    camera: str | None = None
    include_model: bool | None = None
    model_description: str | None = None
    notes: str | None = None
    aspect_ratio: str | None = None


class LayoutUpdate(BaseModel):
    product: dict[str, Any] | None = None
    model: dict[str, Any] | None = None


class GenerateRequest(BaseModel):
    use_layout: bool = True


class RepositionRequest(BaseModel):
    layout: LayoutUpdate
    notes: str | None = None


class BakeRequest(BaseModel):
    draft_id: str | None = None
    size: str | None = Field(default=None, description="1K, 2K, or 4K")
    model: str | None = None
    lesson: str | None = Field(
        default=None,
        description="Optional note the assistant should remember from this approval",
    )


class RatingRequest(BaseModel):
    draft_id: str | None = None
    rating: str = Field(description="up or down")
    reason: str | None = None


class LessonRequest(BaseModel):
    text: str
    product_name: str | None = None


class AssistantAskRequest(BaseModel):
    question: str
    product_name: str | None = None
    apply_suggestion: bool = False


class SuggestRequest(BaseModel):
    product_name: str | None = None
    apply: bool = True


@app.get("/api/health")
def health() -> dict[str, Any]:
    settings = get_settings()
    profile = memory().profile()
    return {
        "ok": True,
        "brand": settings.brand_name,
        "has_api_key": settings.has_api_key,
        "mock_mode": (not settings.has_api_key) and settings.allow_mock_without_key,
        "draft_model": settings.nanobanana_draft_model,
        "bake_model": settings.nanobanana_bake_model,
        "draft_size": settings.nanobanana_draft_size,
        "bake_size": settings.nanobanana_bake_size,
        "learning": profile.get("totals"),
        "self_learning": True,
    }


@app.get("/api/projects")
def list_projects() -> list[dict[str, Any]]:
    return store().list()


@app.post("/api/projects")
def create_project(apply_learning: bool = True) -> dict[str, Any]:
    project = store().create()
    if apply_learning:
        suggestion = memory().suggest()
        brief_updates = {k: v for k, v in (suggestion.get("brief") or {}).items() if v is not None}
        if brief_updates:
            project["brief"].update(brief_updates)
        if suggestion.get("layout"):
            # merge carefully
            layout = suggestion["layout"]
            if layout.get("product"):
                project["layout"]["product"].update(layout["product"])
            if layout.get("model"):
                project["layout"]["model"].update(
                    {k: v for k, v in layout["model"].items() if k != "enabled"}
                )
                project["layout"]["model"]["enabled"] = bool(
                    project["brief"].get("include_model")
                )
        project["meta"]["learning"] = {
            "confidence": suggestion.get("confidence"),
            "tips": suggestion.get("tips") or [],
        }
        project = store().save(project)
    return project


@app.get("/api/projects/{project_id}")
def get_project(project_id: str) -> dict[str, Any]:
    try:
        return store().get(project_id)
    except FileNotFoundError:
        raise HTTPException(404, "Project not found") from None
    except Exception:
        raise HTTPException(404, "Project not found") from None


@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str) -> dict[str, str]:
    store().delete(project_id)
    return {"status": "deleted"}


@app.patch("/api/projects/{project_id}/brief")
def update_brief(project_id: str, body: BriefUpdate) -> dict[str, Any]:
    ps = store()
    project = ps.get(project_id)
    for key, value in body.model_dump(exclude_none=True).items():
        project["brief"][key] = value
    # Keep layout model.enabled in sync with include_model
    if body.include_model is not None:
        project["layout"]["model"]["enabled"] = body.include_model
    return ps.save(project)


@app.patch("/api/projects/{project_id}/layout")
def update_layout(project_id: str, body: LayoutUpdate) -> dict[str, Any]:
    ps = store()
    project = ps.get(project_id)
    if body.product:
        project["layout"]["product"].update(body.product)
    if body.model:
        project["layout"]["model"].update(body.model)
    return ps.save(project)


@app.post("/api/projects/{project_id}/refs/{kind}")
async def upload_ref(
    project_id: str,
    kind: str,
    file: UploadFile = File(...),
) -> dict[str, Any]:
    if kind not in {"product", "model", "style"}:
        raise HTTPException(400, "kind must be product, model, or style")
    content = await file.read()
    if not content:
        raise HTTPException(400, "Empty file")
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 20MB)")
    return store().add_ref(project_id, kind, file.filename or "upload.png", content)


@app.delete("/api/projects/{project_id}/refs/{kind}/{ref_id}")
def delete_ref(project_id: str, kind: str, ref_id: str) -> dict[str, Any]:
    return store().remove_ref(project_id, kind, ref_id)


@app.get("/api/projects/{project_id}/files/{file_path:path}")
def get_file(project_id: str, file_path: str) -> FileResponse:
    base = store().project_dir(project_id).resolve()
    target = (base / file_path).resolve()
    if not str(target).startswith(str(base)) or not target.exists():
        raise HTTPException(404, "File not found")
    return FileResponse(target)


def _ensure_can_generate(settings: Settings) -> None:
    if not settings.has_api_key and not settings.allow_mock_without_key:
        raise HTTPException(
            400,
            "GEMINI_API_KEY is required. Set it in the service .env file.",
        )


@app.post("/api/projects/{project_id}/generate")
def generate_draft(project_id: str, body: GenerateRequest | None = None) -> dict[str, Any]:
    settings = get_settings()
    _ensure_can_generate(settings)
    ps = store()
    project = ps.get(project_id)
    if not project["refs"]["product"]:
        raise HTTPException(400, "Upload at least one product reference image first.")

    brief = dict(project["brief"])
    if body and body.use_layout:
        brief["layout"] = project["layout"]
    brief["model_reference"] = bool(project["refs"]["model"])
    brief["style_reference"] = bool(project["refs"]["style"])

    prompt = prompts.build_draft_prompt(
        brief,
        learning_context=memory().learning_context_for_prompt(brief.get("product_name") or ""),
    )
    kinds = ["product"]
    if brief.get("include_model") and project["refs"]["model"]:
        kinds.append("model")
    if project["refs"]["style"]:
        kinds.append("style")
    paths, labels = ps.resolve_refs(project, kinds)

    client = banana()
    try:
        image = client.generate(
            prompt=prompt,
            reference_paths=paths,
            labels=labels,
            model=settings.nanobanana_draft_model,
            image_size=settings.nanobanana_draft_size,
            aspect_ratio=brief.get("aspect_ratio") or "3:4",
        )
    except NanoBananaError as exc:
        raise HTTPException(502, str(exc)) from exc

    project, draft = ps.add_draft(
        project,
        image,
        prompt=prompt,
        model=settings.nanobanana_draft_model,
        size=settings.nanobanana_draft_size,
        source="generate",
    )
    memory().record(
        "generate",
        {
            "project_id": project_id,
            "draft_id": draft["id"],
            "brief": project["brief"],
            "layout": project["layout"],
        },
    )
    return {"project": project, "draft": draft}


@app.post("/api/projects/{project_id}/reposition")
def reposition_draft(project_id: str, body: RepositionRequest) -> dict[str, Any]:
    """Apply draft-studio layout moves and regenerate an edited draft."""
    settings = get_settings()
    _ensure_can_generate(settings)
    ps = store()
    project = ps.get(project_id)

    if body.layout.product:
        project["layout"]["product"].update(body.layout.product)
    if body.layout.model:
        project["layout"]["model"].update(body.layout.model)
    if body.notes is not None:
        project["brief"]["notes"] = body.notes
    project = ps.save(project)

    active_id = project.get("active_draft_id")
    if not active_id:
        raise HTTPException(400, "Generate a draft before repositioning.")
    draft_meta = next((d for d in project["drafts"] if d["id"] == active_id), None)
    if not draft_meta:
        raise HTTPException(400, "Active draft not found.")

    draft_path = ps.project_dir(project_id) / draft_meta["path"]
    before_layout = draft_meta.get("layout") or {}
    prompt = prompts.build_reposition_prompt(
        project["brief"],
        project["layout"],
        learning_context=memory().learning_context_for_prompt(
            project["brief"].get("product_name") or ""
        ),
    )

    # Include current draft + product refs for fidelity
    paths = [draft_path]
    labels = ["Current draft to edit"]
    prod_paths, prod_labels = ps.resolve_refs(project, ["product"])
    paths.extend(prod_paths)
    labels.extend(prod_labels)
    if project["layout"]["model"].get("enabled") and project["refs"]["model"]:
        m_paths, m_labels = ps.resolve_refs(project, ["model"])
        paths.extend(m_paths)
        labels.extend(m_labels)

    client = banana()
    try:
        image = client.generate(
            prompt=prompt,
            reference_paths=paths,
            labels=labels,
            model=settings.nanobanana_draft_model,
            image_size=settings.nanobanana_draft_size,
            aspect_ratio=project["brief"].get("aspect_ratio") or "3:4",
        )
    except NanoBananaError as exc:
        raise HTTPException(502, str(exc)) from exc

    project, draft = ps.add_draft(
        project,
        image,
        prompt=prompt,
        model=settings.nanobanana_draft_model,
        size=settings.nanobanana_draft_size,
        source="reposition",
    )
    memory().record(
        "reposition",
        {
            "project_id": project_id,
            "draft_id": draft["id"],
            "brief": project["brief"],
            "before_layout": before_layout,
            "after_layout": project["layout"],
            "layout": project["layout"],
        },
    )
    return {"project": project, "draft": draft}


@app.post("/api/projects/{project_id}/bake")
def bake_project(project_id: str, body: BakeRequest | None = None) -> dict[str, Any]:
    """Approve the draft composition and generate a high-res baked image."""
    settings = get_settings()
    _ensure_can_generate(settings)
    ps = store()
    project = ps.get(project_id)
    body = body or BakeRequest()

    draft_id = body.draft_id or project.get("active_draft_id")
    if not draft_id:
        raise HTTPException(400, "No draft to bake. Generate and approve a draft first.")
    draft_meta = next((d for d in project["drafts"] if d["id"] == draft_id), None)
    if not draft_meta:
        raise HTTPException(404, "Draft not found")

    draft_path = ps.project_dir(project_id) / draft_meta["path"]
    layout = draft_meta.get("layout") or project.get("layout")
    prompt = prompts.build_bake_prompt(
        project["brief"],
        layout,
        learning_context=memory().learning_context_for_prompt(
            project["brief"].get("product_name") or ""
        ),
    )

    paths = [draft_path]
    labels = ["Approved draft — match this composition exactly"]
    prod_paths, prod_labels = ps.resolve_refs(project, ["product"])
    paths.extend(prod_paths)
    labels.extend(prod_labels)
    if project["refs"]["model"]:
        m_paths, m_labels = ps.resolve_refs(project, ["model"])
        paths.extend(m_paths)
        labels.extend(m_labels)

    bake_model = body.model or settings.nanobanana_bake_model
    bake_size = body.size or settings.nanobanana_bake_size

    client = banana()
    try:
        image = client.generate(
            prompt=prompt,
            reference_paths=paths,
            labels=labels,
            model=bake_model,
            image_size=bake_size,
            aspect_ratio=project["brief"].get("aspect_ratio") or "3:4",
        )
    except NanoBananaError as exc:
        raise HTTPException(502, str(exc)) from exc

    project, baked = ps.add_baked(
        project,
        image,
        prompt=prompt,
        model=bake_model,
        size=bake_size,
        from_draft_id=draft_id,
    )
    memory().record(
        "bake_approved",
        {
            "project_id": project_id,
            "draft_id": draft_id,
            "baked_id": baked["id"],
            "brief": project["brief"],
            "layout": layout,
            "lesson": body.lesson,
            "product_name": project["brief"].get("product_name"),
        },
    )
    return {"project": project, "baked": baked, "learning": memory().profile().get("totals")}


@app.post("/api/projects/{project_id}/select-draft/{draft_id}")
def select_draft(project_id: str, draft_id: str) -> dict[str, Any]:
    ps = store()
    project = ps.get(project_id)
    if not any(d["id"] == draft_id for d in project["drafts"]):
        raise HTTPException(404, "Draft not found")
    project["active_draft_id"] = draft_id
    return ps.save(project)


@app.post("/api/projects/{project_id}/rate")
def rate_draft(project_id: str, body: RatingRequest) -> dict[str, Any]:
    if body.rating not in {"up", "down"}:
        raise HTTPException(400, "rating must be 'up' or 'down'")
    project = store().get(project_id)
    draft_id = body.draft_id or project.get("active_draft_id")
    result = memory().record(
        "rating",
        {
            "project_id": project_id,
            "draft_id": draft_id,
            "rating": body.rating,
            "reason": body.reason,
            "brief": project.get("brief"),
            "layout": project.get("layout"),
            "product_name": project.get("brief", {}).get("product_name"),
        },
    )
    return result


@app.get("/api/assistant/memory")
def assistant_memory() -> dict[str, Any]:
    mem = memory()
    return {"profile": mem.profile(), "suggestion": mem.suggest()}


@app.post("/api/assistant/suggest")
def assistant_suggest(body: SuggestRequest | None = None) -> dict[str, Any]:
    body = body or SuggestRequest()
    suggestion = memory().suggest(body.product_name or "")
    return suggestion


@app.post("/api/assistant/ask")
def assistant_ask(body: AssistantAskRequest) -> dict[str, Any]:
    return memory().assistant_reply(body.question, body.product_name or "")


@app.post("/api/assistant/lesson")
def assistant_lesson(body: LessonRequest) -> dict[str, Any]:
    text = body.text.strip()
    if not text:
        raise HTTPException(400, "Lesson text required")
    return memory().record(
        "lesson",
        {"text": text, "product_name": body.product_name or "", "brief": {"product_name": body.product_name or ""}},
    )


@app.post("/api/projects/{project_id}/apply-suggestion")
def apply_suggestion(project_id: str) -> dict[str, Any]:
    ps = store()
    project = ps.get(project_id)
    suggestion = memory().suggest(project["brief"].get("product_name") or "")
    brief = suggestion.get("brief") or {}
    for key, value in brief.items():
        if value is not None and value != "":
            project["brief"][key] = value
    layout = suggestion.get("layout") or {}
    if layout.get("product"):
        project["layout"]["product"].update(layout["product"])
    if layout.get("model"):
        project["layout"]["model"].update(
            {k: v for k, v in layout["model"].items() if k != "enabled"}
        )
    project["layout"]["model"]["enabled"] = bool(project["brief"].get("include_model"))
    project["meta"]["learning"] = {
        "confidence": suggestion.get("confidence"),
        "tips": suggestion.get("tips") or [],
    }
    return {"project": ps.save(project), "suggestion": suggestion}


if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")


def main() -> None:
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "lifestyle_studio.app:app",
        host=settings.host,
        port=settings.port,
        reload=False,
    )


if __name__ == "__main__":
    main()
