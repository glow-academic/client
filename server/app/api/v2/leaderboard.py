"""Leaderboard bundle API endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.schemas.analytics import AnalyticsFilters
from app.schemas.leaderboard import LeaderboardBundleResponse
from app.services.leaderboard_service import LeaderboardService
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


@router.post("", response_model=LeaderboardBundleResponse)
async def get_leaderboard(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> LeaderboardBundleResponse:
    """Get leaderboard bundle with all metrics and profile data."""
    try:
        service = LeaderboardService(conn)
        return await service.get_leaderboard_bundle(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

