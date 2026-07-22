from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.models import User, WatchProgress
from app.schemas import ProgressIn, ProgressOut

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("", response_model=list[ProgressOut])
async def list_progress(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(WatchProgress).where(WatchProgress.user_id == user.id).order_by(WatchProgress.updated_at.desc()).limit(50)
    )
    return list(result.scalars().all())


@router.put("", response_model=ProgressOut)
async def upsert_progress(
    body: ProgressIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WatchProgress).where(
            WatchProgress.user_id == user.id,
            WatchProgress.source == body.source,
            WatchProgress.external_id == body.external_id,
        )
    )
    row = result.scalar_one_or_none()
    if row:
        row.position_seconds = body.position_seconds
        row.duration_seconds = body.duration_seconds
        row.title = body.title
        row.poster = body.poster
        row.media_type = body.media_type
    else:
        row = WatchProgress(
            user_id=user.id,
            media_type=body.media_type,
            source=body.source,
            external_id=body.external_id,
            title=body.title,
            poster=body.poster,
            position_seconds=body.position_seconds,
            duration_seconds=body.duration_seconds,
        )
        db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.delete("/{progress_id}")
async def delete_progress(progress_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    row = await db.get(WatchProgress, progress_id)
    if not row or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(row)
    await db.commit()
    return {"ok": True}
