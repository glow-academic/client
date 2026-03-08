"""Provider export endpoint — composable infra architecture."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response
from redis.asyncio import Redis

from app.infra.globals import get_db, get_redis
from app.infra.provider_export import export_provider_client
from app.routes.v5.api.main.provider.types import ExportProviderApiResponse

router = APIRouter()


@router.post("/export", response_model=ExportProviderApiResponse)
async def export_providers(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis)],
) -> ExportProviderApiResponse:
    """Export all providers as a clean, denormalized CSV."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id

    return await export_provider_client(
        conn,
        redis,
        profile_id=profile_id,
        session_id=session_id,
    )
