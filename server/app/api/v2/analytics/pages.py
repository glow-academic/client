"""Page-specific analytics API endpoints."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.repositories.analytics_repository import get_analytics_repository
from app.schemas.analytics import (AnalyticsFilters, AttemptHistoryResponse,
                                   HomeOverviewResponse,
                                   PracticeOverviewResponse)
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter(tags=["analytics-pages"])


@router.post("/home", response_model=HomeOverviewResponse)
async def get_home_overview(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> HomeOverviewResponse:
    """Get home overview analytics."""
    try:
        repo = get_analytics_repository(conn)
        return await repo.get_home_overview(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/history", response_model=AttemptHistoryResponse)
async def get_attempt_history(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> AttemptHistoryResponse:
    """Get attempt history analytics."""
    try:
        repo = get_analytics_repository(conn)
        return await repo.get_attempt_history(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/practice", response_model=PracticeOverviewResponse)
async def get_practice_overview(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PracticeOverviewResponse:
    """Get practice overview analytics."""
    try:
        repo = get_analytics_repository(conn)
        return await repo.get_practice_overview(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

