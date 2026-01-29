"""Handler for simulation_start WebSocket event."""

import uuid
from datetime import UTC, datetime
from typing import Any, cast

import asyncpg  # type: ignore

# Removed gen_trace_id import - trace_id comes from SQL
from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.sql.types import (
    CheckNextIncompleteScenarioSqlParams,
    CheckNextIncompleteScenarioSqlRow,
    StartSimulationAttemptSqlParams,
    StartSimulationAttemptSqlRow,
)
from app.utils.sql_helper import execute_sql_typed, load_sql

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
    # profile_id removed - retrieved via find_profile_by_socket(sid)
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
    await sio.emit("simulation_start_error", payload.model_dump(), room=room)


async def simulation_started(payload: SimulationStartedPayload, room: str) -> None:
    await sio.emit("simulation_started", payload.model_dump(), room=room)


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
    sql = load_sql("app/sql/v4/queries/scenario/get_scenario_by_id.sql")
    parent_scenario = await conn.fetchrow(sql, scenario_id)
    if not parent_scenario:
        return None

    # Convert asyncpg UUID to Python UUID
    parent_scenario_id_uuid = uuid.UUID(str(parent_scenario["id"]))
    parent_scenario_dict = dict(parent_scenario)

    # For skipped chats, create a child scenario variant that copies parent's links (no randomization)
    # Randomization is handled by generate.py via next.py for active chats
    scenario_title = parent_scenario_dict.get("name", "")

    sql = load_sql("app/sql/v4/queries/scenario/insert_scenario_variant.sql")
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
    sql = load_sql("app/sql/v4/queries/scenario/insert_scenario_tree_edge.sql")
    await conn.execute(
        sql,
        parent_scenario_id_uuid,
        child_scenario_id,
        True,
    )

    # Copy parent's links (personas, documents, parameters, departments)
    # Get parent's personas
    sql = load_sql("app/sql/v4/queries/scenario/get_scenario_personas.sql")
    parent_personas = await conn.fetch(sql, parent_scenario_id_uuid)
    for persona_row in parent_personas:
        sql = load_sql("app/sql/v4/queries/scenario/insert_scenario_persona_link.sql")
        await conn.execute(sql, child_scenario_id, persona_row["persona_id"], True)

    # Get parent's documents
    sql = load_sql("app/sql/v4/queries/scenario/get_scenario_documents.sql")
    parent_documents = await conn.fetch(sql, parent_scenario_id_uuid)
    for doc_row in parent_documents:
        sql = load_sql("app/sql/v4/queries/scenario/insert_scenario_document_link.sql")
        await conn.execute(sql, child_scenario_id, doc_row["document_id"], True)

    # Get parent's parameter items
    sql = load_sql("app/sql/v4/queries/scenario/get_scenario_parameter_items.sql")
    parent_parameter_items = await conn.fetch(sql, parent_scenario_id_uuid)
    for param_row in parent_parameter_items:
        sql = load_sql("app/sql/v4/queries/scenario/insert_scenario_parameter_link.sql")
        await conn.execute(sql, child_scenario_id, param_row["parameter_item_id"], True)

    # Get parent's departments
    sql = load_sql("app/sql/v4/queries/scenario/get_scenario_departments.sql")
    parent_departments = await conn.fetch(sql, parent_scenario_id_uuid)
    for dept_row in parent_departments:
        sql = load_sql(
            "app/sql/v4/queries/scenario/insert_scenario_department_link.sql"
        )
        await conn.execute(sql, child_scenario_id, dept_row["department_id"], True)

    # Create chat using child scenario ID (trace_id auto-generated by database)
    chat_title = parent_scenario_dict.get("name", "")

    sql = load_sql("app/sql/v4/queries/simulations/create_simulation_chat.sql")
    chat = await conn.fetchrow(
        sql,
        datetime.now(UTC),
        chat_title,
        str(child_scenario_id),
        attempt_id,
        mark_completed,
    )

    # Get trace_id from SQL result (from groups.trace_id - auto-generated by database)
    if chat:
        return dict(chat)
    return None


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
            return

        # Replaced with get_db_connection()

        async with get_db_connection() as conn:
            chat = await _create_chat_with_randomization(
                conn=conn,
                scenario_id=str(scenario_id),
                attempt_id=str(attempt_id),
                profile_id=str(profile_id) if profile_id else None,
                mark_completed=bool(mark_completed),
            )

            if chat:
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
    except Exception:
        # Error in chat creation - Socket.IO handles logging
        pass


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
        # Get profile_id from socket lookup
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await simulation_start_error(
                StartSimulationErrorPayload(
                    success=False, message="Profile not found for socket"
                ),
                room=sid,
            )
            return
        profile_id = uuid.UUID(profile_id_str)

        simulation_id = data.simulation_id
        scenario_id_override = data.scenario_id
        infinite = data.infinite

        # Validate simulation_id (required unless in practice mode)
        if not data.practice_mode and not simulation_id:
            await simulation_start_error(
                StartSimulationErrorPayload(
                    success=False, message="Missing simulation_id"
                ),
                room=sid,
            )
            return

        async with get_db_connection() as conn:
            # Handle practice mode: find simulation and create variant if needed
            if data.practice_mode:
                # Practice mode: find practice simulation with persona
                if not data.practice_persona_id:
                    await simulation_start_error(
                        StartSimulationErrorPayload(
                            success=False,
                            message="Missing persona_id for practice mode",
                        ),
                        room=sid,
                    )
                    return

                # Find practice simulation with persona
                department_ids = (
                    [data.practice_department_id] if data.practice_department_id else []
                )
                sql = load_sql(
                    "app/sql/v4/queries/practice/find_practice_simulation_with_persona.sql"
                )
                result = await conn.fetchrow(
                    sql, data.practice_persona_id, department_ids
                )

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
                # Get parent scenario
                sql = load_sql("app/sql/v4/queries/scenario/get_scenario_by_id.sql")
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
                    sql = load_sql(
                        "app/sql/v4/queries/scenario/get_scenario_departments.sql"
                    )
                    scenario_dept_rows = await conn.fetch(sql, parent_scenario_id_uuid)
                    if scenario_dept_rows and len(scenario_dept_rows) > 0:
                        selected_dept_id = scenario_dept_rows[0]["department_id"]
                    elif profile_id:
                        sql = load_sql(
                            "app/sql/v4/queries/profile/get_departments_for_profile.sql"
                        )
                        profile_dept_rows = await conn.fetch(sql, profile_id)
                        if profile_dept_rows and len(profile_dept_rows) > 0:
                            selected_dept_id = profile_dept_rows[0]["id"]

                # For guests without departments, allow None and use empty array for randomization
                # Determine if we need to create a customized scenario variant
                needs_customization = data.practice_persona_id or (
                    data.practice_parameter_item_ids
                    and len(data.practice_parameter_item_ids) > 0
                )

                if needs_customization:
                    # Create scenario variant with selected attributes
                    # Create child scenario variant
                    sql = load_sql(
                        "app/sql/v4/queries/scenario/insert_scenario_variant.sql"
                    )
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
                    # Create scenario_tree edge
                    sql = load_sql(
                        "app/sql/v4/queries/scenario/insert_scenario_tree_edge.sql"
                    )
                    await conn.execute(
                        sql, parent_scenario_id_uuid, new_scenario_id, True
                    )

                    # Link persona
                    if data.practice_persona_id:
                        persona_id_to_link = uuid.UUID(data.practice_persona_id)
                        sql = load_sql(
                            "app/sql/v4/queries/scenario/insert_scenario_persona_link.sql"
                        )
                        await conn.execute(
                            sql, new_scenario_id, persona_id_to_link, True
                        )
                    # Link parameter items
                    if data.practice_parameter_item_ids:
                        sql = load_sql(
                            "app/sql/v4/queries/scenario/insert_scenario_parameter_link.sql"
                        )
                        for param_id_str in data.practice_parameter_item_ids:
                            param_id = uuid.UUID(param_id_str)
                            await conn.execute(sql, new_scenario_id, param_id, True)

                    # Link department
                    if selected_dept_id:
                        sql = load_sql(
                            "app/sql/v4/queries/scenario/insert_scenario_department_link.sql"
                        )
                        await conn.execute(sql, new_scenario_id, selected_dept_id, True)
                    else:
                        scenario_id_override = str(new_scenario_id)
                else:
                    # No customization needed, use parent scenario
                    scenario_id_override = parent_scenario_id

            # Create attempt using SQL (trace_id auto-generated by database and returned from groups.trace_id)
            SQL_PATH_START = (
                "app/sql/v4/queries/simulations/start_simulation_attempt_complete.sql"
            )
            # Ensure simulation_id is a UUID object (could be string from payload or UUID from database)
            if not simulation_id:
                # This should not happen due to validation above, but handle for type safety
                await simulation_start_error(
                    StartSimulationErrorPayload(
                        success=False, message="Missing simulation_id"
                    ),
                    room=sid,
                )
                return
            # Convert to UUID (handles both string and UUID object cases)
            if isinstance(simulation_id, uuid.UUID):
                simulation_id_uuid: uuid.UUID = simulation_id
            else:
                simulation_id_uuid = uuid.UUID(str(simulation_id))
            start_params = StartSimulationAttemptSqlParams(
                simulation_id=simulation_id_uuid,  # type: ignore[arg-type]
                infinite_mode=infinite,
                profile_id=profile_id,  # Already a UUID object from line 256
                scenario_id_override=uuid.UUID(scenario_id_override)
                if scenario_id_override
                else None,
            )
            result = cast(
                StartSimulationAttemptSqlRow,
                await execute_sql_typed(conn, SQL_PATH_START, params=start_params),
            )

            if not result:
                await simulation_start_error(
                    StartSimulationErrorPayload(
                        success=False, message="Failed to start simulation attempt"
                    ),
                    room=sid,
                )
                return

            # Get trace_id from SQL result (from groups.trace_id - auto-generated by database)
            trace_id = result.trace_id
            attempt_id = result.attempt_id

            # Check if there's a next incomplete scenario
            next_scenario_result = cast(
                CheckNextIncompleteScenarioSqlRow,
                await execute_sql_typed(
                    conn,
                    "app/sql/v4/queries/simulations/check_next_incomplete_scenario_complete.sql",
                    params=CheckNextIncompleteScenarioSqlParams(
                        attempt_id=uuid.UUID(attempt_id)
                    ),
                ),
            )

            if not next_scenario_result:
                await simulation_start_error(
                    StartSimulationErrorPayload(
                        success=False,
                        message="Failed to check for next scenario",
                    ),
                    room=sid,
                )
                return

            has_next_scenario = next_scenario_result.has_next_scenario or False
            next_scenario_id = (
                str(next_scenario_result.next_scenario_id)
                if next_scenario_result.next_scenario_id
                else None
            )

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
                await internal_sio.emit(
                    "simulation_next",
                    {
                        "attempt_id": str(attempt_id),
                        "scenario_id": str(next_scenario_id),
                        "profile_id": str(profile_id),
                        "simulation_id": str(simulation_id) if simulation_id else None,
                    },
                )

            # Log activity
            try:
                await log_websocket_activity(
                    sid=sid,
                    event_key="simulations.started",
                    template="{{ actor.name }} started simulation",
                    context={"attempt_id": str(attempt_id)},
                    endpoint="/socket/v4/simulations/start",
                    error=False,
                )
            except Exception:
                pass
    except Exception as e:
        await simulation_start_error(
            StartSimulationErrorPayload(
                success=False, message=f"Failed to start simulation: {str(e)}"
            ),
            room=sid,
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="simulations.started",
                template="{{ actor.name }} failed to start simulation",
                context={"error": str(e)},
                endpoint="/socket/v4/simulations/start",
                error=True,
            )
        except Exception:
            pass


@sio.event  # type: ignore
async def simulation_start(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = StartSimulationPayload(**data)
        await _simulation_start_impl(sid, validated)
    except ValidationError as e:
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
                endpoint="/socket/v4/simulations/start",
                error=True,
            )
        except Exception:
            pass


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
