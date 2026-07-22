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
from .nanobanana import NanoBananaClient, NanoBananaError
from .projects import ProjectStore
from . import prompts

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("lifestyle_studio")

STATIC_DIR = Path(__file__).resolve().parent.parent.parent / "static"

app = FastAPI(title="Orija Lifestyle Studio", version="1.0.0")


def store() -> ProjectStore:
    return ProjectStore(get_settings())


def banana() -> NanoBananaClient:
    return NanoBananaClient(get_settings())


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


@app.get("/api/health")
def health() -> dict[str, Any]:
    settings = get_settings()
    return {
        "ok": True,
        "brand": settings.brand_name,
        "has_api_key": settings.has_api_key,
        "mock_mode": (not settings.has_api_key) and settings.allow_mock_without_key,
        "draft_model": settings.nanobanana_draft_model,
        "bake_model": settings.nanobanana_bake_model,
        "draft_size": settings.nanobanana_draft_size,
        "bake_size": settings.nanobanana_bake_size,
    }


@app.get("/api/projects")
def list_projects() -> list[dict[str, Any]]:
    return store().list()


@app.post("/api/projects")
def create_project() -> dict[str, Any]:
    return store().create()


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

    prompt = prompts.build_draft_prompt(brief)
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
    prompt = prompts.build_reposition_prompt(project["brief"], project["layout"])

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
    prompt = prompts.build_bake_prompt(project["brief"], layout)

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
    return {"project": project, "baked": baked}


@app.post("/api/projects/{project_id}/select-draft/{draft_id}")
def select_draft(project_id: str, draft_id: str) -> dict[str, Any]:
    ps = store()
    project = ps.get(project_id)
    if not any(d["id"] == draft_id for d in project["drafts"]):
        raise HTTPException(404, "Draft not found")
    project["active_draft_id"] = draft_id
    return ps.save(project)


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
