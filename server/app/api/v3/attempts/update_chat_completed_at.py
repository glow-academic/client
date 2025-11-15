"""Update chat completed_at endpoint."""

from datetime import datetime
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql

# Inline request/response schemas
class UpdateChatCompletedAtRequest(BaseModel):
    chatId: str
    completedAt: str


class UpdateChatTimestampResponse(BaseModel):
    success: bool
    message: str


router = APIRouter()


@router.post("/chats/update-completed-at", response_model=UpdateChatTimestampResponse)
async def update_chat_completed_at(
    request: UpdateChatCompletedAtRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateChatTimestampResponse:
    """Update simulation chat completedAt timestamp."""
    tags = ["attempts"]  # From router tags
    
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        # Parse ISO string to datetime
        completed_at = datetime.fromisoformat(request.completedAt.replace("Z", "+00:00"))

        # Update the completedAt timestamp with existence check in a single SQL file
        sql_query = load_sql("sql/v3/attempts/update_chat_completed_at_complete.sql")
        sql_params = (completed_at, request.chatId)
        result = await conn.fetchrow(sql_query, completed_at, request.chatId)

        if not result:
            raise HTTPException(status_code=404, detail=f"Chat not found: {request.chatId}")

        result_data = UpdateChatTimestampResponse(
            success=True,
            message=f"Chat {request.chatId} completedAt updated successfully",
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
            operation="update_chat_completed_at",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

