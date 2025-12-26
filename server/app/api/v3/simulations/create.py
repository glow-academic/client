"""Simulation create endpoint - v3 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db, transaction
from app.sql.types import (CreateSimulationApiRequest,
                           CreateSimulationApiResponse,
                           CreateSimulationSqlParams, CreateSimulationSqlRow,
                           load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level
SQL_PATH = "app/sql/v3/simulations/create_simulation_complete.sql"


router = APIRouter()


@router.post(
    "/create",
    response_model=CreateSimulationApiResponse,
    dependencies=[
        audit_activity(
            "simulation.created",
            "{{ actor.name }} created simulation '{{ simulation.title }}'",
        )
    ],
)
async def create_simulation(
    request: CreateSimulationApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateSimulationApiResponse:
    """Create a new simulation."""
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

        async with transaction(conn):
            # Convert API request to SQL params (add profile_id from header)
            params = CreateSimulationSqlParams(
                title=request.title,
                description=request.description,
                active=request.active,
                practice_simulation=request.practice_simulation,
                department_ids=request.department_ids,
                scenario_ids=request.scenario_ids,
                scenario_active_flags=request.scenario_active_flags,
                scenario_hints_enabled=request.scenario_hints_enabled,
                scenario_rubric_ids=request.scenario_rubric_ids,
                scenario_time_limit_seconds=request.scenario_time_limit_seconds,
                scenario_audio_enabled=request.scenario_audio_enabled,
                scenario_text_enabled=request.scenario_text_enabled,
                simulation_text_agent_id=request.simulation_text_agent_id,
                simulation_voice_agent_id=request.simulation_voice_agent_id,
                profile_id=profile_id,
            )
            sql_params = params.to_tuple()

            # Execute query with typed helper
            result = cast(
                CreateSimulationSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.simulation_id:
                raise ValueError("Failed to create simulation")

            actor_name = result.actor_name

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    simulation={"title": request.title, "id": str(result.simulation_id)},
                )

        # Convert SQL result to API response
        api_response = CreateSimulationApiResponse.model_validate(result.model_dump())

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
            operation="create_simulation",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
