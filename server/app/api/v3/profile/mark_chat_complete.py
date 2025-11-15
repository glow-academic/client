"""Profile mark chat complete endpoint - mark viewedChat as complete."""

from typing import Annotated, Any

import asyncpg
from app.main import get_db
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

router = APIRouter()


class MarkChatCompleteRequest(BaseModel):
    """Request to mark chat tour step as complete."""

    profileId: str


class MarkTourStepResponse(BaseModel):
    """Response from marking a tour step complete."""

    success: bool
    message: str


@router.post("/mark-chat-complete", response_model=MarkTourStepResponse)
async def mark_chat_complete(
    request: MarkChatCompleteRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> MarkTourStepResponse:
    """Mark chat tour step as complete."""
    tags = ["profile"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Mark chat complete with existence check in a single SQL file
        sql_query = load_sql("sql/v3/profile/mark_chat_complete.sql")
        sql_params = (request.profileId,)
        result = await conn.fetchrow(sql_query, request.profileId)

        if not result:
            raise HTTPException(status_code=404, detail="Profile not found")

        profile_id = result["profile_id"]
        result_data = MarkTourStepResponse(
            success=True,
            message=f"Profile {profile_id} chat marked complete",
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return result_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="mark_chat_complete",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
