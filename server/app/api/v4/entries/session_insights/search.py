"""Session Insights entry SEARCH endpoint."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    SearchSessionInsightsEntriesApiRequest,
    SearchSessionInsightsEntriesApiResponse,
    SearchSessionInsightsEntriesSqlParams,
    SearchSessionInsightsEntriesSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/session_insights/search_session_insights_entries_complete.sql"

router = APIRouter()


async def search_session_insights_entries_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    group_id: UUID | None = None,
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to search session_insights entries."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["entries", "session_insights"]
    cache_key_val = cache_key(
        "/api/v4/entries/session_insights/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "group_id": str(group_id) if group_id else None,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = SearchSessionInsightsEntriesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        group_id=group_id,
    )
    result = cast(
        SearchSessionInsightsEntriesSqlRow,
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
    "/session_insights/search",
    response_model=SearchSessionInsightsEntriesApiResponse,
)
async def search_session_insights_entries(
    request: SearchSessionInsightsEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchSessionInsightsEntriesApiResponse:
    """Search session_insights entries."""
    tags = ["entries", "session_insights"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_session_insights_entries_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            bypass_cache=bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchSessionInsightsEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_session_insights_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
