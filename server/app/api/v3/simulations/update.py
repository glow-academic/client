"""Simulation update endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.infra.activity.audit import audit_activity, audit_set
from utils.cache.invalidate_tags import invalidate_tags
from app.infra.error.handle_route_error import handle_route_error
from utils.sql_helper import load_sql


# Inline request/response schemas
class ScenarioInRequest(BaseModel):
    """Scenario in request format."""

    scenario_id: str
    active: bool = True


class ContentItemInRequest(BaseModel):
    """Content item (scenario) in request format."""

    type: str  # "scenario"
    id: str  # scenario_id or video_id
    active: bool = True
    # Switch fields (scenarios only)
    hints_enabled: bool | None = None
    copy_paste_allowed: bool | None = None  # Scenarios only
    audio_enabled: bool | None = None  # Scenarios only
    text_enabled: bool | None = None  # Scenarios only
    rubric_id: str | None = None
    time_limit_seconds: int | None = None  # Per-scenario time limit in seconds


class UpdateSimulationRequest(BaseModel):
    """Request to update simulation."""

    simulationId: str
    title: str
    description: str
    department_ids: list[str] | None
    active: bool
    practice_simulation: bool
    hint_agent_id: str | None = None
    grade_text_agent_id: str | None = None
    grade_voice_agent_id: str | None = None
    simulation_text_agent_id: str | None = None
    simulation_voice_agent_id: str | None = None
    time_limit: int | None = (
        None  # Deprecated: use per-scenario time_limit_seconds in content_items
    )
    rubric_id: str = ""  # Deprecated: use per-scenario rubric_id in content_items
    scenario_ids: list[str] | list[ScenarioInRequest] | None = (
        None  # Deprecated, use content_items
    )
    content_items: list[ContentItemInRequest] | None = None  # Unified content list


class UpdateSimulationResponse(BaseModel):
    """Response from update simulation."""

    success: bool
    message: str


router = APIRouter()


@router.post(
    "/update",
    response_model=UpdateSimulationResponse,
    dependencies=[
        audit_activity(
            "simulation.updated",
            "{{ actor.name }} updated simulation '{{ simulation.name }}'",
        )
    ],
)
async def update_simulation(
    request: UpdateSimulationRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateSimulationResponse:
    """Update an existing simulation."""
    tags = ["simulations"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            # Extract content items (scenarios only)
            scenario_ids: list[str] = []
            scenario_active_flags: list[bool] = []
            scenario_hints_enabled: list[bool] = []
            scenario_copy_paste_allowed: list[bool] = []
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
                        scenario_copy_paste_allowed.append(
                            item.copy_paste_allowed
                            if item.copy_paste_allowed is not None
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
            scenario_copy_paste_allowed_array = (
                scenario_copy_paste_allowed if scenario_copy_paste_allowed else []
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

            # Update simulation with departments and scenarios in single SQL (DHH style)
            # Note: rubric_id and time_limit are now per-scenario, not simulation-level
            sql_query = load_sql("app/sql/v3/simulations/update_simulation_complete.sql")
            sql_params = (
                request.simulationId,
                request.title,
                request.description,
                request.active,
                request.practice_simulation,
                dept_ids,  # Always pass array (empty array if no departments)
                scenario_ids_array,
                scenario_flags_array,
                [],  # video_ids (empty for now)
                [],  # video_active_flags (empty for now)
                scenario_hints_array,
                scenario_rubric_ids_array,
                scenario_time_limit_seconds_array,
                scenario_audio_enabled_array,
                scenario_text_enabled_array,
                [],  # video_show_problem_statement (empty for now)
                [],  # video_show_objectives (empty for now)
                [],  # video_show_image (empty for now)
                request.hint_agent_id,  # $22
                request.grade_text_agent_id,  # $23
                request.grade_voice_agent_id,  # $24
                request.simulation_text_agent_id or "",  # $25
                request.simulation_voice_agent_id or "",  # $26
                profile_id,  # $27
            )
            result = await conn.fetchrow(sql_query, *sql_params)

            if not result:
                raise ValueError(f"Simulation not found: {request.simulationId}")

            actor_name = result.get("actor_name")

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    simulation={"name": request.title, "id": request.simulationId},
                )

            result_data = UpdateSimulationResponse(
                success=True,
                message=f"Simulation '{request.title}' updated successfully",
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
            operation="update_simulation",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
