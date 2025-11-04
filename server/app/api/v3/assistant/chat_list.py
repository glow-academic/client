"""Assistant chats list endpoint - GET /assistant/chats/list/{profile_id}"""

from typing import Annotated, Any
from uuid import UUID

import asyncpg  # type: ignore
from app.db import get_db
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

router = APIRouter()


class AssistantChatListResponse(BaseModel):
    """Response schema for assistant chats list."""

    allChats: list[dict[str, Any]]


@router.get("/chats/list/{profile_id}")
async def get_assistant_chats_list(
    profile_id: UUID,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> AssistantChatListResponse:
    """Get all chats for a profile (for new chat state without chat_id)."""
    try:
        profile_id_str = str(profile_id)

        # Get all chats for this profile
        all_chats_sql = load_sql("sql/v3/assistant/get_all_chats.sql")
        all_chats_result = await conn.fetch(all_chats_sql, profile_id_str)
        all_chats = [
            {
                "id": str(row["id"]),
                "createdAt": row["created_at"].isoformat(),
                "updatedAt": row["updated_at"].isoformat(),
                "profileId": str(row["profile_id"]),
                "title": row["title"],
                "traceId": row["trace_id"],
            }
            for row in all_chats_result
        ]

        return AssistantChatListResponse(allChats=all_chats)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

