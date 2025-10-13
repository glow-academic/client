"""Utility analytics API endpoints."""

from typing import Annotated

from app.db import get_session
from app.repositories.analytics_repository import get_analytics_repository
from app.schemas.analytics import RefreshResponse
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter(tags=["analytics-utility"])


@router.post("/refresh", response_model=RefreshResponse)
async def refresh_analytics_view(
    db: Annotated[Session, Depends(get_session)],
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

