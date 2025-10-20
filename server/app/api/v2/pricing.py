"""Pricing analytics API endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.schemas.analytics import AnalyticsFilters
from app.schemas.pricing import PricingAnalyticsResponse
from app.services.pricing_service import PricingService
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter(prefix="/pricing", tags=["pricing"])


@router.post("", response_model=PricingAnalyticsResponse)
async def get_pricing(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PricingAnalyticsResponse:
    """Get pricing metrics with model usage and cost analysis."""
    try:
        service = PricingService(conn)
        return await service.get_pricing_analytics(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

