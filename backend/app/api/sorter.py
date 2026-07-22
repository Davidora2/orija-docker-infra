from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.api.deps import get_admin_user, get_current_user
from app.core.config import settings
from app.models.models import User
from app.services import sorter as sorter_svc

router = APIRouter(prefix="/sorter", tags=["sorter"])


class SortRequest(BaseModel):
    apply_tmdb: bool = True
    include_library: bool = False
    fetch_artwork: bool = True
    paths: list[str] | None = Field(
        default=None,
        description="Optional explicit roots to scan (defaults to incoming + downloads)",
    )


@router.get("/status")
async def sorter_status(user: User = Depends(get_current_user)):
    incoming = settings.incoming_dir
    downloads = settings.downloads_dir
    pending = 0
    for root in (incoming, downloads):
        if root.exists():
            pending += sum(1 for p in root.rglob("*") if p.is_file() and p.suffix.lower() in sorter_svc.VIDEO_EXTS)
    return {
        "media_root": str(settings.media_root),
        "movies_dir": str(settings.movies_dir),
        "shows_dir": str(settings.shows_dir),
        "incoming_dir": str(settings.incoming_dir),
        "downloads_dir": str(settings.downloads_dir),
        "pending_files": pending,
        "tmdb_enabled": bool(settings.tmdb_api_key),
    }


@router.post("/preview")
async def preview_sort(body: SortRequest, _: User = Depends(get_admin_user)):
    roots = [Path(p) for p in body.paths] if body.paths else None
    plans = await sorter_svc.preview_sort(
        roots=roots,
        apply_tmdb=body.apply_tmdb,
        include_library=body.include_library,
    )
    return {"count": len(plans), "items": plans}


@router.post("/run")
async def run_sort(body: SortRequest, _: User = Depends(get_admin_user)):
    roots = [Path(p) for p in body.paths] if body.paths else None
    result = await sorter_svc.run_sort(
        roots=roots,
        apply_tmdb=body.apply_tmdb,
        include_library=body.include_library,
        fetch_artwork=body.fetch_artwork,
    )
    try:
        from app.services.search import invalidate_catalog_cache

        invalidate_catalog_cache()
    except Exception:
        pass
    return result


@router.post("/organize-file")
async def organize_single(
    path: str = Query(..., description="Absolute path to a video file"),
    apply_tmdb: bool = True,
    fetch_artwork: bool = True,
    _: User = Depends(get_admin_user),
):
    src = Path(path)
    if not src.exists() or not src.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    plan = await sorter_svc.build_plan(src, apply_tmdb=apply_tmdb)
    if plan.action == "skip":
        return {"plan": plan.__dict__, "result": "skipped"}
    result = sorter_svc.apply_move(plan)
    if fetch_artwork and plan.poster_url and plan.poster_dest:
        await sorter_svc.download_poster(plan.poster_url, Path(plan.poster_dest))
    return {"plan": plan.__dict__, "result": result}
