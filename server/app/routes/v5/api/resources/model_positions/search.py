"""Model positions search endpoint - v4 API.

Provides search endpoint for finding available model positions for models.
"""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.utils.error.handle_route_error import handle_route_error
from app.infra.globals import get_db
from app.sql.types import (
    QGetModelPositionsV4Item,
    SearchModelPositionsApiRequest,
    SearchModelPositionsApiResponse,
    SearchModelPositionsSqlParams,
    SearchModelPositionsSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/queries/resources/model_positions/search_model_positions_complete.sql"
)

router = APIRouter()


async def search_model_positions_internal(
    conn: asyncpg.Connection,
    model_ids: list[UUID],
    bypass_cache: bool = False,
    *,
    eval: bool = False,
) -> list[QGetModelPositionsV4Item]:
    """Internal function for parallel fetching from artifact endpoint.

    Args:
        conn: Database connection
        model_ids: List of model IDs to search positions for
        bypass_cache: Whether to bypass cache

    Returns:
        List of available model position items
    """
    # Generate cache key
    cache_key_val = cache_key(
        "model_positions/search",
        {
            "model_ids": sorted([str(id) for id in model_ids]),
            "eval": eval,
        },
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetModelPositionsV4Item.model_validate(item)
                for item in cached.get("data", [])
            ]

    # Execute SQL
    params = SearchModelPositionsSqlParams(
        model_ids=model_ids or [],
        eval=eval,
    )
    result = cast(
        SearchModelPositionsSqlRow,
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
        tags=["model_positions"],
    )

    return items


# =============================================================================
# HTTP Endpoint
# =============================================================================


@router.post(
    "/model_positions/search",
    response_model=SearchModelPositionsApiResponse,
)
async def search_model_positions(
    request: SearchModelPositionsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchModelPositionsApiResponse:
    """Search available model positions for models."""
    tags = ["resources", "model_positions"]

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

        items = await search_model_positions_internal(
            conn=conn,
            model_ids=request.model_ids or [],
            bypass_cache=bypass_cache,
            eval=request.eval or False,
        )

        api_response = SearchModelPositionsApiResponse(items=items)
        response.headers["X-Cache-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_model_positions",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
