"""Utility analytics API endpoints."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends

from app.db import get_db
from app.schemas.analytics import RefreshResponse
from app.services.analytics_service import get_analytics_service

router = APIRouter(tags=["analytics-utility"])


@router.post("/refresh", response_model=RefreshResponse)
async def refresh_analytics_view(
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RefreshResponse:
    """Refresh the analytics materialized view."""
    try:
        service = get_analytics_service(conn)
        await service.refresh_materialized_view()
        return RefreshResponse(
            success=True,
            message="Analytics data refreshed successfully",
            status="success",
        )
    except Exception as e:
        return RefreshResponse(success=False, message=str(e), status="error")
