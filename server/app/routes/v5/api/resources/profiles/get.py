"""Profiles get endpoint - v4 API.

Provides batch get endpoint for fetching profiles by IDs.
"""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db
from app.sql.types import (
    GetProfilesApiRequest,
    GetProfilesApiResponse,
    GetProfilesSqlParams,
    GetProfilesSqlRow,
    QGetProfilesV4Item,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/profiles/get_profiles_complete.sql"

router = APIRouter()

# =============================================================================
# Internal Functions
# =============================================================================


async def get_profiles_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetProfilesV4Item]:
    """Internal function for batch fetching profiles by IDs.

    Args:
        conn: Database connection
        ids: List of profile IDs to fetch
        bypass_cache: Whether to bypass cache

    Returns:
        List of profile items
    """
    if not ids:
        return []

    tags = ["resources", "profiles"]
    cache_key_val = cache_key(
        "/api/v5/resources/profiles/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetProfilesV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = GetProfilesSqlParams(p_ids=ids)
    result = cast(
        GetProfilesSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetProfilesV4Item] = result.items if result and result.items else []

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
    "/profiles/get",
    response_model=GetProfilesApiResponse,
)
async def get_profiles(
    request: GetProfilesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetProfilesApiResponse:
    """Get profiles resources by IDs.

    HTTP wrapper that delegates to internal function for caching and data fetching.
    """
    tags = ["resources", "profiles"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_profiles_internal(conn, request.p_ids or [], bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetProfilesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_profiles",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
