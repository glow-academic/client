"""Pricing analytics endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.services.analytics_service import get_analytics_service
from app.schemas.analytics import AnalyticsFilters, PricingAnalyticsResponse
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter()


@router.post("/pricing", response_model=PricingAnalyticsResponse)
async def get_pricing_analytics(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PricingAnalyticsResponse:
    """Get pricing analytics for model runs."""
    try:
        service = get_analytics_service(conn)
        return await service.get_pricing_analytics(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

