"""Field export endpoint — composable infra architecture."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response
from redis.asyncio import Redis

from app.infra.field_export import export_field_client
from app.infra.globals import get_db, get_redis
from app.routes.v5.api.main.field.types import ExportFieldApiResponse

router = APIRouter()


@router.post("/export", response_model=ExportFieldApiResponse)
async def export_fields(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis)],
) -> ExportFieldApiResponse:
    """Export all fields as a clean, denormalized CSV."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id

    return await export_field_client(
        conn,
        redis,
        profile_id=profile_id,
        session_id=session_id,
    )
