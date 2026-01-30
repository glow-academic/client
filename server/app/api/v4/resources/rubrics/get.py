"""Rubrics get endpoint - v4 API.

Provides get endpoint for fetching rubrics by simulation ID.
"""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetRubricsApiRequest,
    GetRubricsApiResponse,
    GetRubricsSqlParams,
    GetRubricsSqlRow,
    QGetRubricsV4Item,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/resources/rubrics/get_rubrics_complete.sql"


router = APIRouter()


# =============================================================================
# Internal Function
# =============================================================================


async def get_rubrics_internal(
    conn: asyncpg.Connection,
    simulation_id: UUID | None,
    bypass_cache: bool = False,
) -> list[QGetRubricsV4Item]:
    """Internal function for parallel fetching from simulation endpoint.

    Args:
        conn: Database connection
        simulation_id: Simulation ID to fetch rubrics for
        bypass_cache: Whether to bypass cache

    Returns:
        List of rubric items
    """
    if not simulation_id:
        return []

    # Generate cache key
    cache_key_val = cache_key(
        "rubrics/get",
        {"simulation_id": str(simulation_id)},
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetRubricsV4Item.model_validate(item)
                for item in cached.get("data", [])
            ]

    # Execute SQL
    params = GetRubricsSqlParams(simulation_id=simulation_id)
    result = cast(
        GetRubricsSqlRow,
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
        tags=["rubrics"],
    )

    return items


# =============================================================================
# HTTP Endpoint
# =============================================================================


@router.post(
    "/rubrics/get",
    response_model=GetRubricsApiResponse,
)
async def get_rubrics(
    request: GetRubricsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetRubricsApiResponse:
    """Get rubrics by simulation ID."""
    tags = ["resources", "rubrics"]

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

        items = await get_rubrics_internal(
            conn=conn,
            simulation_id=request.simulation_id,
            bypass_cache=bypass_cache,
        )

        api_response = GetRubricsApiResponse(items=items)
        response.headers["X-Cache-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_rubrics",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
