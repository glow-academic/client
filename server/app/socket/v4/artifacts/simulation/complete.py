"""Simulation completion handler - listens to generate_call_complete events and emits granular simulation events."""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.api.v4.resources.scenarios.get import get_scenarios_internal
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.simulation.types import (
    SimulationGenerationCompleteEvent,
    SimulationGenerationErrorEvent,
)
from app.sql.types import (
    GetSimulationResourceIdsByGroupIdSqlParams,
    GetSimulationResourceIdsByGroupIdSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/queries/simulations/get_simulation_resource_ids_by_group_id_complete.sql"


@internal_sio.on("generate_call_complete")  # type: ignore
async def handle_simulation_artifact_complete(data: dict[str, Any]) -> None:
    """Handle generate_call_complete events - filter by simulation artifact_type and emit granular event."""
    # Skip processing if in eval mode - benchmark handlers will handle evals
    eval_mode = data.get("eval_mode", False)
    if eval_mode:
        return  # Don't process evals - benchmark handlers will handle them

    # Filter by artifact_type (SQL will also validate, but early return for efficiency)
    artifact_type = data.get("artifact_type")
    if artifact_type != "simulation":
        return  # Not for us

    sid = data.get("sid", "")
    if not sid:
        return  # No socket ID, can't emit to client

    # Get profile_id from sid
    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        return
    profile_id = uuid.UUID(profile_id_str)

    # Extract all data from event (no Python filtering for resource_type - SQL handles it)
    group_id_str = data.get("group_id")
    event_type = data.get("event_type")

    # Only process actual tool completion events, not summary events
    if event_type not in ("tool_call_complete", "tool_result"):
        return

    tool_result = data.get("result") or {}
    tool_results = data.get("tool_results") or []
    if not tool_result and tool_results:
        tool_result = tool_results[0]
    if event_type == "tool_call_complete" and not tool_result and not tool_results:
        return
    resource_id_str = tool_result.get("resource_id")
    resource_type = data.get("resource_type")

    if not group_id_str or not resource_type:
        return

    if not resource_id_str:
        # Check if this was a tool failure (e.g., duplicate key error)
        # In that case, the error was already returned to the model for retry
        # and we don't need to emit an error event to the client
        tool_success = tool_result.get("success", True)
        if not tool_success:
            # Tool execution failed - this is expected and model can retry
            # Don't emit error since other successful calls may have completed
            return
        error_event = SimulationGenerationErrorEvent(
            group_id=group_id_str,
            resource_type=resource_type,
            message=f"Missing resource_id for {resource_type} tool result",
        )
        await sio.emit(
            "simulation_generation_error",
            error_event.model_dump(mode="json"),
            room=sid,
        )
        return

    group_id = uuid.UUID(group_id_str)
    resource_id = uuid.UUID(resource_id_str)

    # Query SQL function - SQL handles validation and mapping (no-op, no queries)
    try:
        async with get_db_connection() as conn:
            params = GetSimulationResourceIdsByGroupIdSqlParams(
                profile_id=profile_id,
                group_id=group_id,
                resource_id=resource_id,
                resource_type=resource_type,
                artifact_type="simulation",  # Always "simulation" for this handler
            )
            result = cast(
                GetSimulationResourceIdsByGroupIdSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )
    except Exception as e:
        # SQL function raised error (validation failed) - emit error to client
        error_event = SimulationGenerationErrorEvent(
            group_id=group_id_str,
            resource_type=resource_type,
            message=str(e),
        )
        await sio.emit(
            "simulation_generation_error",
            error_event.model_dump(mode="json"),
            room=sid,
        )
        return

    # For scenarios, fetch full objects for AI diff view
    scenario_resources = None
    if resource_type == "scenarios" and result.scenario_ids:
        try:
            async with get_db_connection() as conn:
                scenario_resources = await get_scenarios_internal(
                    conn, result.scenario_ids, bypass_cache=True
                )
        except Exception:
            # If fetch fails, continue without full objects (IDs are still available)
            pass

    # Emit granular event with mapped resource ID (one field set, others NULL)
    complete_event = SimulationGenerationCompleteEvent(
        group_id=group_id_str,
        resource_type=resource_type,
        name_id=str(result.name_id) if result.name_id else None,
        description_id=str(result.description_id) if result.description_id else None,
        active_flag_id=str(result.active_flag_id) if result.active_flag_id else None,
        department_ids=[str(did) for did in (result.department_ids or [])],
        scenario_ids=[str(s_id) for s_id in (result.scenario_ids or [])],
        scenario_resources=scenario_resources,
        scenario_flag_ids=[str(sfid) for sfid in (result.scenario_flag_ids or [])],
        scenario_position_ids=[
            str(spid) for spid in (result.scenario_position_ids or [])
        ],
        scenario_rubric_ids=[str(srid) for srid in (result.scenario_rubric_ids or [])],
        scenario_time_limit_ids=[
            str(stlid) for stlid in (result.scenario_time_limit_ids or [])
        ],
        success=True,
        message=f"{resource_type} generation completed successfully",
        run_id=data.get("run_id"),
        type=data.get("type", "complete"),
    )
    await sio.emit(
        "simulation_generation_complete",
        complete_event.model_dump(mode="json"),
        room=sid,
    )
