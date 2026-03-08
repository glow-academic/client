"""Chat export endpoint — composable infra architecture."""

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel
from redis.asyncio import Redis

from app.infra.chat_export import export_chat_client
from app.infra.globals import get_db, get_redis_client
from app.routes.v5.api.main.chat.types import ExportChatApiResponse

router = APIRouter()


class ExportChatApiRequest(BaseModel):
    """Request model for chat export."""

    chat_entry_id: UUID
    group_id: UUID
    attempt_id: UUID | None = None
    draft_id: UUID | None = None


@router.post("/export", response_model=ExportChatApiResponse)
async def export_chat(
    body: ExportChatApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis_client)],
) -> ExportChatApiResponse:
    """Export a single chat as a clean, denormalized CSV."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id

    return await export_chat_client(
        conn,
        redis,
        profile_id=profile_id,
        session_id=session_id,
        chat_entry_id=body.chat_entry_id,
        group_id=body.group_id,
        attempt_id=body.attempt_id,
        draft_id=body.draft_id,
    )
