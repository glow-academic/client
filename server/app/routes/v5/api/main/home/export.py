"""Home export endpoint — composable infra architecture."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response
from redis.asyncio import Redis

from app.infra.globals import get_db, get_redis_client
from app.infra.home_export import export_home_client
from app.routes.v5.api.main.home.types import ExportHomeApiResponse

router = APIRouter()


@router.post("/export", response_model=ExportHomeApiResponse)
async def export_home(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis_client)],
) -> ExportHomeApiResponse:
    """Export all home data as a clean, denormalized ZIP with certificate."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id

    return await export_home_client(
        conn, redis, profile_id=profile_id, session_id=session_id,
    )
