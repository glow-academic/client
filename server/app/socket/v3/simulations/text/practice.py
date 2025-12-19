"""Handler for simulation_text_practice WebSocket event."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.main import get_pool, sio
from app.socket.v3.simulations.text.start import (
    StartSimulationPayload,
    _simulation_text_start_impl,
)
from app.utils.activity.websocket_logger import log_websocket_activity
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for server-to-client events
class CreatePracticeScenarioErrorPayload(BaseModel):
    """Response indicating an error occurred while creating practice scenario."""

    success: bool
    message: str


# Pydantic model for client-to-server event
class CreatePracticeScenarioPayload(BaseModel):
    """Request to create and start a practice scenario simulation."""

    persona_id: str | None = None
    parameter_item_ids: list[str] = []
    department_id: str | None = None
    infinite_mode: bool = False
    infinite_time_limit: int | None = None
    simulation_id: str | None = None  # For infinite mode
    profile_id: str | None = None


# Emit helper functions
async def simulation_text_practice_error(
    payload: CreatePracticeScenarioErrorPayload, room: str
) -> None:
    await sio.emit("simulations_text_practice_error", payload.model_dump(), room=room)


async def _simulation_text_practice_impl(
    sid: str, data: CreatePracticeScenarioPayload
) -> None:
    """
    Handle practice scenario creation requests via WebSocket.
    Creates a customized scenario variant if needed (Option A), then calls
    the normal start_simulation workflow to handle generation and randomization.
    Only handles standard mode - infinite mode should use start_simulation directly.
    """
    try:
        logger.info(
            f"Received simulation_text_practice request from {sid} with data: {data}"
        )

        # Get connection pool
        pool = get_pool()
        if not pool:
            await simulation_text_practice_error(
                CreatePracticeScenarioErrorPayload(
                    success=False, message="Database connection pool not available"
                ),
                room=sid,
            )
            logger.error(
                f"Emitted error to {sid}: Database connection pool not available"
            )
            return

        async with pool.acquire() as conn:
            # Resolve profile for guests
            profile_id = data.profile_id
            if profile_id == "" or profile_id == "null" or profile_id is None:
                sql = load_sql("sql/v3/profile/get_default_guest_profile.sql")
                guest_row = await conn.fetchrow(sql)
                if guest_row:
                    profile_id = str(guest_row["id"])
                    logger.info(
                        f"Assigning practice scenario to default guest profile {profile_id}"
                    )
                else:
                    logger.warning(
                        "No default guest profile found; proceeding without profile_id"
                    )

            # Standard mode: find practice simulation with persona
            if not data.persona_id:
                await simulation_text_practice_error(
                    CreatePracticeScenarioErrorPayload(
                        success=False, message="Missing persona_id"
                    ),
                    room=sid,
                )
                return

            # Find practice simulation with persona
            department_ids = [data.department_id] if data.department_id else []
            sql = load_sql("sql/v3/practice/find_practice_simulation_with_persona.sql")
            result = await conn.fetchrow(sql, data.persona_id, department_ids)

            if not result:
                await simulation_text_practice_error(
                    CreatePracticeScenarioErrorPayload(
                        success=False,
                        message=f"No practice simulation found for persona {data.persona_id}",
                    ),
                    room=sid,
                )
                return

            simulation_id = result["simulation_id"]
            parent_scenario_id = result["scenario_id"]
            logger.info(
                f"Found practice simulation {simulation_id} with scenario {parent_scenario_id}"
            )

            # Get parent scenario
            sql = load_sql("sql/v3/scenarios/get_scenario_by_id.sql")
            parent_scenario = await conn.fetchrow(sql, parent_scenario_id)
            if not parent_scenario:
                await simulation_text_practice_error(
                    CreatePracticeScenarioErrorPayload(
                        success=False, message="Parent scenario not found"
                    ),
                    room=sid,
                )
                return

            scenario = dict(parent_scenario)
            parent_scenario_id_uuid = uuid.UUID(parent_scenario_id)

            # Determine department_id (allow None for guests)
            selected_dept_id: uuid.UUID | None = None
            if data.department_id:
                selected_dept_id = uuid.UUID(data.department_id)
            else:
                # Fallback: get from scenario or profile
                sql = load_sql("sql/v3/scenarios/get_scenario_departments.sql")
                scenario_dept_rows = await conn.fetch(sql, parent_scenario_id_uuid)
                if scenario_dept_rows and len(scenario_dept_rows) > 0:
                    selected_dept_id = scenario_dept_rows[0]["department_id"]
                elif profile_id:
                    sql = load_sql("sql/v3/profile/get_departments_for_profile.sql")
                    profile_dept_rows = await conn.fetch(sql, profile_id)
                    if profile_dept_rows and len(profile_dept_rows) > 0:
                        selected_dept_id = profile_dept_rows[0]["id"]

            # For guests without departments, allow None and use empty array for randomization
            # This will select general/cross-department items (no department links)
            if not selected_dept_id:
                logger.info(
                    f"No department_id found for guest profile {profile_id}, "
                    "proceeding with general/cross-department items"
                )

            # Determine if we need to create a customized scenario variant
            # Only create variant if customization is needed (persona/parameters selected)
            needs_customization = data.persona_id or (
                data.parameter_item_ids and len(data.parameter_item_ids) > 0
            )

            scenario_id_override: str | None = None

            if needs_customization:
                # Create scenario variant with selected attributes (Option A)
                logger.info(
                    f"Creating customized scenario variant for persona={data.persona_id}, "
                    f"parameters={data.parameter_item_ids}"
                )

                # Get parent scenario metadata
                scenario = dict(parent_scenario)

                # Create child scenario variant
                sql = load_sql("sql/v3/scenarios/insert_scenario_variant.sql")
                new_scenario_row = await conn.fetchrow(
                    sql,
                    scenario["name"],
                    True,  # generated
                    True,  # active
                    scenario["hints_enabled"],
                    scenario["objectives_enabled"],
                    scenario["image_input_enabled"],
                )
                new_scenario_id = new_scenario_row["id"]
                logger.info(
                    f"Created child scenario variant {new_scenario_id} for parent {parent_scenario_id_uuid}"
                )

                # Create scenario_tree edge
                sql = load_sql("sql/v3/scenarios/insert_scenario_tree_edge.sql")
                await conn.execute(sql, parent_scenario_id_uuid, new_scenario_id, True)

                # Link persona (use selected persona for standard mode)
                if data.persona_id:
                    persona_id_to_link = uuid.UUID(data.persona_id)
                    sql = load_sql("sql/v3/scenarios/insert_scenario_persona_link.sql")
                    await conn.execute(sql, new_scenario_id, persona_id_to_link, True)
                    logger.info(
                        f"Linked persona {persona_id_to_link} to child scenario"
                    )

                # Link parameter items (use selected ones)
                if data.parameter_item_ids:
                    sql = load_sql(
                        "sql/v3/scenarios/insert_scenario_parameter_link.sql"
                    )
                    for param_id_str in data.parameter_item_ids:
                        param_id = uuid.UUID(param_id_str)
                        await conn.execute(sql, new_scenario_id, param_id, True)
                    logger.info(
                        f"Linked {len(data.parameter_item_ids)} parameter item(s) to child scenario"
                    )

                # Link department (only if we have one)
                if selected_dept_id:
                    sql = load_sql(
                        "sql/v3/scenarios/insert_scenario_department_link.sql"
                    )
                    await conn.execute(sql, new_scenario_id, selected_dept_id, True)
                    logger.info(
                        f"Linked department {selected_dept_id} to child scenario"
                    )
                else:
                    logger.info(
                        "No department to link - scenario will be cross-department"
                    )

                scenario_id_override = str(new_scenario_id)

            # Call the normal start_simulation workflow
            # This will handle scenario generation, randomization, and all other logic
            logger.info(
                f"Calling start_simulation with simulation_id={simulation_id}, "
                f"scenario_id={scenario_id_override}"
            )

            start_payload = StartSimulationPayload(
                simulation_id=simulation_id,
                profile_id=profile_id if profile_id else None,
                scenario_id=scenario_id_override,
                infinite=False,
                infinite_time_limit=None,
            )

            # Call the normal simulation start handler
            # It will handle all response emissions (simulation_started event)
            await _simulation_text_start_impl(sid, start_payload)

    except Exception as e:
        logger.error(
            f"Error creating practice scenario for {sid}: {str(e)}", exc_info=True
        )
        await simulation_text_practice_error(
            CreatePracticeScenarioErrorPayload(
                success=False, message=f"Failed to create practice scenario: {str(e)}"
            ),
            room=sid,
        )
        logger.error(
            f"Emitted error to {sid}: Failed to create practice scenario: {str(e)}"
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="simulations.text.practiced",
                template="{{ actor.name }} failed to create practice scenario",
                context={"error": str(e)},
                endpoint="/socket/v3/simulations/text/practice",
                error=True,
            )
        except Exception as log_error:
            logger.warning(
                f"Error logging practice scenario error activity: {log_error}"
            )


@sio.event  # type: ignore
async def simulation_text_practice(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = CreatePracticeScenarioPayload(**data)
        await _simulation_text_practice_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in simulation_text_practice for {sid}: {e}")
        await simulation_text_practice_error(
            CreatePracticeScenarioErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="simulations.text.practiced",
                template="{{ actor.name }} failed to create practice scenario (invalid payload)",
                context={"error": str(e)},
                endpoint="/socket/v3/simulations/text/practice",
                error=True,
            )
        except Exception as log_error:
            logger.warning(
                f"Error logging practice scenario validation error activity: {log_error}"
            )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/practice", response_model=dict[str, bool])
async def simulation_text_practice_api(
    request: CreatePracticeScenarioPayload,
) -> dict[str, bool]:
    """Client-to-server event: Create and start a practice scenario simulation."""
    return {"success": True}


@server_router.post("/practice_error", response_model=dict[str, bool])
async def simulation_text_practice_error_api(
    request: CreatePracticeScenarioErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred while creating practice scenario."""
    return {"success": True}
