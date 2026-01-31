"""Simulations get endpoint - v4 API.

Provides get endpoint for fetching a single simulation by ID,
and batch endpoint for fetching multiple simulations by IDs.
"""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

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
SQL_BATCH_PATH = (
    "app/sql/v4/queries/resources/simulations/get_simulations_batch_complete.sql"
)


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


# Alias for backward compatibility with search.py
GetSimulationsV4Item = GetSimulationV4Item


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
    """SQL row for get simulation.

    Note: PostgreSQL expands composite types in RETURNS TABLE,
    so we receive the columns directly instead of nested in 'item'.
    """

    simulation_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    time_limit: int | None = None
    generated: bool | None = None

    def to_item(self) -> GetSimulationV4Item | None:
        """Convert SQL row to item format."""
        if self.simulation_id is None:
            return None
        return GetSimulationV4Item(
            simulation_id=self.simulation_id,
            name=self.name,
            description=self.description,
            time_limit=self.time_limit,
            generated=self.generated,
        )


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

    # Execute SQL directly - PostgreSQL expands composite types from RETURNS TABLE
    # so we can't use execute_sql_typed which expects the nested 'item' structure
    rows = await conn.fetch(
        'SELECT * FROM "public"."api_get_simulations_v4"($1)',
        id,
    )

    item = None
    if rows:
        row = dict(rows[0])
        item = GetSimulationV4Item(
            simulation_id=row.get("simulation_id"),
            name=row.get("name"),
            description=row.get("description"),
            time_limit=row.get("time_limit"),
            generated=row.get("generated"),
        )

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


# =============================================================================
# Batch Types (for profile context 2-pass architecture)
# =============================================================================


class GetSimulationsBatchV4Item(BaseModel):
    """Simulation batch item with full context data."""

    simulation_id: UUID | None = None
    title: str | None = None
    description: str | None = None
    department_ids: list[str] | None = None
    time_limit: int | None = None
    active: bool | None = None
    practice_simulation: bool | None = None


class GetSimulationsBatchApiRequest(BaseModel):
    """Request for getting simulations by IDs (batch)."""

    ids: list[UUID] | None = Field(default_factory=list)


class GetSimulationsBatchApiResponse(BaseModel):
    """Response for getting simulations batch."""

    items: list[GetSimulationsBatchV4Item] | None = None


class GetSimulationsBatchSqlParams(BaseModel):
    """SQL parameters for get simulations batch."""

    ids: list[UUID] | None = Field(default_factory=list)

    def to_tuple(self) -> tuple[Any, ...]:
        return (self.ids,)


class GetSimulationsBatchSqlRow(BaseModel):
    """SQL row for get simulations batch."""

    items: list[GetSimulationsBatchV4Item] | None = None


# =============================================================================
# Batch Internal Function
# =============================================================================


async def get_simulations_batch_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[GetSimulationsBatchV4Item]:
    """Internal function for fetching multiple simulations by IDs.

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
        "/api/v4/resources/simulations/batch",
        {"ids": [str(id) for id in ids]},
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                GetSimulationsBatchV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    # Execute SQL
    params = GetSimulationsBatchSqlParams(ids=ids)
    result = cast(
        GetSimulationsBatchSqlRow,
        await execute_sql_typed(conn, SQL_BATCH_PATH, params=params),
    )

    items: list[GetSimulationsBatchV4Item] = (
        result.items if result and result.items else []
    )

    # Cache result
    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items


# =============================================================================
# Batch HTTP Endpoint
# =============================================================================


@router.post(
    "/simulations/batch",
    response_model=GetSimulationsBatchApiResponse,
)
async def get_simulations_batch(
    request: GetSimulationsBatchApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetSimulationsBatchApiResponse:
    """Get simulations by IDs (batch).

    HTTP wrapper that delegates to internal function for caching and data fetching.
    Used by profile context 2-pass architecture.
    """
    tags = ["resources", "simulations"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_simulations_batch_internal(
            conn, request.ids or [], bypass_cache
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetSimulationsBatchApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_simulations_batch",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
