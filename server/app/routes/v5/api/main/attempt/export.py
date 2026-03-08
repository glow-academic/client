"""Attempt export endpoint — composable infra architecture."""

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel
from redis.asyncio import Redis

from app.infra.attempt_export import export_attempt_client
from app.infra.globals import get_db, get_redis_client
from app.routes.v5.api.main.attempt.types import ExportAttemptApiResponse

router = APIRouter()


class ExportAttemptApiRequest(BaseModel):
    attempt_id: UUID


@router.post("/export", response_model=ExportAttemptApiResponse)
async def export_attempt(
    body: ExportAttemptApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis_client)],
) -> ExportAttemptApiResponse:
    """Export attempt data as a clean, denormalized ZIP."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id

    return await export_attempt_client(
        conn,
        redis,
        profile_id=profile_id,
        session_id=session_id,
        attempt_id=body.attempt_id,
    )
