"""Analytics utility API endpoints."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.schemas.analytics import RefreshResponse
from app.services.analytics_service import get_analytics_service
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.post("/refresh", response_model=RefreshResponse)
async def refresh_analytics(
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RefreshResponse:
    """Refresh the analytics materialized view."""
    try:
        service = get_analytics_service(conn)
        await service.refresh_materialized_view()
        return RefreshResponse(
            success=True,
            message="Analytics materialized view refreshed successfully",
            status="success",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
