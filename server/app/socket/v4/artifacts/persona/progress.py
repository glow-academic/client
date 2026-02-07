"""Persona progress handler - listens to generate_text_* events and emits persona-specific events."""

import uuid
from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.persona.types import PersonaGenerationProgressEvent
from app.sql.types import (
    ValidatePersonaResourceProgressSqlParams,
)
from app.utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/persona_generation_progress")
async def persona_generation_progress_api(
    request: PersonaGenerationProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Persona generation progress.

    Emitted during persona resource generation to show progress.
    """
    return {"success": True}


SQL_PATH = "app/sql/v4/queries/personas/validate_persona_resource_progress_complete.sql"


@internal_sio.on("generate_call_start")  # type: ignore
@internal_sio.on("generate_call_progress")  # type: ignore
@internal_sio.on("generate_text_start")  # type: ignore
@internal_sio.on("generate_text_progress")  # type: ignore
async def handle_personas_call_progress(data: dict[str, Any]) -> None:
    """Handle generate_call_* events - filter by persona artifact_type and emit persona-specific event."""
    artifact_type = data.get("artifact_type")
    if artifact_type != "persona":
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
    if not group_id_str or not resource_type:
        return

    group_id = uuid.UUID(group_id_str)

    try:
        async with get_db_connection() as conn:
            params = ValidatePersonaResourceProgressSqlParams(
                profile_id=profile_id,
                group_id=group_id,
                resource_type=resource_type,
                artifact_type="persona",
            )
            await execute_sql_typed(conn, SQL_PATH, params=params)
    except Exception:
        return

    event = PersonaGenerationProgressEvent(
        artifact_type=artifact_type or "persona",
        group_id=data.get("group_id"),
        resource_type=resource_type,
        resource_id=data.get("resource_id"),
        run_id=data.get("run_id"),
        modality="call",
        type=data.get("type", "progress"),
        event_type=data.get("event_type"),
        tool_call_id=data.get("tool_call_id"),
        tool_name=data.get("tool_name"),
        arguments=data.get("arguments"),
        arguments_delta=data.get("arguments_delta"),
        trace_id=data.get("trace_id"),
    )
    await sio.emit(
        "persona_generation_progress",
        event.model_dump(mode="json"),
        room=sid,
    )
