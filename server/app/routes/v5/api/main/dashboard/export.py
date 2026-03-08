"""Dashboard export endpoint — composable infra architecture."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response
from redis.asyncio import Redis

from app.infra.dashboard_export import export_dashboard_client
from app.infra.globals import get_db, get_redis
from app.routes.v5.api.main.dashboard.types import ExportDashboardApiResponse

router = APIRouter()


@router.post("/export", response_model=ExportDashboardApiResponse)
async def export_dashboard(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis)],
) -> ExportDashboardApiResponse:
    """Export all dashboard data as a clean, denormalized ZIP."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id

    return await export_dashboard_client(
        conn,
        redis,
        profile_id=profile_id,
        session_id=session_id,
    )
