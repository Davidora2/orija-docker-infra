from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.models import Favorite, User
from app.schemas import FavoriteIn, FavoriteOut
from app.services.downloads import enqueue_favorite_download

router = APIRouter(prefix="/favorites", tags=["favorites"])


@router.get("", response_model=list[FavoriteOut])
async def list_favorites(
    media_type: str | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Favorite).where(Favorite.user_id == user.id).order_by(Favorite.created_at.desc())
    if media_type:
        stmt = stmt.where(Favorite.media_type == media_type)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("", response_model=FavoriteOut)
async def add_favorite(
    body: FavoriteIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Favorite).where(
            Favorite.user_id == user.id,
            Favorite.source == body.source,
            Favorite.external_id == body.external_id,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    fav = Favorite(
        user_id=user.id,
        media_type=body.media_type,
        source=body.source,
        external_id=body.external_id,
        title=body.title,
        poster=body.poster,
        year=body.year,
        category=body.category,
        stream_url=body.stream_url,
        download_status="queued" if body.save_to_library and body.source == "xtream" and body.media_type != "live" else "none",
    )
    db.add(fav)
    await db.commit()
    await db.refresh(fav)

    if fav.download_status == "queued":
        await enqueue_favorite_download(fav.id)

    return fav


@router.delete("/{favorite_id}")
async def remove_favorite(
    favorite_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    fav = await db.get(Favorite, favorite_id)
    if not fav or fav.user_id != user.id:
        raise HTTPException(status_code=404, detail="Favorite not found")
    await db.delete(fav)
    await db.commit()
    return {"ok": True}


@router.post("/{favorite_id}/download", response_model=FavoriteOut)
async def redownload(
    favorite_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    fav = await db.get(Favorite, favorite_id)
    if not fav or fav.user_id != user.id:
        raise HTTPException(status_code=404, detail="Favorite not found")
    if fav.source != "xtream" or fav.media_type == "live":
        raise HTTPException(status_code=400, detail="Only Xtream movies/shows can be downloaded")
    fav.download_status = "queued"
    await db.commit()
    await enqueue_favorite_download(fav.id)
    await db.refresh(fav)
    return fav
