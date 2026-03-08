"""Profile export endpoint — composable infra architecture."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response
from redis.asyncio import Redis

from app.infra.globals import get_db, get_redis
from app.infra.profile_export import export_profile_client
from app.routes.v5.api.main.profile.types import ExportProfileApiResponse

router = APIRouter()


@router.post("/export", response_model=ExportProfileApiResponse)
async def export_profiles(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis)],
) -> ExportProfileApiResponse:
    """Export all profiles as a clean, denormalized CSV."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id

    return await export_profile_client(
        conn,
        redis,
        profile_id=profile_id,
        session_id=session_id,
    )
