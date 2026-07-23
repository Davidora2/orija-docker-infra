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

VOD_EXTS = ("mp4", "mkv", "avi", "m4v", "mov", "ts", "m3u8")
LIVE_EXTS = ("ts", "m3u8", "mp4")


async def _resolve_container(db: AsyncSession, body: StreamOpenIn) -> str:
    """Ask Xtream for the real container extension when possible."""
    if body.source != "xtream":
        return body.container or "mp4"
    client = await get_xtream_client(db)
    if not client:
        return body.container or "mp4"
    try:
        if body.media_type == "movie":
            info = await client.get_vod_info(body.external_id)
            movie = info.get("movie_data") or {}
            ext = movie.get("container_extension") or (info.get("info") or {}).get("container_extension")
            if ext:
                return str(ext).lstrip(".")
        elif body.media_type in {"show", "episode"} and body.episode_id:
            info = await client.get_series_info(body.external_id)
            episodes = info.get("episodes") or {}
            for season_eps in episodes.values():
                for ep in season_eps or []:
                    if str(ep.get("id")) == str(body.episode_id):
                        ext = ep.get("container_extension")
                        if ext:
                            return str(ext).lstrip(".")
        elif body.media_type == "live":
            return body.container or "ts"
    except Exception:
        pass
    return body.container or ("ts" if body.media_type == "live" else "mp4")


@router.post("/open", response_model=StreamOpenOut)
async def open_stream(
    body: StreamOpenIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    external_id = body.episode_id or body.external_id
    container = await _resolve_container(db, body)

    if body.source == "local":
        media = None
        if str(external_id).isdigit():
            media = await db.get(LocalMedia, int(external_id))
        if not media:
            result = await db.execute(select(LocalMedia).where(LocalMedia.path == external_id))
            media = result.scalar_one_or_none()
        if not media or not Path(media.path).exists():
            raise HTTPException(status_code=404, detail="Local media not found")
        external_id = str(media.id)
        container = Path(media.path).suffix.lstrip(".") or "mp4"
    elif body.source == "xtream":
        client = await get_xtream_client(db)
        if not client:
            raise HTTPException(
                status_code=400,
                detail="Xtream not configured. Set XTREAM_* env vars or save credentials in Settings.",
            )
    else:
        raise HTTPException(status_code=400, detail="source must be xtream|local")

    try:
        session = await stream_svc.open_stream(
            db,
            user,
            media_type=body.media_type,
            source=body.source,
            external_id=str(external_id),
            title=body.title,
        )
    except StreamLimitError as exc:
        raise HTTPException(status_code=429, detail=exc.message) from exc

    session.external_id = f"{external_id}|{container}"
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


def _candidate_urls(client, media_type: str, stream_id: str, preferred: str | None) -> list[str]:
    urls: list[str] = []
    if media_type == "live":
        exts = [preferred] if preferred else []
        exts += [e for e in LIVE_EXTS if e not in exts]
        for ext in exts:
            if ext:
                urls.append(client.live_stream_url(stream_id, ext))
        # Some panels serve live without extension
        urls.append(f"{client.base_url}/live/{client.username}/{client.password}/{stream_id}")
    elif media_type == "movie":
        exts = [preferred] if preferred else []
        exts += [e for e in VOD_EXTS if e not in exts]
        for ext in exts:
            if ext:
                urls.append(client.vod_stream_url(stream_id, ext))
        urls.append(f"{client.base_url}/movie/{client.username}/{client.password}/{stream_id}")
    else:
        exts = [preferred] if preferred else []
        exts += [e for e in VOD_EXTS if e not in exts]
        for ext in exts:
            if ext:
                urls.append(client.series_stream_url(stream_id, ext))
        urls.append(f"{client.base_url}/series/{client.username}/{client.password}/{stream_id}")
    # de-dupe preserve order
    seen: set[str] = set()
    out: list[str] = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


async def _open_upstream(urls: list[str], range_header: str | None) -> tuple[httpx.AsyncClient, httpx.Response, str]:
    headers = {}
    if range_header:
        headers["Range"] = range_header
    last_status = 0
    client = httpx.AsyncClient(timeout=None, follow_redirects=True)
    for url in urls:
        try:
            resp = await client.send(client.build_request("GET", url, headers=headers), stream=True)
            if resp.status_code < 400:
                return client, resp, url
            last_status = resp.status_code
            await resp.aclose()
        except Exception:
            continue
    await client.aclose()
    raise HTTPException(
        status_code=502,
        detail=f"Could not open Xtream stream (last upstream status {last_status or 'error'}). Check credentials/URL.",
    )


@router.get("/play/{session_key}")
async def play_stream(session_key: str, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(StreamSession).where(StreamSession.session_key == session_key))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Stream session not found")
    if not session.active:
        raise HTTPException(status_code=410, detail="Stream session expired — press Play again")

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
            ".m3u8": "application/vnd.apple.mpegurl",
        }
        return FileResponse(path, filename=path.name, media_type=media_types.get(path.suffix.lower(), "video/mp4"))

    client = await get_xtream_client(db)
    if not client:
        raise HTTPException(status_code=400, detail="Xtream not configured")

    urls = _candidate_urls(client, session.media_type, external_id, container)
    http, upstream, _used = await _open_upstream(urls, request.headers.get("range"))

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
        media_type=upstream.headers.get("content-type", "video/mp4"),
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
