"""Practice overview API endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.schemas.analytics import AnalyticsFilters
from app.schemas.practice import PracticeFilters, PracticeOverviewResponse
from app.services.practice_service import PracticeService
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter(prefix="/practice", tags=["practice"])


@router.post("", response_model=PracticeOverviewResponse)
async def get_practice(
    filters: PracticeFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PracticeOverviewResponse:
    """Get practice overview with items, history, and all entity mappings.
    
    Practice uses simplified filters: only profileId and departmentIds.
    No cohort/role/date filtering for personal practice.
    """
    try:
        service = PracticeService(conn)
        # Convert PracticeFilters to AnalyticsFilters for service compatibility
        analytics_filters = AnalyticsFilters(
            profileId=filters.profileId,
            departmentIds=filters.departmentIds,
            startDate="1970-01-01",  # Dummy values (not used)
            endDate="2100-12-31",
        )
        return await service.get_practice_overview(analytics_filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
