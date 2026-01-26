"""Profile error handler - listens to generate_*_error events and emits profile-specific events."""

import uuid
from typing import Any, cast

from app.infra.v4.websocket.find_profile_by_socket import \
    find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.sql.types import (ValidateProfileResourceErrorSqlParams,
                           ValidateProfileResourceErrorSqlRow)
from fastapi import APIRouter
from app.utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/queries/profile/validate_profile_resource_error_complete.sql"


@internal_sio.on("generate_call_error")  # type: ignore
async def handle_profiles_error(data: dict[str, Any]) -> None:
    """Handle generate_*_error event - filter by profile artifact_type and emit profile-specific event."""
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
    resource_type = data.get("resource_type")
    resource_types = data.get("resource_types", [])

    # SQL validation is optional - only validate if group_id is provided
    # We must always emit errors to the client, even without a group_id
    if group_id_str:
        try:
            group_id = uuid.UUID(group_id_str)
            async with get_db_connection() as conn:
                params = ValidateProfileResourceErrorSqlParams(
                    profile_id=profile_id,
                    group_id=group_id,
                    resource_type=resource_type or "",
                    resource_types=resource_types or [],
                    artifact_type="profile",
                )
                result = cast(
                    ValidateProfileResourceErrorSqlRow,
                    await execute_sql_typed(conn, SQL_PATH, params=params),
                )
        except Exception:
            # SQL validation failed, but still emit error to client
            pass

    error_message = data.get("error_message") or data.get(
        "message", "An error occurred during profile generation"
    )

    await sio.emit(
        "profile_generation_error",
        {
            "artifact_type": artifact_type,
            "resource_type": resource_type,
            "resource_types": resource_types if resource_types else None,
            "resource_id": data.get("resource_id"),
            "group_id": data.get("group_id"),
            "success": False,
            "message": error_message,
            "trace_id": data.get("trace_id"),
        },
        room=sid,
    )
