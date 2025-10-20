"""Practice overview API endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.schemas.analytics import AnalyticsFilters, PracticeOverviewResponse
from app.services.practice_service import PracticeService
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter(prefix="/practice", tags=["practice"])


@router.post("", response_model=PracticeOverviewResponse)
async def get_practice(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PracticeOverviewResponse:
    """Get practice overview with items, history, and all entity mappings."""
    try:
        service = PracticeService(conn)
        return await service.get_practice_overview(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

