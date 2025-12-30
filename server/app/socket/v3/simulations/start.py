"""Handler for simulation_start WebSocket event."""

import json
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import asyncpg  # type: ignore
from agents import (
    FunctionToolResult,
    RunContextWrapper,
    Runner,
    Tool,
    ToolsToFinalOutputResult,
    function_tool,
    gen_trace_id,
    trace,
)
from agents.items import TResponseInputItem
from fastapi import APIRouter
from pydantic import BaseModel, Field, ValidationError
from utils.logging.db_logger import get_logger
from utils.sql_helper import load_sql

from app.infra.v3.activity.websocket_logger import log_websocket_activity
from app.infra.v3.agents.generic_agent import GenericAgent
from app.infra.v3.debug.debug_info import DebugContext
from app.infra.v3.debug.debug_info import debug_info as debug_info_tool
from app.infra.v3.documents.format_document_info import format_document_info
from app.main import get_internal_sio, get_pool, sio

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for server-to-client events
class StartSimulationErrorPayload(BaseModel):
    """Response indicating an error occurred while starting simulation."""

    success: bool
    message: str


class SimulationStartedPayload(BaseModel):
    """Response indicating simulation started successfully."""

    success: bool
    message: str
    attempt_id: str


# Pydantic model for client-to-server event
class StartSimulationPayload(BaseModel):
    """Request to start a simulation attempt."""

    simulation_id: str | None = None  # Optional for practice mode
    profile_id: str | None = None
    scenario_id: str | None = None
    infinite: bool = False
    # Practice mode fields (when practice_mode=True, simulation_id can be None)
    practice_mode: bool = False
    practice_persona_id: str | None = None
    practice_parameter_item_ids: list[str] = []
    practice_department_id: str | None = None


# Emit helper functions
async def simulation_start_error(
    payload: StartSimulationErrorPayload, room: str
) -> None:
    await sio.emit("simulations_start_error", payload.model_dump(), room=room)


async def simulation_started(payload: SimulationStartedPayload, room: str) -> None:
    await sio.emit("simulations_started", payload.model_dump(), room=room)


