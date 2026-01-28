"""Simulations list endpoint - v4 API following DHH principles.

Uses Python-computed permissions for each simulation item.
"""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetSimulationsListApiRequest,
    GetSimulationsListApiResponse,
    GetSimulationsListSqlParams,
    GetSimulationsListSqlRow,
    load_sql_query,
)
from app.api.v4.artifacts.simulation.permissions import (
    compute_can_edit,
    compute_can_delete,
    compute_can_duplicate,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level
SQL_PATH = "app/sql/v4/queries/simulations/get_simulations_list_complete.sql"


router = APIRouter()


@router.post(
    "/list",
    response_model=GetSimulationsListApiResponse,
    dependencies=[
        audit_activity(
            "simulations.list", "{{ actor.name }} visited the Simulations page"
        )
    ],
)
async def get_simulation_list(
    filters: GetSimulationsListApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetSimulationsListApiResponse:
    """Get simulations list with Python-computed permissions."""
    tags = ["simulations"]

    # Check for cache bypass header (for testing)
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body (mode='json' to serialize UUIDs)
    body_dict = filters.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return GetSimulationsListApiResponse.model_validate(cached["data"])

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

        # Convert API request to SQL params
        params = GetSimulationsListSqlParams(
            **filters.model_dump(), profile_id=profile_id
        )
        sql_params = params.to_tuple()

        # Execute query with typed helper
        result = cast(
            GetSimulationsListSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context
        if result.actor_name:
            audit_set(http_request, actor={"name": result.actor_name, "id": profile_id})

        # Extract user context for Python permission computation
        user_role = getattr(result, "user_role", None)

        # Process simulations with Python-computed permissions
        raw_simulations = result.simulations or []
        simulations_with_permissions = []

        for sim in raw_simulations:
            # Get simulation-specific context
            sim_department_ids_raw = getattr(sim, "department_ids", None) or []
            # Convert string UUIDs to UUID objects if needed
            sim_department_ids = [
                UUID(d) if isinstance(d, str) else d
                for d in sim_department_ids_raw
            ]
            usage_count = getattr(sim, "usage_count", 0) or 0

            # Compute permissions in Python
            can_edit = compute_can_edit(user_role, sim_department_ids, usage_count)
            can_delete = compute_can_delete(user_role, sim_department_ids, usage_count)
            can_duplicate = compute_can_duplicate(user_role)

            # Build simulation with permissions
            sim_dict = sim.model_dump() if hasattr(sim, "model_dump") else dict(sim)
            sim_dict["can_edit"] = can_edit
            sim_dict["can_delete"] = can_delete
            sim_dict["can_duplicate"] = can_duplicate

            simulations_with_permissions.append(sim_dict)

        # Build result dict with updated simulations
        result_dict = result.model_dump()
        result_dict["simulations"] = simulations_with_permissions

        # Convert to API response
        api_response = GetSimulationsListApiResponse.model_validate(result_dict)

        # Cache response (use mode='json' to serialize UUIDs and other types)
        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_simulation_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
