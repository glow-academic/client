"""Cohort error handler - listens to resource_error events and emits cohort-specific events."""

import uuid
from typing import Any, cast

from app.infra.v4.websocket.find_profile_by_socket import \
    find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.sql.types import (ValidateCohortResourceErrorSqlParams,
                           ValidateCohortResourceErrorSqlRow)
from fastapi import APIRouter
from utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/cohorts/validate_cohort_resource_error_complete.sql"


@internal_sio.on("resource_error")  # type: ignore
async def handle_cohorts_error(data: dict[str, Any]) -> None:
    """Handle resource_error event - filter by cohort artifact_type and emit cohort-specific event."""
    # Filter by artifact_type (SQL will also validate, but early return for efficiency)
    artifact_type = data.get("artifact_type")
    if artifact_type != "cohort":
        return  # Not for us

    sid = data.get("sid", "")
    if not sid:
        return  # No socket ID, can't emit to client

    # Get profile_id from sid
    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        return
    profile_id = uuid.UUID(profile_id_str)

    # Extract data from event
    group_id_str = data.get("group_id")
    resource_type = data.get("resource_type")
    resource_types = data.get("resource_types", [])

    if not group_id_str:
        return

    group_id = uuid.UUID(group_id_str)

    # Query SQL function - SQL handles validation (handles both resource_type and resource_types)
    try:
        async with get_db_connection() as conn:
            params = ValidateCohortResourceErrorSqlParams(
                profile_id=profile_id,
                group_id=group_id,
                resource_type=resource_type or "",  # SQL function expects non-null, empty string if None
                resource_types=resource_types or [],  # SQL function expects non-null array
                artifact_type="cohort",  # Always "cohort" for this handler
            )
            result = cast(
                ValidateCohortResourceErrorSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )
    except Exception:
        # SQL function raised error (validation failed) - return early
        return

    error_message = data.get("error_message") or data.get(
        "message", "An error occurred during cohort generation"
    )

    # Emit cohort-specific error event with all fields from internal event
    await sio.emit(
        "cohort_generation_error",
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
