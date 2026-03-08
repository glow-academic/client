"""Practice export endpoint — composable infra architecture."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response
from redis.asyncio import Redis

from app.infra.globals import get_db, get_redis
from app.infra.practice_export import export_practice_client
from app.routes.v5.api.main.practice.types import ExportPracticeApiResponse

router = APIRouter()


@router.post("/export", response_model=ExportPracticeApiResponse)
async def export_practice(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis)],
) -> ExportPracticeApiResponse:
    """Export all practice data as a clean, denormalized ZIP."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id

    return await export_practice_client(
        conn,
        redis,
        profile_id=profile_id,
        session_id=session_id,
    )
