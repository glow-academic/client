"""Conversations Completions entry GET endpoint."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.utils.error.handle_route_error import handle_route_error
from app.infra.globals import get_db
from app.sql.types import (
    GetConversationsCompletionsEntriesApiRequest,
    GetConversationsCompletionsEntriesApiResponse,
    GetConversationsCompletionsEntriesSqlParams,
    GetConversationsCompletionsEntriesSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/conversations_completions/get_conversations_completions_entries_complete.sql"

router = APIRouter()


async def get_conversations_completions_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch conversations_completions entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "conversations_completions"]
    cache_key_val = cache_key(
        "/api/v5/entries/conversations_completions/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = GetConversationsCompletionsEntriesSqlParams(ids=ids)
    result = cast(
        GetConversationsCompletionsEntriesSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[dict] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": items if isinstance(items, list) else []},
        ttl=60,
        tags=tags,
    )

    return items


@router.post(
    "/conversations_completions/get",
    response_model=GetConversationsCompletionsEntriesApiResponse,
)
async def get_conversations_completions_entries(
    request: GetConversationsCompletionsEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetConversationsCompletionsEntriesApiResponse:
    """Get conversations_completions entries by IDs."""
    tags = ["entries", "conversations_completions"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_conversations_completions_entries_internal(
            conn, request.ids, bypass_cache
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetConversationsCompletionsEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_conversations_completions_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
