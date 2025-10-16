"""Bundle analytics API endpoints."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.repositories.analytics_repository import get_analytics_repository
from app.schemas.analytics import (AnalyticsFilters, DashboardBundleResponse,
                                   LeaderboardBundleResponse,
                                   ReportsBundleResponse)
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter(tags=["analytics-bundles"])


@router.post("/leaderboard", response_model=LeaderboardBundleResponse)
async def get_leaderboard_bundle(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> LeaderboardBundleResponse:
    """Get leaderboard bundle analytics."""
    try:
        repo = get_analytics_repository(conn)
        return await repo.get_leaderboard_bundle(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reports", response_model=ReportsBundleResponse)
async def get_reports_bundle(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ReportsBundleResponse:
    """Get reports bundle analytics."""
    try:
        repo = get_analytics_repository(conn)
        return await repo.get_reports_bundle(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/dashboard", response_model=DashboardBundleResponse)
async def get_dashboard_bundle(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DashboardBundleResponse:
    """Get complete dashboard bundle analytics."""
    try:
        repo = get_analytics_repository(conn)
        return await repo.get_dashboard_bundle(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

