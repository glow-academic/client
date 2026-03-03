"""Request Limits SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db
from app.sql.types import (
    QGetRequestLimitsV4Item,
    SearchRequestLimitsApiRequest,
    SearchRequestLimitsApiResponse,
    SearchRequestLimitsSqlParams,
    SearchRequestLimitsSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/queries/resources/request_limits/search_request_limits_complete.sql"
)

router = APIRouter()


async def search_request_limits_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    exclude_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    profile: bool = False,
) -> list[QGetRequestLimitsV4Item]:
    """Internal function to search request limits."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "request_limits"]
    cache_key_val = cache_key(
        "/api/v5/resources/request_limits/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "profile": profile,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetRequestLimitsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = SearchRequestLimitsSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        exclude_ids=exclude_ids or [],
        profile=profile,
    )
    result = cast(
        SearchRequestLimitsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetRequestLimitsV4Item] = (
        result.items if result and result.items else []
    )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items


# =============================================================================
# HTTP Endpoint
# =============================================================================


@router.post(
    "/request_limits/search",
    response_model=SearchRequestLimitsApiResponse,
)
async def search_request_limits(
    request: SearchRequestLimitsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchRequestLimitsApiResponse:
    """Search request_limits resources."""
    tags = ["resources", "request_limits"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_request_limits_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            request.exclude_ids,
            bypass_cache,
            profile=request.profile or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchRequestLimitsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_request_limits",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
