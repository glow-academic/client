"""Simulation save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (input_simulation_id = NULL) and update (input_simulation_id provided).
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (GetNameByIdSqlParams, GetNameByIdSqlRow,
                           SaveSimulationApiRequest, SaveSimulationApiResponse,
                           SaveSimulationSqlParams, SaveSimulationSqlRow,
                           load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/simulations/save_simulation_complete.sql"
GET_NAME_SQL_PATH = "app/sql/v4/queries/simulations/get_name_by_id_complete.sql"


router = APIRouter()


@router.post(
    "/save",
    response_model=SaveSimulationApiResponse,
    dependencies=[
        audit_activity(
            "simulation.saved",
            "{{ actor.name }} {% if simulation %}updated{% else %}created{% endif %} simulation{% if simulation %} '{{ simulation.name }}'{% endif %}",
        )
    ],
)
async def save_simulation(
    request: SaveSimulationApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveSimulationApiResponse:
    """Save simulation - handles both create (input_simulation_id = NULL) and update (input_simulation_id provided)."""
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

        async with conn.transaction():
            # Convert API request to SQL params (add profile_id from header)
            # Map input_simulation_id from API request (already correct field name)
            params = SaveSimulationSqlParams(
                **request.model_dump(),
                profile_id=profile_id,
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                SaveSimulationSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.simulation_id:
                if request.input_simulation_id:
                    raise ValueError(f"Simulation not found: {request.input_simulation_id}")
                else:
                    raise ValueError("Failed to create simulation")

            # Set audit context with data from SQL query
            if result.actor_name:
                audit_ctx = {"actor": {"name": result.actor_name, "id": profile_id}}
                # Only add simulation to audit context if input_simulation_id was provided (update mode)
                # For create mode, we don't have the name yet, so we'll use a placeholder
                if request.input_simulation_id:
                    # Update mode: look up name from name_id if available
                    simulation_name = "Simulation"
                    if hasattr(request, "name_id") and request.name_id:
                        name_params = GetNameByIdSqlParams(name_id=request.name_id)
                        name_result = cast(
                            GetNameByIdSqlRow,
                            await execute_sql_typed(conn, GET_NAME_SQL_PATH, params=name_params),
                        )
                        if name_result and name_result.name:
                            simulation_name = name_result.name
                    audit_ctx["simulation"] = {
                        "name": simulation_name,
                        "id": str(result.simulation_id),
                    }
                audit_set(http_request, **audit_ctx)

        # Convert SQL result to API response
        api_response = SaveSimulationApiResponse.model_validate(
            {
                "simulation_id": str(result.simulation_id),
                "actor_name": result.actor_name,
            }
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="save_simulation",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
