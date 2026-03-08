"""Invocation export endpoint — composable infra architecture."""

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel
from redis.asyncio import Redis

from app.infra.globals import get_db, get_redis
from app.infra.invocation_export import export_invocation_client
from app.routes.v5.api.main.invocation.types import ExportInvocationApiResponse

router = APIRouter()


class ExportInvocationApiRequest(BaseModel):
    """Request model for invocation export."""

    test_id: UUID
    group_id: UUID
    invocation_entry_id: UUID | None = None
    draft_id: UUID | None = None


@router.post("/export", response_model=ExportInvocationApiResponse)
async def export_invocation(
    body: ExportInvocationApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis)],
) -> ExportInvocationApiResponse:
    """Export a single invocation as a clean, denormalized CSV."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id

    return await export_invocation_client(
        conn,
        redis,
        profile_id=profile_id,
        session_id=session_id,
        test_id=body.test_id,
        group_id=body.group_id,
        invocation_entry_id=body.invocation_entry_id,
        draft_id=body.draft_id,
    )
