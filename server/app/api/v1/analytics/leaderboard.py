"""Leaderboard-specific analytics API endpoints."""

from typing import Annotated

from app.db import get_session
from app.repositories.analytics_repository import get_analytics_repository
from app.schemas.analytics import AnalyticsFilters, MetricResponse
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter(prefix="/leaderboard", tags=["analytics-leaderboard"])


@router.post("/improvement-per-day", response_model=MetricResponse)
async def get_improvement_per_day(
    filters: AnalyticsFilters,
    db: Annotated[Session, Depends(get_session)],
) -> MetricResponse:
    """Get improvement per day metric."""
    try:
        repo = get_analytics_repository(db)
        return repo.get_improvement_per_day(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/perfect-scores", response_model=MetricResponse)
async def get_perfect_scores(
    filters: AnalyticsFilters,
    db: Annotated[Session, Depends(get_session)],
) -> MetricResponse:
    """Get perfect scores metric."""
    try:
        repo = get_analytics_repository(db)
        return repo.get_perfect_scores(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/quickest-pass", response_model=MetricResponse)
async def get_quickest_pass(
    filters: AnalyticsFilters,
    db: Annotated[Session, Depends(get_session)],
) -> MetricResponse:
    """Get quickest pass metric."""
    try:
        repo = get_analytics_repository(db)
        return repo.get_quickest_pass(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

