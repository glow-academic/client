"""Session export endpoint — composable infra architecture."""

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel
from redis.asyncio import Redis

from app.infra.globals import get_db, get_redis_client
from app.infra.session_export import export_session_client
from app.routes.v5.api.main.session.types import ExportSessionApiResponse

router = APIRouter()


class ExportSessionApiRequest(BaseModel):
    target_session_id: UUID


@router.post("/export", response_model=ExportSessionApiResponse)
async def export_session(
    body: ExportSessionApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis_client)],
) -> ExportSessionApiResponse:
    """Export session data as a clean, denormalized ZIP."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id

    return await export_session_client(
        conn,
        redis,
        profile_id=profile_id,
        session_id=session_id,
        target_session_id=body.target_session_id,
    )
