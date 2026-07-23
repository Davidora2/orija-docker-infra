from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_admin_user, get_current_user
from app.core.database import get_db
from app.models.models import User
from app.services import search as search_svc

router = APIRouter(prefix="/search", tags=["search"])


@router.get("")
async def search(
    q: str = Query("", min_length=0),
    limit: int = Query(40, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await search_svc.search_all(db, q, limit=limit)


@router.get("/suggest")
async def suggest(
    q: str = Query("", min_length=0),
    limit: int = Query(8, ge=1, le=20),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Predictive title suggestions (catalog fuzzy + TMDB)."""
    return await search_svc.suggest(db, q, limit=limit)


@router.post("/reindex")
async def reindex(_: User = Depends(get_admin_user)):
    search_svc.invalidate_catalog_cache()
    return {"ok": True, "message": "Catalog cache cleared; next search will rebuild."}
