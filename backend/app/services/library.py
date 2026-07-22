"""Local media library scanner and file serving helpers."""

from __future__ import annotations

import re
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.models import LocalMedia

VIDEO_EXTS = {".mp4", ".mkv", ".avi", ".mov", ".m4v", ".ts", ".m2ts", ".webm", ".mpg", ".mpeg"}
EPISODE_RE = re.compile(
    r"[Ss](?P<season>\d{1,2})[Ee](?P<episode>\d{1,3})|"
    r"(?P<season2>\d{1,2})x(?P<episode2>\d{1,3})",
    re.IGNORECASE,
)


def _title_from_filename(path: Path) -> str:
    name = path.stem
    name = re.sub(r"[._]+", " ", name)
    name = re.sub(r"\b(1080p|720p|2160p|4k|bluray|web[- ]?dl|x264|x265|hevc|aac|hdr)\b", "", name, flags=re.I)
    name = re.sub(r"\s+", " ", name).strip(" -._")
    return name or path.stem


def parse_episode(path: Path) -> tuple[str, int | None, int | None]:
    match = EPISODE_RE.search(path.stem)
    if not match:
        return _title_from_filename(path), None, None
    season = match.group("season") or match.group("season2")
    episode = match.group("episode") or match.group("episode2")
    show = path.parent.name if path.parent.name.lower() not in {"shows", "tv", "series"} else _title_from_filename(path)
    # Prefer parent folder as show name for nested layouts: Shows/Name/S01/...
    parts = path.parts
    for i, part in enumerate(parts):
        if part.lower() in {"shows", "tv", "series"} and i + 1 < len(parts):
            show = parts[i + 1]
            break
    show = re.sub(r"[._]+", " ", show).strip()
    return show, int(season), int(episode)


async def scan_library(db: AsyncSession) -> dict:
    settings.movies_dir.mkdir(parents=True, exist_ok=True)
    settings.shows_dir.mkdir(parents=True, exist_ok=True)
    settings.live_dir.mkdir(parents=True, exist_ok=True)
    settings.downloads_dir.mkdir(parents=True, exist_ok=True)

    found: list[LocalMedia] = []
    seen_paths: set[str] = set()

    for path in settings.movies_dir.rglob("*"):
        if path.is_file() and path.suffix.lower() in VIDEO_EXTS:
            rel = str(path)
            seen_paths.add(rel)
            found.append(
                LocalMedia(
                    media_type="movie",
                    title=_title_from_filename(path),
                    path=rel,
                    size_bytes=path.stat().st_size,
                )
            )

    for path in settings.shows_dir.rglob("*"):
        if path.is_file() and path.suffix.lower() in VIDEO_EXTS:
            rel = str(path)
            seen_paths.add(rel)
            show, season, episode = parse_episode(path)
            found.append(
                LocalMedia(
                    media_type="episode" if season is not None else "show",
                    title=f"{show} S{season:02d}E{episode:02d}" if season and episode else _title_from_filename(path),
                    path=rel,
                    show_name=show,
                    season=season,
                    episode=episode,
                    size_bytes=path.stat().st_size,
                )
            )

    existing = (await db.execute(select(LocalMedia))).scalars().all()
    existing_by_path = {m.path: m for m in existing}

    added = 0
    for item in found:
        if item.path in existing_by_path:
            existing_by_path[item.path].title = item.title
            existing_by_path[item.path].size_bytes = item.size_bytes
            existing_by_path[item.path].show_name = item.show_name
            existing_by_path[item.path].season = item.season
            existing_by_path[item.path].episode = item.episode
            existing_by_path[item.path].media_type = item.media_type
        else:
            db.add(item)
            added += 1

    removed = 0
    for path, row in list(existing_by_path.items()):
        if path not in seen_paths:
            await db.delete(row)
            removed += 1

    await db.commit()
    return {"scanned": len(found), "added": added, "removed": removed}
