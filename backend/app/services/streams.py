"""Multi-stream session manager."""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.models import StreamSession, User


class StreamLimitError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


async def prune_stale_sessions(db: AsyncSession, max_age_minutes: int = 5) -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=max_age_minutes)
    # SQLite often returns naive datetimes — compare in Python for safety
    result = await db.execute(select(StreamSession).where(StreamSession.active.is_(True)))
    for session in result.scalars().all():
        hb = session.last_heartbeat
        if hb is None:
            continue
        if hb.tzinfo is None:
            hb = hb.replace(tzinfo=timezone.utc)
        if hb < cutoff:
            session.active = False
    await db.commit()


async def open_stream(
    db: AsyncSession,
    user: User,
    *,
    media_type: str,
    source: str,
    external_id: str,
    title: str,
) -> StreamSession:
    await prune_stale_sessions(db)

    user_active = await db.scalar(
        select(func.count()).select_from(StreamSession).where(
            StreamSession.user_id == user.id, StreamSession.active.is_(True)
        )
    )
    limit = user.max_streams or settings.max_streams_per_user
    if (user_active or 0) >= limit:
        raise StreamLimitError(f"Stream limit reached ({limit} concurrent streams for this account).")

    global_active = await db.scalar(
        select(func.count()).select_from(StreamSession).where(StreamSession.active.is_(True))
    )
    if (global_active or 0) >= settings.max_global_streams:
        raise StreamLimitError("Server is at maximum concurrent streams. Try again shortly.")

    session = StreamSession(
        user_id=user.id,
        session_key=secrets.token_urlsafe(24),
        media_type=media_type,
        source=source,
        external_id=external_id,
        title=title,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def heartbeat(db: AsyncSession, session_key: str, user_id: int) -> StreamSession | None:
    result = await db.execute(
        select(StreamSession).where(
            StreamSession.session_key == session_key,
            StreamSession.user_id == user_id,
            StreamSession.active.is_(True),
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        return None
    session.last_heartbeat = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(session)
    return session


async def close_stream(db: AsyncSession, session_key: str, user_id: int) -> bool:
    result = await db.execute(
        select(StreamSession).where(
            StreamSession.session_key == session_key,
            StreamSession.user_id == user_id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        return False
    session.active = False
    await db.commit()
    return True


async def list_active(db: AsyncSession, user_id: int | None = None) -> list[StreamSession]:
    await prune_stale_sessions(db)
    stmt = select(StreamSession).where(StreamSession.active.is_(True))
    if user_id is not None:
        stmt = stmt.where(StreamSession.user_id == user_id)
    result = await db.execute(stmt.order_by(StreamSession.started_at.desc()))
    return list(result.scalars().all())
