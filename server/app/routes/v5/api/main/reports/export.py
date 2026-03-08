"""Reports export endpoint — composable infra architecture."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response
from redis.asyncio import Redis

from app.infra.globals import get_db, get_redis_client
from app.infra.reports_export import export_reports_client
from app.routes.v5.api.main.reports.types import ExportReportsApiResponse

router = APIRouter(tags=["reports"])


@router.post("/export", response_model=ExportReportsApiResponse)
async def export_reports(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis_client)],
) -> ExportReportsApiResponse:
    """Export all reports data as a clean, denormalized ZIP."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id

    return await export_reports_client(
        conn,
        redis,
        profile_id=profile_id,
        session_id=session_id,
    )
