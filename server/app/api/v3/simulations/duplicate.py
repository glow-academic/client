"""Simulation duplicate endpoint - v3 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    DuplicateSimulationApiRequest,
    DuplicateSimulationApiResponse,
    DuplicateSimulationSqlParams,
    DuplicateSimulationSqlRow,
    load_sql_query,
)

# Load SQL with types at module level
SQL_PATH = "app/sql/v3/simulations/duplicate_simulation_complete.sql"


router = APIRouter()


@router.post(
    "/duplicate",
    response_model=DuplicateSimulationApiResponse,
    dependencies=[
        audit_activity(
            "simulation.duplicated",
            "{{ actor.name }} duplicated simulation '{{ simulation.name }}'",
        )
    ],
)
async def duplicate_simulation(
    request: DuplicateSimulationApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateSimulationApiResponse:
    """Duplicate a simulation."""
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
        params = DuplicateSimulationSqlParams(
            simulation_id=request.simulation_id,
            profile_id=profile_id,
        )
        sql_params = params.to_tuple()

        # Execute query with typed helper
        result = cast(
            DuplicateSimulationSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        if not result or not result.simulation_id:
            raise HTTPException(
                status_code=404, detail=f"Simulation {request.simulation_id} not found"
            )

        simulation_name = result.simulation_name or "Unknown"
        actor_name = result.actor_name

        # Set audit context with data from SQL query
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                simulation={"name": simulation_name, "id": str(request.simulation_id)},
            )

        # Convert SQL result to API response
        api_response = DuplicateSimulationApiResponse.model_validate(
            result.model_dump()
        )

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
            operation="duplicate_simulation",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
