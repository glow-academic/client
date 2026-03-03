"""Model flags get endpoint - v4 API.

Provides get endpoint for fetching model flags by resource IDs.
"""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.infra.error.handle_route_error import handle_route_error
from app.main import get_db
from app.v5.sql.types import (
    GetModelFlagsApiRequest,
    GetModelFlagsApiResponse,
    GetModelFlagsSqlParams,
    GetModelFlagsSqlRow,
    QGetModelFlagsV4Item,
    load_sql_query,
)
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/v5/sql/queries/resources/model_flags/get_model_flags_complete.sql"

router = APIRouter()

# =============================================================================
# Internal Function
# =============================================================================


async def get_model_flags_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetModelFlagsV4Item]:
    """Internal function for parallel fetching from artifact endpoint.

    Args:
        conn: Database connection
        ids: List of model flag resource IDs
        bypass_cache: Whether to bypass cache

    Returns:
        List of model flag items
    """
    if not ids:
        return []

    # Generate cache key
    cache_key_val = cache_key(
        "model_flags/get",
        {
            "ids": sorted([str(id) for id in ids]),
        },
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetModelFlagsV4Item.model_validate(item)
                for item in cached.get("data", [])
            ]

    # Execute SQL
    params = GetModelFlagsSqlParams(ids=ids)
    result = cast(
        GetModelFlagsSqlRow,
        await execute_sql_typed(
            conn,
            SQL_PATH,
            params=params,
        ),
    )

    items = result.items or []

    # Cache response
    await set_cached(
        cache_key_val,
        {"data": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["model_flags"],
    )

    return items


# =============================================================================
# HTTP Endpoint
# =============================================================================


@router.post(
    "/model_flags/get",
    response_model=GetModelFlagsApiResponse,
)
async def get_model_flags(
    request: GetModelFlagsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetModelFlagsApiResponse:
    """Get model flags by resource IDs."""
    tags = ["resources", "model_flags"]

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

        items = await get_model_flags_internal(
            conn=conn,
            ids=request.ids or [],
            bypass_cache=bypass_cache,
        )

        api_response = GetModelFlagsApiResponse(items=items)
        response.headers["X-Cache-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_model_flags",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
