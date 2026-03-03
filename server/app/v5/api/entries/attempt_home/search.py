"""Attempt Home entry SEARCH endpoint."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.infra.error.handle_route_error import handle_route_error
from app.main import get_db
from app.v5.sql.types import (
    SearchAttemptHomeEntriesApiRequest,
    SearchAttemptHomeEntriesApiResponse,
    SearchAttemptHomeEntriesSqlParams,
    SearchAttemptHomeEntriesSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/v5/sql/queries/entries/attempt_home/search_attempt_home_entries_complete.sql"
)

router = APIRouter()


async def search_attempt_home_entries_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    attempt_id: UUID | None = None,
    home_id: UUID | None = None,
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to search attempt_home entries."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["entries", "attempt_home"]
    cache_key_val = cache_key(
        "/api/v5/entries/attempt_home/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "attempt_id": str(attempt_id) if attempt_id else None,
            "home_id": str(home_id) if home_id else None,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = SearchAttemptHomeEntriesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        attempt_id=attempt_id,
        home_id=home_id,
    )
    result = cast(
        SearchAttemptHomeEntriesSqlRow,
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
    "/attempt-home/search",
    response_model=SearchAttemptHomeEntriesApiResponse,
)
async def search_attempt_home_entries(
    request: SearchAttemptHomeEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchAttemptHomeEntriesApiResponse:
    """Search attempt_home entries."""
    tags = ["entries", "attempt_home"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_attempt_home_entries_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            attempt_id=request.attempt_id,
            home_id=request.home_id,
            bypass_cache=bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchAttemptHomeEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_attempt_home_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
