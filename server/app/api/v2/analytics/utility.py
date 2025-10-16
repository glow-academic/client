"""Utility analytics API endpoints."""

from typing import Annotated

from app.db import get_db
from app.repositories.analytics_repository import get_analytics_repository
from app.schemas.analytics import RefreshResponse
from fastapi import APIRouter, Depends, HTTPException
import asyncpg  # type: ignore

router = APIRouter(tags=["analytics-utility"])


@router.post("/refresh", response_model=RefreshResponse)
async def refresh_analytics_view(
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RefreshResponse:
    """Refresh the analytics materialized view."""
    try:
        repo = get_analytics_repository(db)
        repo.refresh_materialized_view()
        return RefreshResponse(
            success=True,
            message="Analytics data refreshed successfully",
            status="success",
        )
    except Exception as e:
        return RefreshResponse(
            success=False, message=str(e), status="error"
        )

