"""Assistant chats list endpoint - POST /assistant/chats/list"""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.error.handle_route_error import handle_route_error
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

router = APIRouter()


class AssistantChatListRequest(BaseModel):
    """Request schema for assistant chats list."""

    profileId: str


class AssistantChatListResponse(BaseModel):
    """Response schema for assistant chats list."""

    allChats: list[dict[str, Any]]


@router.post("/chats/list", response_model=AssistantChatListResponse)
async def get_assistant_chats_list(
    request_body: AssistantChatListRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> AssistantChatListResponse:
    """Get all chats for a profile (for new chat state without chat_id)."""
    tags = ["assistant"]  # From router tags

    # Generate cache key from path and body
    body_dict = request_body.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return AssistantChatListResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id_str = request_body.profileId

        # Get all chats for this profile
        sql_query = load_sql("sql/v3/assistant/get_all_chats.sql")
        sql_params = (profile_id_str,)
        all_chats_result = await conn.fetch(sql_query, profile_id_str)
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
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_assistant_chats_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