# Chat creation helpers (moved from simulation_text/start.py)
async def _create_chat_with_randomization(
    conn: asyncpg.Connection,
    scenario_id: str,
    attempt_id: str,
    profile_id: str | None,
    mark_completed: bool,
) -> dict[str, Any] | None:
    """
    Create a chat for a scenario.
    
    For skipped chats (mark_completed=True): Creates a child scenario variant that copies
    the parent's links (no randomization), then creates the chat.
    
    Note: For active chats, randomization is handled by generate.py via next.py.
    This function is only used for skipped chats in end.py.
    """
    # Get parent scenario by ID (NEVER modify the original scenario)
    sql = load_sql("app/sql/v3/scenario/get_scenario_by_id.sql")
    parent_scenario = await conn.fetchrow(sql, scenario_id)
    if not parent_scenario:
        return None

    # Convert asyncpg UUID to Python UUID
    parent_scenario_id_uuid = uuid.UUID(str(parent_scenario["id"]))
    parent_scenario_dict = dict(parent_scenario)
    
    # For skipped chats, create a child scenario variant that copies parent's links (no randomization)
    # Randomization is handled by generate.py via next.py for active chats
    scenario_title = parent_scenario_dict.get("name", "")
    
    sql = load_sql("app/sql/v3/scenario/insert_scenario_variant.sql")
    new_scenario_row = await conn.fetchrow(
        sql,
        scenario_title or parent_scenario_dict.get("name", ""),
        True,  # generated
        True,  # active
        parent_scenario_dict.get("objectives_enabled", True),
        parent_scenario_dict.get("images_enabled", True),
        parent_scenario_dict.get("scenario_agent_id"),
        parent_scenario_dict.get("image_agent_id"),
    )
    child_scenario_id = new_scenario_row["id"]
    
    # Link scenario tree edge
    sql = load_sql("app/sql/v3/scenario/insert_scenario_tree_edge.sql")
    await conn.execute(
        sql,
        parent_scenario_id_uuid,
        child_scenario_id,
        True,
    )
    
    # Copy parent's links (personas, documents, parameters, departments)
    # Get parent's personas
    sql = load_sql("app/sql/v3/scenario/get_scenario_personas.sql")
    parent_personas = await conn.fetch(sql, parent_scenario_id_uuid)
    for persona_row in parent_personas:
        sql = load_sql("app/sql/v3/scenario/insert_scenario_persona_link.sql")
        await conn.execute(sql, child_scenario_id, persona_row["persona_id"], True)
    
    # Get parent's documents
    sql = load_sql("app/sql/v3/scenario/get_scenario_documents.sql")
    parent_documents = await conn.fetch(sql, parent_scenario_id_uuid)
    for doc_row in parent_documents:
        sql = load_sql("app/sql/v3/scenario/insert_scenario_document_link.sql")
        await conn.execute(sql, child_scenario_id, doc_row["document_id"], True)
    
    # Get parent's parameter items
    sql = load_sql("app/sql/v3/scenario/get_scenario_parameter_items.sql")
    parent_parameter_items = await conn.fetch(sql, parent_scenario_id_uuid)
    for param_row in parent_parameter_items:
        sql = load_sql("app/sql/v3/scenario/insert_scenario_parameter_link.sql")
        await conn.execute(sql, child_scenario_id, param_row["parameter_item_id"], True)
    
    # Get parent's departments
    sql = load_sql("app/sql/v3/scenario/get_scenario_departments.sql")
    parent_departments = await conn.fetch(sql, parent_scenario_id_uuid)
    for dept_row in parent_departments:
        sql = load_sql("app/sql/v3/scenario/insert_scenario_department_link.sql")
        await conn.execute(sql, child_scenario_id, dept_row["department_id"], True)
    
    logger.info(
        f"Created child scenario {child_scenario_id} for parent {parent_scenario_id_uuid} "
        f"(copied {len(parent_personas)} persona(s), {len(parent_documents)} document(s), "
        f"{len(parent_parameter_items)} parameter item(s), {len(parent_departments)} department(s))"
    )
    
    # Create chat using child scenario ID
    chat_title = parent_scenario_dict.get("name", "")
    trace_id = gen_trace_id()
    
    sql = load_sql("app/sql/v3/simulations/create_simulation_chat.sql")
    chat = await conn.fetchrow(
        sql,
        datetime.now(UTC),
        chat_title,
        str(child_scenario_id),
        attempt_id,
        mark_completed,
        trace_id,
    )
    
    return dict(chat) if chat else None


# Internal event handler for chat creation
@internal_sio.on("simulation_chat_create")
async def simulation_chat_create_internal(data: dict[str, Any]) -> None:
    """Handle simulation_chat_create event from internal bus (server-to-server).

    This handler creates a new chat for skipped scenarios.
    Called by end.py when it needs to create a new chat.
    """
    try:
        scenario_id = data.get("scenario_id")
        attempt_id = data.get("attempt_id")
        profile_id = data.get("profile_id")
        mark_completed = data.get("mark_completed", False)

        if not scenario_id or not attempt_id:
            logger.error(
                "[simulation_chat_create_internal] Missing required fields: scenario_id or attempt_id"
            )
            return

        pool = get_pool()
        if not pool:
            logger.error(
                "[simulation_chat_create_internal] Database connection pool not available"
            )
            return

        async with pool.acquire() as conn:
            chat = await _create_chat_with_randomization(
                conn=conn,
                scenario_id=str(scenario_id),
                attempt_id=str(attempt_id),
                profile_id=str(profile_id) if profile_id else None,
                mark_completed=bool(mark_completed),
            )

            if chat:
                logger.info(
                    f"[simulation_chat_create_internal] Created chat {chat.get('id')} for scenario {scenario_id}"
                )
                # Emit completion event if callback provided
                if "callback" in data:
                    callback_data = data["callback"]
                    await internal_sio.emit(
                        callback_data.get("event", "simulation_chat_created"),
                        {
                            **callback_data.get("payload", {}),
                            "chat_id": str(chat["id"]),
                            "chat": chat,
                        },
                    )
            else:
                logger.error(
                    f"[simulation_chat_create_internal] Failed to create chat for scenario {scenario_id}"
                )

    except Exception as e:
        logger.error(
            f"[simulation_chat_create_internal] Error creating chat: {str(e)}",
            exc_info=True,
        )


