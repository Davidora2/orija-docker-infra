"""Media sorter — rename, classify, move into movies/TVshows, fetch artwork."""

from __future__ import annotations

import logging
import re
import shutil
from dataclasses import asdict, dataclass
from pathlib import Path

import httpx

from app.core.config import settings

logger = logging.getLogger("orijaflix.sorter")

VIDEO_EXTS = {".mp4", ".mkv", ".avi", ".mov", ".m4v", ".ts", ".m2ts", ".webm", ".mpg", ".mpeg"}
SAMPLE_RE = re.compile(r"(^|[.\-_ ])sample([.\-_ ]|$)", re.I)
JUNK_TOKENS = re.compile(
    r"\b("
    r"1080p|720p|480p|2160p|4k|uhd|hdr10|hdr|dv|dolby[\s.]?vision|"
    r"bluray|blu[\s.-]?ray|web[\s.-]?dl|webrip|hdtv|hdrip|dvdrip|remux|"
    r"x264|x265|h\.?264|h\.?265|hevc|avc|aac|ac3|dts|truehd|atmos|"
    r"proper|repack|extended|unrated|directors[\s.]?cut|internal|"
    r"yify|yts|rarbg|sparks|amzn|nf|dsnp|hulu|multi|subs?"
    r")\b",
    re.I,
)
YEAR_RE = re.compile(r"(?:^|[.\s_\-(])((?:19|20)\d{2})(?:$|[.\s_\-)])")
EPISODE_RE = re.compile(
    r"(?:^|[.\s_\-])(?:S(?P<season>\d{1,2})E(?P<episode>\d{1,3})"
    r"|(?P<season2>\d{1,2})x(?P<episode2>\d{1,3})"
    r"|Season[\s._-]?(?P<season3>\d{1,2})[\s._-]*Episode[\s._-]?(?P<episode3>\d{1,3}))"
    r"(?:$|[.\s_\-])",
    re.I,
)
TMDB_IMG = "https://image.tmdb.org/t/p/w500"


@dataclass
class SortPlan:
    source: str
    media_type: str  # movie | show
    title: str
    year: str | None
    season: int | None
    episode: int | None
    episode_title: str | None
    destination: str
    poster_url: str | None
    poster_dest: str | None
    tmdb_id: int | None
    action: str  # move | skip
    reason: str


def safe_name(name: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*]', "", name)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" .")
    return cleaned[:180] or "Unknown"


def clean_title_fragment(raw: str) -> str:
    text = raw.replace(".", " ").replace("_", " ").replace("-", " ")
    text = JUNK_TOKENS.sub(" ", text)
    text = re.sub(r"\s+", " ", text).strip(" -._")
    return text


def parse_media_filename(path: Path) -> dict:
    stem = path.stem
    if SAMPLE_RE.search(stem) or path.name.lower().startswith("."):
        return {"skip": True, "reason": "sample or hidden file"}

    ep = EPISODE_RE.search(stem)
    year_match = YEAR_RE.search(stem)
    year = year_match.group(1) if year_match else None

    if ep:
        season = int(ep.group("season") or ep.group("season2") or ep.group("season3"))
        episode = int(ep.group("episode") or ep.group("episode2") or ep.group("episode3"))
        show_part = stem[: ep.start()]
        # If show name empty, use parent folder
        show = clean_title_fragment(show_part)
        if not show or show.lower() in {"season", "seasons", "tvshows", "shows", "series"}:
            parent = path.parent.name
            if not re.match(r"(?i)season\s*\d+", parent):
                show = clean_title_fragment(parent)
            else:
                show = clean_title_fragment(path.parent.parent.name)
        # Strip year from show name for folder naming (keep separately)
        show_no_year = YEAR_RE.sub(" ", show)
        show = clean_title_fragment(show_no_year) or show
        return {
            "skip": False,
            "media_type": "show",
            "title": show,
            "year": year,
            "season": season,
            "episode": episode,
            "episode_title": None,
        }

    # Movie: take text before year if present, else full cleaned stem
    if year_match:
        title = clean_title_fragment(stem[: year_match.start()])
        if not title:
            title = clean_title_fragment(stem)
    else:
        title = clean_title_fragment(stem)
        # Sometimes movies are in a folder named properly
        if len(title) < 3 and path.parent.name.lower() not in {
            "movies",
            "incoming",
            "downloads",
            "tvshows",
            "shows",
        }:
            title = clean_title_fragment(path.parent.name)

    return {
        "skip": False,
        "media_type": "movie",
        "title": title or path.stem,
        "year": year,
        "season": None,
        "episode": None,
        "episode_title": None,
    }


