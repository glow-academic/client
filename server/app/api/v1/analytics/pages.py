"""Page-specific analytics API endpoints."""

from typing import Annotated

from app.db import get_session
from app.repositories.analytics_repository import get_analytics_repository
from app.schemas.analytics import (AnalyticsFilters, AttemptHistoryResponse,
                                   HomeOverviewResponse,
                                   PracticeOverviewResponse)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter(tags=["analytics-pages"])


@router.post("/home", response_model=HomeOverviewResponse)
async def get_home_overview(
    filters: AnalyticsFilters,
    db: Annotated[Session, Depends(get_session)],
) -> HomeOverviewResponse:
    """Get home overview analytics."""
    try:
        repo = get_analytics_repository(db)
        return repo.get_home_overview(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/history", response_model=AttemptHistoryResponse)
async def get_attempt_history(
    filters: AnalyticsFilters,
    db: Annotated[Session, Depends(get_session)],
) -> AttemptHistoryResponse:
    """Get attempt history analytics."""
    try:
        repo = get_analytics_repository(db)
        return repo.get_attempt_history(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/practice", response_model=PracticeOverviewResponse)
async def get_practice_overview(
    filters: AnalyticsFilters,
    db: Annotated[Session, Depends(get_session)],
) -> PracticeOverviewResponse:
    """Get practice overview analytics."""
    try:
        repo = get_analytics_repository(db)
        return repo.get_practice_overview(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

