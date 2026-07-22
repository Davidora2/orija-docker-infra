from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.models import LocalMedia, User
from app.schemas import LocalMediaOut
from app.services.library import scan_library

router = APIRouter(prefix="/library", tags=["library"])


@router.post("/scan")
async def scan(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await scan_library(db)


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
    return list(result.scalars().all())


@router.get("/shows")
async def grouped_shows(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(LocalMedia).where(LocalMedia.media_type.in_(["show", "episode"])).order_by(LocalMedia.show_name, LocalMedia.season, LocalMedia.episode)
    )
    items = list(result.scalars().all())
    shows: dict[str, dict] = {}
    for ep in items:
        key = ep.show_name or ep.title
        if key not in shows:
            shows[key] = {"title": key, "episodes": [], "source": "local", "media_type": "show"}
        shows[key]["episodes"].append(
            {
                "id": str(ep.id),
                "title": ep.title,
                "season": ep.season,
                "episode": ep.episode,
                "path": ep.path,
                "size_bytes": ep.size_bytes,
                "source": "local",
                "media_type": "episode",
            }
        )
    return list(shows.values())


@router.get("/{media_id}", response_model=LocalMediaOut)
async def get_local(media_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    media = await db.get(LocalMedia, media_id)
    if not media:
        raise HTTPException(status_code=404, detail="Not found")
    return media
