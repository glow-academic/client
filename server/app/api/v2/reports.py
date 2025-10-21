"""Reports bundle API endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException

from app.db import get_db
from app.schemas.analytics import AnalyticsFilters
from app.schemas.reports import ReportsBundleResponse
from app.services.reports_service import ReportsService

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("", response_model=ReportsBundleResponse)
async def get_reports(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ReportsBundleResponse:
    """Get reports bundle with aggregated metrics per profile and entity mappings."""
    try:
        service = ReportsService(conn)
        return await service.get_reports_bundle(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
