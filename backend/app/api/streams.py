from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.models import LocalMedia, StreamSession, User
from app.schemas import StreamOpenIn, StreamOpenOut, StreamSessionOut
from app.services import streams as stream_svc
from app.services.downloads import get_xtream_client
from app.services.streams import StreamLimitError

router = APIRouter(prefix="/streams", tags=["streams"])


@router.post("/open", response_model=StreamOpenOut)
async def open_stream(
    body: StreamOpenIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    external_id = body.episode_id or body.external_id

    if body.source == "local":
        media = None
        if external_id.isdigit():
            media = await db.get(LocalMedia, int(external_id))
        if not media:
            result = await db.execute(select(LocalMedia).where(LocalMedia.path == external_id))
            media = result.scalar_one_or_none()
        if not media or not Path(media.path).exists():
            raise HTTPException(status_code=404, detail="Local media not found")
        external_id = str(media.id)
    elif body.source == "xtream":
        client = await get_xtream_client(db)
        if not client:
            raise HTTPException(status_code=400, detail="Xtream not configured")
    else:
        raise HTTPException(status_code=400, detail="source must be xtream|local")

    try:
        session = await stream_svc.open_stream(
            db,
            user,
            media_type=body.media_type,
            source=body.source,
            external_id=external_id,
            title=body.title,
        )
    except StreamLimitError as exc:
        raise HTTPException(status_code=429, detail=exc.message) from exc

    # Persist container hint in title side-channel is avoided; use default extensions at play time.
    # Store container on session by appending via external_id format id|ext when needed.
    if body.container and body.container not in {"mp4", "ts", "mkv"}:
        pass
    if body.container:
        session.external_id = f"{external_id}|{body.container}"
        await db.commit()

    return StreamOpenOut(
        session_key=session.session_key,
        play_url=f"/api/streams/play/{session.session_key}",
        title=body.title,
        source=body.source,
        media_type=body.media_type,
    )


def _split_id_ext(value: str) -> tuple[str, str | None]:
    if "|" in value:
        eid, ext = value.rsplit("|", 1)
        return eid, ext
    return value, None


@router.get("/play/{session_key}")
async def play_stream(session_key: str, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(StreamSession).where(StreamSession.session_key == session_key, StreamSession.active.is_(True))
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Stream session not found or expired")

    await stream_svc.heartbeat(db, session_key, session.user_id)
    external_id, container = _split_id_ext(session.external_id)

    if session.source == "local":
        media = await db.get(LocalMedia, int(external_id)) if external_id.isdigit() else None
        if not media or not Path(media.path).exists():
            raise HTTPException(status_code=404, detail="Local file missing")
        path = Path(media.path)
        media_types = {
            ".mp4": "video/mp4",
            ".mkv": "video/x-matroska",
            ".webm": "video/webm",
            ".ts": "video/mp2t",
        }
        return FileResponse(path, filename=path.name, media_type=media_types.get(path.suffix.lower(), "video/mp4"))

    client = await get_xtream_client(db)
    if not client:
        raise HTTPException(status_code=400, detail="Xtream not configured")

    if session.media_type == "movie":
        url = client.vod_stream_url(external_id, container or "mp4")
    elif session.media_type == "live":
        url = client.live_stream_url(external_id, container or "ts")
    else:
        url = client.series_stream_url(external_id, container or "mp4")

    headers = {}
    if request.headers.get("range"):
        headers["Range"] = request.headers["range"]

    http = httpx.AsyncClient(timeout=None, follow_redirects=True)
    upstream = await http.send(http.build_request("GET", url, headers=headers), stream=True)
    if upstream.status_code >= 400:
        await upstream.aclose()
        await http.aclose()
        raise HTTPException(status_code=upstream.status_code, detail="Upstream stream error")

    async def iterator():
        try:
            async for chunk in upstream.aiter_bytes(64 * 1024):
                yield chunk
        finally:
            await upstream.aclose()
            await http.aclose()

    out_headers = {"Accept-Ranges": "bytes", "Cache-Control": "no-cache"}
    for h in ("Content-Type", "Content-Length", "Content-Range"):
        if h in upstream.headers:
            out_headers[h] = upstream.headers[h]

    return StreamingResponse(
        iterator(),
        status_code=upstream.status_code,
        headers=out_headers,
        media_type=upstream.headers.get("content-type", "video/mp2t"),
    )


@router.post("/{session_key}/heartbeat", response_model=StreamSessionOut)
async def heartbeat(session_key: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    session = await stream_svc.heartbeat(db, session_key, user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/{session_key}/close")
async def close_stream(session_key: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    ok = await stream_svc.close_stream(db, session_key, user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"ok": True}


@router.get("/active", response_model=list[StreamSessionOut])
async def active_streams(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user.is_admin:
        return await stream_svc.list_active(db)
    return await stream_svc.list_active(db, user.id)
