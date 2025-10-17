"""Header analytics API endpoints."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.services.analytics_service import get_analytics_service
from app.schemas.analytics import AnalyticsFilters, MetricResponse
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter(prefix="/header", tags=["analytics-header"])


@router.post("/average-score", response_model=MetricResponse)
async def get_average_score(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> MetricResponse:
    """Get average score metric."""
    try:
        service = get_analytics_service(conn)
        return await service.get_average_score(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/completion-percentage", response_model=MetricResponse)
async def get_completion_percentage(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> MetricResponse:
    """Get completion percentage metric."""
    try:
        service = get_analytics_service(conn)
        return await service.get_completion_percentage(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/first-attempt-pass-rate", response_model=MetricResponse)
async def get_first_attempt_pass_rate(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> MetricResponse:
    """Get first attempt pass rate metric."""
    try:
        service = get_analytics_service(conn)
        return await service.get_first_attempt_pass_rate(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/highest-score", response_model=MetricResponse)
async def get_highest_score(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> MetricResponse:
    """Get highest score metric."""
    try:
        service = get_analytics_service(conn)
        return await service.get_highest_score(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/messages-per-session", response_model=MetricResponse)
async def get_messages_per_session(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> MetricResponse:
    """Get messages per session metric."""
    try:
        service = get_analytics_service(conn)
        return await service.get_messages_per_session(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/persona-response-times", response_model=MetricResponse)
async def get_persona_response_times(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> MetricResponse:
    """Get persona response times metric."""
    try:
        service = get_analytics_service(conn)
        return await service.get_persona_response_times(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/session-efficiency", response_model=MetricResponse)
async def get_session_efficiency(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> MetricResponse:
    """Get session efficiency metric."""
    try:
        service = get_analytics_service(conn)
        return await service.get_session_efficiency(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stagnation-rate", response_model=MetricResponse)
async def get_stagnation_rate(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> MetricResponse:
    """Get stagnation rate metric."""
    try:
        service = get_analytics_service(conn)
        return await service.get_stagnation_rate(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/time-spent", response_model=MetricResponse)
async def get_time_spent(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> MetricResponse:
    """Get time spent metric."""
    try:
        service = get_analytics_service(conn)
        return await service.get_time_spent(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/total-attempts", response_model=MetricResponse)
async def get_total_attempts(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> MetricResponse:
    """Get total attempts metric."""
    try:
        service = get_analytics_service(conn)
        return await service.get_total_attempts(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

