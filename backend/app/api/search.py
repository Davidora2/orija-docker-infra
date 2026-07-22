from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.models import User
from app.services.search import search_all

router = APIRouter(prefix="/search", tags=["search"])


@router.get("")
async def search(
    q: str = Query("", min_length=0),
    limit: int = Query(40, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await search_all(db, q, limit=limit)
