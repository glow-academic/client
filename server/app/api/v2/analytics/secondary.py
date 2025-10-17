"""Secondary analytics API endpoints."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.services.analytics_service import get_analytics_service
from app.schemas.analytics import (AnalyticsFilters,
                                   AttemptImprovementResponse,
                                   CohortPerformanceResponse,
                                   SkillPerformanceResponse)
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter(prefix="/secondary", tags=["analytics-secondary"])


@router.post("/attempt-improvement", response_model=AttemptImprovementResponse)
async def get_attempt_improvement(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> AttemptImprovementResponse:
    """Get attempt improvement analytics."""
    try:
        service = get_analytics_service(conn)
        return await service.get_attempt_improvement(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cohort-performance", response_model=CohortPerformanceResponse)
async def get_cohort_performance(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CohortPerformanceResponse:
    """Get cohort performance analytics."""
    try:
        service = get_analytics_service(conn)
        return await service.get_cohort_performance(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/skill-performance", response_model=SkillPerformanceResponse)
async def get_skill_performance(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SkillPerformanceResponse:
    """Get skill performance analytics."""
    try:
        service = get_analytics_service(conn)
        return await service.get_skill_performance(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