async def tmdb_search_movie(title: str, year: str | None = None) -> dict | None:
    if not settings.tmdb_api_key:
        return None
    params = {
        "api_key": settings.tmdb_api_key,
        "query": title,
        "language": settings.tmdb_language,
        "include_adult": "false",
    }
    if year:
        params["year"] = year
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get("https://api.themoviedb.org/3/search/movie", params=params)
        resp.raise_for_status()
        results = (resp.json() or {}).get("results") or []
        return results[0] if results else None


async def tmdb_search_tv(title: str, year: str | None = None) -> dict | None:
    if not settings.tmdb_api_key:
        return None
    params = {
        "api_key": settings.tmdb_api_key,
        "query": title,
        "language": settings.tmdb_language,
        "include_adult": "false",
    }
    if year:
        params["first_air_date_year"] = year
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get("https://api.themoviedb.org/3/search/tv", params=params)
        resp.raise_for_status()
        results = (resp.json() or {}).get("results") or []
        return results[0] if results else None


async def tmdb_episode_name(tv_id: int, season: int, episode: int) -> str | None:
    if not settings.tmdb_api_key:
        return None
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(
            f"https://api.themoviedb.org/3/tv/{tv_id}/season/{season}/episode/{episode}",
            params={"api_key": settings.tmdb_api_key, "language": settings.tmdb_language},
        )
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return (resp.json() or {}).get("name")


def movie_dest(title: str, year: str | None, ext: str) -> tuple[Path, Path]:
    folder_name = f"{safe_name(title)} ({year})" if year else safe_name(title)
    folder = settings.movies_dir / folder_name
    filename = f"{folder_name}{ext.lower()}"
    return folder / filename, folder / "poster.jpg"


def show_dest(title: str, season: int, episode: int, ep_title: str | None, ext: str) -> tuple[Path, Path]:
    show_folder = settings.shows_dir / safe_name(title)
    season_folder = show_folder / f"Season {season:02d}"
    ep_bit = f" - {safe_name(ep_title)}" if ep_title else ""
    filename = f"{safe_name(title)} - S{season:02d}E{episode:02d}{ep_bit}{ext.lower()}"
    return season_folder / filename, show_folder / "poster.jpg"


async def enrich(parsed: dict) -> dict:
    """Apply TMDB corrections when API key is configured."""
    out = dict(parsed)
    out["poster_url"] = None
    out["tmdb_id"] = None
    try:
        if parsed["media_type"] == "movie":
            hit = await tmdb_search_movie(parsed["title"], parsed.get("year"))
            if hit:
                out["title"] = hit.get("title") or parsed["title"]
                out["year"] = (hit.get("release_date") or "")[:4] or parsed.get("year")
                out["tmdb_id"] = hit.get("id")
                if hit.get("poster_path"):
                    out["poster_url"] = f"{TMDB_IMG}{hit['poster_path']}"
        else:
            hit = await tmdb_search_tv(parsed["title"], parsed.get("year"))
            if hit:
                out["title"] = hit.get("name") or parsed["title"]
                out["year"] = (hit.get("first_air_date") or "")[:4] or parsed.get("year")
                out["tmdb_id"] = hit.get("id")
                if hit.get("poster_path"):
                    out["poster_url"] = f"{TMDB_IMG}{hit['poster_path']}"
                if out.get("season") and out.get("episode") and out["tmdb_id"]:
                    ep_name = await tmdb_episode_name(out["tmdb_id"], out["season"], out["episode"])
                    if ep_name:
                        out["episode_title"] = ep_name
    except Exception:
        logger.exception("TMDB enrich failed for %s", parsed.get("title"))
    return out


def collect_candidates(scan_roots: list[Path] | None = None) -> list[Path]:
    roots = scan_roots or [settings.incoming_dir, settings.downloads_dir]
    # Also allow sorting misplaced files already under media root (not yet tidy)
    files: list[Path] = []
    for root in roots:
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if path.is_file() and path.suffix.lower() in VIDEO_EXTS:
                files.append(path)
    return sorted(files)


