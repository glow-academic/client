"""Problems entry SEARCH endpoint."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db
from app.sql.types import (
    SearchProblemsEntriesApiRequest,
    SearchProblemsEntriesApiResponse,
    SearchProblemsEntriesSqlParams,
    SearchProblemsEntriesSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/problems/search_problems_entries_complete.sql"

router = APIRouter()


async def search_problems_entries_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    session_id: UUID | None = None,
    profile_id: UUID | None = None,
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to search problems entries."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["entries", "problems"]
    cache_key_val = cache_key(
        "/api/v5/entries/problems/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "session_id": str(session_id) if session_id else None,
            "profile_id": str(profile_id) if profile_id else None,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = SearchProblemsEntriesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        session_id=session_id,
        profile_id=profile_id,
    )
    result = cast(
        SearchProblemsEntriesSqlRow,
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
    "/problems/search",
    response_model=SearchProblemsEntriesApiResponse,
)
async def search_problems_entries(
    request: SearchProblemsEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchProblemsEntriesApiResponse:
    """Search problems entries."""
    tags = ["entries", "problems"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_problems_entries_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            bypass_cache=bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchProblemsEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_problems_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
