"""Footer analytics API endpoints."""

from typing import Annotated

from app.db import get_session
from app.repositories.analytics_repository import get_analytics_repository
from app.schemas.analytics import (AnalyticsFilters,
                                   ScenarioPerformanceResponse,
                                   ScenarioStatsResponse,
                                   SimulationCompositionResponse,
                                   SimulationPerformanceResponse)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter(prefix="/footer", tags=["analytics-footer"])


@router.post("/scenario-performance", response_model=ScenarioPerformanceResponse)
async def get_scenario_performance(
    filters: AnalyticsFilters,
    db: Annotated[Session, Depends(get_session)],
) -> ScenarioPerformanceResponse:
    """Get scenario performance analytics."""
    try:
        repo = get_analytics_repository(db)
        return repo.get_scenario_performance(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scenario-stats", response_model=ScenarioStatsResponse)
async def get_scenario_stats(
    filters: AnalyticsFilters,
    db: Annotated[Session, Depends(get_session)],
) -> ScenarioStatsResponse:
    """Get scenario stats analytics."""
    try:
        repo = get_analytics_repository(db)
        return repo.get_scenario_stats(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/simulation-composition", response_model=SimulationCompositionResponse)
async def get_simulation_composition(
    filters: AnalyticsFilters,
    db: Annotated[Session, Depends(get_session)],
) -> SimulationCompositionResponse:
    """Get simulation composition analytics."""
    try:
        repo = get_analytics_repository(db)
        return repo.get_simulation_composition(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/simulation-performance", response_model=SimulationPerformanceResponse)
async def get_simulation_performance(
    filters: AnalyticsFilters,
    db: Annotated[Session, Depends(get_session)],
) -> SimulationPerformanceResponse:
    """Get simulation performance analytics."""
    try:
        repo = get_analytics_repository(db)
        return repo.get_simulation_performance(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