async def build_plan(path: Path, apply_tmdb: bool = True) -> SortPlan:
    parsed = parse_media_filename(path)
    if parsed.get("skip"):
        return SortPlan(
            source=str(path),
            media_type="unknown",
            title="",
            year=None,
            season=None,
            episode=None,
            episode_title=None,
            destination="",
            poster_url=None,
            poster_dest=None,
            tmdb_id=None,
            action="skip",
            reason=parsed.get("reason") or "skipped",
        )

    meta = await enrich(parsed) if apply_tmdb else {**parsed, "poster_url": None, "tmdb_id": None}

    if meta["media_type"] == "movie":
        dest, poster = movie_dest(meta["title"], meta.get("year"), path.suffix)
    else:
        dest, poster = show_dest(
            meta["title"],
            meta["season"],
            meta["episode"],
            meta.get("episode_title"),
            path.suffix,
        )

    # Skip if already correctly placed
    if path.resolve() == dest.resolve():
        return SortPlan(
            source=str(path),
            media_type=meta["media_type"],
            title=meta["title"],
            year=meta.get("year"),
            season=meta.get("season"),
            episode=meta.get("episode"),
            episode_title=meta.get("episode_title"),
            destination=str(dest),
            poster_url=meta.get("poster_url"),
            poster_dest=str(poster),
            tmdb_id=meta.get("tmdb_id"),
            action="skip",
            reason="already organized",
        )

    return SortPlan(
        source=str(path),
        media_type=meta["media_type"],
        title=meta["title"],
        year=meta.get("year"),
        season=meta.get("season"),
        episode=meta.get("episode"),
        episode_title=meta.get("episode_title"),
        destination=str(dest),
        poster_url=meta.get("poster_url"),
        poster_dest=str(poster),
        tmdb_id=meta.get("tmdb_id"),
        action="move",
        reason="organize",
    )


async def download_poster(url: str, dest: Path) -> bool:
    try:
        dest.parent.mkdir(parents=True, exist_ok=True)
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            dest.write_bytes(resp.content)
        return True
    except Exception:
        logger.exception("Poster download failed: %s", url)
        return False


def apply_move(plan: SortPlan) -> dict:
    src = Path(plan.source)
    dest = Path(plan.destination)
    if plan.action != "move":
        return {"ok": True, "skipped": True, "source": plan.source, "destination": plan.destination}
    if not src.exists():
        return {"ok": False, "error": "source missing", "source": plan.source}
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.resolve() != src.resolve():
        # Avoid clobber — add numeric suffix
        stem, ext = dest.stem, dest.suffix
        i = 2
        while dest.exists():
            dest = dest.with_name(f"{stem} ({i}){ext}")
            i += 1
        plan.destination = str(dest)
    shutil.move(str(src), str(dest))
    return {"ok": True, "skipped": False, "source": plan.source, "destination": str(dest)}


async def preview_sort(
    roots: list[Path] | None = None,
    apply_tmdb: bool = True,
    include_library: bool = False,
) -> list[dict]:
    scan = list(roots or [])
    if not scan:
        scan = [settings.incoming_dir, settings.downloads_dir]
        if include_library:
            scan.extend([settings.movies_dir, settings.shows_dir])
    plans = []
    for path in collect_candidates(scan):
        plan = await build_plan(path, apply_tmdb=apply_tmdb)
        plans.append(asdict(plan))
    return plans


async def run_sort(
    roots: list[Path] | None = None,
    apply_tmdb: bool = True,
    include_library: bool = False,
    fetch_artwork: bool = True,
) -> dict:
    settings.movies_dir.mkdir(parents=True, exist_ok=True)
    settings.shows_dir.mkdir(parents=True, exist_ok=True)
    settings.incoming_dir.mkdir(parents=True, exist_ok=True)

    plans = await preview_sort(roots=roots, apply_tmdb=apply_tmdb, include_library=include_library)
    moved = 0
    skipped = 0
    posters = 0
    errors: list[dict] = []
    results: list[dict] = []

    for raw in plans:
        plan = SortPlan(**raw)
        if plan.action == "skip":
            skipped += 1
            results.append({**raw, "result": "skipped"})
            continue
        try:
            result = apply_move(plan)
            if not result.get("ok"):
                errors.append(result)
                results.append({**raw, "result": "error", **result})
                continue
            moved += 1 if not result.get("skipped") else 0
            skipped += 1 if result.get("skipped") else 0
            if fetch_artwork and plan.poster_url and plan.poster_dest:
                poster_path = Path(plan.poster_dest)
                if not poster_path.exists():
                    if await download_poster(plan.poster_url, poster_path):
                        posters += 1
            results.append({**raw, "result": "moved", "destination": result["destination"]})
        except Exception as exc:
            logger.exception("Sort failed for %s", plan.source)
            errors.append({"source": plan.source, "error": str(exc)})
            results.append({**raw, "result": "error", "error": str(exc)})

    return {
        "moved": moved,
        "skipped": skipped,
        "posters": posters,
        "errors": errors,
        "items": results,
        "movies_dir": str(settings.movies_dir),
        "shows_dir": str(settings.shows_dir),
        "tmdb_enabled": bool(settings.tmdb_api_key),
    }