# Direct callable function for when return value is needed
async def simulation_chat_create_impl(
    conn: asyncpg.Connection,
    scenario_id: str,
    attempt_id: str,
    profile_id: str | None,
    mark_completed: bool,
) -> dict[str, Any] | None:
    """Direct callable implementation for creating chat.

    This can be called directly when the return value is needed (e.g., from end.py).
    The internal event handler wraps this function.
    """
    return await _create_chat_with_randomization(
        conn=conn,
        scenario_id=scenario_id,
        attempt_id=attempt_id,
        profile_id=profile_id,
        mark_completed=mark_completed,
    )


async def _simulation_start_impl(sid: str, data: StartSimulationPayload) -> None:
    """
    Handle simulation start requests via WebSocket.
    Creates attempt and checks for next incomplete scenario, then emits to next.py if found.
    """
    try:
        logger.info(
            f"Received simulation_start request from {sid} with data: {data}"
        )

        simulation_id = data.simulation_id
        profile_id = data.profile_id
        scenario_id_override = data.scenario_id
        infinite = data.infinite

        # Validate profile_id is required
        if not profile_id or profile_id == "" or profile_id == "null":
            await simulation_start_error(
                StartSimulationErrorPayload(
                    success=False, message="profileId is required"
                ),
                room=sid,
            )
            logger.error(f"Emitted error to {sid}: profileId is required")
            return

        # Validate simulation_id (required unless in practice mode)
        if not data.practice_mode and not simulation_id:
            logger.error(f"Missing simulation_id in request from {sid}")
            await simulation_start_error(
                StartSimulationErrorPayload(
                    success=False, message="Missing simulation_id"
                ),
                room=sid,
            )
            logger.error(f"Emitted error to {sid}: Missing simulation_id")
            return

        logger.info(
            f"Processing simulation start: simulation_id={simulation_id}, profile_id={profile_id}, practice_mode={data.practice_mode}, sid={sid}"
        )

        # Get connection pool
        pool = get_pool()
        if not pool:
            await simulation_start_error(
                StartSimulationErrorPayload(
                    success=False, message="Database connection pool not available"
                ),
                room=sid,
            )
            logger.error(
                f"Emitted error to {sid}: Database connection pool not available"
            )
            return

        async with pool.acquire() as conn:
            # Handle practice mode: find simulation and create variant if needed
            if data.practice_mode:
                # Practice mode: find practice simulation with persona
                if not data.practice_persona_id:
                    await simulation_start_error(
                        StartSimulationErrorPayload(
                            success=False, message="Missing persona_id for practice mode"
                        ),
                        room=sid,
                    )
                    return

                # Find practice simulation with persona
                department_ids = (
                    [data.practice_department_id] if data.practice_department_id else []
                )
                sql = load_sql(
                    "app/sql/v3/practice/find_practice_simulation_with_persona.sql"
                )
                result = await conn.fetchrow(sql, data.practice_persona_id, department_ids)

                if not result:
                    await simulation_start_error(
                        StartSimulationErrorPayload(
                            success=False,
                            message=f"No practice simulation found for persona {data.practice_persona_id}",
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
                sql = load_sql("app/sql/v3/scenario/get_scenario_by_id.sql")
                parent_scenario = await conn.fetchrow(sql, parent_scenario_id)
                if not parent_scenario:
                    await simulation_start_error(
                        StartSimulationErrorPayload(
                            success=False, message="Parent scenario not found"
                        ),
                        room=sid,
                    )
                    return

                parent_scenario_dict = dict(parent_scenario)
                parent_scenario_id_uuid = uuid.UUID(parent_scenario_id)

                # Determine department_id (allow None for guests)
                selected_dept_id: uuid.UUID | None = None
                if data.practice_department_id:
                    selected_dept_id = uuid.UUID(data.practice_department_id)
                else:
                    # Fallback: get from scenario or profile
                    sql = load_sql("app/sql/v3/scenario/get_scenario_departments.sql")
                    scenario_dept_rows = await conn.fetch(sql, parent_scenario_id_uuid)
                    if scenario_dept_rows and len(scenario_dept_rows) > 0:
                        selected_dept_id = scenario_dept_rows[0]["department_id"]
                    elif profile_id:
                        sql = load_sql("app/sql/v3/profile/get_departments_for_profile.sql")
                        profile_dept_rows = await conn.fetch(sql, profile_id)
                        if profile_dept_rows and len(profile_dept_rows) > 0:
                            selected_dept_id = profile_dept_rows[0]["id"]

                # For guests without departments, allow None and use empty array for randomization
                if not selected_dept_id:
                    logger.info(
                        f"No department_id found for guest profile {profile_id}, "
                        "proceeding with general/cross-department items"
                    )

                # Determine if we need to create a customized scenario variant
                needs_customization = data.practice_persona_id or (
                    data.practice_parameter_item_ids
                    and len(data.practice_parameter_item_ids) > 0
                )

                if needs_customization:
                    # Create scenario variant with selected attributes
                    logger.info(
                        f"Creating customized scenario variant for persona={data.practice_persona_id}, "
                        f"parameters={data.practice_parameter_item_ids}"
                    )

                    # Create child scenario variant
                    sql = load_sql("app/sql/v3/scenario/insert_scenario_variant.sql")
                    new_scenario_row = await conn.fetchrow(
                        sql,
                        parent_scenario_dict["name"],
                        True,  # generated
                        True,  # active
                        parent_scenario_dict.get("objectives_enabled", True),
                        parent_scenario_dict.get("images_enabled", True),
                        parent_scenario_dict.get("scenario_agent_id"),
                        parent_scenario_dict.get("image_agent_id"),
                    )
                    new_scenario_id = new_scenario_row["id"]
                    logger.info(
                        f"Created child scenario variant {new_scenario_id} for parent {parent_scenario_id_uuid}"
                    )

                    # Create scenario_tree edge
                    sql = load_sql("app/sql/v3/scenario/insert_scenario_tree_edge.sql")
                    await conn.execute(
                        sql, parent_scenario_id_uuid, new_scenario_id, True
                    )

                    # Link persona
                    if data.practice_persona_id:
                        persona_id_to_link = uuid.UUID(data.practice_persona_id)
                        sql = load_sql(
                            "app/sql/v3/scenario/insert_scenario_persona_link.sql"
                        )
                        await conn.execute(sql, new_scenario_id, persona_id_to_link, True)
                        logger.info(
                            f"Linked persona {persona_id_to_link} to child scenario"
                        )

                    # Link parameter items
                    if data.practice_parameter_item_ids:
                        sql = load_sql(
                            "app/sql/v3/scenario/insert_scenario_parameter_link.sql"
                        )
                        for param_id_str in data.practice_parameter_item_ids:
                            param_id = uuid.UUID(param_id_str)
                            await conn.execute(sql, new_scenario_id, param_id, True)
                        logger.info(
                            f"Linked {len(data.practice_parameter_item_ids)} parameter item(s) to child scenario"
                        )

                    # Link department
                    if selected_dept_id:
                        sql = load_sql(
                            "app/sql/v3/scenario/insert_scenario_department_link.sql"
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
                else:
                    # No customization needed, use parent scenario
                    scenario_id_override = parent_scenario_id

            # Generate trace_id
            from agents import gen_trace_id

            trace_id = gen_trace_id()

            # Create attempt using SQL
            sql = load_sql(
                "app/sql/v3/simulations/start_simulation_attempt_complete.sql"
            )
            row = await conn.fetchrow(
                sql,
                simulation_id,
                infinite,
                profile_id if profile_id else None,
                scenario_id_override if scenario_id_override else None,
                trace_id,
            )

            if not row:
                await simulation_start_error(
                    StartSimulationErrorPayload(
                        success=False, message="Failed to start simulation attempt"
                    ),
                    room=sid,
                )
                logger.error(
                    f"Emitted error to {sid}: Failed to start simulation attempt"
                )
                return

            attempt_id = row["attempt_id"]

            # Check if there's a next incomplete scenario
            sql = load_sql(
                "app/sql/v3/simulations/check_next_incomplete_scenario.sql"
            )
            next_scenario_row = await conn.fetchrow(sql, attempt_id)

            if not next_scenario_row:
                await simulation_start_error(
                    StartSimulationErrorPayload(
                        success=False,
                        message="Failed to check for next scenario",
                    ),
                    room=sid,
                )
                logger.error(
                    f"Emitted error to {sid}: Failed to check for next scenario"
                )
                return

            has_next_scenario = next_scenario_row.get("has_next_scenario", False)
            next_scenario_id = next_scenario_row.get("next_scenario_id")

            # Emit success event
            await simulation_started(
                SimulationStartedPayload(
                    success=True,
                    message="Simulation attempt created successfully",
                    attempt_id=str(attempt_id),
                ),
                room=sid,
            )

            # If there's a next scenario, emit to next.py handler
            if has_next_scenario and next_scenario_id:
                logger.info(
                    f"Found next scenario {next_scenario_id} for attempt {attempt_id}, emitting to next.py"
                )
                await internal_sio.emit(
                    "simulation_next",
                    {
                        "attempt_id": str(attempt_id),
                        "scenario_id": str(next_scenario_id),
                        "profile_id": profile_id,
                        "simulation_id": simulation_id,
                    },
                )

            # Log activity
            try:
                await log_websocket_activity(
                    sid=sid,
                    event_key="simulations.started",
                    template="{{ actor.name }} started simulation",
                    context={"attempt_id": str(attempt_id)},
                    endpoint="/socket/v3/simulations/start",
                    error=False,
                )
            except Exception as log_error:
                logger.warning(
                    f"Error logging simulation start activity: {log_error}"
                )

    except Exception as e:
        logger.error(f"Error starting simulation for {sid}: {str(e)}", exc_info=True)
        await simulation_start_error(
            StartSimulationErrorPayload(
                success=False, message=f"Failed to start simulation: {str(e)}"
            ),
            room=sid,
        )
        logger.error(f"Emitted error to {sid}: Failed to start simulation: {str(e)}")
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="simulations.started",
                template="{{ actor.name }} failed to start simulation",
                context={"error": str(e)},
                endpoint="/socket/v3/simulations/start",
                error=True,
            )
        except Exception as log_error:
            logger.warning(
                f"Error logging simulation start error activity: {log_error}"
            )


@sio.event  # type: ignore
async def simulation_start(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = StartSimulationPayload(**data)
        await _simulation_start_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in simulation_start for {sid}: {e}")
        await simulation_start_error(
            StartSimulationErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="simulations.started",
                template="{{ actor.name }} failed to start simulation (invalid payload)",
                context={"error": str(e)},
                endpoint="/socket/v3/simulations/start",
                error=True,
            )
        except Exception as log_error:
            logger.warning(
                f"Error logging simulation start validation error activity: {log_error}"
            )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/start", response_model=dict[str, bool])
async def simulation_start_api(request: StartSimulationPayload) -> dict[str, bool]:
    """Client-to-server event: Start simulation attempt."""
    return {"success": True}


@server_router.post("/start_error", response_model=dict[str, bool])
async def simulation_start_error_api(
    request: StartSimulationErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred while starting simulation."""
    return {"success": True}


@server_router.post("/started", response_model=dict[str, bool])
async def simulation_started_api(
    request: SimulationStartedPayload,
) -> dict[str, bool]:
    """Server-to-client event: Simulation started successfully."""
    return {"success": True}

