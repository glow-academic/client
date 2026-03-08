"""Generate messages endpoint — thin route, delegates to infra."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.infra.auth.generate import resolve_group_messages
from app.infra.globals import get_db
from app.routes.auth.types import GetGroupMessagesApiResponse, GroupMessageItem
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


class GetGroupMessagesApiRequest(BaseModel):
    """Request body for /auth/generate endpoint."""

    group_id: UUID
    page_limit: int = 50
    page_offset: int = 0


@router.post("/generate", response_model=GetGroupMessagesApiResponse)
async def get_group_messages(
    request: GetGroupMessagesApiRequest,
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetGroupMessagesApiResponse:
    """Return paginated messages for a specific group."""
    try:
        result = await resolve_group_messages(
            conn,
            group_id=request.group_id,
            page_limit=request.page_limit,
            page_offset=request.page_offset,
        )

        if not result:
            return GetGroupMessagesApiResponse()

        messages = [
            GroupMessageItem(
                message_id=str(m.message_id),
                run_id=str(m.run_id),
                role=m.role,
                message_created_at=m.message_created_at.isoformat(),
                text_upload_ids=[str(u) for u in m.text_upload_ids]
                if m.text_upload_ids
                else None,
                audio_upload_ids=[str(u) for u in m.audio_upload_ids]
                if m.audio_upload_ids
                else None,
                image_upload_ids=[str(u) for u in m.image_upload_ids]
                if m.image_upload_ids
                else None,
                video_upload_ids=[str(u) for u in m.video_upload_ids]
                if m.video_upload_ids
                else None,
                file_upload_ids=[str(u) for u in m.file_upload_ids]
                if m.file_upload_ids
                else None,
                call_upload_ids=[str(u) for u in m.call_upload_ids]
                if m.call_upload_ids
                else None,
            )
            for m in result.messages
        ]

        return GetGroupMessagesApiResponse(
            group_id=str(result.group_id),
            group_name=result.group_name,
            group_created_at=result.group_created_at.isoformat(),
            session_id=str(result.session_id),
            messages=messages,
            total_message_count=result.total_message_count,
        )

    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_group_messages",
            request=http_request,
        )
