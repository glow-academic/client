"""Generate messages endpoint — returns paginated messages for a group."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.api.v4.auth.types import GetGroupMessagesApiResponse, GroupMessageItem
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_pool

router = APIRouter()


class GetGroupMessagesApiRequest(BaseModel):
    """Request body for /auth/generate endpoint."""

    group_id: UUID
    page_limit: int = 50
    page_offset: int = 0


def _convert_message(msg: Any) -> GroupMessageItem:
    """Convert a SQL row/dict to the API message format."""
    if isinstance(msg, dict):
        created_at_raw = msg.get("message_created_at")
        return GroupMessageItem(
            message_id=str(msg["message_id"]) if msg.get("message_id") else None,
            run_id=str(msg["run_id"]) if msg.get("run_id") else None,
            role=msg.get("role"),
            message_created_at=created_at_raw.isoformat()
            if hasattr(created_at_raw, "isoformat")
            else str(created_at_raw)
            if created_at_raw
            else None,
            contents=msg.get("contents"),
        )
    # Attribute-style (Record) access
    created_at_raw = getattr(msg, "message_created_at", None)
    return GroupMessageItem(
        message_id=str(msg.message_id) if getattr(msg, "message_id", None) else None,
        run_id=str(msg.run_id) if getattr(msg, "run_id", None) else None,
        role=getattr(msg, "role", None),
        message_created_at=created_at_raw.isoformat()
        if hasattr(created_at_raw, "isoformat")
        else str(created_at_raw)
        if created_at_raw
        else None,
        contents=getattr(msg, "contents", None),
    )


@router.post("/generate", response_model=GetGroupMessagesApiResponse)
async def get_group_messages(
    request: GetGroupMessagesApiRequest,
    http_request: Request,
) -> GetGroupMessagesApiResponse:
    """Return paginated messages for a specific group."""
    try:
        pool = get_pool()
        if not pool:
            raise HTTPException(status_code=500, detail="Database pool not available")

        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM api_get_auth_group_messages_v4($1, $2, $3)",
                request.group_id,
                request.page_limit,
                request.page_offset,
            )

        if not row or not row["items"]:
            return GetGroupMessagesApiResponse()

        items = row["items"]
        if not items:
            return GetGroupMessagesApiResponse()

        # Extract the first (only) item from the array
        item = items[0]

        messages_raw = (
            item.get("messages", [])
            if isinstance(item, dict)
            else getattr(item, "messages", [])
        )
        messages = [_convert_message(m) for m in (messages_raw or [])]

        if isinstance(item, dict):
            group_created_at_raw = item.get("group_created_at")
            return GetGroupMessagesApiResponse(
                group_id=str(item["group_id"]) if item.get("group_id") else None,
                group_name=item.get("group_name"),
                group_created_at=group_created_at_raw.isoformat()
                if hasattr(group_created_at_raw, "isoformat")
                else str(group_created_at_raw)
                if group_created_at_raw
                else None,
                session_id=str(item["session_id"]) if item.get("session_id") else None,
                messages=messages,
                total_message_count=item.get("total_message_count", 0),
            )

        # Attribute-style
        group_created_at_raw = getattr(item, "group_created_at", None)
        return GetGroupMessagesApiResponse(
            group_id=str(item.group_id) if getattr(item, "group_id", None) else None,
            group_name=getattr(item, "group_name", None),
            group_created_at=group_created_at_raw.isoformat()
            if hasattr(group_created_at_raw, "isoformat")
            else str(group_created_at_raw)
            if group_created_at_raw
            else None,
            session_id=str(item.session_id)
            if getattr(item, "session_id", None)
            else None,
            messages=messages,
            total_message_count=getattr(item, "total_message_count", 0),
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
