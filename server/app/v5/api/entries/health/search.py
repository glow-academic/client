"""Health entry SEARCH endpoint."""

from typing import Annotated, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.infra.error.handle_route_error import handle_route_error
from app.main import get_db
from app.v5.sql.types import (
    SearchHealthEntriesApiRequest,
    SearchHealthEntriesApiResponse,
    SearchHealthEntriesSqlParams,
    SearchHealthEntriesSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/v5/sql/queries/entries/health/search_health_entries_complete.sql"

router = APIRouter()


async def search_health_entries_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to search health entries."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["entries", "health"]
    cache_key_val = cache_key(
        "/api/v5/entries/health/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = SearchHealthEntriesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
    )
    result = cast(
        SearchHealthEntriesSqlRow,
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
    "/health/search",
    response_model=SearchHealthEntriesApiResponse,
)
async def search_health_entries(
    request: SearchHealthEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchHealthEntriesApiResponse:
    """Search health entries."""
    tags = ["entries", "health"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_health_entries_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            bypass_cache=bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchHealthEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_health_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
