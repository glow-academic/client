"""Simulation update endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class ScenarioInRequest(BaseModel):
    """Scenario in request format."""

    scenario_id: str
    active: bool = True


class VideoInRequest(BaseModel):
    """Video in request format."""

    video_id: str
    active: bool = True


class ContentItemInRequest(BaseModel):
    """Unified content item (scenario or video) in request format."""

    type: str  # "scenario" or "video"
    id: str  # scenario_id or video_id
    active: bool = True
    # Switch fields (scenarios only, except show fields which apply to both)
    hints_enabled: bool | None = None
    audio_enabled: bool | None = None  # Scenarios only
    text_enabled: bool | None = None  # Scenarios only
    show_problem_statement: bool | None = None  # Scenarios and videos
    show_objectives: bool | None = None  # Scenarios and videos
    show_image: bool | None = None  # Scenarios and videos
    rubric_id: str | None = None
    time_limit_seconds: int | None = None  # Per-scenario time limit in seconds
    hint_agent_id: str | None = None
    grade_agent_ids: list[str] | None = (
        None  # Array of grade agent IDs for this scenario
    )


class UpdateSimulationRequest(BaseModel):
    """Request to update simulation."""

    simulationId: str
    title: str
    description: str
    department_ids: list[str] | None
    active: bool
    practice_simulation: bool
    time_limit: int | None = (
        None  # Deprecated: use per-scenario time_limit_seconds in content_items
    )
    rubric_id: str = ""  # Deprecated: use per-scenario rubric_id in content_items
    scenario_ids: list[str] | list[ScenarioInRequest] | None = (
        None  # Deprecated, use content_items
    )
    video_ids: list[str] | list[VideoInRequest] | None = (
        None  # Deprecated, use content_items
    )
    content_items: list[ContentItemInRequest] | None = None  # Unified content list


class UpdateSimulationResponse(BaseModel):
    """Response from update simulation."""

    success: bool
    message: str


router = APIRouter()


@router.post("/update", response_model=UpdateSimulationResponse)
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
            # Extract content items (scenarios and videos) with unified positions
            scenario_ids: list[str] = []
            scenario_active_flags: list[bool] = []
            scenario_hints_enabled: list[bool] = []
            scenario_audio_enabled: list[bool] = []
            scenario_text_enabled: list[bool] = []
            scenario_show_problem_statement: list[bool] = []
            scenario_show_objectives: list[bool] = []
            scenario_show_image: list[bool] = []
            scenario_rubric_ids: list[str] = []
            scenario_time_limit_seconds: list[int | None] = []
            scenario_hint_agent_ids: list[str] = []
            scenario_grade_agent_ids: list[
                list[str]
            ] = []  # Array of arrays, one per scenario
            video_ids: list[str] = []
            video_active_flags: list[bool] = []
            video_show_problem_statement: list[bool] = []
            video_show_objectives: list[bool] = []
            video_show_image: list[bool] = []

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
                        scenario_show_problem_statement.append(
                            item.show_problem_statement
                            if item.show_problem_statement is not None
                            else True
                        )
                        scenario_show_objectives.append(
                            item.show_objectives
                            if item.show_objectives is not None
                            else True
                        )
                        scenario_show_image.append(
                            item.show_image if item.show_image is not None else True
                        )
                        scenario_rubric_ids.append(
                            item.rubric_id if item.rubric_id else ""
                        )
                        scenario_time_limit_seconds.append(item.time_limit_seconds)
                        scenario_hint_agent_ids.append(
                            item.hint_agent_id if item.hint_agent_id else ""
                        )
                        scenario_grade_agent_ids.append(
                            item.grade_agent_ids if item.grade_agent_ids else []
                        )
                    elif item.type == "video":
                        video_ids.append(item.id)
                        video_active_flags.append(item.active)
                        video_show_problem_statement.append(
                            item.show_problem_statement
                            if item.show_problem_statement is not None
                            else True
                        )
                        video_show_objectives.append(
                            item.show_objectives
                            if item.show_objectives is not None
                            else True
                        )
                        video_show_image.append(
                            item.show_image if item.show_image is not None else True
                        )
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

                if request.video_ids:
                    for video_item in request.video_ids:
                        if isinstance(video_item, str):
                            video_ids.append(video_item)
                            video_active_flags.append(True)
                        else:
                            video_ids.append(video_item.video_id)
                            video_active_flags.append(video_item.active)

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
            scenario_show_problem_statement_array = (
                scenario_show_problem_statement
                if scenario_show_problem_statement
                else []
            )
            scenario_show_objectives_array = (
                scenario_show_objectives if scenario_show_objectives else []
            )
            scenario_show_image_array = (
                scenario_show_image if scenario_show_image else []
            )
            scenario_rubric_ids_array = (
                scenario_rubric_ids if scenario_rubric_ids else []
            )
            scenario_time_limit_seconds_array = (
                scenario_time_limit_seconds if scenario_time_limit_seconds else []
            )
            scenario_hint_agent_ids_array = (
                scenario_hint_agent_ids if scenario_hint_agent_ids else []
            )
            scenario_grade_agent_ids_array = (
                scenario_grade_agent_ids if scenario_grade_agent_ids else []
            )
            video_ids_array = video_ids if video_ids else []
            video_flags_array = video_active_flags if video_active_flags else []
            video_show_problem_statement_array = (
                video_show_problem_statement if video_show_problem_statement else []
            )
            video_show_objectives_array = (
                video_show_objectives if video_show_objectives else []
            )
            video_show_image_array = video_show_image if video_show_image else []

            # Update simulation with departments, scenarios, and videos in single SQL (DHH style)
            # Note: rubric_id and time_limit are now per-scenario, not simulation-level
            sql_query = load_sql("sql/v3/simulations/update_simulation_complete.sql")
            sql_params = (
                request.simulationId,
                request.title,
                request.description,
                request.active,
                request.practice_simulation,
                dept_ids,  # Always pass array (empty array if no departments)
                scenario_ids_array,
                scenario_flags_array,
                video_ids_array,
                video_flags_array,
                scenario_hints_array,
                scenario_rubric_ids_array,
                scenario_time_limit_seconds_array,
                scenario_audio_enabled_array,
                scenario_text_enabled_array,
                scenario_show_problem_statement_array,
                scenario_show_objectives_array,
                scenario_show_image_array,
                video_show_problem_statement_array,
                video_show_objectives_array,
                video_show_image_array,
                scenario_hint_agent_ids_array,
                scenario_grade_agent_ids_array,
            )
            result = await conn.fetchrow(sql_query, *sql_params)

            if not result:
                raise ValueError(f"Simulation not found: {request.simulationId}")

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
