"""Assistant chats list endpoint - GET /assistant/chats/list/{profile_id}"""

from typing import Annotated, Any
from uuid import UUID

import asyncpg  # type: ignore
from app.db import get_db
from app.utils.http_cache import cache_key, get_cached, set_cached
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

router = APIRouter()


class AssistantChatListResponse(BaseModel):
    """Response schema for assistant chats list."""

    allChats: list[dict[str, Any]]


@router.get("/chats/list/{profile_id}", response_model=AssistantChatListResponse)
async def get_assistant_chats_list(
    profile_id: UUID,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> AssistantChatListResponse:
    """Get all chats for a profile (for new chat state without chat_id)."""
    tags = ["assistant"]  # From router tags
    
    # Generate cache key from path and parameters
    body_dict = {"profile_id": str(profile_id)}
    cache_key_val = cache_key(request.url.path, body_dict)
    
    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return AssistantChatListResponse.model_validate(cached["data"])
    
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

        response_data = AssistantChatListResponse(allChats=all_chats)
        
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

