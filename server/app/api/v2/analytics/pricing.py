"""Pricing analytics endpoint."""

from typing import Annotated

from app.db import get_db
from app.repositories.analytics_repository import get_analytics_repository
from app.schemas.analytics import AnalyticsFilters, PricingAnalyticsResponse
from fastapi import APIRouter, Depends, HTTPException
import asyncpg  # type: ignore

router = APIRouter()


@router.post("/pricing", response_model=PricingAnalyticsResponse)
async def get_pricing_analytics(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PricingAnalyticsResponse:
    """Get pricing analytics for model runs."""
    try:
        repo = get_analytics_repository(db)
        return repo.get_pricing_analytics(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

