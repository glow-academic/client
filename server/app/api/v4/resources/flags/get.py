"""Flags GET endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetFlagsApiRequest,
    GetFlagsApiResponse,
    GetFlagsSqlParams,
    GetFlagsSqlRow,
    QGetFlagsV4Item,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed
from fastapi import APIRouter, Depends, HTTPException, Request, Response

# Load SQL with types at module level
SQL_PATH = "app/sql/v4/queries/resources/flags/get_flags_complete.sql"


router = APIRouter()


async def get_flags_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    search: str | None = None,
    bypass_cache: bool = False,
) -> list[QGetFlagsV4Item]:
    """Internal function to fetch flags by IDs.

    Can be called directly from other routes without HTTP overhead.
    """
    if not ids:
        return []

    tags = ["resources", "flags"]
    cache_key_val = cache_key(
        "/api/v4/resources/flags/get",
        {"ids": [str(id) for id in ids], "search": search},
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [QGetFlagsV4Item.model_validate(item) for item in cached.get("items", [])]

    # Execute SQL
    params = GetFlagsSqlParams(ids=ids, search=search)
    result = cast(
        GetFlagsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetFlagsV4Item] = result.items if result and result.items else []

    # Cache result
    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items


@router.post(
    "/flags/get",
    response_model=GetFlagsApiResponse,
)
async def get_flags(
    request: GetFlagsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetFlagsApiResponse:
    """Get flags resources by IDs."""
    tags = ["resources", "flags"]

    # Check for cache bypass header
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return GetFlagsApiResponse.model_validate(cached)

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Execute SQL
        params = GetFlagsSqlParams(ids=request.ids, search=request.search)
        sql_params = params.to_tuple()

        result = cast(
            GetFlagsSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        items = result.items if result and result.items else []

        response_data = GetFlagsApiResponse(items=items)

        # Cache response
        await set_cached(
            cache_key_val,
            response_data.model_dump(mode="json"),
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return response_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_flags",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
