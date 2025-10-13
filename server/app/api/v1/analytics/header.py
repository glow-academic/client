"""Header analytics API endpoints."""

from typing import Annotated

from app.db import get_session
from app.repositories.analytics_repository import get_analytics_repository
from app.schemas.analytics import AnalyticsFilters, MetricResponse
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter(prefix="/header", tags=["analytics-header"])


@router.post("/average-score", response_model=MetricResponse)
async def get_average_score(
    filters: AnalyticsFilters,
    db: Annotated[Session, Depends(get_session)],
) -> MetricResponse:
    """Get average score metric."""
    try:
        repo = get_analytics_repository(db)
        return repo.get_average_score(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/completion-percentage", response_model=MetricResponse)
async def get_completion_percentage(
    filters: AnalyticsFilters,
    db: Annotated[Session, Depends(get_session)],
) -> MetricResponse:
    """Get completion percentage metric."""
    try:
        repo = get_analytics_repository(db)
        return repo.get_completion_percentage(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/first-attempt-pass-rate", response_model=MetricResponse)
async def get_first_attempt_pass_rate(
    filters: AnalyticsFilters,
    db: Annotated[Session, Depends(get_session)],
) -> MetricResponse:
    """Get first attempt pass rate metric."""
    try:
        repo = get_analytics_repository(db)
        return repo.get_first_attempt_pass_rate(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/highest-score", response_model=MetricResponse)
async def get_highest_score(
    filters: AnalyticsFilters,
    db: Annotated[Session, Depends(get_session)],
) -> MetricResponse:
    """Get highest score metric."""
    try:
        repo = get_analytics_repository(db)
        return repo.get_highest_score(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/messages-per-session", response_model=MetricResponse)
async def get_messages_per_session(
    filters: AnalyticsFilters,
    db: Annotated[Session, Depends(get_session)],
) -> MetricResponse:
    """Get messages per session metric."""
    try:
        repo = get_analytics_repository(db)
        return repo.get_messages_per_session(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/persona-response-times", response_model=MetricResponse)
async def get_persona_response_times(
    filters: AnalyticsFilters,
    db: Annotated[Session, Depends(get_session)],
) -> MetricResponse:
    """Get persona response times metric."""
    try:
        repo = get_analytics_repository(db)
        return repo.get_persona_response_times(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/session-efficiency", response_model=MetricResponse)
async def get_session_efficiency(
    filters: AnalyticsFilters,
    db: Annotated[Session, Depends(get_session)],
) -> MetricResponse:
    """Get session efficiency metric."""
    try:
        repo = get_analytics_repository(db)
        return repo.get_session_efficiency(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stagnation-rate", response_model=MetricResponse)
async def get_stagnation_rate(
    filters: AnalyticsFilters,
    db: Annotated[Session, Depends(get_session)],
) -> MetricResponse:
    """Get stagnation rate metric."""
    try:
        repo = get_analytics_repository(db)
        return repo.get_stagnation_rate(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/time-spent", response_model=MetricResponse)
async def get_time_spent(
    filters: AnalyticsFilters,
    db: Annotated[Session, Depends(get_session)],
) -> MetricResponse:
    """Get time spent metric."""
    try:
        repo = get_analytics_repository(db)
        return repo.get_time_spent(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/total-attempts", response_model=MetricResponse)
async def get_total_attempts(
    filters: AnalyticsFilters,
    db: Annotated[Session, Depends(get_session)],
) -> MetricResponse:
    """Get total attempts metric."""
    try:
        repo = get_analytics_repository(db)
        return repo.get_total_attempts(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

