"""Profile completion handler - listens to resource_complete events and emits granular profile events."""

import uuid
from typing import Any, cast

from app.infra.v4.websocket.find_profile_by_socket import \
    find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.sql.types import (GetProfileResourceIdsByGroupIdSqlParams,
                           GetProfileResourceIdsByGroupIdSqlRow)
from fastapi import APIRouter
from app.utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/profile/get_profile_resource_ids_by_group_id_complete.sql"


@internal_sio.on("resource_complete")  # type: ignore
async def handle_profile_artifact_complete(data: dict[str, Any]) -> None:
    """Handle resource_complete internal event - filter by profile artifact_type and emit granular event."""
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
    resource_id_str = data.get("resource_id")
    resource_type = data.get("resource_type")

    if not group_id_str or not resource_type:
        return

    if not resource_id_str:
        await internal_sio.emit(
            "resource_error",
            {
                "sid": sid,
                "artifact_type": "profile",
                "group_id": group_id_str,
                "resource_type": resource_type,
                "error_message": f"Model generated text but did not call the {resource_type} creation tool. Expected a tool call to create a resource.",
                "trace_id": data.get("trace_id"),
            },
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
            "type": data.get("type", "run_complete"),
        },
        room=sid,
    )
