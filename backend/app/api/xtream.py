from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_admin_user, get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.models import User, XtreamConfig
from app.schemas import XtreamConfigIn, XtreamConfigOut
from app.services.downloads import get_xtream_client
from app.services.xtream import XtreamClient

router = APIRouter(prefix="/xtream", tags=["xtream"])


@router.get("/config", response_model=XtreamConfigOut | None)
async def get_config(_: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(XtreamConfig).limit(1))
    return result.scalar_one_or_none()


@router.put("/config", response_model=XtreamConfigOut)
async def upsert_config(
    body: XtreamConfigIn,
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(XtreamConfig).limit(1))
    cfg = result.scalar_one_or_none()
    if cfg:
        cfg.base_url = body.base_url.rstrip("/")
        cfg.username = body.username
        cfg.password = body.password
        cfg.label = body.label
        cfg.enabled = body.enabled
    else:
        cfg = XtreamConfig(
            base_url=body.base_url.rstrip("/"),
            username=body.username,
            password=body.password,
            label=body.label,
            enabled=body.enabled,
        )
        db.add(cfg)
    await db.commit()
    await db.refresh(cfg)
    return cfg


@router.post("/test")
async def test_connection(body: XtreamConfigIn, _: User = Depends(get_admin_user)):
    client = XtreamClient(body.base_url.rstrip("/"), body.username, body.password)
    try:
        data = await client.authenticate()
        user_info = data.get("user_info") or {}
        return {
            "ok": True,
            "auth": user_info.get("auth"),
            "status": user_info.get("status"),
            "exp_date": user_info.get("exp_date"),
            "max_connections": user_info.get("max_connections"),
            "active_cons": user_info.get("active_cons"),
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Connection failed: {exc}") from exc


@router.get("/status")
async def status(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    client = await get_xtream_client(db)
    if not client:
        return {"configured": False, "connected": False}
    try:
        data = await client.authenticate()
        info = data.get("user_info") or {}
        return {
            "configured": True,
            "connected": True,
            "status": info.get("status"),
            "exp_date": info.get("exp_date"),
            "max_connections": info.get("max_connections"),
            "active_cons": info.get("active_cons"),
        }
    except Exception as exc:
        return {"configured": True, "connected": False, "error": str(exc)}


@router.get("/categories/{kind}")
async def categories(kind: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    client = await get_xtream_client(db)
    if not client:
        raise HTTPException(status_code=400, detail="Xtream not configured")
    if kind == "movies":
        return await client.get_vod_categories()
    if kind == "shows":
        return await client.get_series_categories()
    if kind == "live":
        return await client.get_live_categories()
    raise HTTPException(status_code=400, detail="kind must be movies|shows|live")


@router.get("/catalog/{kind}")
async def catalog(
    kind: str,
    category_id: str | None = Query(None),
    q: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    client = await get_xtream_client(db)
    if not client:
        raise HTTPException(status_code=400, detail="Xtream not configured")

    if kind == "movies":
        items = [XtreamClient.normalize_movie(i) for i in await client.get_vod_streams(category_id)]
    elif kind == "shows":
        items = [XtreamClient.normalize_series(i) for i in await client.get_series(category_id)]
    elif kind == "live":
        items = [XtreamClient.normalize_live(i) for i in await client.get_live_streams(category_id)]
    else:
        raise HTTPException(status_code=400, detail="kind must be movies|shows|live")

    if q:
        from app.services.search import title_matches

        items = [i for i in items if title_matches(i.get("title") or "", q)]

    total = len(items)
    page = items[offset : offset + limit]
    return {"total": total, "items": page}


@router.get("/movies/{vod_id}")
async def movie_detail(vod_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    client = await get_xtream_client(db)
    if not client:
        raise HTTPException(status_code=400, detail="Xtream not configured")
    info = await client.get_vod_info(vod_id)
    movie = info.get("movie_data") or info.get("info") or {}
    return {
        "id": vod_id,
        "title": movie.get("name") or info.get("info", {}).get("name") or "Movie",
        "plot": (info.get("info") or {}).get("plot") or movie.get("plot") or "",
        "poster": (info.get("info") or {}).get("movie_image") or movie.get("stream_icon") or "",
        "year": (info.get("info") or {}).get("releasedate") or movie.get("year") or "",
        "duration": (info.get("info") or {}).get("duration") or "",
        "rating": (info.get("info") or {}).get("rating") or "",
        "container": movie.get("container_extension") or "mp4",
        "media_type": "movie",
        "source": "xtream",
        "raw": info,
    }


@router.get("/shows/{series_id}")
async def show_detail(series_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    client = await get_xtream_client(db)
    if not client:
        raise HTTPException(status_code=400, detail="Xtream not configured")
    info = await client.get_series_info(series_id)
    meta = info.get("info") or {}
    episodes_raw = info.get("episodes") or {}
    seasons = []
    for season_key, eps in episodes_raw.items():
        seasons.append(
            {
                "season": int(season_key) if str(season_key).isdigit() else season_key,
                "episodes": [
                    {
                        "id": str(ep.get("id")),
                        "title": ep.get("title") or f"Episode {ep.get('episode_num')}",
                        "episode_num": ep.get("episode_num"),
                        "season": ep.get("season") or season_key,
                        "container": ep.get("container_extension") or "mp4",
                        "plot": (ep.get("info") or {}).get("plot") if isinstance(ep.get("info"), dict) else "",
                    }
                    for ep in (eps or [])
                ],
            }
        )
    seasons.sort(key=lambda s: int(s["season"]) if str(s["season"]).isdigit() else 0)
    return {
        "id": series_id,
        "title": meta.get("name") or "Series",
        "plot": meta.get("plot") or "",
        "poster": meta.get("cover") or "",
        "year": str(meta.get("releaseDate") or meta.get("release_date") or "")[:4],
        "rating": meta.get("rating") or "",
        "media_type": "show",
        "source": "xtream",
        "seasons": seasons,
    }
