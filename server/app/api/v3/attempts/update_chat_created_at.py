"""Update chat created_at endpoint."""

from datetime import datetime
from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from app.db import get_db
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql

# Inline request/response schemas
class UpdateChatCreatedAtRequest(BaseModel):
    chatId: str
    createdAt: str


class UpdateChatTimestampResponse(BaseModel):
    success: bool
    message: str


router = APIRouter()


@router.post("/chats/update-created-at", response_model=UpdateChatTimestampResponse)
async def update_chat_created_at(
    request: UpdateChatCreatedAtRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateChatTimestampResponse:
    """Update simulation chat createdAt timestamp."""
    tags = ["attempts"]  # From router tags
    
    try:
        # Parse ISO string to datetime
        created_at = datetime.fromisoformat(request.createdAt.replace("Z", "+00:00"))

        # Update the createdAt timestamp with existence check in a single SQL file
        sql = load_sql("sql/v3/attempts/update_chat_created_at_complete.sql")
        result = await conn.fetchrow(sql, created_at, request.chatId)

        if not result:
            raise HTTPException(status_code=404, detail=f"Chat not found: {request.chatId}")

        result_data = UpdateChatTimestampResponse(
            success=True,
            message=f"Chat {request.chatId} createdAt updated successfully",
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

