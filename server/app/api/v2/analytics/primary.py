"""Primary analytics API endpoints."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.services.analytics_service import get_analytics_service
from app.schemas.analytics import (AnalyticsFilters, GrowthDataResponse,
                                   PersonaPerformanceResponse,
                                   RubricHeatmapResponse)
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter(prefix="/primary", tags=["analytics-primary"])


@router.post("/growth-data", response_model=GrowthDataResponse)
async def get_growth_data(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GrowthDataResponse:
    """Get growth data analytics."""
    try:
        service = get_analytics_service(conn)
        return await service.get_growth_data(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/persona-performance", response_model=PersonaPerformanceResponse)
async def get_persona_performance(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PersonaPerformanceResponse:
    """Get persona performance analytics."""
    try:
        service = get_analytics_service(conn)
        return await service.get_persona_performance(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rubric-heatmap", response_model=RubricHeatmapResponse)
async def get_rubric_heatmap(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RubricHeatmapResponse:
    """Get rubric heatmap analytics."""
    try:
        service = get_analytics_service(conn)
        return await service.get_rubric_heatmap(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

