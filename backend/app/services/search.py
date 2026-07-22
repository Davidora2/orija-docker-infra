"""Unified search across Xtream + local library."""

from __future__ import annotations

import re
import unicodedata

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import LocalMedia
from app.services.downloads import get_xtream_client
from app.services.xtream import XtreamClient


def normalize_text(value: str) -> str:
    """Lowercase, strip punctuation/diacritics — so 'shogun' matches 'Shōgun'."""
    if not value:
        return ""
    text = unicodedata.normalize("NFKD", value)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def title_matches(title: str, query: str) -> bool:
    nt = normalize_text(title)
    nq = normalize_text(query)
    if not nq:
        return True
    if nq in nt:
        return True
    # all query tokens present (order-independent)
    tokens = nq.split()
    return all(tok in nt for tok in tokens)


async def search_all(db: AsyncSession, q: str, limit: int = 40) -> dict:
    query = (q or "").strip()
    if len(query) < 1:
        return {"query": query, "total": 0, "items": []}

    items: list[dict] = []

    # Local library first (fast, always available)
    result = await db.execute(select(LocalMedia).order_by(LocalMedia.title).limit(2000))
    local_rows = list(result.scalars().all())
    for row in local_rows:
        hay = " ".join(filter(None, [row.title, row.show_name]))
        if not title_matches(hay, query):
            continue
        kind = "movie" if row.media_type == "movie" else "show"
        items.append(
            {
                "id": str(row.id),
                "title": row.title,
                "poster": f"/api/library/artwork/{row.id}" if row.poster else "",
                "media_type": kind if row.media_type != "episode" else "show",
                "source": "local",
                "year": "",
                "show_name": row.show_name,
                "season": row.season,
                "episode": row.episode,
                "origin": "library",
            }
        )

    client = await get_xtream_client(db)
    if client:
        try:
            movies = [XtreamClient.normalize_movie(i) for i in await client.get_vod_streams()]
            shows = [XtreamClient.normalize_series(i) for i in await client.get_series()]
            live = [XtreamClient.normalize_live(i) for i in await client.get_live_streams()]
            for bucket, origin in ((movies, "xtream-movies"), (shows, "xtream-shows"), (live, "xtream-live")):
                for item in bucket:
                    if title_matches(item.get("title") or "", query):
                        items.append({**item, "origin": origin})
        except Exception:
            # Xtream optional — local results still return
            pass

    # De-dupe by source+type+id, prefer earlier (local first)
    seen: set[str] = set()
    unique: list[dict] = []
    for item in items:
        key = f"{item.get('source')}:{item.get('media_type')}:{item.get('id')}"
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)

    # Rank: exact prefix > contains at start word > other
    nq = normalize_text(query)

    def rank(item: dict) -> tuple:
        nt = normalize_text(item.get("title") or "")
        if nt == nq:
            return (0, nt)
        if nt.startswith(nq):
            return (1, nt)
        if f" {nq}" in f" {nt}":
            return (2, nt)
        return (3, nt)

    unique.sort(key=rank)
    page = unique[:limit]
    return {"query": query, "total": len(unique), "items": page}
