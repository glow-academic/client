"""Bundle analytics API endpoints."""

from typing import Annotated

from app.db import get_session
from app.repositories.analytics_repository import get_analytics_repository
from app.schemas.analytics import (AnalyticsFilters, DashboardBundleResponse,
                                   LeaderboardBundleResponse,
                                   ReportsBundleResponse)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter(tags=["analytics-bundles"])


@router.post("/leaderboard", response_model=LeaderboardBundleResponse)
async def get_leaderboard_bundle(
    filters: AnalyticsFilters,
    db: Annotated[Session, Depends(get_session)],
) -> LeaderboardBundleResponse:
    """Get leaderboard bundle analytics."""
    try:
        repo = get_analytics_repository(db)
        return repo.get_leaderboard_bundle(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reports", response_model=ReportsBundleResponse)
async def get_reports_bundle(
    filters: AnalyticsFilters,
    db: Annotated[Session, Depends(get_session)],
) -> ReportsBundleResponse:
    """Get reports bundle analytics."""
    try:
        repo = get_analytics_repository(db)
        return repo.get_reports_bundle(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/dashboard", response_model=DashboardBundleResponse)
async def get_dashboard_bundle(
    filters: AnalyticsFilters,
    db: Annotated[Session, Depends(get_session)],
) -> DashboardBundleResponse:
    """Get complete dashboard bundle analytics."""
    try:
        repo = get_analytics_repository(db)
        return repo.get_dashboard_bundle(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

