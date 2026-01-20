"""Simulation completion handler - listens to artifact_generation_complete events and emits granular simulation events."""

import uuid
from typing import Any, cast

from app.infra.v4.websocket.find_profile_by_socket import \
    find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.sql.types import (GetSimulationResourceIdsByGroupIdSqlParams,
                           GetSimulationResourceIdsByGroupIdSqlRow)
from fastapi import APIRouter
from app.utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/simulations/get_simulation_resource_ids_by_group_id_complete.sql"


@internal_sio.on("resource_complete")  # type: ignore
async def handle_simulation_artifact_complete(data: dict[str, Any]) -> None:
    """Handle resource_complete internal event - filter by simulation artifact_type and emit granular event."""
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
    resource_id_str = data.get("resource_id")
    resource_type = data.get("resource_type")

    if not group_id_str or not resource_type:
        return

    # If no resource_id, this is an error - we expected a tool call to create a resource
    # Emit resource_error so the error handler can process it and unblock the frontend
    if not resource_id_str:
        # Emit resource_error - the simulations error handler will pick it up and emit simulation_generation_error to client
        await internal_sio.emit(
            "resource_error",
            {
                "sid": sid,
                "artifact_type": "simulation",
                "group_id": group_id_str,
                "resource_type": resource_type,
                "error_message": f"Model generated text but did not call the {resource_type} creation tool. Expected a tool call to create a resource.",
                "trace_id": data.get("trace_id"),
            },
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
        await sio.emit(
            "artifact_generation_error",
            {
                "artifact_type": "simulation",
                "resource_type": resource_type,
                "group_id": group_id_str,
                "success": False,
                "message": str(e),
            },
            room=sid,
        )
        return

    # Emit granular event with mapped resource ID (one field set, others NULL)
    await sio.emit(
        "simulation_generation_complete",
        {
            "artifact_type": "simulation",
            "group_id": group_id_str,
            "resource_type": resource_type,
            "name_id": str(result.name_id) if result.name_id else None,
            "description_id": str(result.description_id) if result.description_id else None,
            "active_flag_id": str(result.active_flag_id) if result.active_flag_id else None,
            "department_ids": [str(did) for did in (result.department_ids or [])],
            "scenario_ids": [str(sid) for sid in (result.scenario_ids or [])],
            "scenario_flag_ids": [str(sfid) for sfid in (result.scenario_flag_ids or [])],
            "scenario_position_ids": [str(spid) for spid in (result.scenario_position_ids or [])],
            "scenario_rubric_ids": [str(srid) for srid in (result.scenario_rubric_ids or [])],
            "scenario_time_limit_ids": [str(stlid) for stlid in (result.scenario_time_limit_ids or [])],
            "success": True,
            "message": f"{resource_type} generation completed successfully",
            "run_id": data.get("run_id"),
            "type": data.get("type", "run_complete"),
        },
        room=sid,
    )
