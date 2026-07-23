"""Unified search with fuzzy recognition + predictive title suggestions."""

from __future__ import annotations

import asyncio
import re
import time
import unicodedata
from dataclasses import dataclass

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.models import LocalMedia
from app.services.downloads import get_xtream_client
from app.services.xtream import XtreamClient

# Articles / noise often typed or omitted
_STOP = {"a", "an", "the", "and", "of", "or", "to", "in", "on", "at", "for"}
_YEAR_RE = re.compile(r"\b((?:19|20)\d{2})\b")

# Simple in-process catalog cache (Xtream lists are large)
_cache_lock = asyncio.Lock()
_catalog_cache: dict | None = None
_catalog_cache_at: float = 0.0
_CATALOG_TTL = 300.0  # 5 minutes


def normalize_text(value: str) -> str:
    """Lowercase, strip punctuation/diacritics — 'shogun' matches 'Shōgun'."""
    if not value:
        return ""
    text = unicodedata.normalize("NFKD", value)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def tokens(value: str, drop_stop: bool = False) -> list[str]:
    parts = normalize_text(value).split()
    if drop_stop:
        parts = [p for p in parts if p not in _STOP]
    return parts


def acronym(value: str, drop_stop: bool = True) -> str:
    toks = tokens(value, drop_stop=drop_stop)
    return "".join(t[0] for t in toks if t)


def acronyms(value: str) -> set[str]:
    """Both with and without stop-words — 'got' and 'gt' for Game of Thrones."""
    return {a for a in (acronym(value, True), acronym(value, False)) if len(a) >= 2}


def levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    # Prefer shorter as columns
    if len(a) < len(b):
        a, b = b, a
    previous = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        current = [i]
        for j, cb in enumerate(b, 1):
            ins = current[j - 1] + 1
            delete = previous[j] + 1
            sub = previous[j - 1] + (ca != cb)
            current.append(min(ins, delete, sub))
        previous = current
    return previous[-1]


def similarity(a: str, b: str) -> float:
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    dist = levenshtein(a, b)
    return 1.0 - dist / max(len(a), len(b))


def token_set_ratio(a: str, b: str) -> float:
    ta, tb = set(tokens(a)), set(tokens(b))
    if not ta or not tb:
        return 0.0
    inter = len(ta & tb)
    return (2 * inter) / (len(ta) + len(tb))


def prefix_score(title: str, query: str) -> float:
    nt, nq = normalize_text(title), normalize_text(query)
    if not nq:
        return 0.0
    if nt.startswith(nq):
        return 1.0
    # word-prefix: each query token prefixes some title token
    qt, tt = tokens(query), tokens(title)
    if not qt:
        return 0.0
    hits = 0
    for qtok in qt:
        if any(t.startswith(qtok) for t in tt):
            hits += 1
    return hits / len(qt)


