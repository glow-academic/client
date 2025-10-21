"""Dashboard bundle API endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException

from app.db import get_db
from app.schemas.analytics import AnalyticsFilters
from app.schemas.dashboard import DashboardBundleResponse
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.post("", response_model=DashboardBundleResponse)
async def get_dashboard(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DashboardBundleResponse:
    """Get complete dashboard bundle with all metrics, history, insights, and mappings."""
    try:
        service = DashboardService(conn)
        return await service.get_dashboard_bundle(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
