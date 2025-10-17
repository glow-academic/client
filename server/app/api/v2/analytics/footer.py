"""Footer analytics API endpoints."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.services.analytics_service import get_analytics_service
from app.schemas.analytics import (AnalyticsFilters,
                                   ScenarioPerformanceResponse,
                                   ScenarioStatsResponse,
                                   SimulationCompositionResponse,
                                   SimulationPerformanceResponse)
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter(prefix="/footer", tags=["analytics-footer"])


@router.post("/scenario-performance", response_model=ScenarioPerformanceResponse)
async def get_scenario_performance(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ScenarioPerformanceResponse:
    """Get scenario performance analytics."""
    try:
        service = get_analytics_service(conn)
        return await service.get_scenario_performance(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scenario-stats", response_model=ScenarioStatsResponse)
async def get_scenario_stats(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ScenarioStatsResponse:
    """Get scenario stats analytics."""
    try:
        service = get_analytics_service(conn)
        return await service.get_scenario_stats(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/simulation-composition", response_model=SimulationCompositionResponse)
async def get_simulation_composition(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SimulationCompositionResponse:
    """Get simulation composition analytics."""
    try:
        service = get_analytics_service(conn)
        return await service.get_simulation_composition(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/simulation-performance", response_model=SimulationPerformanceResponse)
async def get_simulation_performance(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SimulationPerformanceResponse:
    """Get simulation performance analytics."""
    try:
        service = get_analytics_service(conn)
        return await service.get_simulation_performance(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

