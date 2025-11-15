"""Assistant chat full data endpoint - POST /assistant/chats/full"""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.error.handle_route_error import handle_route_error
from app.utils.cache.cache_key import cache_key, get_cached, set_cached
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

router = APIRouter()


class AssistantChatFullRequest(BaseModel):
    """Request schema for assistant chat full data."""

    chatId: str
    profileId: str


class AssistantChatFullResponse(BaseModel):
    """Response schema for assistant chat full data."""

    chat: dict[str, Any] | None
    messages: list[dict[str, Any]]
    toolCalls: list[dict[str, Any]]
    allChats: list[dict[str, Any]]


@router.post("/chats/full", response_model=AssistantChatFullResponse)
async def get_assistant_chat_full(
    request_body: AssistantChatFullRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> AssistantChatFullResponse:
    """Get complete assistant chat data with all related entities."""
    tags = ["assistant"]  # From router tags

    # Generate cache key from path and body
    body_dict = request_body.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return AssistantChatFullResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        chat_id_str = request_body.chatId
        profile_id_str = request_body.profileId

        # Get complete chat data in a single SQL query
        sql_query = load_sql("sql/v3/assistant/get_chat_full_complete.sql")
        sql_params = (chat_id_str, profile_id_str)
        result_row = await conn.fetchrow(sql_query, chat_id_str, profile_id_str)

        if not result_row or not result_row["chat"]:
            raise HTTPException(
                status_code=404, detail=f"Assistant chat {chat_id_str} not found"
            )

        # Parse JSONB data from SQL (asyncpg returns JSONB as dict/list, but handle string case for safety)
        def parse_jsonb(data: Any) -> Any:
            if isinstance(data, str):
                return json.loads(data)
            return data

        chat_data = parse_jsonb(result_row["chat"])
        if not chat_data:
            raise HTTPException(
                status_code=404, detail=f"Assistant chat {chat_id_str} not found"
            )

        all_chats_data = parse_jsonb(result_row["all_chats"]) or []
        messages_data = parse_jsonb(result_row["messages"]) or []
        tool_calls_data = parse_jsonb(result_row["tool_calls"]) or []

        # Format chat data (JSONB timestamps are already ISO format strings)
        result: dict[str, Any] = {
            "chat": {
                "id": str(chat_data["id"]),
                "createdAt": str(chat_data["created_at"]),
                "updatedAt": str(chat_data["updated_at"]),
                "profileId": str(chat_data["profile_id"]),
                "title": str(chat_data["title"]),
                "traceId": str(chat_data.get("trace_id", ""))
                if chat_data.get("trace_id")
                else None,
            },
            "allChats": [
                {
                    "id": str(chat["id"]),
                    "createdAt": str(chat["created_at"]),
                    "updatedAt": str(chat["updated_at"]),
                    "profileId": str(chat["profile_id"]),
                    "title": str(chat["title"]),
                    "traceId": str(chat.get("trace_id", ""))
                    if chat.get("trace_id")
                    else None,
                }
                for chat in all_chats_data
            ],
            "messages": [
                {
                    "id": str(msg["id"]),
                    "createdAt": str(msg["created_at"]),
                    "updatedAt": str(msg["updated_at"]),
                    "chatId": str(msg["chat_id"]),
                    "role": str(msg["role"]),
                    "content": str(msg["content"]),
                    "completed": bool(msg["completed"]),
                }
                for msg in messages_data
            ],
            "toolCalls": [
                {
                    "id": str(tc["id"]),
                    "createdAt": str(tc["created_at"]),
                    "updatedAt": str(tc["updated_at"]),
                    "chatId": str(tc["chat_id"]),
                    "toolName": str(tc["tool_name"]),
                    "toolType": str(tc["tool_type"]),
                    "toolArguments": tc["tool_arguments"],
                    "toolResult": tc["tool_result"],
                    "completed": bool(tc["completed"]),
                }
                for tc in tool_calls_data
            ],
        }

        response_data = AssistantChatFullResponse(**result)

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump()},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return response_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_assistant_chat_full",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
