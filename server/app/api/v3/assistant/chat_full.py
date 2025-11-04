"""Assistant chat full data endpoint - GET /assistant/chats/{chat_id}/full"""

from typing import Annotated, Any
from uuid import UUID

import asyncpg  # type: ignore
from app.db import get_db
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

router = APIRouter()


class AssistantChatFullResponse(BaseModel):
    """Response schema for assistant chat full data."""

    chat: dict[str, Any] | None
    messages: list[dict[str, Any]]
    toolCalls: list[dict[str, Any]]
    allChats: list[dict[str, Any]]


@router.get("/chats/{chat_id}/full")
async def get_assistant_chat_full(
    chat_id: UUID,
    profile_id: Annotated[UUID, Query()],
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> AssistantChatFullResponse:
    """Get complete assistant chat data with all related entities."""
    try:
        chat_id_str = str(chat_id)
        profile_id_str = str(profile_id)

        result: dict[str, Any] = {
            "chat": None,
            "messages": [],
            "toolCalls": [],
            "allChats": [],
        }

        # 1. Get all chats for this profile (for dropdown)
        all_chats_sql = load_sql("sql/v3/assistant/get_all_chats.sql")
        all_chats_result = await conn.fetch(all_chats_sql, profile_id_str)
        result["allChats"] = [
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

        # 2. Get specific chat details
        chat_sql = load_sql("sql/v3/assistant/get_chat.sql")
        chat_result = await conn.fetchrow(chat_sql, chat_id_str)
        if not chat_result:
            raise HTTPException(status_code=404, detail=f"Assistant chat {chat_id} not found")

        result["chat"] = {
            "id": str(chat_result["id"]),
            "createdAt": chat_result["created_at"].isoformat(),
            "updatedAt": chat_result["updated_at"].isoformat(),
            "profileId": str(chat_result["profile_id"]),
            "title": chat_result["title"],
            "traceId": chat_result["trace_id"],
        }

        # 3. Get all messages for this chat
        messages_sql = load_sql("sql/v3/assistant/get_chat_messages.sql")
        messages_result = await conn.fetch(messages_sql, chat_id_str)
        result["messages"] = [
            {
                "id": str(row["id"]),
                "createdAt": row["created_at"].isoformat(),
                "updatedAt": row["updated_at"].isoformat(),
                "chatId": str(row["chat_id"]),
                "role": row["role"],
                "content": row["content"],
                "completed": row["completed"],
            }
            for row in messages_result
        ]

        # 4. Get all tool calls for this chat
        tool_calls_sql = load_sql("sql/v3/assistant/get_chat_tool_calls.sql")
        tool_calls_result = await conn.fetch(tool_calls_sql, chat_id_str)
        result["toolCalls"] = [
            {
                "id": str(row["id"]),
                "createdAt": row["created_at"].isoformat(),
                "updatedAt": row["updated_at"].isoformat(),
                "chatId": str(row["chat_id"]),
                "toolName": row["tool_name"],
                "toolType": row["tool_type"],
                "toolArguments": row["tool_arguments"],
                "toolResult": row["tool_result"],
                "completed": row["completed"],
            }
            for row in tool_calls_result
        ]

        return AssistantChatFullResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

