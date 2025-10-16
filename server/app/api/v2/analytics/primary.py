"""Primary analytics API endpoints."""

from typing import Annotated

from app.db import get_db
from app.repositories.analytics_repository import get_analytics_repository
from app.schemas.analytics import (AnalyticsFilters, GrowthDataResponse,
                                   PersonaPerformanceResponse,
                                   RubricHeatmapResponse)
from fastapi import APIRouter, Depends, HTTPException
import asyncpg  # type: ignore

router = APIRouter(prefix="/primary", tags=["analytics-primary"])


@router.post("/growth-data", response_model=GrowthDataResponse)
async def get_growth_data(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GrowthDataResponse:
    """Get growth data analytics."""
    try:
        repo = get_analytics_repository(db)
        return repo.get_growth_data(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/persona-performance", response_model=PersonaPerformanceResponse)
async def get_persona_performance(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PersonaPerformanceResponse:
    """Get persona performance analytics."""
    try:
        repo = get_analytics_repository(db)
        return repo.get_persona_performance(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rubric-heatmap", response_model=RubricHeatmapResponse)
async def get_rubric_heatmap(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RubricHeatmapResponse:
    """Get rubric heatmap analytics."""
    try:
        repo = get_analytics_repository(db)
        return repo.get_rubric_heatmap(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

