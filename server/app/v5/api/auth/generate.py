"""Generate messages endpoint — returns paginated messages for a group."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.v5.api.auth.types import GetGroupMessagesApiResponse, GroupMessageItem
from app.v5.infra.error.handle_route_error import handle_route_error
from app.main import get_db
from app.v5.sql.types import GetAuthGroupMessagesSqlParams, GetAuthGroupMessagesSqlRow
from app.v5.utils.sql_helper import execute_sql_typed

router = APIRouter()

SQL_PATH = "app/v5/sql/queries/auth/group/get_auth_group_messages_complete.sql"


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
        params = GetAuthGroupMessagesSqlParams(
            group_id_param=request.group_id,
            page_limit_val=request.page_limit,
            page_offset_val=request.page_offset,
        )
        result: GetAuthGroupMessagesSqlRow = await execute_sql_typed(
            conn, SQL_PATH, params=params
        )

        if not result or not result.items:
            return GetGroupMessagesApiResponse()

        item = result.items[0]

        messages = [
            GroupMessageItem(
                message_id=str(m.message_id) if m.message_id else None,
                run_id=str(m.run_id) if m.run_id else None,
                role=m.role,
                message_created_at=m.message_created_at.isoformat()
                if m.message_created_at
                else None,
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
            for m in (item.messages or [])
        ]

        return GetGroupMessagesApiResponse(
            group_id=str(item.group_id) if item.group_id else None,
            group_name=item.group_name,
            group_created_at=item.group_created_at.isoformat()
            if item.group_created_at
            else None,
            session_id=str(item.session_id) if item.session_id else None,
            messages=messages,
            total_message_count=item.total_message_count or 0,
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
