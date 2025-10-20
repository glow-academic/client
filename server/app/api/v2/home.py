"""Home overview API endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.schemas.analytics import AnalyticsFilters
from app.schemas.home import HomeOverviewResponse
from app.services.home_service import HomeService
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter(prefix="/home", tags=["home"])


@router.post("", response_model=HomeOverviewResponse)
async def get_home(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> HomeOverviewResponse:
    """Get home overview with items, history, and mappings."""
    try:
        service = HomeService(conn)
        return await service.get_home_overview(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

