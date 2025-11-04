"""Update chat created_at endpoint."""

from datetime import datetime
from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db
from app.utils.sql_helper import load_sql

# Inline request/response schemas
class UpdateChatCreatedAtRequest(BaseModel):
    chatId: str
    createdAt: str


class UpdateChatTimestampResponse(BaseModel):
    success: bool
    message: str


router = APIRouter()


@router.post("/chats/update-created-at")
async def update_chat_created_at(
    request: UpdateChatCreatedAtRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateChatTimestampResponse:
    """Update simulation chat createdAt timestamp."""
    try:
        # Parse ISO string to datetime
        created_at = datetime.fromisoformat(request.createdAt.replace("Z", "+00:00"))

        # Update the createdAt timestamp
        sql = load_sql("sql/v3/attempts/update_chat_created_at.sql")
        result = await conn.execute(sql, created_at, request.chatId)

        if result == "UPDATE 0":
            raise HTTPException(status_code=404, detail=f"Chat not found: {request.chatId}")

        return UpdateChatTimestampResponse(
            success=True,
            message=f"Chat {request.chatId} createdAt updated successfully",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

