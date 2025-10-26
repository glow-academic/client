"""Home overview API endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.schemas.analytics import AnalyticsFilters
from app.schemas.home import HomeFilters, HomeOverviewResponse
from app.services.home_service import HomeService
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter(prefix="/home", tags=["home"])


@router.post("", response_model=HomeOverviewResponse)
async def get_home(
    filters: HomeFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> HomeOverviewResponse:
    """Get home overview with items, history, and mappings.
    
    Home always shows general simulations only (no simulationFilters parameter).
    """
    try:
        service = HomeService(conn)
        # Convert HomeFilters to AnalyticsFilters for service compatibility
        # Note: No roles parameter since home always shows general simulations
        analytics_filters = AnalyticsFilters(
            startDate=filters.startDate,
            endDate=filters.endDate,
            cohortIds=filters.cohortIds,
            profileId=filters.profileId,
            departmentIds=filters.departmentIds,
        )
        return await service.get_home_overview(analytics_filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
