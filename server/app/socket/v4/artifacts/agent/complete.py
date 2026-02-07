"""Agent completion handler - listens to generate_call_complete events and emits granular agent events."""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.sql.types import (
    GetAgentResourceIdsByGroupIdSqlParams,
    GetAgentResourceIdsByGroupIdSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/queries/agents/get_agent_resource_ids_by_group_id_complete.sql"


@internal_sio.on("generate_call_complete")  # type: ignore
async def handle_agent_artifact_complete(data: dict[str, Any]) -> None:
    """Handle generate_call_complete events - filter by agent artifact_type and emit granular event."""
    # Skip processing if in eval mode - benchmark handlers will handle evals
    eval_mode = data.get("eval_mode", False)
    if eval_mode:
        return  # Don't process evals - benchmark handlers will handle them

    # Filter by artifact_type (SQL will also validate, but early return for efficiency)
    artifact_type = data.get("artifact_type")
    if artifact_type != "agent":
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
        await sio.emit(
            "agent_generation_error",
            {
                "artifact_type": "agent",
                "resource_type": resource_type,
                "group_id": group_id_str,
                "success": False,
                "message": f"Missing resource_id for {resource_type} tool result",
            },
            room=sid,
        )
        return

    group_id = uuid.UUID(group_id_str)
    resource_id = uuid.UUID(resource_id_str)

    # Query SQL function - SQL handles validation and mapping (no-op, no queries)
    try:
        async with get_db_connection() as conn:
            params = GetAgentResourceIdsByGroupIdSqlParams(
                profile_id=profile_id,
                group_id=group_id,
                resource_id=resource_id,
                resource_type=resource_type,
                artifact_type="agent",  # Always "agent" for this handler
            )
            result = cast(
                GetAgentResourceIdsByGroupIdSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )
    except Exception as e:
        # SQL function raised error (validation failed) - emit error to client
        await sio.emit(
            "artifact_generation_error",
            {
                "artifact_type": "agent",
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
        "agent_generation_complete",
        {
            "artifact_type": "agent",
            "group_id": group_id_str,
            "resource_type": resource_type,
            "name_id": str(result.name_id) if result.name_id else None,
            "description_id": str(result.description_id)
            if result.description_id
            else None,
            "model_id": str(result.model_id) if result.model_id else None,
            "prompt_id": str(result.prompt_id) if result.prompt_id else None,
            "instructions_id": str(result.instructions_id)
            if result.instructions_id
            else None,
            "active_flag_id": str(result.active_flag_id)
            if result.active_flag_id
            else None,
            "department_ids": [str(did) for did in (result.department_ids or [])],
            "success": True,
            "message": f"{resource_type} generation completed successfully",
            "run_id": data.get("run_id"),
            "type": data.get("type", "complete"),
        },
        room=sid,
    )


@server_router.post("/agent_generation_complete")
async def agent_generation_complete_api(
    request: dict[str, Any],
) -> dict[str, bool]:
    """Server-to-client event: agent generation complete."""
    _ = request
    return {"ok": True}
