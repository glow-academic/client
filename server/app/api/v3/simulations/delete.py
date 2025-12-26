"""Simulation delete endpoint - v3 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (DeleteSimulationApiRequest,
                           DeleteSimulationApiResponse,
                           DeleteSimulationSqlParams, DeleteSimulationSqlRow,
                           load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level
SQL_PATH = "app/sql/v3/simulations/delete_simulation_complete.sql"


router = APIRouter()


@router.post(
    "/delete",
    response_model=DeleteSimulationApiResponse,
    dependencies=[
        audit_activity(
            "simulation.deleted",
            "{{ actor.name }} deleted simulation '{{ simulation.name }}'",
        )
    ],
)
async def delete_simulation(
    request: DeleteSimulationApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteSimulationApiResponse:
    """Delete a simulation (with usage check)."""
    tags = ["simulations"]  # From router tags

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

        # Convert API request to SQL params (add profile_id from header)
        params = DeleteSimulationSqlParams(**request.model_dump(), profile_id=profile_id)
        sql_params = params.to_tuple()

        # Execute query with typed helper
        result = cast(
            DeleteSimulationSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        if not result:
            # Simulation doesn't exist
            raise HTTPException(
                status_code=404, detail=f"Simulation {request.simulation_id} not found"
            )

        # Check if simulation was deleted or is in use
        if not result.deleted:
            # Simulation exists but is in use
            usage_count = result.usage_count or 0
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete simulation: in use by {usage_count} cohort(s)",
            )

        simulation_name = result.title or "Unknown"
        actor_name = result.actor_name

        # Set audit context with data from SQL query
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                simulation={"name": simulation_name, "id": str(request.simulation_id)},
            )

        # Convert SQL result to API response
        api_response = DeleteSimulationApiResponse.model_validate(result.model_dump())

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_simulation",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
