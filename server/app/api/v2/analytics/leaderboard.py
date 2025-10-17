"""Leaderboard-specific analytics API endpoints."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.services.analytics_service import get_analytics_service
from app.schemas.analytics import AnalyticsFilters, MetricResponse
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter(prefix="/leaderboard", tags=["analytics-leaderboard"])


@router.post("/improvement-per-day", response_model=MetricResponse)
async def get_improvement_per_day(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> MetricResponse:
    """Get improvement per day metric."""
    try:
        service = get_analytics_service(conn)
        return await service.get_improvement_per_day(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/perfect-scores", response_model=MetricResponse)
async def get_perfect_scores(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> MetricResponse:
    """Get perfect scores metric."""
    try:
        service = get_analytics_service(conn)
        return await service.get_perfect_scores(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/quickest-pass", response_model=MetricResponse)
async def get_quickest_pass(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> MetricResponse:
    """Get quickest pass metric."""
    try:
        service = get_analytics_service(conn)
        return await service.get_quickest_pass(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

