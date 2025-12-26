"""Simulation create endpoint - v3 API following DHH principles."""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db, transaction
from app.sql.types import (CreateSimulationSqlParams, CreateSimulationSqlRow,
                           load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level
SQL_PATH = "app/sql/v3/simulations/create_simulation_complete.sql"


# Inline request/response schemas
class ScenarioInRequest(BaseModel):
    """Scenario in request format."""

    scenario_id: str
    active: bool = True


class ContentItemInRequest(BaseModel):
    """Content item (scenario) in request format."""

    type: str  # "scenario"
    id: str  # scenario_id
    active: bool = True
    # Switch fields (scenarios only)
    hints_enabled: bool | None = None
    audio_enabled: bool | None = None
    text_enabled: bool | None = None
    rubric_id: str | None = None
    time_limit_seconds: int | None = None  # Per-scenario time limit in seconds


class CreateSimulationRequest(BaseModel):
    """Request to create a simulation."""

    title: str
    description: str
    department_ids: list[str] | None
    active: bool
    practice_simulation: bool
    simulation_text_agent_id: str
    simulation_voice_agent_id: str | None = None
    time_limit: int | None = (
        None  # Deprecated: use per-scenario time_limit_seconds in content_items
    )
    rubric_id: str = ""  # Deprecated: use per-scenario rubric_id in content_items (kept for backward compatibility)
    scenario_ids: list[str] | list[ScenarioInRequest] | None = (
        None  # Deprecated, use content_items
    )
    content_items: list[ContentItemInRequest] | None = None  # Unified content list
    # profileId removed - comes from X-Profile-Id header


class CreateSimulationResponse(BaseModel):
    """Response from create simulation."""

    success: bool
    simulationId: str
    message: str


router = APIRouter()


@router.post(
    "/create",
    response_model=CreateSimulationResponse,
    dependencies=[
        audit_activity(
            "simulation.created",
            "{{ actor.name }} created simulation '{{ simulation.title }}'",
        )
    ],
)
async def create_simulation(
    request: CreateSimulationRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateSimulationResponse:
    """Create a new simulation."""
    tags = ["simulations"]  # From router tags

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            # Extract content items (scenarios only)
            scenario_ids: list[str] = []
            scenario_active_flags: list[bool] = []
            scenario_hints_enabled: list[bool] = []
            scenario_audio_enabled: list[bool] = []
            scenario_text_enabled: list[bool] = []
            scenario_rubric_ids: list[str] = []
            scenario_time_limit_seconds: list[int | None] = []

            # Use unified content_items if provided, otherwise fall back to separate arrays
            if request.content_items:
                for item in request.content_items:
                    if item.type == "scenario":
                        scenario_ids.append(item.id)
                        scenario_active_flags.append(item.active)
                        scenario_hints_enabled.append(
                            item.hints_enabled
                            if item.hints_enabled is not None
                            else False
                        )
                        scenario_audio_enabled.append(
                            item.audio_enabled
                            if item.audio_enabled is not None
                            else False
                        )
                        scenario_text_enabled.append(
                            item.text_enabled if item.text_enabled is not None else True
                        )
                        scenario_rubric_ids.append(
                            item.rubric_id if item.rubric_id else ""
                        )
                        scenario_time_limit_seconds.append(item.time_limit_seconds)
            else:
                # Legacy support: extract from separate arrays
                if request.scenario_ids:
                    for scenario_item in request.scenario_ids:
                        if isinstance(scenario_item, str):
                            scenario_ids.append(scenario_item)
                            scenario_active_flags.append(True)
                        else:
                            scenario_ids.append(scenario_item.scenario_id)
                            scenario_active_flags.append(scenario_item.active)

            # Ensure arrays are always arrays (empty arrays if None/empty)
            dept_ids = request.department_ids if request.department_ids else []
            scenario_ids_array = scenario_ids if scenario_ids else []
            scenario_flags_array = (
                scenario_active_flags if scenario_active_flags else []
            )
            scenario_hints_array = (
                scenario_hints_enabled if scenario_hints_enabled else []
            )
            scenario_audio_enabled_array = (
                scenario_audio_enabled if scenario_audio_enabled else []
            )
            scenario_text_enabled_array = (
                scenario_text_enabled if scenario_text_enabled else []
            )
            scenario_rubric_ids_array = (
                scenario_rubric_ids if scenario_rubric_ids else []
            )
            scenario_time_limit_seconds_array = (
                scenario_time_limit_seconds if scenario_time_limit_seconds else []
            )
            # Get profile_id from header (set by router-level dependency)
            profile_id = http_request.state.profile_id
            if not profile_id:
                raise HTTPException(
                    status_code=401,
                    detail="Profile ID is required. Please sign in again.",
                )

            # Convert to SQL params
            params = CreateSimulationSqlParams(
                title=request.title,
                description=request.description,
                active=request.active,
                practice_simulation=request.practice_simulation,
                department_ids=[UUID(did) for did in dept_ids],
                scenario_ids=[UUID(sid) for sid in scenario_ids_array],
                scenario_active_flags=scenario_flags_array,
                scenario_hints_enabled=scenario_hints_array,
                scenario_rubric_ids=[UUID(rid) if rid else UUID("00000000-0000-0000-0000-000000000000") for rid in scenario_rubric_ids_array],
                scenario_time_limit_seconds=scenario_time_limit_seconds_array,
                scenario_audio_enabled=scenario_audio_enabled_array,
                scenario_text_enabled=scenario_text_enabled_array,
                simulation_text_agent_id=UUID(request.simulation_text_agent_id),
                simulation_voice_agent_id=UUID(request.simulation_voice_agent_id) if request.simulation_voice_agent_id else UUID("00000000-0000-0000-0000-000000000000"),
                profile_id=UUID(profile_id),
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

            simulation_id = str(result.simulation_id)
            actor_name = result.actor_name

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    simulation={"title": request.title, "id": simulation_id},
                )

            result_data = CreateSimulationResponse(
                success=True,
                simulationId=simulation_id,
                message=f"Simulation '{request.title}' created successfully",
            )

            # Invalidate cache after mutation
            await invalidate_tags(tags)
            response.headers["X-Invalidate-Tags"] = ",".join(tags)

            return result_data
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
