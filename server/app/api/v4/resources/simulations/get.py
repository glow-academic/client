"""Simulations get endpoint - v4 API.

Provides get endpoint for fetching a single simulation by ID.
"""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

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
# Types
# =============================================================================


class GetSimulationV4Item(BaseModel):
    """Simulation item returned from get endpoint."""

    simulation_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    time_limit: int | None = None
    generated: bool | None = None


class GetSimulationApiRequest(BaseModel):
    """Request for getting a simulation by ID."""

    id: UUID


class GetSimulationApiResponse(BaseModel):
    """Response for getting a simulation."""

    item: GetSimulationV4Item | None = None


class GetSimulationSqlParams(BaseModel):
    """SQL parameters for get simulation."""

    id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        return (self.id,)


class GetSimulationSqlRow(BaseModel):
    """SQL row for get simulation."""

    item: GetSimulationV4Item | None = None


# =============================================================================
# Internal Function
# =============================================================================


async def get_simulation_internal(
    conn: asyncpg.Connection,
    id: UUID,
    bypass_cache: bool = False,
) -> GetSimulationV4Item | None:
    """Internal function for fetching a single simulation.

    Args:
        conn: Database connection
        id: Simulation ID to fetch
        bypass_cache: Whether to bypass cache

    Returns:
        Simulation item or None if not found
    """
    # Generate cache key
    cache_key_val = cache_key("simulations/get", {"id": str(id)})

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            item_data = cached.get("data")
            if item_data:
                return GetSimulationV4Item.model_validate(item_data)
            return None

    # Execute SQL
    params = GetSimulationSqlParams(id=id)
    result = cast(
        GetSimulationSqlRow,
        await execute_sql_typed(
            conn,
            SQL_PATH,
            params=params,
        ),
    )

    item = result.item if result else None

    # Cache response
    await set_cached(
        cache_key_val,
        {"data": item.model_dump(mode="json") if item else None},
        ttl=60,
        tags=["simulations"],
    )

    return item


# =============================================================================
# HTTP Endpoint
# =============================================================================


@router.post(
    "/simulations/get",
    response_model=GetSimulationApiResponse,
    dependencies=[
        audit_activity(
            "simulations.get",
            "{{ actor.name }} fetched simulation",
        )
    ],
)
async def get_simulation(
    request: GetSimulationApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetSimulationApiResponse:
    """Get simulation by ID."""
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
        item = await get_simulation_internal(
            conn=conn,
            id=request.id,
            bypass_cache=bypass_cache,
        )

        api_response = GetSimulationApiResponse(item=item)

        response.headers["X-Cache-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_simulation",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
