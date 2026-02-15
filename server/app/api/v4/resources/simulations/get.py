"""Simulations get endpoint - v4 API.

Provides get endpoint for fetching simulations by IDs.
"""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.resources.simulations.types import (
    GetSimulationsApiRequest,
    GetSimulationsApiResponse,
    GetSimulationsSqlParams,
    GetSimulationsSqlRow,
    GetSimulationsV4Item,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import load_sql_query
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level
SQL_PATH = "app/sql/v4/queries/resources/simulations/get_simulations_complete.sql"


router = APIRouter()


# =============================================================================
# Internal Function
# =============================================================================


async def get_simulations_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[GetSimulationsV4Item]:
    """Internal function for fetching simulations by IDs.

    Can be called directly from other routes without HTTP overhead.

    Args:
        conn: Database connection
        ids: List of simulation IDs to fetch
        bypass_cache: Whether to bypass cache

    Returns:
        List of simulation items
    """
    if not ids:
        return []

    tags = ["resources", "simulations"]
    cache_key_val = cache_key(
        "/api/v4/resources/simulations/get",
        {"ids": sorted(str(i) for i in ids)},
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                GetSimulationsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    # Execute SQL
    params = GetSimulationsSqlParams(ids=ids)
    result = cast(
        GetSimulationsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    # Convert auto-generated Q* types to handcrafted types via dict roundtrip
    items: list[GetSimulationsV4Item] = [
        GetSimulationsV4Item.model_validate(
            item.model_dump() if hasattr(item, "model_dump") else item
        )
        for item in (result.items or [])
    ] if result else []

    # Cache result
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
    "/simulations/get",
    response_model=GetSimulationsApiResponse,
    dependencies=[
        audit_activity(
            "simulations.get",
            "{{ actor.name }} fetched simulation",
        )
    ],
)
async def get_simulations(
    request: GetSimulationsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetSimulationsApiResponse:
    """Get simulations by IDs."""
    tags = ["resources", "simulations"]

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Check for cache bypass header
        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

        # Use internal function
        items = await get_simulations_internal(
            conn=conn,
            ids=request.ids or [],
            bypass_cache=bypass_cache,
        )

        api_response = GetSimulationsApiResponse(items=items)

        response.headers["X-Cache-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_simulations",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
