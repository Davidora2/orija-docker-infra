from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.models import LocalMedia, User
from app.schemas import LocalMediaOut
from app.services.library import scan_library

router = APIRouter(prefix="/library", tags=["library"])


@router.post("/scan")
async def scan(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await scan_library(db)


@router.get("/paths")
async def library_paths(user: User = Depends(get_current_user)):
    return {
        "media_root": str(settings.media_root),
        "movies": str(settings.movies_dir),
        "tvshows": str(settings.shows_dir),
        "incoming": str(settings.incoming_dir),
        "downloads": str(settings.downloads_dir),
    }


@router.get("", response_model=list[LocalMediaOut])
async def list_local(
    media_type: str | None = Query(None),
    q: str | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(LocalMedia).order_by(LocalMedia.title)
    if media_type == "movies":
        stmt = stmt.where(LocalMedia.media_type == "movie")
    elif media_type == "shows":
        stmt = stmt.where(LocalMedia.media_type.in_(["show", "episode"]))
    if q:
        stmt = stmt.where(LocalMedia.title.ilike(f"%{q}%"))
    result = await db.execute(stmt)
    items = list(result.scalars().all())
    for item in items:
        if item.poster:
            item.poster = f"/api/library/artwork/{item.id}"
    return items


@router.get("/shows")
async def grouped_shows(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(LocalMedia)
        .where(LocalMedia.media_type.in_(["show", "episode"]))
        .order_by(LocalMedia.show_name, LocalMedia.season, LocalMedia.episode)
    )
    items = list(result.scalars().all())
    shows: dict[str, dict] = {}
    for ep in items:
        key = ep.show_name or ep.title
        poster_url = f"/api/library/artwork/{ep.id}" if ep.poster else None
        if key not in shows:
            shows[key] = {
                "title": key,
                "poster": poster_url,
                "episodes": [],
                "source": "local",
                "media_type": "show",
            }
        elif not shows[key].get("poster") and poster_url:
            shows[key]["poster"] = poster_url
        shows[key]["episodes"].append(
            {
                "id": str(ep.id),
                "title": ep.title,
                "season": ep.season,
                "episode": ep.episode,
                "path": ep.path,
                "size_bytes": ep.size_bytes,
                "poster": poster_url,
                "source": "local",
                "media_type": "episode",
            }
        )
    return list(shows.values())


@router.get("/artwork/{media_id}")
async def artwork(media_id: int, db: AsyncSession = Depends(get_db)):
    """Public artwork by media id — <img> tags cannot send Bearer tokens."""
    media = await db.get(LocalMedia, media_id)
    if not media or not media.poster:
        raise HTTPException(status_code=404, detail="Artwork not found")
    path = Path(media.poster).resolve()
    root = settings.media_root.resolve()
    if root not in path.parents and path != root:
        raise HTTPException(status_code=403, detail="Invalid artwork path")
    if not path.exists():
        raise HTTPException(status_code=404, detail="Artwork file missing")
    media_type = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    return FileResponse(path, media_type=media_type)


@router.get("/{media_id}", response_model=LocalMediaOut)
async def get_local(media_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    media = await db.get(LocalMedia, media_id)
    if not media:
        raise HTTPException(status_code=404, detail="Not found")
    if media.poster:
        media.poster = f"/api/library/artwork/{media.id}"
    return media
