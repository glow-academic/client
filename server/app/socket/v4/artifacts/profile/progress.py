"""Profile progress handler - listens to resource_progress events and emits profile-specific events."""

import uuid
from typing import Any, cast

from app.infra.v4.websocket.find_profile_by_socket import \
    find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.sql.types import (ValidateProfileResourceProgressSqlParams,
                           ValidateProfileResourceProgressSqlRow)
from fastapi import APIRouter
from app.utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/profile/validate_profile_resource_progress_complete.sql"


@internal_sio.on("resource_progress")  # type: ignore
async def handle_profiles_progress(data: dict[str, Any]) -> None:
    """Handle resource_progress internal event - filter by profile artifact_type and emit profile-specific event."""
    artifact_type = data.get("artifact_type")
    if artifact_type != "profile":
        return  # Not for us

    sid = data.get("sid", "")
    if not sid:
        return  # No socket ID, can't emit to client

    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        return
    profile_id = uuid.UUID(profile_id_str)

    group_id_str = data.get("group_id")
    resource_type = data.get("resource_type")

    if not group_id_str or not resource_type:
        return

    group_id = uuid.UUID(group_id_str)

    try:
        async with get_db_connection() as conn:
            params = ValidateProfileResourceProgressSqlParams(
                profile_id=profile_id,
                group_id=group_id,
                resource_type=resource_type,
                artifact_type="profile",
            )
            result = cast(
                ValidateProfileResourceProgressSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )
    except Exception:
        return

    await sio.emit(
        "profile_generation_progress",
        {
            "modality": data.get("modality", "text"),
            "artifact_type": artifact_type,
            "resource_type": resource_type,
            "resource_id": data.get("resource_id"),
            "run_id": data.get("run_id"),
            "group_id": data.get("group_id"),
            "type": data.get("type", "progress"),
            "message": data.get("message", "Processing..."),
            "text": data.get("text"),
            "tool_call_id": data.get("tool_call_id"),
            "tool_name": data.get("tool_name"),
            "arguments": data.get("arguments"),
            "arguments_delta": data.get("arguments_delta"),
            "status": data.get("status"),
            "progress": data.get("progress"),
            "ephemeral_key": data.get("ephemeral_key"),
            "expires_in": data.get("expires_in"),
            "model": data.get("model"),
            "trace_id": data.get("trace_id"),
            "item_id": data.get("item_id"),
            "audio_start_ms": data.get("audio_start_ms"),
            "transcript": data.get("transcript"),
            "response_id": data.get("response_id"),
            "output_type": data.get("output_type"),
            "audio": data.get("audio"),
            "call_id": data.get("call_id"),
            "function_call": data.get("function_call"),
        },
        room=sid,
    )
