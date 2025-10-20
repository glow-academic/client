"""Page-specific analytics API endpoints."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.schemas.analytics import (AnalyticsFilters, HomeOverviewResponse,
                                   PracticeOverviewResponse)
from app.services.home_service import HomeService
from app.services.practice_service import PracticeService
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter(tags=["analytics-pages"])


@router.post("/home", response_model=HomeOverviewResponse)
async def get_home_overview(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> HomeOverviewResponse:
    """Get home overview analytics."""
    try:
        service = HomeService(conn)
        return await service.get_home_overview(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/practice", response_model=PracticeOverviewResponse)
async def get_practice_overview(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PracticeOverviewResponse:
    """Get practice overview analytics."""
    try:
        service = PracticeService(conn)
        return await service.get_practice_overview(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
