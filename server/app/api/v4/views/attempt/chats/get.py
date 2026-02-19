"""Get endpoint for attempt chats view — thin router over entries canonical function."""

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from app.api.v4.entries.attempt.get import ChatViewItem, get_attempt_chats_internal
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db

router = APIRouter()


class GetChatsRequest(BaseModel):
    """Request for getting chat data."""

    attempt_id: UUID = Field(description="Attempt ID to fetch chats for")


class GetChatsResponse(BaseModel):
    """Response containing chat data."""

    items: list[ChatViewItem] = Field(
        default_factory=list, description="Chat data items"
    )


@router.post(
    "/get",
    response_model=GetChatsResponse,
    dependencies=[
        audit_activity(
            "views.attempt.chats.get",
            "{{ actor.name }} fetched attempt chat data",
        )
    ],
)
async def get_chats(
    request: GetChatsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetChatsResponse:
    """Get attempt chat data from the materialized view."""
    tags = ["views", "attempt", "chats"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_attempt_chats_internal(
            conn=conn,
            attempt_id=request.attempt_id,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetChatsResponse(items=items)

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="views_attempt_chats_get",
            request=http_request,
        )
