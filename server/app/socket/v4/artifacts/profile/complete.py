"""Profile completion handler - listens to generate_call_complete events and emits granular profile events."""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.sql.types import (
    GetProfileResourceIdsByGroupIdSqlParams,
    GetProfileResourceIdsByGroupIdSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = (
    "app/sql/v4/queries/profile/get_profile_resource_ids_by_group_id_complete.sql"
)


@internal_sio.on("generate_call_complete")  # type: ignore
async def handle_profile_artifact_complete(data: dict[str, Any]) -> None:
    """Handle generate_call_complete events - filter by profile artifact_type and emit granular event."""
    eval_mode = data.get("eval_mode", False)
    if eval_mode:
        return

    artifact_type = data.get("artifact_type")
    if artifact_type != "profile":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        return
    profile_id = uuid.UUID(profile_id_str)

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
            "profile_generation_error",
            {
                "artifact_type": "profile",
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

    try:
        async with get_db_connection() as conn:
            params = GetProfileResourceIdsByGroupIdSqlParams(
                profile_id=profile_id,
                group_id=group_id,
                resource_id=resource_id,
                resource_type=resource_type,
                artifact_type="profile",
            )
            result = cast(
                GetProfileResourceIdsByGroupIdSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )
    except Exception as e:
        await sio.emit(
            "artifact_generation_error",
            {
                "artifact_type": "profile",
                "resource_type": resource_type,
                "group_id": group_id_str,
                "success": False,
                "message": str(e),
            },
            room=sid,
        )
        return

    await sio.emit(
        "profile_generation_complete",
        {
            "artifact_type": "profile",
            "group_id": group_id_str,
            "resource_type": resource_type,
            "name_id": str(result.name_id) if result.name_id else None,
            "active_flag_id": str(result.active_flag_id)
            if result.active_flag_id
            else None,
            "request_limit_id": str(result.request_limit_id)
            if result.request_limit_id
            else None,
            "department_ids": [str(did) for did in (result.department_ids or [])],
            "email_ids": [str(eid) for eid in (result.email_ids or [])],
            "cohort_ids": [str(cid) for cid in (result.cohort_ids or [])],
            "route_ids": [str(rid) for rid in (result.route_ids or [])],
            "success": True,
            "message": f"{resource_type} generation completed successfully",
            "run_id": data.get("run_id"),
            "type": data.get("type", "complete"),
        },
        room=sid,
    )
