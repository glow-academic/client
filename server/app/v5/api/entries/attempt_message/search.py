"""Attempt Message entry SEARCH endpoint."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.infra.error.handle_route_error import handle_route_error
from app.main import get_db
from app.v5.sql.types import (
    SearchAttemptMessageEntriesApiRequest,
    SearchAttemptMessageEntriesApiResponse,
    SearchAttemptMessageEntriesSqlParams,
    SearchAttemptMessageEntriesSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/v5/sql/queries/entries/attempt_message/search_attempt_message_entries_complete.sql"

router = APIRouter()


async def search_attempt_message_entries_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    chat_id: UUID | None = None,
    attempt_id: UUID | None = None,
    runs_id: UUID | None = None,
    text_id: UUID | None = None,
    audio_id: UUID | None = None,
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to search attempt_message entries."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["entries", "attempt_message"]
    cache_key_val = cache_key(
        "/api/v5/entries/attempt_message/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "chat_id": str(chat_id) if chat_id else None,
            "attempt_id": str(attempt_id) if attempt_id else None,
            "runs_id": str(runs_id) if runs_id else None,
            "text_id": str(text_id) if text_id else None,
            "audio_id": str(audio_id) if audio_id else None,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = SearchAttemptMessageEntriesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        chat_id=chat_id,
        attempt_id=attempt_id,
        runs_id=runs_id,
        text_id=text_id,
        audio_id=audio_id,
    )
    result = cast(
        SearchAttemptMessageEntriesSqlRow,
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
    "/attempt_message/search",
    response_model=SearchAttemptMessageEntriesApiResponse,
)
async def search_attempt_message_entries(
    request: SearchAttemptMessageEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchAttemptMessageEntriesApiResponse:
    """Search attempt_message entries."""
    tags = ["entries", "attempt_message"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_attempt_message_entries_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            bypass_cache=bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchAttemptMessageEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_attempt_message_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
