"""Persona error handler - listens to generate_*_error events and emits persona-specific events."""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.persona.types import PersonaGenerationErrorEvent
from app.sql.types import (
    ValidatePersonaResourceErrorSqlParams,
    ValidatePersonaResourceErrorSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/persona_generation_error")
async def persona_generation_error_api(
    request: PersonaGenerationErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Persona generation error.

    Emitted when persona resource generation fails.
    """
    return {"success": True}

SQL_PATH = "app/sql/v4/queries/personas/validate_persona_resource_error_complete.sql"


@internal_sio.on("generate_call_error")  # type: ignore
@internal_sio.on("generate_text_error")  # type: ignore
async def handle_personas_error(data: dict[str, Any]) -> None:
    """Handle generate_*_error event - filter by persona artifact_type and emit persona-specific event."""
    # Filter by artifact_type (SQL will also validate, but early return for efficiency)
    artifact_type = data.get("artifact_type")
    if artifact_type != "persona":
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

    # SQL validation is optional - only validate if group_id is provided
    # We must always emit errors to the client, even without a group_id
    if group_id_str:
        try:
            group_id = uuid.UUID(group_id_str)
            async with get_db_connection() as conn:
                params = ValidatePersonaResourceErrorSqlParams(
                    profile_id=profile_id,
                    group_id=group_id,
                    resource_type=resource_type
                    or "",  # SQL function expects non-null, empty string if None
                    resource_types=resource_types
                    or [],  # SQL function expects non-null array
                    artifact_type="persona",  # Always "persona" for this handler
                )
                result = cast(
                    ValidatePersonaResourceErrorSqlRow,
                    await execute_sql_typed(conn, SQL_PATH, params=params),
                )
        except Exception:
            # SQL validation failed, but still emit error to client
            pass

    error_message = data.get("error_message") or data.get(
        "message", "An error occurred during persona generation"
    )

    # Emit persona-specific error event with all fields from internal event
    event = PersonaGenerationErrorEvent(
        artifact_type=artifact_type or "persona",
        group_id=data.get("group_id"),
        resource_type=resource_type,
        resource_types=resource_types if resource_types else None,
        resource_id=data.get("resource_id"),
        success=False,
        message=error_message,
        trace_id=data.get("trace_id"),
    )
    await sio.emit(
        "persona_generation_error",
        event.model_dump(mode="json"),
        room=sid,
    )
