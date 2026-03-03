"""Calls entry SEARCH endpoint."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.infra.error.handle_route_error import handle_route_error
from app.v5.infra.globals import get_db
from app.v5.sql.types import (
    SearchCallsEntriesApiRequest,
    SearchCallsEntriesApiResponse,
    SearchCallsEntriesSqlParams,
    SearchCallsEntriesSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/v5/sql/queries/entries/calls/search_calls_entries_complete.sql"

router = APIRouter()


async def search_calls_entries_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    run_id: UUID | None = None,
    tool_id: UUID | None = None,
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to search calls entries."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["entries", "calls"]
    cache_key_val = cache_key(
        "/api/v5/entries/calls/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "run_id": str(run_id) if run_id else None,
            "tool_id": str(tool_id) if tool_id else None,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = SearchCallsEntriesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        run_id=run_id,
        tool_id=tool_id,
    )
    result = cast(
        SearchCallsEntriesSqlRow,
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
    "/calls/search",
    response_model=SearchCallsEntriesApiResponse,
)
async def search_calls_entries(
    request: SearchCallsEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchCallsEntriesApiResponse:
    """Search calls entries."""
    tags = ["entries", "calls"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_calls_entries_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            bypass_cache=bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchCallsEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_calls_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
