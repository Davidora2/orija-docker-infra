"""Favorite download queue — saves Xtream VOD/series to movies/shows folders."""

from __future__ import annotations

import asyncio
import logging
import re
from pathlib import Path

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.models import Favorite, XtreamConfig
from app.services.xtream import XtreamClient

logger = logging.getLogger("orija.downloads")

_queue: asyncio.Queue[int] | None = None
_worker_task: asyncio.Task | None = None


def _safe_name(name: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*]', "", name).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned[:180] or "untitled"


async def get_xtream_client(db: AsyncSession) -> XtreamClient | None:
    result = await db.execute(select(XtreamConfig).where(XtreamConfig.enabled.is_(True)).limit(1))
    cfg = result.scalar_one_or_none()
    if cfg:
        return XtreamClient(cfg.base_url, cfg.username, cfg.password)
    if settings.xtream_base_url and settings.xtream_username and settings.xtream_password:
        return XtreamClient(settings.xtream_base_url, settings.xtream_username, settings.xtream_password)
    return None


async def enqueue_favorite_download(favorite_id: int) -> None:
    global _queue
    if _queue is None:
        _queue = asyncio.Queue()
    await _queue.put(favorite_id)


async def _download_file(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    async with httpx.AsyncClient(timeout=None, follow_redirects=True) as client:
        async with client.stream("GET", url) as resp:
            resp.raise_for_status()
            with tmp.open("wb") as f:
                async for chunk in resp.aiter_bytes(1024 * 256):
                    f.write(chunk)
    tmp.replace(dest)


async def _process_favorite(favorite_id: int) -> None:
    async with SessionLocal() as db:
        fav = await db.get(Favorite, favorite_id)
        if not fav or fav.source != "xtream":
            return
        if fav.media_type == "live":
            fav.download_status = "error"
            await db.commit()
            return

        client = await get_xtream_client(db)
        if not client:
            fav.download_status = "error"
            await db.commit()
            return

        fav.download_status = "downloading"
        await db.commit()

        try:
            if fav.media_type == "movie":
                info = await client.get_vod_info(fav.external_id)
                movie_data = info.get("movie_data") or {}
                ext = movie_data.get("container_extension") or "mp4"
                url = client.vod_stream_url(fav.external_id, ext)
                filename = f"{_safe_name(fav.title)}.{ext}"
                dest = settings.movies_dir / filename
            else:
                # show: download first available episode as starter; full series handled per-episode later
                info = await client.get_series_info(fav.external_id)
                episodes = info.get("episodes") or {}
                first = None
                for season_eps in episodes.values():
                    if isinstance(season_eps, list) and season_eps:
                        first = season_eps[0]
                        break
                if not first:
                    raise RuntimeError("No episodes found for series")
                ext = first.get("container_extension") or "mp4"
                ep_id = first.get("id")
                season = first.get("season") or 1
                ep_num = first.get("episode_num") or first.get("episode") or 1
                show_dir = settings.shows_dir / _safe_name(fav.title) / f"Season {int(season):02d}"
                filename = f"{_safe_name(fav.title)} S{int(season):02d}E{int(ep_num):02d}.{ext}"
                dest = show_dir / filename
                url = client.series_stream_url(ep_id, ext)

            await _download_file(url, dest)
            fav.local_path = str(dest)
            fav.download_status = "done"
            await db.commit()
            logger.info("Downloaded favorite %s -> %s", favorite_id, dest)
        except Exception:
            logger.exception("Download failed for favorite %s", favorite_id)
            fav.download_status = "error"
            await db.commit()


async def download_worker() -> None:
    global _queue
    if _queue is None:
        _queue = asyncio.Queue()
    while True:
        fav_id = await _queue.get()
        try:
            await _process_favorite(fav_id)
        finally:
            _queue.task_done()


def start_download_worker() -> None:
    global _worker_task
    if _worker_task is None or _worker_task.done():
        _worker_task = asyncio.create_task(download_worker())
