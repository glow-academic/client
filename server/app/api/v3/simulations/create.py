"""Simulation create endpoint - v3 API following DHH principles."""

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
    # Switch fields (scenarios only, except objectives_enabled which applies to both)
    hints_enabled: bool | None = None
    objectives_enabled: bool | None = None
    input_guardrail_enabled: bool | None = None
    output_guardrail_enabled: bool | None = None
    image_input_enabled: bool | None = None
    rubric_id: str | None = None


class CreateSimulationRequest(BaseModel):
    """Request to create a simulation."""

    title: str
    description: str
    department_ids: list[str] | None
    active: bool
    practice_simulation: bool
    time_limit: int | None
    rubric_id: str
    scenario_ids: list[str] | list[ScenarioInRequest] | None = None  # Deprecated, use content_items
    video_ids: list[str] | list[VideoInRequest] | None = None  # Deprecated, use content_items
    content_items: list[ContentItemInRequest] | None = None  # Unified content list


class CreateSimulationResponse(BaseModel):
    """Response from create simulation."""

    success: bool
    simulationId: str
    message: str


router = APIRouter()


@router.post("/create", response_model=CreateSimulationResponse)
async def create_simulation(
    request: CreateSimulationRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateSimulationResponse:
    """Create a new simulation."""
    tags = ["simulations"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            # Extract content items (scenarios and videos) with unified positions
            scenario_ids: list[str] = []
            scenario_active_flags: list[bool] = []
            scenario_hints_enabled: list[bool] = []
            scenario_objectives_enabled: list[bool] = []
            scenario_input_guardrail_enabled: list[bool] = []
            scenario_output_guardrail_enabled: list[bool] = []
            scenario_image_input_enabled: list[bool] = []
            scenario_rubric_ids: list[str] = []
            video_ids: list[str] = []
            video_active_flags: list[bool] = []
            video_objectives_enabled: list[bool] = []

            # Use unified content_items if provided, otherwise fall back to separate arrays
            if request.content_items:
                for item in request.content_items:
                    if item.type == "scenario":
                        scenario_ids.append(item.id)
                        scenario_active_flags.append(item.active)
                        scenario_hints_enabled.append(item.hints_enabled if item.hints_enabled is not None else False)
                        scenario_objectives_enabled.append(item.objectives_enabled if item.objectives_enabled is not None else True)
                        scenario_input_guardrail_enabled.append(item.input_guardrail_enabled if item.input_guardrail_enabled is not None else False)
                        scenario_output_guardrail_enabled.append(item.output_guardrail_enabled if item.output_guardrail_enabled is not None else False)
                        scenario_image_input_enabled.append(item.image_input_enabled if item.image_input_enabled is not None else False)
                        scenario_rubric_ids.append(item.rubric_id if item.rubric_id else "")
                    elif item.type == "video":
                        video_ids.append(item.id)
                        video_active_flags.append(item.active)
                        video_objectives_enabled.append(item.objectives_enabled if item.objectives_enabled is not None else True)
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
            scenario_hints_array = scenario_hints_enabled if scenario_hints_enabled else []
            scenario_objectives_array = scenario_objectives_enabled if scenario_objectives_enabled else []
            scenario_input_guardrail_array = scenario_input_guardrail_enabled if scenario_input_guardrail_enabled else []
            scenario_output_guardrail_array = scenario_output_guardrail_enabled if scenario_output_guardrail_enabled else []
            scenario_image_input_array = scenario_image_input_enabled if scenario_image_input_enabled else []
            scenario_rubric_ids_array = scenario_rubric_ids if scenario_rubric_ids else []
            video_ids_array = video_ids if video_ids else []
            video_flags_array = video_active_flags if video_active_flags else []
            video_objectives_array = video_objectives_enabled if video_objectives_enabled else []

            # Create simulation with departments, time limit, scenarios, and videos in single SQL (DHH style)
            sql_query = load_sql("sql/v3/simulations/create_simulation_complete.sql")
            sql_params = (
                request.title,
                request.description,
                request.active,
                request.practice_simulation,
                request.rubric_id,
                dept_ids,  # Always pass array (empty array if no departments)
                request.time_limit,
                scenario_ids_array,
                scenario_flags_array,
                video_ids_array,
                video_flags_array,
                scenario_hints_array,
                scenario_objectives_array,
                scenario_input_guardrail_array,
                scenario_output_guardrail_array,
                scenario_image_input_array,
                scenario_rubric_ids_array,
                video_objectives_array,
            )
            result = await conn.fetchrow(sql_query, *sql_params)

            if not result:
                raise ValueError("Failed to create simulation")

            simulation_id = result["simulation_id"]

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