def score_title(title: str, query: str, alt: str | None = None) -> tuple[float, str]:
    """
    Return (0..100 score, reason). Higher is better.
    Combines exact, prefix, fuzzy, token, and acronym signals.
    """
    haystacks = [title]
    if alt:
        haystacks.append(alt)

    nq = normalize_text(query)
    if not nq:
        return 0.0, "empty"

    best = 0.0
    reason = "none"
    q_acro = nq.replace(" ", "")

    for hay in haystacks:
        nt = normalize_text(hay)
        if not nt:
            continue

        # Exact
        if nt == nq:
            return 100.0, "exact"

        local = 0.0
        local_reason = "fuzzy"

        if nt.startswith(nq):
            local = max(local, 96.0)
            local_reason = "prefix"
        elif f" {nq} " in f" {nt} " or nt.endswith(f" {nq}"):
            local = max(local, 90.0)
            local_reason = "word"
        elif nq in nt:
            # contained — length penalty so short noise doesn't dominate
            local = max(local, 78.0 + 10.0 * (len(nq) / max(len(nt), 1)))
            local_reason = "contains"

        # Token coverage (order-independent)
        tsr = token_set_ratio(hay, query) * 85.0
        if tsr > local:
            local, local_reason = tsr, "tokens"

        # Prefix-of-words (sho → shogun)
        ps = prefix_score(hay, query) * 88.0
        if ps > local:
            local, local_reason = ps, "starts-with"

        # Full-string fuzzy (typos: shogun ↔ shogunn, matrix ↔ matrx)
        # Only for reasonably close lengths
        if abs(len(nt) - len(nq)) <= max(3, len(nq) // 2):
            sim = similarity(nt, nq) * 92.0
            if sim > local:
                local, local_reason = sim, "fuzzy"

        # Token-level fuzzy (each query token vs best title token)
        qt, tt = tokens(query), tokens(title)
        if qt and tt:
            token_sims = []
            for qtok in qt:
                best_tok = max((similarity(qtok, t) for t in tt), default=0.0)
                # also allow prefix
                if any(t.startswith(qtok) for t in tt):
                    best_tok = max(best_tok, 0.95)
                token_sims.append(best_tok)
            avg = (sum(token_sims) / len(token_sims)) * 90.0
            if avg > local:
                local, local_reason = avg, "token-fuzzy"

        # Acronym: got → game of thrones, tlou → the last of us
        ac_set = acronyms(hay)
        if len(q_acro) >= 2:
            if q_acro in ac_set:
                local = max(local, 92.0)
                local_reason = "acronym"
            elif any(ac.startswith(q_acro) for ac in ac_set):
                local = max(local, 74.0)
                local_reason = "acronym"

        # Year-aware: "matrix 1999"
        yq = _YEAR_RE.search(nq)
        yt = _YEAR_RE.search(nt)
        if yq and yt and yq.group(1) == yt.group(1):
            local = min(100.0, local + 6.0)

        if local > best:
            best, reason = local, local_reason

    return best, reason


def title_matches(title: str, query: str, threshold: float = 62.0) -> bool:
    score, _ = score_title(title, query)
    return score >= threshold


@dataclass
class IndexedTitle:
    item: dict
    norm: str
    acro: str


async def _load_catalog(db: AsyncSession, force: bool = False) -> list[IndexedTitle]:
    global _catalog_cache, _catalog_cache_at
    now = time.monotonic()
    async with _cache_lock:
        if not force and _catalog_cache is not None and (now - _catalog_cache_at) < _CATALOG_TTL:
            return _catalog_cache

        indexed: list[IndexedTitle] = []

        result = await db.execute(select(LocalMedia).order_by(LocalMedia.title).limit(5000))
        for row in result.scalars().all():
            kind = "movie" if row.media_type == "movie" else "show"
            title = row.show_name or row.title
            item = {
                "id": str(row.id),
                "title": row.title,
                "display_title": title if row.media_type == "episode" else row.title,
                "poster": f"/api/library/artwork/{row.id}" if row.poster else "",
                "media_type": kind if row.media_type != "episode" else "show",
                "source": "local",
                "year": "",
                "show_name": row.show_name,
                "season": row.season,
                "episode": row.episode,
                "origin": "library",
            }
            # Index show name for episodes so searching the series works
            hay = title
            indexed.append(IndexedTitle(item=item, norm=normalize_text(hay), acro=acronym(hay, False)))

        client = await get_xtream_client(db)
        if client:
            try:
                movies, shows, live = await asyncio.gather(
                    client.get_vod_streams(),
                    client.get_series(),
                    client.get_live_streams(),
                )
                for raw in movies or []:
                    item = {**XtreamClient.normalize_movie(raw), "origin": "xtream-movies", "display_title": None}
                    item["display_title"] = item["title"]
                    indexed.append(
                        IndexedTitle(item=item, norm=normalize_text(item["title"]), acro=acronym(item["title"], False))
                    )
                for raw in shows or []:
                    item = {**XtreamClient.normalize_series(raw), "origin": "xtream-shows", "display_title": None}
                    item["display_title"] = item["title"]
                    indexed.append(
                        IndexedTitle(item=item, norm=normalize_text(item["title"]), acro=acronym(item["title"], False))
                    )
                for raw in live or []:
                    item = {**XtreamClient.normalize_live(raw), "origin": "xtream-live", "display_title": None}
                    item["display_title"] = item["title"]
                    indexed.append(
                        IndexedTitle(item=item, norm=normalize_text(item["title"]), acro=acronym(item["title"], False))
                    )
            except Exception:
                pass

        _catalog_cache = indexed
        _catalog_cache_at = time.monotonic()
        return indexed


def invalidate_catalog_cache() -> None:
    global _catalog_cache, _catalog_cache_at
    _catalog_cache = None
    _catalog_cache_at = 0.0


async def tmdb_predict(query: str, limit: int = 8) -> list[dict]:
    """Predict likely titles from TMDB (helps recognition even before catalog match)."""
    if not settings.tmdb_api_key or len(query.strip()) < 2:
        return []
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.get(
                "https://api.themoviedb.org/3/search/multi",
                params={
                    "api_key": settings.tmdb_api_key,
                    "language": settings.tmdb_language,
                    "query": query,
                    "include_adult": "false",
                    "page": 1,
                },
            )
            resp.raise_for_status()
            out = []
            for row in (resp.json() or {}).get("results") or []:
                media = row.get("media_type")
                if media not in {"movie", "tv"}:
                    continue
                title = row.get("title") or row.get("name") or ""
                if not title:
                    continue
                date = row.get("release_date") or row.get("first_air_date") or ""
                poster = row.get("poster_path")
                out.append(
                    {
                        "title": title,
                        "year": date[:4] if date else "",
                        "media_type": "movie" if media == "movie" else "show",
                        "poster": f"https://image.tmdb.org/t/p/w185{poster}" if poster else "",
                        "source": "tmdb",
                        "tmdb_id": row.get("id"),
                        "popularity": row.get("popularity") or 0,
                    }
                )
                if len(out) >= limit:
                    break
            return out
    except Exception:
        return []


async def search_all(db: AsyncSession, q: str, limit: int = 40, threshold: float = 55.0) -> dict:
    query = (q or "").strip()
    if len(query) < 1:
        return {"query": query, "total": 0, "items": [], "suggestions": []}

    catalog = await _load_catalog(db)
    scored: list[tuple[float, str, dict]] = []

    for entry in catalog:
        title = entry.item.get("display_title") or entry.item.get("title") or ""
        alt = entry.item.get("show_name")
        score, reason = score_title(title, query, alt=alt)
        # Slight boost for local library
        if entry.item.get("source") == "local" and score > 0:
            score = min(100.0, score + 2.0)
        if score >= threshold:
            item = {**entry.item, "score": round(score, 1), "match": reason}
            scored.append((score, title, item))

    # De-dupe by source:type:id keeping highest score
    best_by_key: dict[str, tuple[float, str, dict]] = {}
    for score, title, item in scored:
        key = f"{item.get('source')}:{item.get('media_type')}:{item.get('id')}"
        # For local episodes of same show, collapse to one show entry when query matches show
        if item.get("source") == "local" and item.get("show_name"):
            show_score, _ = score_title(item["show_name"], query)
            if show_score >= threshold:
                key = f"local:show:{normalize_text(item['show_name'])}"
                item = {
                    **item,
                    "id": item.get("id"),
                    "title": item["show_name"],
                    "media_type": "show",
                    "score": round(max(score, show_score), 1),
                }
        prev = best_by_key.get(key)
        if not prev or score > prev[0]:
            best_by_key[key] = (score, title, item)

    ranked = sorted(best_by_key.values(), key=lambda x: (-x[0], x[1].lower()))
    items = [x[2] for x in ranked[:limit]]

    # Predictions for UI typeahead (catalog prefixes + TMDB)
    suggestions = await build_suggestions(db, query, catalog=catalog, limit=8)

    return {
        "query": query,
        "total": len(ranked),
        "items": items,
        "suggestions": suggestions,
    }


async def build_suggestions(
    db: AsyncSession,
    query: str,
    catalog: list[IndexedTitle] | None = None,
    limit: int = 8,
) -> list[dict]:
    query = (query or "").strip()
    if len(query) < 1:
        return []

    if catalog is None:
        catalog = await _load_catalog(db)

    nq = normalize_text(query)
    seen_titles: set[str] = set()
    suggestions: list[dict] = []

    # 1) Catalog title completions / close matches
    catalog_hits: list[tuple[float, dict]] = []
    for entry in catalog:
        title = entry.item.get("display_title") or entry.item.get("title") or ""
        score, reason = score_title(title, query, alt=entry.item.get("show_name"))
        if score < 50:
            continue
        # Prefer clean series/movie titles over episode strings
        clean_title = entry.item.get("show_name") or title
        # If episode title scored via show_name, surface the show
        if entry.item.get("show_name"):
            show_score, _ = score_title(entry.item["show_name"], query)
            if show_score >= 50:
                clean_title = entry.item["show_name"]
                score = max(score, show_score)
                reason = "show"
        key = normalize_text(clean_title)
        if key in seen_titles:
            continue
        catalog_hits.append(
            (
                score,
                {
                    "title": clean_title,
                    "year": entry.item.get("year") or "",
                    "media_type": entry.item.get("media_type"),
                    "poster": entry.item.get("poster") or "",
                    "source": entry.item.get("source"),
                    "id": entry.item.get("id"),
                    "origin": entry.item.get("origin"),
                    "score": round(score, 1),
                    "match": reason,
                    "kind": "catalog",
                },
            )
        )
        seen_titles.add(key)

    catalog_hits.sort(key=lambda x: -x[0])
    for _, sug in catalog_hits[:limit]:
        suggestions.append(sug)

    # 2) TMDB predictions fill remaining slots (helps typeahead before provider titles match)
    remaining = max(0, limit - len(suggestions))
    if remaining:
        tmdb = await tmdb_predict(query, limit=remaining + 4)
        for row in tmdb:
            key = normalize_text(row["title"])
            if key in seen_titles:
                # Already in catalog — skip duplicate prediction
                continue
            seen_titles.add(key)
            suggestions.append({**row, "kind": "prediction", "match": "tmdb"})
            if len(suggestions) >= limit:
                break

    return suggestions[:limit]


async def suggest(db: AsyncSession, q: str, limit: int = 8) -> dict:
    query = (q or "").strip()
    suggestions = await build_suggestions(db, query, limit=limit)
    return {"query": query, "suggestions": suggestions}
