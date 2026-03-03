"""Flags GET endpoint - v4 API following DHH principles."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db
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

# Load SQL with types at module level
SQL_PATH = "app/sql/queries/resources/flags/get_flags_complete.sql"

router = APIRouter()


async def get_flags_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetFlagsV4Item]:
    """Internal function to fetch flags by IDs.

    Can be called directly from other routes without HTTP overhead.
    """
    if not ids:
        return []

    tags = ["resources", "flags"]
    cache_key_val = cache_key(
        "/api/v5/resources/flags/get",
        {"ids": [str(id) for id in ids]},
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetFlagsV4Item.model_validate(item) for item in cached.get("items", [])
            ]

    # Execute SQL
    params = GetFlagsSqlParams(ids=ids)
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
    """Get flags resources by IDs.

    HTTP wrapper that delegates to internal function for caching and data fetching.
    """
    tags = ["resources", "flags"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_flags_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetFlagsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_flags",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
